import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
  PoseLandmarker,
  type GestureRecognizerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { detectAllKeys, pickPrimaryKey, type DetectionScope } from '@/lib/gestures/mapping';
import { DUO_PLAYER_COUNT, POSE_LANDMARKER_NUM_POSES } from '@/lib/gestures/duoConstants';
import { detectDuoPoseLandmarks } from '@/lib/gestures/poseRegionDetection';
import { computeDuoHandMetrics, type DuoHandMetrics } from '@/lib/gestures/duoHandMetrics';
import {
  MultiHandLandmarkSmoother,
  MultiPoseLandmarkSmoother,
  DEFAULT_LANDMARK_SMOOTHER_OPTIONS,
} from '@/lib/gestures/landmarkSmoothing';
import {
  MultiFaceBlendshapeSmoother,
  DEFAULT_FACE_BLENDSHAPE_SMOOTHER_OPTIONS,
} from '@/lib/gestures/faceBlendshapeSmoothing';
import { GestureKeyStabilizer } from '@/lib/gestures/gestureStabilizer';
import { DetectedKeysHold } from '@/lib/gestures/detectedKeysHold';
import {
  EMPTY_HAND_CURSOR,
  landmarkToNormalizedCursor,
  pickHandCursorLandmark,
  type NormalizedHandCursor,
} from '@/lib/gestures/handCursor';
import { translate } from '@/i18n/translations';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Language } from '@/i18n/types';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const CAMERA_RETRIES = 3;
const FRAME_MS = 33;

export type GestureRecognizerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface GestureFrame {
  gestureKey: string | null;
  detectedKeys: string[];
  mpCategory: string | null;
  score: number;
  duoMetrics: DuoHandMetrics | null;
}

interface GestureRecognizerContextValue {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  handCursorRef: RefObject<NormalizedHandCursor>;
  detectedKeysRef: RefObject<string[]>;
  setActive: (consumerId: string, active: boolean) => void;
  setDetectionScope: (scope: DetectionScope) => void;
  ensureCamera: () => Promise<void>;
  status: GestureRecognizerStatus;
  bootStatus: GestureRecognizerStatus;
  error: string | null;
  frame: GestureFrame;
}

const GestureRecognizerContext = createContext<GestureRecognizerContextValue | null>(null);

const EMPTY_FRAME: GestureFrame = {
  gestureKey: null,
  detectedKeys: [],
  mpCategory: null,
  score: 0,
  duoMetrics: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isCameraTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('timeout') && msg.includes('video');
}

function mapCameraError(err: unknown, lang: Language): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return translate(lang, 'cameraDenied');
  }
  if (isCameraTimeoutError(err)) {
    return translate(lang, 'cameraTimeout');
  }
  if (err instanceof Error) return err.message;
  return translate(lang, 'gestureBootFailed');
}

function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null,
  attempts = 120,
): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    let remaining = attempts;

    const tryResolve = () => {
      const video = getVideo();
      if (video) {
        resolve(video);
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        reject(new Error('Video element missing'));
        return;
      }
      requestAnimationFrame(tryResolve);
    };

    tryResolve();
  });
}

function hasVideoFrames(video: HTMLVideoElement): boolean {
  return video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

function isStreamLive(stream: MediaStream | null): boolean {
  return stream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;
}

function isCameraHealthy(
  video: HTMLVideoElement | null,
  stream: MediaStream | null,
): boolean {
  if (!video || !stream || !isStreamLive(stream)) return false;
  if (!hasVideoFrames(video)) return false;
  return !video.paused && !video.ended;
}

function waitForVideoFrames(video: HTMLVideoElement, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + timeoutMs;

    const check = () => {
      if (hasVideoFrames(video)) {
        resolve();
        return;
      }
      if (performance.now() >= deadline) {
        reject(new Error('Timeout starting video source'));
        return;
      }
      requestAnimationFrame(check);
    };

    check();
  });
}

async function acquireCameraStream(stopExisting: () => void): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API unavailable');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < CAMERA_RETRIES; attempt += 1) {
    try {
      if (attempt > 0) stopExisting();
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err) {
      lastError = err;
      if (attempt >= CAMERA_RETRIES - 1) break;
      await sleep(400 * (attempt + 1));
    }
  }

  throw lastError;
}

export function GesturePreviewCanvas() {
  const { canvasRef } = useGestureRecognizerContext();
  return <canvas ref={canvasRef} className="gesture-canvas" aria-hidden="true" />;
}

export function GestureRecognizerProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseCropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const lastMpTimestampRef = useRef(0);

  const nextMediaPipeTimestamp = useCallback((): number => {
    const ts = lastMpTimestampRef.current + FRAME_MS;
    lastMpTimestampRef.current = ts;
    return ts;
  }, []);
  const streamRef = useRef<MediaStream | null>(null);
  const activeConsumersRef = useRef(new Set<string>());
  const handCursorRef = useRef<NormalizedHandCursor>(EMPTY_HAND_CURSOR);
  const detectedKeysRef = useRef<string[]>([]);
  const modelReadyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const cameraBootRef = useRef<Promise<void> | null>(null);
  const bootSessionRef = useRef(0);
  const handLandmarkSmootherRef = useRef(new MultiHandLandmarkSmoother(DEFAULT_LANDMARK_SMOOTHER_OPTIONS));
  const poseLandmarkSmootherRef = useRef(new MultiPoseLandmarkSmoother());
  const faceBlendshapeSmootherRef = useRef(
    new MultiFaceBlendshapeSmoother(DEFAULT_FACE_BLENDSHAPE_SMOOTHER_OPTIONS),
  );
  const gestureStabilizerRef = useRef(new GestureKeyStabilizer());
  const detectedKeysHoldRef = useRef(new DetectedKeysHold(600));
  const detectionScopeRef = useRef<DetectionScope>('full');

  const [bootStatus, setBootStatus] = useState<GestureRecognizerStatus>('idle');
  const [runtimeStatus, setRuntimeStatus] = useState<GestureRecognizerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<GestureFrame>(EMPTY_FRAME);

  const isRecognizerActive = useCallback(
    () => activeConsumersRef.current.size > 0,
    [],
  );

  const syncRuntimeStatus = useCallback(() => {
    const active = isRecognizerActive();
    if (!modelReadyRef.current) {
      setRuntimeStatus('loading');
      return;
    }
    if (cameraBootRef.current && !cameraReadyRef.current) {
      setRuntimeStatus('loading');
      return;
    }
    if (!cameraReadyRef.current) {
      setRuntimeStatus(active ? 'loading' : 'ready');
      return;
    }
    setRuntimeStatus(active ? 'running' : 'ready');
  }, [isRecognizerActive]);

  const resetTrackingState = useCallback(() => {
    handLandmarkSmootherRef.current.reset();
    poseLandmarkSmootherRef.current.reset();
    faceBlendshapeSmootherRef.current.reset();
    gestureStabilizerRef.current.reset();
    detectedKeysHoldRef.current.reset();
    lastVideoTimeRef.current = -1;
    handCursorRef.current = EMPTY_HAND_CURSOR;
    // Keep frameIndexRef monotonic — MediaPipe VIDEO mode rejects timestamp resets.
    setFrame(EMPTY_FRAME);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cameraReadyRef.current = false;
    cameraBootRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.load();
    }
  }, []);

  const attachStreamHandlers = useCallback(
    (stream: MediaStream) => {
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (!cameraReadyRef.current) return;
          stopCamera();
          setRuntimeStatus(isRecognizerActive() ? 'error' : 'ready');
          setError(translate(languageRef.current, 'cameraTimeout'));
        };
      });
    },
    [stopCamera],
  );

  const startCamera = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (cameraReadyRef.current && isCameraHealthy(video, streamRef.current)) {
      syncRuntimeStatus();
      return;
    }
    if (cameraReadyRef.current) {
      stopCamera();
    }
    if (cameraBootRef.current) return cameraBootRef.current;

    const session = bootSessionRef.current;
    setRuntimeStatus('loading');
    setError(null);

    cameraBootRef.current = (async () => {
      try {
        if (!modelReadyRef.current || !recognizerRef.current) {
          throw new Error(translate(languageRef.current, 'gestureBootFailed'));
        }

        if (streamRef.current && !cameraReadyRef.current) {
          stopCamera();
        }

        const stream = await acquireCameraStream(stopCamera);
        if (session !== bootSessionRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = await waitForVideoElement(() => videoRef.current);
        if (session !== bootSessionRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        attachStreamHandlers(stream);
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();
        await waitForVideoFrames(video);

        if (session !== bootSessionRef.current) {
          stopCamera();
          return;
        }

        cameraReadyRef.current = true;
        setError(null);
        syncRuntimeStatus();
      } catch (err) {
        if (session !== bootSessionRef.current) return;
        stopCamera();
        setError(mapCameraError(err, languageRef.current));
        setRuntimeStatus('error');
        throw err;
      } finally {
        if (session === bootSessionRef.current) {
          cameraBootRef.current = null;
        }
      }
    })();

    return cameraBootRef.current;
  }, [attachStreamHandlers, stopCamera, syncRuntimeStatus]);

  const ensureCamera = useCallback(async () => {
    const video = videoRef.current;
    if (cameraReadyRef.current && isCameraHealthy(video, streamRef.current)) {
      setError(null);
      syncRuntimeStatus();
      return;
    }
    if (cameraReadyRef.current) {
      stopCamera();
    }

    if (cameraBootRef.current) {
      setRuntimeStatus('loading');
      try {
        await cameraBootRef.current;
        syncRuntimeStatus();
      } catch {
        /* error already set in startCamera */
      }
      return;
    }

    setRuntimeStatus('loading');
    setError(null);
    try {
      await startCamera();
      syncRuntimeStatus();
    } catch {
      /* error already set in startCamera */
    }
  }, [startCamera, stopCamera, syncRuntimeStatus]);

  const setDetectionScope = useCallback((scope: DetectionScope) => {
    if (detectionScopeRef.current === scope) return;
    detectionScopeRef.current = scope;
    gestureStabilizerRef.current.reset();
    detectedKeysHoldRef.current.reset();
  }, []);

  const setActive = useCallback(
    (consumerId: string, active: boolean) => {
      const wasActive = isRecognizerActive();
      if (active) activeConsumersRef.current.add(consumerId);
      else activeConsumersRef.current.delete(consumerId);
      if (!wasActive && isRecognizerActive()) {
        resetTrackingState();
      }
      if (wasActive && !isRecognizerActive()) {
        handCursorRef.current = EMPTY_HAND_CURSOR;
      }
      syncRuntimeStatus();
    },
    [isRecognizerActive, resetTrackingState, syncRuntimeStatus],
  );

  useEffect(() => {
    const session = ++bootSessionRef.current;
    let cancelled = false;

    function drawPreview(
      handLandmarks: NormalizedLandmark[][],
      poseLandmarks: NormalizedLandmark[][],
      video: HTMLVideoElement,
    ) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      for (const pose of poseLandmarks) {
        ctx.fillStyle = '#6eb5ff';
        for (const p of pose) {
          if ((p.visibility ?? 1) < 0.4) continue;
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const hand of handLandmarks) {
        ctx.fillStyle = '#7dff9a';
        for (const p of hand) {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function processResult(
      result: GestureRecognizerResult,
      smoothedHandLandmarks: NormalizedLandmark[][],
      poseLandmarks: NormalizedLandmark[][],
      faceLandmarks: NormalizedLandmark[][],
      faceBlendshapes: ReturnType<FaceLandmarker['detectForVideo']>['faceBlendshapes'] | undefined,
    ) {
      const top = result.gestures?.[0]?.[0];
      const mpCategory = top?.categoryName && top.categoryName !== 'None' ? top.categoryName : null;
      const handCategories = (result.gestures ?? []).map((g) => g?.[0]?.categoryName);

      const rawKeys = detectAllKeys(
        {
          handLandmarks: smoothedHandLandmarks,
          handCategories,
          poseLandmarks,
          faceLandmarks,
          faceBlendshapes,
        },
        detectionScopeRef.current,
      );
      const rawPrimary = pickPrimaryKey(rawKeys);
      const gestureKey = gestureStabilizerRef.current.update(rawPrimary);
      const stabilizedKeys = detectedKeysHoldRef.current.update(rawKeys, performance.now());

      detectedKeysRef.current = stabilizedKeys;
      setFrame({
        gestureKey,
        detectedKeys: stabilizedKeys,
        mpCategory,
        score: top?.score ?? 0,
        duoMetrics: computeDuoHandMetrics(smoothedHandLandmarks, poseLandmarks, faceLandmarks),
      });
    }

    function loop() {
      const video = videoRef.current;
      const recognizer = recognizerRef.current;
      const poseLandmarker = poseLandmarkerRef.current;
      const faceLandmarker = faceLandmarkerRef.current;

      if (
        video &&
        recognizer &&
        poseLandmarker &&
        faceLandmarker &&
        isRecognizerActive() &&
        cameraReadyRef.current &&
        hasVideoFrames(video) &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime;
        try {
          const timestamp = nextMediaPipeTimestamp();
          const result = recognizer.recognizeForVideo(video, timestamp);
          const rawLandmarks = result.landmarks ?? [];

          let smoothedHandLandmarks = rawLandmarks;
          if (rawLandmarks.length > 0) {
            smoothedHandLandmarks = handLandmarkSmootherRef.current.smooth(rawLandmarks, timestamp);
          } else {
            handLandmarkSmootherRef.current.reset();
          }

          const faceResult = faceLandmarker.detectForVideo(video, timestamp);
          const rawFaceLandmarks = faceResult.faceLandmarks ?? [];

          if (!poseCropCanvasRef.current) {
            poseCropCanvasRef.current = document.createElement('canvas');
          }

          const rawPoseLandmarks = detectDuoPoseLandmarks(
            poseLandmarker,
            video,
            timestamp,
            rawFaceLandmarks,
            poseCropCanvasRef.current,
            nextMediaPipeTimestamp,
          );
          const smoothedFaceBlendshapes = faceBlendshapeSmootherRef.current.smooth(
            faceResult.faceBlendshapes,
            timestamp,
          );

          let smoothedPoseLandmarks = rawPoseLandmarks;
          if (rawPoseLandmarks.length > 0) {
            smoothedPoseLandmarks = poseLandmarkSmootherRef.current.smooth(rawPoseLandmarks, timestamp);
          } else {
            poseLandmarkSmootherRef.current.reset();
          }

          if (rawLandmarks.length === 0 && rawPoseLandmarks.length === 0) {
            gestureStabilizerRef.current.reset();
    detectedKeysHoldRef.current.reset();
          }

          const cursorLandmark = pickHandCursorLandmark(smoothedHandLandmarks);
          handCursorRef.current = cursorLandmark
            ? landmarkToNormalizedCursor(cursorLandmark)
            : EMPTY_HAND_CURSOR;

          processResult(
            result,
            smoothedHandLandmarks,
            smoothedPoseLandmarks,
            rawFaceLandmarks,
            smoothedFaceBlendshapes,
          );
          drawPreview(smoothedHandLandmarks, smoothedPoseLandmarks, video);
        } catch (err) {
          console.warn('Gesture recognition frame failed:', err);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    async function bootModel() {
      setBootStatus('loading');
      setRuntimeStatus('loading');
      setError(null);

      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled || session !== bootSessionRef.current) return;

        const visionOptions = { baseOptions: { delegate: 'GPU' as const } };
        let recognizer: GestureRecognizer;
        let poseLandmarker: PoseLandmarker;
        let faceLandmarker: FaceLandmarker;

        try {
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 4,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.6,
          });
          poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            ...visionOptions,
            baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: POSE_LANDMARKER_NUM_POSES,
            minPoseDetectionConfidence: 0.2,
            minPosePresenceConfidence: 0.2,
            minTrackingConfidence: 0.2,
          });
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            ...visionOptions,
            baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numFaces: DUO_PLAYER_COUNT,
            outputFaceBlendshapes: true,
          });
        } catch {
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 4,
          });
          poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: POSE_LANDMARKER_NUM_POSES,
            minPoseDetectionConfidence: 0.2,
            minPosePresenceConfidence: 0.2,
            minTrackingConfidence: 0.2,
          });
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numFaces: DUO_PLAYER_COUNT,
            outputFaceBlendshapes: true,
          });
        }

        if (cancelled || session !== bootSessionRef.current) {
          recognizer.close();
          poseLandmarker.close();
          faceLandmarker.close();
          return;
        }

        recognizerRef.current = recognizer;
        poseLandmarkerRef.current = poseLandmarker;
        faceLandmarkerRef.current = faceLandmarker;
        modelReadyRef.current = true;
        setBootStatus('ready');
        setRuntimeStatus('ready');
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled || session !== bootSessionRef.current) return;
        const msg =
          err instanceof Error ? err.message : translate(languageRef.current, 'gestureBootFailed');
        setError(msg);
        setBootStatus('error');
        setRuntimeStatus('error');
      }
    }

    void bootModel();

    return () => {
      cancelled = true;
      bootSessionRef.current += 1;
      cancelAnimationFrame(rafRef.current);
      stopCamera();
      recognizerRef.current?.close();
      poseLandmarkerRef.current?.close();
      faceLandmarkerRef.current?.close();
      recognizerRef.current = null;
      poseLandmarkerRef.current = null;
      faceLandmarkerRef.current = null;
      modelReadyRef.current = false;
      handLandmarkSmootherRef.current.reset();
      poseLandmarkSmootherRef.current.reset();
      faceBlendshapeSmootherRef.current.reset();
      gestureStabilizerRef.current.reset();
    detectedKeysHoldRef.current.reset();
      lastVideoTimeRef.current = -1;
      lastMpTimestampRef.current = 0;
      handCursorRef.current = EMPTY_HAND_CURSOR;
      detectedKeysRef.current = [];
      detectedKeysHoldRef.current.reset();
      activeConsumersRef.current.clear();
      setFrame(EMPTY_FRAME);
      setBootStatus('idle');
      setRuntimeStatus('idle');
    };
  }, [stopCamera]);

  const status = runtimeStatus === 'idle' && bootStatus !== 'idle' ? bootStatus : runtimeStatus;

  const value: GestureRecognizerContextValue = {
    videoRef,
    canvasRef,
    handCursorRef,
    detectedKeysRef,
    setActive,
    setDetectionScope,
    ensureCamera,
    status,
    bootStatus,
    error,
    frame,
  };

  return (
    <GestureRecognizerContext.Provider value={value}>
      <div className="gesture-recognizer-hidden-video" aria-hidden="true">
        <video ref={videoRef} className="gesture-video" muted playsInline autoPlay />
      </div>
      {children}
    </GestureRecognizerContext.Provider>
  );
}

export function useGestureRecognizerContext() {
  const ctx = useContext(GestureRecognizerContext);
  if (!ctx) {
    throw new Error('useGestureRecognizerContext must be used within GestureRecognizerProvider');
  }
  return ctx;
}

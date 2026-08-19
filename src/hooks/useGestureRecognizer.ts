import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { resolveGestureKey } from '@/lib/gestures/mapping';
import { MultiHandLandmarkSmoother, DEFAULT_LANDMARK_SMOOTHER_OPTIONS } from '@/lib/gestures/landmarkSmoothing';
import { GestureKeyStabilizer } from '@/lib/gestures/gestureStabilizer';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export type GestureRecognizerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface GestureFrame {
  gestureKey: string | null;
  mpCategory: string | null;
  score: number;
}

export function useGestureRecognizer(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkSmootherRef = useRef(new MultiHandLandmarkSmoother(DEFAULT_LANDMARK_SMOOTHER_OPTIONS));
  const gestureStabilizerRef = useRef(new GestureKeyStabilizer());

  const [status, setStatus] = useState<GestureRecognizerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<GestureFrame>({
    gestureKey: null,
    mpCategory: null,
    score: 0,
  });

  const drawPreview = useCallback(
    (landmarks: NormalizedLandmark[][], video: HTMLVideoElement) => {
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

      for (const hand of landmarks) {
        ctx.fillStyle = '#7dff9a';
        for (const p of hand) {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [],
  );

  const processResult = useCallback(
    (result: GestureRecognizerResult, smoothedLandmarks: NormalizedLandmark[][]) => {
      const top = result.gestures?.[0]?.[0];
      const mpCategory = top?.categoryName && top.categoryName !== 'None' ? top.categoryName : null;
      const landmarks = smoothedLandmarks[0];
      const rawGestureKey = resolveGestureKey(mpCategory ?? undefined, landmarks);
      const gestureKey = gestureStabilizerRef.current.update(rawGestureKey);
      setFrame({
        gestureKey,
        mpCategory,
        score: top?.score ?? 0,
      });
    },
    [],
  );

  const loop = useCallback(() => {
    const video = videoRef.current;
    const recognizer = recognizerRef.current;
    if (!video || !recognizer || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const timestamp = performance.now();
      const result = recognizer.recognizeForVideo(video, timestamp);
      const rawLandmarks = result.landmarks ?? [];
      let smoothedLandmarks = rawLandmarks;
      if (rawLandmarks.length > 0) {
        smoothedLandmarks = landmarkSmootherRef.current.smooth(rawLandmarks, timestamp);
      } else {
        landmarkSmootherRef.current.reset();
        gestureStabilizerRef.current.reset();
      }
      processResult(result, smoothedLandmarks);
      drawPreview(smoothedLandmarks, video);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [drawPreview, processResult]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function boot() {
      setStatus('loading');
      setError(null);

      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        let recognizer: GestureRecognizer;
        try {
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.6,
          });
        } catch {
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 2,
          });
        }

        if (cancelled) {
          recognizer.close();
          return;
        }

        recognizerRef.current = recognizer;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          recognizer.close();
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error('Video element missing');

        video.srcObject = stream;
        await video.play();

        setStatus('running');
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? '摄像头权限被拒绝，请在浏览器设置中允许访问。'
            : err instanceof Error
              ? err.message
              : '手势识别启动失败';
        setError(msg);
        setStatus('error');
      }
    }

    void boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recognizerRef.current?.close();
      recognizerRef.current = null;
      landmarkSmootherRef.current.reset();
      gestureStabilizerRef.current.reset();
      lastVideoTimeRef.current = -1;
      setStatus('idle');
      setFrame({ gestureKey: null, mpCategory: null, score: 0 });
    };
  }, [active, loop]);

  return { videoRef, canvasRef, status, error, frame };
}

import type { PoseLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { dist, mid } from '@/lib/gestures/geometry';
import { DUO_PLAYER_COUNT } from '@/lib/gestures/duoConstants';

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const POSE = { lShoulder: 11, rShoulder: 12, nose: 0 } as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function poseTorsoMid(pose: NormalizedLandmark[]): NormalizedLandmark | null {
  if (pose.length < 13) return null;
  const ls = pose[POSE.lShoulder];
  const rs = pose[POSE.rShoulder];
  if ((ls.visibility ?? 1) < 0.15 && (rs.visibility ?? 1) < 0.15) {
    if ((pose[POSE.nose].visibility ?? 1) >= 0.15) return pose[POSE.nose];
    return null;
  }
  return mid(ls, rs);
}

export function faceCenterNormalized(face: NormalizedLandmark[]): NormalizedLandmark {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const point of face) {
    if ((point.visibility ?? 1) < 0.15) continue;
    x += point.x;
    y += point.y;
    n += 1;
  }
  if (n === 0) return face[0] ?? { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  return { x: x / n, y: y / n, z: 0, visibility: 1 };
}

export function buildPersonCropFromFace(face: NormalizedLandmark[]): NormalizedRect {
  const center = faceCenterNormalized(face);
  const width = 0.46;
  const height = 0.94;
  const x = clamp01(center.x - width * 0.5);
  const y = clamp01(center.y - 0.2);
  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
  };
}

const SIDE_BY_SIDE_CROPS: NormalizedRect[] = [
  { x: 0, y: 0, width: 0.54, height: 1 },
  { x: 0.46, y: 0, width: 0.54, height: 1 },
];

export function cropVideoToCanvas(
  video: HTMLVideoElement,
  rect: NormalizedRect,
  canvas: HTMLCanvasElement,
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sx = Math.round(rect.x * vw);
  const sy = Math.round(rect.y * vh);
  const sw = Math.max(1, Math.round(rect.width * vw));
  const sh = Math.max(1, Math.round(rect.height * vh));

  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
}

export function mapLandmarksFromCrop(
  landmarks: NormalizedLandmark[],
  rect: NormalizedRect,
): NormalizedLandmark[] {
  return landmarks.map((point) => ({
    ...point,
    x: rect.x + point.x * rect.width,
    y: rect.y + point.y * rect.height,
  }));
}

export function mergePoseTracks(
  tracks: NormalizedLandmark[][],
  maxTracks = DUO_PLAYER_COUNT,
): NormalizedLandmark[][] {
  const merged: NormalizedLandmark[][] = [];

  for (const pose of tracks) {
    const torso = poseTorsoMid(pose);
    if (!torso) continue;

    const duplicate = merged.some((existing) => {
      const existingTorso = poseTorsoMid(existing);
      return existingTorso !== null && dist(torso, existingTorso) < 0.1;
    });
    if (duplicate) continue;

    merged.push(pose);
    if (merged.length >= maxTracks) break;
  }

  return merged.sort((a, b) => {
    const ax = poseTorsoMid(a)?.x ?? 0;
    const bx = poseTorsoMid(b)?.x ?? 0;
    return ax - bx;
  });
}

/**
 * BlazePose often returns one track when two people stand side-by-side even with numPoses=2.
 * Supplement with per-person video crops (from face position, or left/right halves).
 */
export function detectDuoPoseLandmarks(
  poseLandmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestamp: number,
  faceLandmarks: NormalizedLandmark[][],
  cropCanvas: HTMLCanvasElement,
  nextTimestamp: () => number,
): NormalizedLandmark[][] {
  const fullResult = poseLandmarker.detectForVideo(video, timestamp);
  const tracks: NormalizedLandmark[][] = [...(fullResult.landmarks ?? [])];

  if (tracks.length >= DUO_PLAYER_COUNT) {
    return mergePoseTracks(tracks);
  }

  const sortedFaces = [...faceLandmarks]
    .sort((a, b) => faceCenterNormalized(a).x - faceCenterNormalized(b).x)
    .slice(0, DUO_PLAYER_COUNT);

  const cropRects =
    sortedFaces.length >= DUO_PLAYER_COUNT
      ? sortedFaces.map(buildPersonCropFromFace)
      : SIDE_BY_SIDE_CROPS;

  for (const rect of cropRects) {
    if (tracks.length >= DUO_PLAYER_COUNT) break;
    cropVideoToCanvas(video, rect, cropCanvas);
    const cropResult = poseLandmarker.detectForVideo(cropCanvas, nextTimestamp());
    const pose = cropResult.landmarks?.[0];
    if (pose) tracks.push(mapLandmarksFromCrop(pose, rect));
  }

  return mergePoseTracks(tracks);
}

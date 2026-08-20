import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function mid(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

export function visible(lm: NormalizedLandmark, min = 0.5): boolean {
  return (lm.visibility ?? 1) >= min;
}

export function allVisible(lms: NormalizedLandmark[], indices: number[], min = 0.45): boolean {
  return indices.every((i) => visible(lms[i], min));
}

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/** MediaPipe canned gesture names → our levels.json gestureKey values */
export const MEDIAPIPE_TO_GESTURE_KEY: Record<string, string> = {
  Thumb_Up: 'thumb_up',
  Victory: 'two_fingers',
};

export const CUSTOM_GESTURE_KEYS = new Set([
  'half_thumb_up',
  'point_diagonal_down',
  'point_to_other',
]);

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function isFingerExtended(
  lm: NormalizedLandmark[],
  tip: number,
  pip: number,
  mcp: number,
): boolean {
  const tipToWrist = dist(lm[tip], lm[0]);
  const pipToWrist = dist(lm[pip], lm[0]);
  const mcpToWrist = dist(lm[mcp], lm[0]);
  return tipToWrist > pipToWrist * 1.05 && pipToWrist > mcpToWrist * 0.92;
}

function curledFingers(lm: NormalizedLandmark[], tips: number[], pips: number[], mcps: number[]): boolean {
  return tips.every((tip, i) => !isFingerExtended(lm, tip, pips[i], mcps[i]));
}

export function detectCustomGestureKey(landmarks: NormalizedLandmark[]): string | null {
  if (landmarks.length < 21) return null;

  const indexExtended = isFingerExtended(landmarks, 8, 6, 5);
  const middleExtended = isFingerExtended(landmarks, 12, 10, 9);
  const thumbExtended = isFingerExtended(landmarks, 4, 3, 2);
  const othersCurled = curledFingers(
    landmarks,
    [12, 16, 20],
    [10, 14, 18],
    [9, 13, 17],
  );

  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];

  if (indexExtended && !middleExtended && othersCurled) {
    const dx = indexTip.x - wrist.x;
    const dy = indexTip.y - wrist.y;
    if (Math.abs(dx) > 0.12 && Math.abs(dy) < Math.abs(dx) * 0.85) {
      return 'point_to_other';
    }
    if (dy > 0.08 && Math.abs(dx) < 0.1) {
      return 'point_diagonal_down';
    }
  }

  if (thumbExtended && !indexExtended && curledFingers(landmarks, [8, 12, 16, 20], [6, 10, 14, 18], [5, 9, 13, 17])) {
    const thumbReach = dist(thumbTip, wrist);
    const indexReach = dist(landmarks[8], wrist);
    if (thumbReach > indexReach * 0.55 && thumbReach < indexReach * 1.15) {
      return 'half_thumb_up';
    }
  }

  return null;
}

export function resolveGestureKey(
  mpCategory: string | undefined,
  landmarks: NormalizedLandmark[] | undefined,
): string | null {
  if (landmarks?.length) {
    const custom = detectCustomGestureKey(landmarks);
    if (custom) return custom;
  }

  if (mpCategory && mpCategory !== 'None' && MEDIAPIPE_TO_GESTURE_KEY[mpCategory]) {
    return MEDIAPIPE_TO_GESTURE_KEY[mpCategory];
  }

  return null;
}

export function gestureKeyMatches(expectedKey: string, detectedKey: string | null): boolean {
  if (!detectedKey) return false;
  return expectedKey === detectedKey;
}

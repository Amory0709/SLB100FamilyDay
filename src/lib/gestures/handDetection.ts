import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { dist, mid } from '@/lib/gestures/geometry';

const POSE = {
  lShoulder: 11,
  rShoulder: 12,
} as const;

/** MediaPipe canned gesture names → our levels.json gestureKey values */
export const MEDIAPIPE_TO_GESTURE_KEY: Record<string, string> = {
  Thumb_Up: 'thumb_up',
  Victory: 'two_fingers',
};

export const CUSTOM_GESTURE_KEYS = new Set([
  'half_thumb_up',
  'point_diagonal_down',
  'point_to_other',
  'double_thumb_up',
  'double_thumb_up_duo',
]);

function isFingerExtended(
  lm: NormalizedLandmark[],
  tip: number,
  pip: number,
  mcp: number,
): boolean {
  const tipToWrist = dist(lm[tip], lm[0]);
  const pipToWrist = dist(lm[pip], lm[0]);
  const mcpToWrist = dist(lm[mcp], lm[0]);
  return tipToWrist > pipToWrist * 1.02 && pipToWrist > mcpToWrist * 0.88;
}

function curledFingers(
  lm: NormalizedLandmark[],
  tips: number[],
  pips: number[],
  mcps: number[],
): boolean {
  return tips.every((tip, i) => !isFingerExtended(lm, tip, pips[i], mcps[i]));
}

function isThumbUp(landmarks: NormalizedLandmark[]): boolean {
  if (landmarks.length < 21) return false;
  const thumbExtended = isFingerExtended(landmarks, 4, 3, 2);
  const othersCurled = curledFingers(
    landmarks,
    [8, 12, 16, 20],
    [6, 10, 14, 18],
    [5, 9, 13, 17],
  );
  if (!thumbExtended || !othersCurled) return false;
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  return thumbTip.y < wrist.y + 0.05 || dist(thumbTip, wrist) > dist(landmarks[8], wrist) * 0.7;
}

function isVictoryPose(landmarks: NormalizedLandmark[]): boolean {
  if (landmarks.length < 21) return false;

  const indexExtended = isFingerExtended(landmarks, 8, 6, 5);
  const middleExtended = isFingerExtended(landmarks, 12, 10, 9);
  const othersCurled = curledFingers(landmarks, [16, 20], [14, 18], [13, 17]);

  return indexExtended && middleExtended && othersCurled;
}

export function detectCustomGestureKey(landmarks: NormalizedLandmark[]): string | null {
  if (landmarks.length < 21) return null;

  if (isVictoryPose(landmarks)) {
    return 'two_fingers';
  }

  const indexExtended = isFingerExtended(landmarks, 8, 6, 5);
  const middleExtended = isFingerExtended(landmarks, 12, 10, 9);
  const thumbExtended = isFingerExtended(landmarks, 4, 3, 2);

  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];

  if (
    indexExtended &&
    !middleExtended &&
    curledFingers(landmarks, [12, 16, 20], [10, 14, 18], [9, 13, 17])
  ) {
    const dx = indexTip.x - wrist.x;
    const dy = indexTip.y - wrist.y;
    const reach = Math.hypot(dx, dy);

    if (reach > 0.055) {
      const horizRatio = Math.abs(dx) / reach;
      if (horizRatio > 0.48) {
        return 'point_to_other';
      }
      if (dy > 0.06 && horizRatio < 0.45) {
        return 'point_diagonal_down';
      }
    }
  }

  if (
    thumbExtended &&
    !indexExtended &&
    curledFingers(landmarks, [8, 12, 16, 20], [6, 10, 14, 18], [5, 9, 13, 17])
  ) {
    const thumbReach = dist(thumbTip, wrist);
    const indexReach = dist(landmarks[8], wrist);
    if (thumbReach > indexReach * 0.55 && thumbReach < indexReach * 1.15) {
      return 'half_thumb_up';
    }
  }

  return null;
}

export function resolveHandGestureKey(
  mpCategory: string | undefined,
  landmarks: NormalizedLandmark[] | undefined,
): string | null {
  if (landmarks?.length) {
    const custom = detectCustomGestureKey(landmarks);
    if (custom) return custom;
    if (isVictoryPose(landmarks)) return 'two_fingers';
    if (isThumbUp(landmarks)) return 'thumb_up';
  }

  if (mpCategory && mpCategory !== 'None' && MEDIAPIPE_TO_GESTURE_KEY[mpCategory]) {
    return MEDIAPIPE_TO_GESTURE_KEY[mpCategory];
  }

  return null;
}

export function detectHandKeys(
  allLandmarks: NormalizedLandmark[][],
  mpCategories: (string | undefined)[],
): string[] {
  const keys: string[] = [];

  allLandmarks.forEach((landmarks, i) => {
    const key = resolveHandGestureKey(mpCategories[i], landmarks);
    if (key) keys.push(key);
  });

  const thumbCount = allLandmarks.filter((lm) => isThumbUp(lm)).length;
  if (thumbCount >= 2) keys.push('double_thumb_up');

  return keys;
}

function sortPosesByX(poses: NormalizedLandmark[][]): NormalizedLandmark[][] {
  return [...poses].sort((a, b) => {
    const ax = (a[POSE.lShoulder].x + a[POSE.rShoulder].x) / 2;
    const bx = (b[POSE.lShoulder].x + b[POSE.rShoulder].x) / 2;
    return ax - bx;
  });
}

/** Couple mode: two tracked players, each with at least one thumb-up hand. */
export function detectDoubleThumbUpDuo(
  handLandmarks: NormalizedLandmark[][],
  poseLandmarks: NormalizedLandmark[][],
): boolean {
  if (poseLandmarks.length < 2) return false;

  const thumbHands = handLandmarks.filter((lm) => isThumbUp(lm));
  if (thumbHands.length < 2) return false;

  const [leftPerson, rightPerson] = sortPosesByX(poseLandmarks);
  const leftMid = mid(leftPerson[POSE.lShoulder], leftPerson[POSE.rShoulder]);
  const rightMid = mid(rightPerson[POSE.lShoulder], rightPerson[POSE.rShoulder]);

  let leftHasThumb = false;
  let rightHasThumb = false;

  for (const hand of thumbHands) {
    const wrist = hand[0];
    if (dist(wrist, leftMid) <= dist(wrist, rightMid)) {
      leftHasThumb = true;
    } else {
      rightHasThumb = true;
    }
  }

  return leftHasThumb && rightHasThumb;
}

import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { detectFaceKeys } from '@/lib/gestures/faceDetection';
import {
  detectDoubleThumbUpDuo,
  detectHandKeys,
  detectInfinitySymbolDuo,
} from '@/lib/gestures/handDetection';
import { detectPoseKeys } from '@/lib/gestures/poseDetection';

export { MEDIAPIPE_TO_GESTURE_KEY, CUSTOM_GESTURE_KEYS } from '@/lib/gestures/handDetection';

export interface DetectionInput {
  handLandmarks: NormalizedLandmark[][];
  handCategories: (string | undefined)[];
  poseLandmarks: NormalizedLandmark[][];
  faceLandmarks: NormalizedLandmark[][];
  faceBlendshapes: Classifications[] | undefined;
}

export type DetectionScope = 'full' | 'face';

export function detectAllKeys(
  input: DetectionInput,
  scope: DetectionScope = 'full',
): string[] {
  if (scope === 'face') {
    return detectFaceKeys(input.faceBlendshapes);
  }

  const keys = new Set<string>([
    ...detectHandKeys(input.handLandmarks, input.handCategories),
    ...detectPoseKeys(input.poseLandmarks, input.handLandmarks),
    ...detectFaceKeys(input.faceBlendshapes),
  ]);
  if (detectDoubleThumbUpDuo(input.handLandmarks, input.poseLandmarks, input.faceLandmarks)) {
    keys.add('double_thumb_up_duo');
  }
  if (detectInfinitySymbolDuo(input.handLandmarks, input.poseLandmarks, input.faceLandmarks)) {
    keys.add('infinity_symbol');
  }
  return [...keys];
}

/** Primary key for HUD display — prefer body/pose over hand when multiple match. */
const DISPLAY_PRIORITY = [
  'hse_lift_duo',
  'infinity_symbol',
  'hug',
  'hse_lift',
  'muscle_pose',
  'smile',
  'double_thumb_up_duo',
  'double_thumb_up',
  'thumb_up',
  'half_thumb_up',
  'two_fingers',
  'point_to_other',
  'point_diagonal_down',
  'hand_circle',
] as const;

export function pickPrimaryKey(keys: string[]): string | null {
  for (const key of DISPLAY_PRIORITY) {
    if (keys.includes(key)) return key;
  }
  return keys[0] ?? null;
}

export function gestureKeyMatches(expectedKey: string, detectedKeys: string[]): boolean {
  if (!detectedKeys.length) return false;
  return detectedKeys.includes(expectedKey);
}

/** @deprecated use detectAllKeys — kept for single-hand call sites */
export function resolveGestureKey(
  mpCategory: string | undefined,
  landmarks: NormalizedLandmark[] | undefined,
): string | null {
  const hands = landmarks ? [landmarks] : [];
  const keys = detectHandKeys(hands, [mpCategory]);
  return pickPrimaryKey(keys);
}

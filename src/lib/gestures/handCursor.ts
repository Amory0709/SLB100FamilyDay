import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/** Palm base landmarks used to track the hand center (not index finger). */
const PALM_LANDMARKS = [0, 5, 9, 13, 17] as const;

export const HAND_CURSOR_DWELL_MS = 1000;

export interface NormalizedHandCursor {
  /** Normalized x in screen space (0 = left, 1 = right), mirrored for front camera. */
  x: number;
  /** Normalized y in screen space (0 = top, 1 = bottom). */
  y: number;
  visible: boolean;
}

export const EMPTY_HAND_CURSOR: NormalizedHandCursor = {
  x: 0.5,
  y: 0.5,
  visible: false,
};

const CLICKABLE_SELECTOR =
  'button:not(:disabled), a[href], input[type="button"]:not(:disabled), input[type="submit"]:not(:disabled), [role="button"]:not([aria-disabled="true"])';

function computePalmCenter(hand: NormalizedLandmark[]): NormalizedLandmark | null {
  if (hand.length < 21) return null;

  let x = 0;
  let y = 0;
  let z = 0;
  for (const index of PALM_LANDMARKS) {
    const point = hand[index];
    if (!point) return null;
    x += point.x;
    y += point.y;
    z += point.z ?? 0;
  }

  const count = PALM_LANDMARKS.length;
  return { x: x / count, y: y / count, z: z / count, visibility: 1 };
}

export function pickHandCursorLandmark(hands: NormalizedLandmark[][]): NormalizedLandmark | null {
  for (const hand of hands) {
    const center = computePalmCenter(hand);
    if (center) return center;
  }
  return null;
}

export function landmarkToNormalizedCursor(landmark: NormalizedLandmark): NormalizedHandCursor {
  return {
    x: 1 - landmark.x,
    y: landmark.y,
    visible: true,
  };
}

export function normalizedCursorToScreen(
  cursor: NormalizedHandCursor,
  width = window.innerWidth,
  height = window.innerHeight,
): { x: number; y: number } {
  return {
    x: cursor.x * width,
    y: cursor.y * height,
  };
}

function isElementClickable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('.hand-cursor-layer')) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.pointerEvents === 'none' || style.visibility === 'hidden' || style.display === 'none') {
    return false;
  }
  return true;
}

export function findClickableElement(x: number, y: number): HTMLElement | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const clickable = el.closest(CLICKABLE_SELECTOR);
    if (clickable && isElementClickable(clickable)) {
      return clickable;
    }
  }
  return null;
}

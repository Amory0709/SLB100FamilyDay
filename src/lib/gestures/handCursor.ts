import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/** MediaPipe index-finger tip landmark index. */
export const INDEX_FINGER_TIP = 8;

export const HAND_CURSOR_DWELL_MS = 1500;

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

export function pickHandCursorLandmark(hands: NormalizedLandmark[][]): NormalizedLandmark | null {
  for (const hand of hands) {
    const tip = hand[INDEX_FINGER_TIP];
    if (tip) return tip;
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

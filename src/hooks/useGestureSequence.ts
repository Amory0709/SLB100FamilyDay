import { useCallback, useEffect, useRef, useState } from 'react';
import type { LevelGesture } from '@/types/levels';
import { gestureKeyMatches } from '@/lib/gestures/mapping';

export const HOLD_MS = 1000;

export type GestureStepStatus = 'pending' | 'active' | 'done' | 'wrong';

export interface GestureStepState {
  index: number;
  status: GestureStepStatus;
}

export interface GestureSequenceState {
  steps: GestureStepState[];
  currentIndex: number;
  holdProgress: number;
  detectedKey: string | null;
  wrongFlash: boolean;
  isComplete: boolean;
}

function initState(gestures: LevelGesture[]): GestureSequenceState {
  return {
    steps: gestures.map((_, index) => ({
      index,
      status: index === 0 ? 'active' : 'pending',
    })),
    currentIndex: 0,
    holdProgress: 0,
    detectedKey: null,
    wrongFlash: false,
    isComplete: gestures.length === 0,
  };
}

export function useGestureSequence(
  gestures: LevelGesture[],
  detectedKey: string | null,
  enabled: boolean,
) {
  const [state, setState] = useState<GestureSequenceState>(() => initState(gestures));
  const holdStartRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const next = initState(gestures);
    setState(next);
    holdStartRef.current = null;
    currentIndexRef.current = 0;
  }, [gestures]);

  useEffect(() => {
    if (!enabled || !gestures.length) return;

    const idx = currentIndexRef.current;
    const expectedKey = gestures[idx]?.gestureKey;
    if (!expectedKey) return;

    const now = performance.now();

    if (gestureKeyMatches(expectedKey, detectedKey)) {
      if (holdStartRef.current === null) holdStartRef.current = now;

      const elapsed = now - holdStartRef.current;
      const progress = Math.min(1, elapsed / HOLD_MS);

      setState((prev) => ({
        ...prev,
        holdProgress: progress,
        detectedKey,
        wrongFlash: false,
      }));

      if (elapsed >= HOLD_MS) {
        holdStartRef.current = null;
        const nextIndex = idx + 1;
        currentIndexRef.current = nextIndex;
        const done = nextIndex >= gestures.length;

        setState((prev) => ({
          ...prev,
          currentIndex: nextIndex,
          holdProgress: 0,
          isComplete: done,
          steps: prev.steps.map((s, i) => ({
            ...s,
            status: i < nextIndex ? 'done' : i === nextIndex && !done ? 'active' : 'pending',
          })),
        }));
      }
      return;
    }

    holdStartRef.current = null;

    if (detectedKey && !gestureKeyMatches(expectedKey, detectedKey)) {
      setState((prev) => ({ ...prev, holdProgress: 0, detectedKey, wrongFlash: true }));
      const t = window.setTimeout(() => {
        setState((prev) => ({ ...prev, wrongFlash: false }));
      }, 450);
      return () => window.clearTimeout(t);
    }

    setState((prev) => ({ ...prev, holdProgress: 0, detectedKey }));
  }, [detectedKey, enabled, gestures]);

  const reset = useCallback(() => {
    holdStartRef.current = null;
    currentIndexRef.current = 0;
    setState(initState(gestures));
  }, [gestures]);

  return { ...state, reset };
}

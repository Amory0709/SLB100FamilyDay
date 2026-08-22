import { useEffect, useId, useRef } from 'react';
import {
  useGestureRecognizerContext,
  type GestureFrame,
  type GestureRecognizerStatus,
} from '@/contexts/GestureRecognizerContext';
import type { DetectionScope } from '@/lib/gestures/mapping';

export type { GestureFrame, GestureRecognizerStatus };

export interface UseGestureRecognizerOptions {
  detectionScope?: DetectionScope;
}

export function useGestureRecognizer(active: boolean, options?: UseGestureRecognizerOptions) {
  const consumerId = useId();
  const { setActive, setDetectionScope, ensureCamera, videoRef, status, error, frame } =
    useGestureRecognizerContext();
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const detectionScope = options?.detectionScope ?? 'full';

  useEffect(() => {
    setActive(consumerId, active);
    setDetectionScope(detectionScope);
    if (!active) return;

    void ensureCamera().catch(() => {
      /* error state handled in context */
    });

    return () => {
      setActive(consumerId, false);
      setDetectionScope('full');
    };
  }, [active, consumerId, detectionScope, setActive, setDetectionScope, ensureCamera]);

  // Re-verify camera when task bar remounts after level transitions.
  useEffect(() => {
    if (!active) return;
    const retryId = window.setTimeout(() => {
      void ensureCamera().catch(() => {
        /* error state handled in context */
      });
    }, 300);
    return () => window.clearTimeout(retryId);
  }, [active, ensureCamera]);

  return { videoRef, previewWrapRef, status, error, frame, ensureCamera };
}

/** App-level boot status for the loading screen. */
export function useGestureRecognizerBoot() {
  const { bootStatus, error } = useGestureRecognizerContext();
  return { bootStatus, error };
}

/** Request camera during a user click handler. */
export function useGestureCamera() {
  const { ensureCamera } = useGestureRecognizerContext();
  return ensureCamera;
}

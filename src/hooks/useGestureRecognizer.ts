import { useEffect, useId, useRef } from 'react';
import {
  useGestureRecognizerContext,
  type GestureFrame,
  type GestureRecognizerStatus,
} from '@/contexts/GestureRecognizerContext';

export type { GestureFrame, GestureRecognizerStatus };

export function useGestureRecognizer(active: boolean) {
  const consumerId = useId();
  const { setActive, ensureCamera, videoRef, status, error, frame } = useGestureRecognizerContext();
  const previewWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(consumerId, active);
    if (!active) return;

    void ensureCamera().catch(() => {
      /* error state handled in context */
    });

    return () => setActive(consumerId, false);
  }, [active, consumerId, setActive, ensureCamera]);

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

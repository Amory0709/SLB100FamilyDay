import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  useGestureRecognizerContext,
  type GestureFrame,
  type GestureRecognizerStatus,
} from '@/contexts/GestureRecognizerContext';

export type { GestureFrame, GestureRecognizerStatus };

export function useGestureRecognizer(active: boolean) {
  const { setActive, setPreviewHost, videoRef, status, error, frame } = useGestureRecognizerContext();
  const previewWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(active);
    return () => setActive(false);
  }, [active, setActive]);

  useLayoutEffect(() => {
    if (!active) {
      setPreviewHost(null);
      return;
    }
    const host = previewWrapRef.current;
    if (!host) return;
    setPreviewHost(host);
    return () => setPreviewHost(null);
  }, [active, setPreviewHost]);

  return { videoRef, previewWrapRef, status, error, frame };
}

/** App-level boot status for the loading screen. */
export function useGestureRecognizerBoot() {
  const { bootStatus, error } = useGestureRecognizerContext();
  return { bootStatus, error };
}

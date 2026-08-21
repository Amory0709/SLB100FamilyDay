import { useEffect, useId, useRef, type RefObject } from 'react';
import {
  EMPTY_HAND_CURSOR,
  HAND_CURSOR_DWELL_MS,
  findClickableElement,
  normalizedCursorToScreen,
  type NormalizedHandCursor,
} from '@/lib/gestures/handCursor';
import { useGestureRecognizerContext } from '@/contexts/GestureRecognizerContext';
import { HAND_CURSOR_LIVE_SIZE, HAND_CURSOR_RING_RADIUS, HandCursorMark } from '@/components/HandCursorMark';

const HAND_CURSOR_CONSUMER = 'hand-cursor';
const RING_CIRCUMFERENCE = 2 * Math.PI * HAND_CURSOR_RING_RADIUS;

interface HandCursorOverlayProps {
  enabled: boolean;
  suppressClickRef?: RefObject<boolean>;
}

export function HandCursorOverlay({ enabled, suppressClickRef }: HandCursorOverlayProps) {
  const gradientId = useId();
  const filterId = useId();
  const { handCursorRef, setActive, ensureCamera } = useGestureRecognizerContext();
  const dotRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGCircleElement>(null);
  const dwellTargetRef = useRef<HTMLElement | null>(null);
  const dwellStartRef = useRef(0);
  const clickCooldownRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    setActive(HAND_CURSOR_CONSUMER, true);
    void ensureCamera().catch(() => {
      /* surfaced via gesture context if needed */
    });

    return () => setActive(HAND_CURSOR_CONSUMER, false);
  }, [enabled, ensureCamera, setActive]);

  useEffect(() => {
    if (!enabled) return;

    document.body.classList.add('hand-cursor-active');

    let raf = 0;

    const updateProgress = (progress: number) => {
      const circle = progressRef.current;
      if (!circle) return;
      circle.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
      circle.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - progress)}`;
    };

    const tick = (now: number) => {
      const cursor: NormalizedHandCursor = handCursorRef.current ?? EMPTY_HAND_CURSOR;
      const dot = dotRef.current;

      if (dot) {
        if (cursor.visible) {
          const { x, y } = normalizedCursorToScreen(cursor);
          dot.style.transform = `translate(${x}px, ${y}px)`;
          dot.dataset.visible = 'true';

          const target = findClickableElement(x, y);
          if (target !== dwellTargetRef.current) {
            dwellTargetRef.current = target;
            dwellStartRef.current = now;
            updateProgress(0);
          } else if (target && now >= clickCooldownRef.current && !suppressClickRef?.current) {
            const elapsed = now - dwellStartRef.current;
            const progress = Math.min(1, elapsed / HAND_CURSOR_DWELL_MS);
            updateProgress(progress);

            if (progress >= 1) {
              target.click();
              clickCooldownRef.current = now + 600;
              dwellStartRef.current = now;
              updateProgress(0);
            }
          } else {
            updateProgress(0);
          }
        } else {
          dot.dataset.visible = 'false';
          dwellTargetRef.current = null;
          updateProgress(0);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove('hand-cursor-active');
    };
  }, [enabled, handCursorRef, suppressClickRef]);

  if (!enabled) return null;

  const halfSize = HAND_CURSOR_LIVE_SIZE / 2;

  return (
    <div className="hand-cursor-layer" aria-hidden="true">
      <div
        ref={dotRef}
        className="hand-cursor-dot"
        data-visible="false"
        style={{
          width: HAND_CURSOR_LIVE_SIZE,
          height: HAND_CURSOR_LIVE_SIZE,
          margin: `${-halfSize}px 0 0 ${-halfSize}px`,
        }}
      >
        <HandCursorMark
          size={HAND_CURSOR_LIVE_SIZE}
          gradientId={gradientId}
          filterId={filterId}
          progressRef={progressRef}
          className="hand-cursor-mark"
        />
      </div>
    </div>
  );
}

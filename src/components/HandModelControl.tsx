import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GameEngine } from '@/game/createGameEngine';
import { useGestureRecognizerContext } from '@/contexts/GestureRecognizerContext';
import {
  frameMotionScale,
  HandMotionSmoother,
  HAND_MODEL_MOTION,
  type HandControlMode,
} from '@/lib/gestures/handModelControlMotion';
import { useLanguage } from '@/i18n/LanguageContext';

const ROTATE_GESTURE = 'point_to_other';
const ZOOM_GESTURE = 'two_fingers';

interface HandModelControlProps {
  enabled: boolean;
  engineRef: RefObject<GameEngine | null>;
  controlActiveRef: RefObject<boolean>;
}

export function HandModelControl({ enabled, engineRef, controlActiveRef }: HandModelControlProps) {
  const { t } = useLanguage();
  const { handCursorRef, detectedKeysRef } = useGestureRecognizerContext();
  const [mode, setMode] = useState<HandControlMode>('idle');
  const modeRef = useRef<HandControlMode>('idle');
  const smootherRef = useRef(new HandMotionSmoother());
  const lastTickRef = useRef(performance.now());

  useEffect(() => {
    if (!enabled) {
      controlActiveRef.current = false;
      smootherRef.current.reset();
      if (modeRef.current !== 'idle') {
        modeRef.current = 'idle';
        setMode('idle');
      }
      return;
    }

    let raf = 0;

    const setControlMode = (next: HandControlMode) => {
      if (modeRef.current === next) return;
      modeRef.current = next;
      setMode(next);
    };

    const tick = (now: number) => {
      const engine = engineRef.current;
      const keys = detectedKeysRef.current;
      const cursor = handCursorRef.current;
      const rotateActive = keys.includes(ROTATE_GESTURE);
      const zoomActive = keys.includes(ZOOM_GESTURE) && !rotateActive;
      const active = (rotateActive || zoomActive) && cursor?.visible;
      const dtScale = frameMotionScale((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      controlActiveRef.current = rotateActive || zoomActive;

      if (active && engine) {
        const controlMode = rotateActive ? 'rotate' : 'zoom';
        const motion = smootherRef.current.update(cursor, controlMode);

        if (motion) {
          const { dx, dy } = motion;
          if (controlMode === 'rotate') {
            if (dx !== 0 || dy !== 0) {
              engine.applyHandOrbit(
                dx * HAND_MODEL_MOTION.orbitAzimuth * dtScale,
                dy * HAND_MODEL_MOTION.orbitPolar * dtScale,
              );
            }
            setControlMode('rotate');
          } else if (dy !== 0) {
            engine.applyHandZoom(dy * HAND_MODEL_MOTION.zoomExponent * dtScale);
            setControlMode('zoom');
          } else {
            setControlMode('zoom');
          }
        } else {
          setControlMode(controlMode);
        }
      } else {
        smootherRef.current.release();
        setControlMode('idle');
      }

      raf = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controlActiveRef, detectedKeysRef, enabled, engineRef, handCursorRef]);

  if (!enabled) return null;

  const hint =
    mode === 'rotate'
      ? t('handModelRotate')
      : mode === 'zoom'
        ? t('handModelZoom')
        : t('handModelHint');

  return (
    <div id="hint" className="hand-model-hint" data-mode={mode} aria-live="polite">
      {hint}
    </div>
  );
}

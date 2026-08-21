import { useEffect, useRef, useState } from 'react';
import type { LevelConfig, LevelGesture } from '@/types/levels';
import { GESTURE_GLYPHS } from '@/lib/gestures/glyphs';
import { GESTURE_LABELS } from '@/lib/gestures/labels';
import { useGestureRecognizer } from '@/hooks/useGestureRecognizer';
import { useGestureSequence, type GestureStepStatus } from '@/hooks/useGestureSequence';
import { useLanguage } from '@/i18n/LanguageContext';
import { GesturePreviewCanvas } from '@/contexts/GestureRecognizerContext';
import { DuoGestureChecklist, isDuoChecklistGesture } from '@/components/DuoGestureChecklist';

interface LevelTaskBarProps {
  level: LevelConfig;
  onComplete: () => void;
}

export function LevelTaskBar({ level, onComplete }: LevelTaskBarProps) {
  const { t, language } = useLanguage();
  const gestures = level.gestures ?? [];
  const useRecognition = gestures.length > 0 && level.completionType === 'gesture';

  const { previewWrapRef, status, error, frame, ensureCamera } = useGestureRecognizer(useRecognition);
  const sequence = useGestureSequence(gestures, frame.detectedKeys, useRecognition);
  const completedRef = useRef(false);

  const [smoothProgress, setSmoothProgress] = useState(0);
  useEffect(() => {
    let rafId: number;
    const animate = () => {
      setSmoothProgress((prev) => {
        const target = sequence.holdProgress;
        if (target === 0) return 0;
        const diff = target - prev;
        if (Math.abs(diff) < 0.01) return target;
        return prev + diff * 0.3;
      });
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [sequence.holdProgress]);

  useEffect(() => {
    completedRef.current = false;
  }, [level.id]);

  useEffect(() => {
    if (sequence.isComplete && useRecognition && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [sequence.isComplete, useRecognition, onComplete]);

  const expectedGestureKey = gestures[sequence.currentIndex]?.gestureKey ?? gestures[0]?.gestureKey;
  const showDuoChecklist =
    useRecognition && expectedGestureKey && isDuoChecklistGesture(expectedGestureKey) && frame.duoMetrics;

  return (
    <div
      className="level-taskbar"
      role="region"
      aria-label={t('currentTask')}
      style={{ ['--level-color' as string]: level.color ?? '#0014c8' }}
    >
      <div className="level-color-orb" aria-hidden="true" />

      <div className="task-header">
        <div className="task-icon">
          {expectedGestureKey && GESTURE_GLYPHS[expectedGestureKey]
            ? GESTURE_GLYPHS[expectedGestureKey]
            : (level.taskIcon ?? '🎯')}
        </div>
        <div className="task-header-text">
          <div className="task-title">{level.title}</div>
          <div className="task-hint">{level.task}</div>
        </div>
      </div>

      {useRecognition && (
        <div ref={previewWrapRef} className="gesture-camera-wrap large">
          <GesturePreviewCanvas />
          <div className="gesture-camera-badge">
            {status === 'loading' && !error && t('startingCamera')}
            {(status === 'ready' || status === 'running') &&
              (frame.gestureKey
                ? t('recognizing', GESTURE_LABELS[frame.gestureKey]?.[language] ?? frame.gestureKey)
                : t('waitingGesture'))}
            {status === 'error' && t('recognitionUnavailable')}
          </div>
          {error && (
            <div className="gesture-error">
              <p>{error}</p>
              <button
                type="button"
                className="level-btn level-btn-ghost gesture-retry-btn"
                onClick={() => {
                  void ensureCamera().catch(() => {
                    /* surfaced above */
                  });
                }}
              >
                {t('retryCamera')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="task-progress-section">
        {showDuoChecklist && (
          <DuoGestureChecklist
            gestureKey={expectedGestureKey!}
            metrics={frame.duoMetrics!}
            holdProgress={smoothProgress}
          />
        )}

        <div className="gesture-hint-text">
          {useRecognition ? t('gestureSequenceHint') : ''}
        </div>

        {gestures.length === 0 ? (
          <div className="task-gestures-empty">{t('noGesturesConfigured')}</div>
        ) : showDuoChecklist ? null : (
          <div className="task-gestures center-gestures" aria-label="Gesture sequence">
            {gestures.map((g, idx) => (
              <GestureCard
                key={`${g.word}-${idx}`}
                gesture={g}
                index={idx}
                status={sequence.steps[idx]?.status ?? 'pending'}
                holdProgress={sequence.steps[idx]?.status === 'active' ? smoothProgress : 0}
                wrongFlash={sequence.wrongFlash && sequence.currentIndex === idx}
              />
            ))}
          </div>
        )}
      </div>

      {!useRecognition && (
        <button className="level-btn level-btn-primary" type="button" onClick={onComplete}>
          {t('imDone')}
        </button>
      )}

      {useRecognition && sequence.isComplete && (
        <div className="level-btn level-btn-primary task-auto-done" aria-live="polite">
          {t('recognitionComplete')}
        </div>
      )}
    </div>
  );
}

interface GestureCardProps {
  gesture: LevelGesture;
  index: number;
  status: GestureStepStatus;
  holdProgress: number;
  wrongFlash: boolean;
}

function GestureCard({ gesture, index, status, holdProgress, wrongFlash }: GestureCardProps) {
  const glyph = gesture.gestureKey ? GESTURE_GLYPHS[gesture.gestureKey] : null;

  return (
    <div
      className={`task-gesture-card status-${status}${wrongFlash ? ' wrong-flash' : ''}`}
      aria-current={status === 'active' ? 'step' : undefined}
    >
      <div className="task-card-glyph">
        {glyph ?? <div className="task-card-glyph-fallback">✋</div>}
      </div>
      <div className="task-card-num">{index + 1}</div>
      <div className="task-card-word">{gesture.word}</div>
      <div className="task-card-hint">{gesture.hint}</div>
      {status === 'active' && holdProgress > 0 && (
        <div className="hold-bar" style={{ width: `${holdProgress * 100}%` }} aria-hidden="true" />
      )}
      {status === 'done' && (
        <div className="done-check" aria-hidden="true">
          ✓
        </div>
      )}
    </div>
  );
}

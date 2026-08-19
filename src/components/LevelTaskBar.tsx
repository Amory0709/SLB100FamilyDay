import { useEffect, useRef } from 'react';
import type { LevelConfig, LevelGesture } from '@/types/levels';
import { GESTURE_GLYPHS } from '@/lib/gestures/glyphs';
import { useGestureRecognizer } from '@/hooks/useGestureRecognizer';
import { useGestureSequence, type GestureStepStatus } from '@/hooks/useGestureSequence';

interface LevelTaskBarProps {
  level: LevelConfig;
  onComplete: () => void;
}

export function LevelTaskBar({ level, onComplete }: LevelTaskBarProps) {
  const gestures = level.gestures ?? [];
  const useRecognition = gestures.length > 0 && level.completionType === 'gesture';

  const { videoRef, canvasRef, status, error, frame } = useGestureRecognizer(useRecognition);
  const sequence = useGestureSequence(gestures, frame.gestureKey, useRecognition);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
  }, [level.id]);

  useEffect(() => {
    if (sequence.isComplete && useRecognition && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [sequence.isComplete, useRecognition, onComplete]);

  return (
    <div
      className="level-taskbar"
      role="region"
      aria-label="Current task"
      style={{ ['--level-color' as string]: level.color ?? '#0014c8' }}
    >
      <div className="task-icon">{level.taskIcon ?? '🎯'}</div>

      <div className="task-body">
        <div className="task-title">{level.title}</div>
        <div className="task-hint">{level.task}</div>

        {gestures.length === 0 ? (
          <div className="task-gestures-empty">本关没有配置手势 — 直接点击「我完成了」即可</div>
        ) : (
          <div className="task-gestures" aria-label="Gesture sequence">
            {gestures.map((g, idx) => (
              <GestureCard
                key={`${g.word}-${idx}`}
                gesture={g}
                index={idx}
                status={sequence.steps[idx]?.status ?? 'pending'}
                holdProgress={sequence.steps[idx]?.status === 'active' ? sequence.holdProgress : 0}
                wrongFlash={sequence.wrongFlash && sequence.currentIndex === idx}
              />
            ))}
          </div>
        )}

        {useRecognition && (
          <div className="gesture-status-row">
            <div className="gesture-camera-wrap">
              <video ref={videoRef} className="gesture-video" muted playsInline aria-hidden="true" />
              <canvas ref={canvasRef} className="gesture-canvas" aria-hidden="true" />
              <div className="gesture-camera-badge">
                {status === 'loading' && '加载模型…'}
                {status === 'running' && (frame.gestureKey ? `识别: ${frame.gestureKey}` : '等待手势…')}
                {status === 'error' && '识别不可用'}
              </div>
            </div>
            <div className="gesture-hint-text">
              按顺序做手势，保持 1 秒。错了可从当前步继续。
              {error && <span className="gesture-error">{error}</span>}
            </div>
          </div>
        )}
      </div>

      {!useRecognition && (
        <button className="level-btn level-btn-primary" type="button" onClick={onComplete}>
          我完成了 ✓
        </button>
      )}

      {useRecognition && sequence.isComplete && (
        <div className="level-btn level-btn-primary task-auto-done" aria-live="polite">
          识别完成 ✓
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
      {status === 'done' && <div className="done-check" aria-hidden="true">✓</div>}
    </div>
  );
}

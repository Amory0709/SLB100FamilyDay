import { useEffect, useRef, useState } from 'react';
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

  const { previewWrapRef, status, error, frame } = useGestureRecognizer(useRecognition);
  const sequence = useGestureSequence(gestures, frame.gestureKey, useRecognition, frame);
  const completedRef = useRef(false);

  // Smooth out the displayed progress slightly to prevent visually jarring jumps if frame skips
  const [smoothProgress, setSmoothProgress] = useState(0);
  useEffect(() => {
    let rafId: number;
    const animate = () => {
      setSmoothProgress((prev) => {
        const target = sequence.holdProgress;
        
        // 如果进度归零（比如刚完成一个手势或手势失败），立刻重置，避免进度条视觉上回弹跳动
        if (target === 0) return 0;
        
        const diff = target - prev;
        if (Math.abs(diff) < 0.01) return target;
        // 每帧逼近 30%（0.5秒需要更干脆的动画）
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

  return (
    <div
      className="level-taskbar"
      role="region"
      aria-label="Current task"
      style={{ ['--level-color' as string]: level.color ?? '#0014c8' }}
    >
      <div className="level-color-orb" aria-hidden="true" />
      
      <div className="task-header">
        <div className="task-icon">{level.taskIcon ?? '🎯'}</div>
        <div className="task-header-text">
          <div className="task-title">{level.title}</div>
          <div className="task-hint">{level.task}</div>
        </div>
      </div>

      {useRecognition && (
        <div ref={previewWrapRef} className="gesture-camera-wrap large">
          <div className="gesture-camera-badge">
            {status === 'loading' && '加载模型…'}
            {(status === 'ready' || status === 'running') &&
              (frame.gestureKey ? `识别: ${frame.gestureKey}` : '等待手势…')}
            {status === 'error' && '识别不可用'}
          </div>
          {error && <div className="gesture-error">{error}</div>}
        </div>
      )}

      <div className="task-progress-section">
        <div className="gesture-hint-text">
          {useRecognition ? '按顺序做手势，保持 1 秒。错了可从当前步继续。' : ''}
        </div>

        {gestures.length === 0 ? (
          <div className="task-gestures-empty">本关没有配置手势 — 直接点击「我完成了」即可</div>
        ) : (
          <>
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
            
            {useRecognition && (
              <div className="sequence-progress-bar">
                <div 
                  className="sequence-progress-fill" 
                  style={{ width: `${Math.min(100, ((sequence.currentIndex + smoothProgress) / gestures.length) * 100)}%` }}
                />
              </div>
            )}
          </>
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

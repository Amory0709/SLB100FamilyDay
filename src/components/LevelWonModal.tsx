import type { LevelConfig } from '@/types/levels';

interface LevelWonModalProps {
  level: LevelConfig;
  totalLevels: number;
  onNext: () => void;
  onReplay: () => void;
}

export function LevelWonModal({ level, totalLevels, onNext, onReplay }: LevelWonModalProps) {
  const isLast = level.id >= totalLevels;

  return (
    <div
      className="level-popup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-won-title"
      style={{ ['--level-color' as string]: level.color ?? '#0014c8' }}
    >
      <div className="level-card level-card-celebrate">
        <div className="won-icon">✓</div>
        <h2 id="level-won-title">{level.title} — 完成!</h2>
        <p>{level.reward ?? '恭喜解锁本关!'}</p>
        <div className="level-card-actions">
          <button className="level-btn level-btn-primary" type="button" onClick={onNext}>
            {isLast ? '完成全部 ✓' : '下一关 →'}
          </button>
          <button className="level-btn level-btn-ghost" type="button" onClick={onReplay}>
            重玩本关
          </button>
        </div>
        <p className="small-note">
          {level.id} / {totalLevels}
        </p>
      </div>
    </div>
  );
}

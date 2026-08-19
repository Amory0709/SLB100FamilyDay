import type { LevelConfig } from '@/types/levels';

interface LevelIntroModalProps {
  level: LevelConfig;
  totalLevels: number;
  onStart: () => void;
  onSkip: () => void;
}

export function LevelIntroModal({ level, totalLevels, onStart, onSkip }: LevelIntroModalProps) {
  return (
    <div
      className="level-popup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-intro-title"
      style={{ ['--level-color' as string]: level.color ?? '#0014c8' }}
    >
      <div className="level-card">
        <div className="level-badge">{level.id}</div>
        <h2 id="level-intro-title">{level.title}</h2>
        <p>{level.intro}</p>
        <div className="level-card-actions">
          <button className="level-btn level-btn-primary" type="button" onClick={onStart}>
            开始任务 →
          </button>
          <button className="level-btn level-btn-ghost" type="button" onClick={onSkip}>
            跳过本关
          </button>
        </div>
        <p className="small-note">
          {level.id} / {totalLevels}
        </p>
      </div>
    </div>
  );
}

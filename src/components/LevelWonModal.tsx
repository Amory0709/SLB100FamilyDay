import type { LevelConfig } from '@/types/levels';
import { useLanguage } from '@/i18n/LanguageContext';

interface LevelWonModalProps {
  level: LevelConfig;
  totalLevels: number;
  onNext: () => void;
  onReplay: () => void;
}

export function LevelWonModal({ level, totalLevels, onNext, onReplay }: LevelWonModalProps) {
  const { t } = useLanguage();
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
        <h2 id="level-won-title">
          {level.title} — {t('levelComplete')}
        </h2>
        <p>{level.reward ?? t('defaultReward')}</p>
        <div className="level-card-actions">
          <button className="level-btn level-btn-primary" type="button" onClick={onNext}>
            {isLast ? t('allComplete') : t('nextLevel')}
          </button>
          <button className="level-btn level-btn-ghost" type="button" onClick={onReplay}>
            {t('replayLevel')}
          </button>
        </div>
        <p className="small-note">
          {level.id} / {totalLevels}
        </p>
      </div>
    </div>
  );
}

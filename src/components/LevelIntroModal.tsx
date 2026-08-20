import type { LevelConfig } from '@/types/levels';
import { useLanguage } from '@/i18n/LanguageContext';

interface LevelIntroModalProps {
  level: LevelConfig;
  totalLevels: number;
  onStart: () => void;
  onSkip: () => void;
}

export function LevelIntroModal({ level, totalLevels, onStart, onSkip }: LevelIntroModalProps) {
  const { t } = useLanguage();

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
            {t('startTask')}
          </button>
          <button className="level-btn level-btn-ghost" type="button" onClick={onSkip}>
            {t('skipLevel')}
          </button>
        </div>
        <p className="small-note">
          {level.id} / {totalLevels}
        </p>
      </div>
    </div>
  );
}

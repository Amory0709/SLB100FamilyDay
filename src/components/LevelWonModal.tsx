import type { LevelConfig } from '@/types/levels';
import { useLanguage } from '@/i18n/LanguageContext';

interface LevelWonModalProps {
  level: LevelConfig;
  totalLevels: number;
  onLobby: () => void;
}

export function LevelWonModal({ level, totalLevels, onLobby }: LevelWonModalProps) {
  const { t } = useLanguage();

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
          <button className="level-btn level-btn-primary" type="button" onClick={onLobby}>
            {t('returnMainMenu')}
          </button>
        </div>
        <p className="small-note">
          {level.id} / {totalLevels}
        </p>
      </div>
    </div>
  );
}

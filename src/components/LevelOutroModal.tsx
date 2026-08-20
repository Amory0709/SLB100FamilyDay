import { useLanguage } from '@/i18n/LanguageContext';

interface LevelOutroModalProps {
  text: string;
  onRestart: () => void;
  onLobby: () => void;
}

export function LevelOutroModal({ text, onRestart, onLobby }: LevelOutroModalProps) {
  const { t } = useLanguage();

  return (
    <div className="level-popup" role="dialog" aria-modal="true" aria-labelledby="level-outro-title">
      <div className="level-card level-card-celebrate">
        <div className="won-icon outro">🎉</div>
        <h2 id="level-outro-title">{t('allLevelsComplete')}</h2>
        <p>{text}</p>
        <div className="level-card-actions">
          <button className="level-btn level-btn-primary" type="button" onClick={onRestart}>
            {t('restart')}
          </button>
          <button className="level-btn level-btn-ghost" type="button" onClick={onLobby}>
            {t('returnMainMenu')}
          </button>
        </div>
      </div>
    </div>
  );
}

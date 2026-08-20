import { useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { fireCelebrationConfetti } from '@/lib/celebrationConfetti';

interface LevelOutroModalProps {
  text: string;
  colors: string[];
  onRestart: () => void;
  onLobby: () => void;
}

export function LevelOutroModal({ text, colors, onRestart, onLobby }: LevelOutroModalProps) {
  const { t } = useLanguage();

  useEffect(() => fireCelebrationConfetti(colors), [colors]);

  return (
    <div className="level-popup level-popup-outro" role="dialog" aria-modal="true" aria-labelledby="level-outro-title">
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

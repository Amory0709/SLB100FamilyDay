import { forwardRef } from 'react';
import type { GameMode } from '@/types/levels';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface LobbyPanelProps {
  visible: boolean;
  onSelectMode: (mode: GameMode) => void;
}

export const LobbyPanel = forwardRef<HTMLDivElement, LobbyPanelProps>(function LobbyPanel(
  { visible, onSelectMode },
  ref,
) {
  const { t } = useLanguage();

  if (!visible) return null;

  return (
    <div id="slb-panel" ref={ref}>
      <div className="panel-text">
        <h1 className="game-title">{t('gameTitle')}</h1>
        <p className="welcome-subtitle">{t('welcomeTitle')}</p>
      </div>

      <h2 className="mode-prompt">{t('selectMode')}</h2>

      <div className="modes">
        <button className="mode-card" type="button" onClick={() => onSelectMode('single')}>
          <svg className="mode-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label={t('singleMode')}>
            <circle cx="32" cy="22" r="9" fill="#0014c8" />
            <path d="M14 50 C 14 36 50 36 50 50 L 50 54 L 14 54 Z" fill="#0014c8" />
          </svg>
          <span className="mode-label">{t('singleMode')}</span>
        </button>
        <button className="mode-card" type="button" onClick={() => onSelectMode('couple')}>
          <svg className="mode-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label={t('coupleMode')}>
            <circle cx="22" cy="22" r="7" fill="#0014c8" />
            <path d="M8 50 C 8 38 36 38 36 50 L 36 54 L 8 54 Z" fill="#0014c8" />
            <circle cx="42" cy="22" r="7" fill="#0014c8" />
            <path d="M28 50 C 28 38 56 38 56 50 L 56 54 L 28 54 Z" fill="#0014c8" />
          </svg>
          <span className="mode-label">{t('coupleMode')}</span>
        </button>
      </div>

      <div className="panel-video">
        <video
          id="slb-video"
          src="https://www.slb.com/static/anniversary28052026/assets/anniversity/video-home.webm"
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
        />
      </div>

      <div className="panel-language-wrap">
        <LanguageSwitcher />
      </div>
    </div>
  );
});

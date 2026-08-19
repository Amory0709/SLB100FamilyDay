import { forwardRef } from 'react';
import type { GameMode } from '@/types/levels';

interface LobbyPanelProps {
  visible: boolean;
  onSelectMode: (mode: GameMode) => void;
  onClose: () => void;
  onToggleGui: () => void;
}

export const LobbyPanel = forwardRef<HTMLDivElement, LobbyPanelProps>(function LobbyPanel(
  { visible, onSelectMode, onClose, onToggleGui },
  ref,
) {
  if (!visible) return null;

  return (
    <div id="slb-panel" ref={ref}>
      <button id="gui-toggle" type="button" title="toggle GUI" onClick={onToggleGui}>
        ⚙
      </button>
      <button id="slb-video-close" type="button" title="close" onClick={onClose}>
        ×
      </button>

      <div className="panel-text">
        <h1>Welcome to family day</h1>
      </div>

      <h2 className="mode-prompt">Please select your mode</h2>

      <div className="modes">
        <button className="mode-card" type="button" onClick={() => onSelectMode('single')}>
          <svg className="mode-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Single Mode">
            <circle cx="32" cy="22" r="9" fill="#0014c8" />
            <path d="M14 50 C 14 36 50 36 50 50 L 50 54 L 14 54 Z" fill="#0014c8" />
          </svg>
          <span className="mode-label">Single Mode</span>
        </button>
        <button className="mode-card" type="button" onClick={() => onSelectMode('couple')}>
          <svg className="mode-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Couple Mode">
            <circle cx="22" cy="22" r="7" fill="#0014c8" />
            <path d="M8 50 C 8 38 36 38 36 50 L 36 54 L 8 54 Z" fill="#0014c8" />
            <circle cx="42" cy="22" r="7" fill="#0014c8" />
            <path d="M28 50 C 28 38 56 38 56 50 L 56 54 L 28 54 Z" fill="#0014c8" />
          </svg>
          <span className="mode-label">Couple Mode</span>
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
    </div>
  );
});

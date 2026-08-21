import { useId } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { HAND_CURSOR_DWELL_MS } from '@/lib/gestures/handCursor';
import { HandCursorFog, HandCursorMark, HAND_CURSOR_FOG_BADGE_SIZE, HAND_CURSOR_FOG_ICON_SIZE } from '@/components/HandCursorMark';

interface HandControlIntroModalProps {
  onContinue: () => void;
}

const dwellSeconds = String(HAND_CURSOR_DWELL_MS / 1000);

function CameraIcon() {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <rect x="9" y="15" width="30" height="21" rx="5" fill="none" stroke="#0014c8" strokeWidth="2.5" />
      <circle cx="24" cy="26" r="6.5" fill="none" stroke="#0014c8" strokeWidth="2.5" />
      <path
        d="M18 15 L21.5 11 H26.5 L30 15"
        fill="none"
        stroke="#0014c8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HandControlIntroModal({ onContinue }: HandControlIntroModalProps) {
  const { t } = useLanguage();
  const badgeFogFilterId = useId();
  const stepFogFilterId = useId();
  const stepRingGradientId = useId();
  const stepRingFilterId = useId();

  return (
    <div
      className="level-popup hand-control-intro"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hand-intro-title"
    >
      <div className="level-card hand-control-intro-card">
        <div className="hand-intro-badge" aria-hidden="true">
          <HandCursorFog size={HAND_CURSOR_FOG_BADGE_SIZE} filterId={badgeFogFilterId} animated />
        </div>
        <h2 id="hand-intro-title">{t('handIntroTitle')}</h2>
        <p className="hand-intro-lead">{t('handIntroLead')}</p>

        <ol className="hand-intro-steps">
          <li>
            <span className="hand-intro-step-icon">
              <CameraIcon />
            </span>
            <span>{t('handIntroStepPoint')}</span>
          </li>
          <li>
            <span className="hand-intro-step-icon">
              <HandCursorFog size={HAND_CURSOR_FOG_ICON_SIZE} filterId={stepFogFilterId} animated />
            </span>
            <span>{t('handIntroStepMove')}</span>
          </li>
          <li>
            <span className="hand-intro-step-icon">
              <HandCursorMark
                size={HAND_CURSOR_FOG_ICON_SIZE}
                gradientId={stepRingGradientId}
                filterId={stepRingFilterId}
                progress={0.75}
                animatedFog
              />
            </span>
            <span>{t('handIntroStepClick', dwellSeconds)}</span>
          </li>
        </ol>

        <p className="hand-intro-tip">{t('handIntroCameraTip')}</p>

        <div className="level-card-actions">
          <button className="level-btn level-btn-primary hand-intro-continue" type="button" onClick={onContinue}>
            {t('handIntroContinue')}
          </button>
        </div>

        <p className="small-note">{t('handIntroPracticeHint', dwellSeconds)}</p>
      </div>
    </div>
  );
}

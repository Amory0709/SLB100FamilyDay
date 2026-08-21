import { useLanguage } from '@/i18n/LanguageContext';

export function GameViewport({ containerRef, showHint = true }: GameViewportProps) {
  const { t } = useLanguage();

  return (
    <>
      <div id="viewport" ref={containerRef} />
      {showHint ? <div id="hint">{t('viewportHint')}</div> : null}
    </>
  );
}

interface GameViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  showHint?: boolean;
}

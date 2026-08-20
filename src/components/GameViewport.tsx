import { useLanguage } from '@/i18n/LanguageContext';

export function GameViewport({ containerRef }: GameViewportProps) {
  const { t } = useLanguage();

  return (
    <>
      <div id="viewport" ref={containerRef} />
      <div id="hint">{t('viewportHint')}</div>
    </>
  );
}

interface GameViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

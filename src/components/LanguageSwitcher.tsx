import { LANGUAGE_LABELS, LANGUAGES, type Language } from '@/i18n/types';
import { useLanguage } from '@/i18n/LanguageContext';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t('switchLanguage')}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          className={`language-switcher-btn${language === lang ? ' active' : ''}`}
          aria-pressed={language === lang}
          onClick={() => setLanguage(lang as Language)}
        >
          {LANGUAGE_LABELS[lang]}
        </button>
      ))}
    </div>
  );
}

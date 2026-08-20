export type Language = 'en' | 'zh';

export const LANGUAGES: Language[] = ['en', 'zh'];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'EN',
  zh: '中文',
};

export type LocalizedString = string | Partial<Record<Language, string>>;

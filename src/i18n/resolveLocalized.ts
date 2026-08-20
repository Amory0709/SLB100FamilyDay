import type { Language, LocalizedString } from '@/i18n/types';

export function resolveLocalized(value: LocalizedString, lang: Language): string {
  if (typeof value === 'string') return value;
  return value[lang] ?? value.en ?? value.zh ?? '';
}

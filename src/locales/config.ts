import en from './en';
import ja from './ja';
import zhCN from './zh-CN';

export const translations = {
  en,
  ja,
  'zh-CN': zhCN,
} as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof (typeof translations)['en'];

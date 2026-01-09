import { createContext } from 'react';
import type { Locale, TranslationKey } from './config';

export type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { translations } from './config';
import type { Locale, TranslationKey } from './config';
import { I18nContext } from './context';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = window.localStorage.getItem('litemark.locale');
    if (saved === 'zh-CN' || saved === 'en' || saved === 'ja') {
      return saved;
    }
    const language = navigator.language.toLowerCase();
    if (language.startsWith('zh')) return 'zh-CN';
    if (language.startsWith('ja')) return 'ja';
    return 'en';
  });

  useEffect(() => {
    window.localStorage.setItem('litemark.locale', locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const dict = translations[locale] ?? translations.en;
      let value: string = dict[key] ?? translations.en[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([name, paramValue]) => {
          const token = `{${name}}`;
          value = value.split(token).join(String(paramValue));
        });
      }
      return value;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

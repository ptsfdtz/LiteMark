import { describe, expect, it } from 'vitest';
import { translations, type Locale } from './config';

describe('editor translations', () => {
  it.each<[Locale, string]>([
    ['zh-CN', '接受'],
    ['en', 'Accept'],
    ['ja', '承諾'],
  ])('provides the inline suggestion action in %s', (locale, expected) => {
    expect(translations[locale]['editor.acceptSuggestion']).toBe(expected);
  });
});

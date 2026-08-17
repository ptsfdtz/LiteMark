import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '@/locales';
import SaveSuccessToast from './SaveSuccessToast';

describe('SaveSuccessToast', () => {
  it('shows the completed export message instead of an unlabeled icon', () => {
    window.localStorage.setItem('litemark.locale', 'en');
    render(
      <I18nProvider>
        <SaveSuccessToast show message="Exported note.pdf" />
      </I18nProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Exported note.pdf');
  });
});

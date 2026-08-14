import { describe, expect, it, vi } from 'vitest';
import { connectInlineSuggestionHintLocalization } from './inlineSuggestionHintLocalization';

function createInlineSuggestionHint(): HTMLElement {
  const hint = document.createElement('div');
  hint.className = 'inlineSuggestionsHints';
  hint.innerHTML = `
    <ul class="actions-container">
      <li class="action-item"></li>
      <li class="action-item"></li>
      <li class="action-item"></li>
      <li class="action-item menu-entry">
        <a class="action-label inlineSuggestionStatusBarItemLabel" aria-label="Accept (Tab)">
          Accept
          <div class="keybinding"><span class="monaco-keybinding-key">Tab</span></div>
        </a>
      </li>
      <li class="action-item menu-entry">
        <a class="action-label inlineSuggestionStatusBarItemLabel">Accept Word</a>
      </li>
    </ul>
  `;
  return hint;
}

function getActionLabels(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.inlineSuggestionStatusBarItemLabel'));
}

describe('inline suggestion hint localization', () => {
  it('localizes the primary action while preserving its keybinding', () => {
    const root = createInlineSuggestionHint();
    const localization = connectInlineSuggestionHintLocalization(root, '接受');
    const [acceptLabel, acceptWordLabel] = getActionLabels(root);

    expect(acceptLabel.childNodes[0]?.textContent).toBe('接受');
    expect(acceptLabel.querySelector('.keybinding')).toHaveTextContent('Tab');
    expect(acceptLabel).toHaveAttribute('aria-label', '接受 (Tab)');
    expect(acceptWordLabel).toHaveTextContent('Accept Word');

    localization.dispose();
  });

  it('localizes a Monaco hint created after the editor mounts', async () => {
    const root = document.createElement('div');
    const localization = connectInlineSuggestionHintLocalization(root, '接受');

    root.append(createInlineSuggestionHint());

    await vi.waitFor(() => {
      expect(getActionLabels(root)[0].childNodes[0]?.textContent).toBe('接受');
    });

    localization.dispose();
  });

  it('updates an existing hint when the application language changes', () => {
    const root = createInlineSuggestionHint();
    const localization = connectInlineSuggestionHintLocalization(root, '接受');

    localization.setLabel('承諾');

    expect(getActionLabels(root)[0].childNodes[0]?.textContent).toBe('承諾');
    expect(getActionLabels(root)[0]).toHaveAttribute('aria-label', '承諾 (Tab)');

    localization.dispose();
  });
});

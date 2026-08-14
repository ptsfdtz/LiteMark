const ACTIONS_SELECTOR = '.inlineSuggestionsHints .actions-container';
const PRIMARY_ACTION_SELECTOR =
  '.action-item.menu-entry > .action-label.inlineSuggestionStatusBarItemLabel';

export interface InlineSuggestionHintLocalization {
  setLabel: (label: string) => void;
  dispose: () => void;
}

function localizePrimaryAction(actions: HTMLElement, label: string): void {
  const actionLabel = actions.querySelector<HTMLElement>(PRIMARY_ACTION_SELECTOR);
  if (!actionLabel) return;

  const textNode = Array.from(actionLabel.childNodes).find((node) => node.nodeType === 3);
  if (!textNode) return;

  if (textNode.textContent !== label) {
    textNode.textContent = label;
  }

  const keybinding = actionLabel.querySelector<HTMLElement>('.keybinding')?.textContent?.trim();
  actionLabel.setAttribute('aria-label', keybinding ? `${label} (${keybinding})` : label);
}

export function connectInlineSuggestionHintLocalization(
  root: HTMLElement,
  initialLabel: string,
): InlineSuggestionHintLocalization {
  let currentLabel = initialLabel;

  const sync = () => {
    root
      .querySelectorAll<HTMLElement>(ACTIONS_SELECTOR)
      .forEach((actions) => localizePrimaryAction(actions, currentLabel));
  };

  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  sync();

  return {
    setLabel(label) {
      currentLabel = label;
      sync();
    },
    dispose() {
      observer.disconnect();
    },
  };
}

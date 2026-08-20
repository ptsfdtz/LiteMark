import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import type { AgentSession } from '@/modules/agent/useAgentSession';
import AgentPanel from './AgentPanel';

const session: AgentSession = {
  items: [],
  status: 'idle',
  error: null,
  send: vi.fn(async () => undefined),
  stop: vi.fn(),
  clear: vi.fn(),
  applyEdit: vi.fn(),
  respondPermission: vi.fn(),
};

describe('AgentPanel conversations', () => {
  it('offers creation, selection, and deletion for persisted chats', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const onCreateConversation = vi.fn();
    const onSelectConversation = vi.fn();
    const onRenameConversation = vi.fn();
    const onDeleteConversation = vi.fn();

    render(
      <I18nProvider>
        <AgentPanel
          session={session}
          conversations={[
            { id: 'first', title: 'Refactor the project', createdAt: 1, updatedAt: 1 },
            { id: 'second', title: 'Write release notes', createdAt: 2, updatedAt: 2 },
          ]}
          activeConversationId="first"
          scopeKind="project"
          onCreateConversation={onCreateConversation}
          onSelectConversation={onSelectConversation}
          onRenameConversation={onRenameConversation}
          onDeleteConversation={onDeleteConversation}
          isConfigured
          modelName="gpt-4o-mini"
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('Project')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write release notes' }));
    expect(onSelectConversation).toHaveBeenCalledWith('second');

    await user.click(screen.getByRole('button', { name: 'Delete chat: Refactor the project' }));
    expect(onDeleteConversation).toHaveBeenCalledWith('first');

    await user.click(screen.getAllByRole('button', { name: 'New chat' })[0]);
    expect(onCreateConversation).toHaveBeenCalledOnce();

    await user.dblClick(screen.getByRole('button', { name: 'Write release notes' }));
    const renameInput = screen.getByRole('textbox', { name: 'Rename chat' });
    await user.clear(renameInput);
    await user.type(renameInput, 'Project plan{Enter}');
    expect(onRenameConversation).toHaveBeenCalledWith('second', 'Project plan');
  });

  it('renders assistant responses as safe GitHub-flavored Markdown', () => {
    const markdownSession: AgentSession = {
      ...session,
      items: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            '## Result',
            '',
            '**Ready** with `inline code`:',
            '',
            '- First item',
            '- Second item',
            '',
            '| File | Status |',
            '| --- | --- |',
            '| note.md | Updated |',
            '',
            '```ts',
            'const answer = 42;',
            '```',
            '',
            '[Open docs](https://example.com)',
            '',
            '<script>alert("unsafe")</script>',
          ].join('\n'),
        },
      ],
    };

    const { container } = render(
      <I18nProvider>
        <AgentPanel
          session={markdownSession}
          conversations={[]}
          activeConversationId="first"
          scopeKind="project"
          onCreateConversation={vi.fn()}
          onSelectConversation={vi.fn()}
          onRenameConversation={vi.fn()}
          onDeleteConversation={vi.fn()}
          isConfigured
          modelName="gpt-4o-mini"
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('First item');
    expect(screen.getByRole('table')).toHaveTextContent('note.md');
    expect(screen.getByRole('link', { name: 'Open docs' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(container.querySelector('code.language-ts')).toHaveTextContent('const answer = 42;');
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });
});

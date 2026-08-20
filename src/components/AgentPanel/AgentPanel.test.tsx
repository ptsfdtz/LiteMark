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
  resume: vi.fn(async () => undefined),
  stop: vi.fn(),
  clear: vi.fn(),
  applyEdit: vi.fn(),
  respondPermission: vi.fn(),
};

describe('AgentPanel conversations', () => {
  it('offers to resume an interrupted run', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const resume = vi.fn(async () => undefined);

    render(
      <I18nProvider>
        <AgentPanel
          session={{
            ...session,
            resume,
            activeRun: {
              id: 'run-old',
              goal: 'Rewrite the project documentation',
              status: 'interrupted',
              stepCount: 2,
              retryCount: 0,
              plan: [],
              startedAt: 1,
              updatedAt: 2,
            },
          }}
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

    await user.click(screen.getByRole('button', { name: 'Start a new chat' }));
    expect(screen.getByText('Task interrupted')).toBeInTheDocument();
    expect(screen.getByText('Rewrite the project documentation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(resume).toHaveBeenCalledOnce();
  });

  it('opens on the chat home and supports selecting, archiving, and creating chats', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const onCreateConversation = vi.fn();
    const onSelectConversation = vi.fn();
    const onRenameConversation = vi.fn();
    const onArchiveConversation = vi.fn();

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
          onArchiveConversation={onArchiveConversation}
          onDeleteConversation={vi.fn()}
          isConfigured
          modelName="gpt-4o-mini"
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe the change you want…')).not.toBeVisible();
    const chatList = screen.getByRole('list', { name: 'Chats' });
    expect(screen.getByRole('button', { name: 'Refactor the project' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Write release notes' }));
    expect(onSelectConversation).toHaveBeenCalledWith('second');
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(chatList).not.toBeVisible();
    expect(screen.getByPlaceholderText('Describe the change you want…')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Back to chats' }));
    await user.click(screen.getByRole('button', { name: 'Archive chat: Refactor the project' }));
    expect(onArchiveConversation).toHaveBeenCalledWith('first');

    await user.click(screen.getByRole('button', { name: 'Start a new chat' }));
    expect(onCreateConversation).toHaveBeenCalledOnce();
  });

  it('restores or permanently deletes archived chats', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const onRestoreConversation = vi.fn();
    const onDeleteConversation = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <I18nProvider>
        <AgentPanel
          session={session}
          conversations={[
            { id: 'active', title: 'Current work', createdAt: 1, updatedAt: 3 },
            {
              id: 'archived',
              title: 'Old design review',
              createdAt: 1,
              updatedAt: 2,
              archivedAt: 2,
            },
          ]}
          activeConversationId="active"
          scopeKind="project"
          onCreateConversation={vi.fn()}
          onSelectConversation={vi.fn()}
          onRenameConversation={vi.fn()}
          onRestoreConversation={onRestoreConversation}
          onDeleteConversation={onDeleteConversation}
          isConfigured
          modelName="gpt-4o-mini"
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Archived chats' }));
    expect(screen.getByText('Old design review')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore chat: Old design review' }));
    expect(onRestoreConversation).toHaveBeenCalledWith('archived');

    await user.click(screen.getByRole('button', { name: 'Back to chats' }));
    await user.click(screen.getByRole('button', { name: 'Archived chats' }));
    await user.click(screen.getByRole('button', { name: 'Delete chat: Old design review' }));
    expect(confirm).toHaveBeenCalledWith(
      'Permanently delete this archived chat? This cannot be undone.',
    );
    expect(onDeleteConversation).toHaveBeenCalledWith('archived');
    confirm.mockRestore();
  });

  it('renders assistant responses as safe GitHub-flavored Markdown', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: 'Start a new chat' }));
    expect(screen.getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    expect(screen.getByText('First item').closest('ul')).toHaveTextContent('Second item');
    expect(screen.getByRole('table')).toHaveTextContent('note.md');
    expect(screen.getByRole('link', { name: 'Open docs' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(container.querySelector('code.language-ts')).toHaveTextContent('const answer = 42;');
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });

  it('keeps tool results collapsed until the user expands them', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const toolSession: AgentSession = {
      ...session,
      items: [
        { id: 'tool-1', role: 'tool', name: 'read_document', result: '# Hidden content' },
        { id: 'tool-2', role: 'tool', name: 'read_file', error: 'Unable to read file' },
        { id: 'tool-3', role: 'tool', name: 'list_documents' },
      ],
    };

    render(
      <I18nProvider>
        <AgentPanel
          session={toolSession}
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

    await user.click(screen.getByRole('button', { name: 'Start a new chat' }));
    const completedTool = screen.getByRole('button', { name: 'Read document, Completed' });
    const failedTool = screen.getByRole('button', { name: 'Read file, Failed' });
    expect(completedTool).toHaveAttribute('aria-expanded', 'false');
    expect(failedTool).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('# Hidden content').closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByText('Running')).toBeInTheDocument();

    await user.click(completedTool);
    expect(completedTool).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('# Hidden content').closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'false',
    );

    await user.click(failedTool);
    expect(failedTool).toHaveAttribute('aria-expanded', 'true');

    await user.click(completedTool);
    expect(completedTool).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses clear one-time, persistent, and deny actions for permissions', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const respondPermission = vi.fn();
    const permissionSession: AgentSession = {
      ...session,
      respondPermission,
      items: [
        {
          id: 'permission-1',
          role: 'permission',
          requestId: 12,
          name: 'rewrite_document',
          pending: true,
        },
      ],
    };

    render(
      <I18nProvider>
        <AgentPanel
          session={permissionSession}
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

    await user.click(screen.getByRole('button', { name: 'Start a new chat' }));
    await user.click(screen.getByRole('button', { name: 'Allow' }));
    await user.click(screen.getByRole('button', { name: 'Always allow' }));
    await user.click(screen.getByRole('button', { name: 'Deny' }));

    expect(respondPermission).toHaveBeenNthCalledWith(1, 12, true);
    expect(respondPermission).toHaveBeenNthCalledWith(2, 12, true, true);
    expect(respondPermission).toHaveBeenNthCalledWith(3, 12, false);
  });
});

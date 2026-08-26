import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/locales';
import type { AgentSession } from '@/modules/agent/useAgentSession';
import AgentPanel from '@/components/AgentPanel/AgentPanel';

const session: AgentSession = {
  items: [],
  status: 'idle',
  error: null,
  send: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  stop: vi.fn(),
  clear: vi.fn(),
  applyEdit: vi.fn(),
  resolveTaskChanges: vi.fn(async () => undefined),
  respondPermission: vi.fn(),
};

describe('AgentPanel conversations', () => {
  it('shows task-level file stats and resolves all changes together', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const user = userEvent.setup();
    const resolveTaskChanges = vi.fn(async () => undefined);
    render(
      <I18nProvider>
        <AgentPanel
          session={{
            ...session,
            resolveTaskChanges,
            items: [
              {
                id: 'changes-1',
                role: 'task-changes',
                checkpointId: 'run-1',
                added: 2,
                removed: 1,
                resolution: 'pending',
                files: [
                  {
                    path: 'notes/a.md',
                    status: 'modified',
                    added: 2,
                    removed: 1,
                    before: '# Old',
                    after: '# New\nBody',
                  },
                ],
              },
            ],
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
    expect(screen.getByText('1 files changed')).toBeVisible();
    expect(screen.getByText('notes/a.md')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Revert all' }));
    expect(resolveTaskChanges).toHaveBeenCalledWith('changes-1', 'revert');
  });

  it('groups completed file write approvals and results', async () => {
    window.localStorage.setItem('litemark.locale', 'en');
    const firstArgs = '{"path":"notes/a.md","content":"alpha"}';
    const secondArgs = '{"path":"notes/b.md","content":"beta"}';

    render(
      <I18nProvider>
        <AgentPanel
          session={{
            ...session,
            items: [
              {
                id: 'permission-1',
                role: 'permission',
                requestId: 1,
                name: 'write_file',
                arguments: firstArgs,
                pending: false,
                decision: 'allow',
              },
              {
                id: 'write-1',
                role: 'tool',
                name: 'write_file',
                arguments: firstArgs,
                result: 'File written.',
              },
              {
                id: 'permission-2',
                role: 'permission',
                requestId: 2,
                name: 'write_file',
                arguments: secondArgs,
                pending: false,
                decision: 'allow',
              },
              {
                id: 'write-2',
                role: 'tool',
                name: 'write_file',
                arguments: secondArgs,
                result: 'File written.',
              },
            ],
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

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Start a new chat' }));
    const group = screen.getByRole('button', { name: 'Write files, Completed' });
    expect(group).toBeVisible();
    expect(screen.getByText('2 files')).toBeVisible();
    expect(screen.queryByText('Permission required')).not.toBeInTheDocument();
    await user.click(group);
    expect(screen.getByText('notes/a.md')).toBeVisible();
    await user.click(screen.getByText('notes/b.md'));
    expect(screen.getByText('beta')).toBeVisible();
  });

  it('groups consecutive file reads into one compact status card', async () => {
    window.localStorage.setItem('litemark.locale', 'en');

    render(
      <I18nProvider>
        <AgentPanel
          session={{
            ...session,
            items: [
              {
                id: 'read-1',
                role: 'tool',
                name: 'read_file',
                arguments: '{"path":"notes/a.md"}',
                result: 'alpha',
              },
              {
                id: 'read-2',
                role: 'tool',
                name: 'read_file',
                arguments: '{"path":"notes/b.md"}',
                result: 'beta',
              },
              {
                id: 'read-3',
                role: 'tool',
                name: 'read_files',
                arguments: '{"paths":["notes/c.md","notes/d.md"]}',
                result: JSON.stringify({
                  files: [
                    { path: 'notes/c.md', content: 'charlie', truncated: false },
                    { path: 'notes/d.md', content: 'delta', truncated: false },
                  ],
                  truncated: false,
                }),
              },
            ],
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

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Start a new chat' }));
    const group = screen.getByRole('button', { name: 'Read files, Completed' });
    expect(group).toBeVisible();
    expect(screen.getByText('4 files')).toBeVisible();
    expect(screen.getAllByText('Read files')).toHaveLength(1);
    await user.click(group);
    expect(screen.getByText('notes/a.md')).toBeVisible();
    expect(screen.getByText('notes/d.md')).toBeVisible();
    await user.click(screen.getByText('notes/c.md'));
    expect(screen.getByText('charlie')).toBeVisible();
  });

  it('renders agent plans as dedicated task progress', async () => {
    window.localStorage.setItem('litemark.locale', 'en');

    render(
      <I18nProvider>
        <AgentPanel
          session={{
            ...session,
            items: [
              {
                id: 'plan-1',
                role: 'plan',
                steps: [
                  { id: 'inspect', description: 'Inspect the document', status: 'completed' },
                  { id: 'edit', description: 'Apply the changes', status: 'in_progress' },
                  { id: 'verify', description: 'Verify the result', status: 'pending' },
                ],
              },
            ],
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

    await userEvent.click(screen.getByRole('button', { name: 'Start a new chat' }));
    expect(screen.getByRole('region', { name: 'Task progress' })).toBeVisible();
    expect(screen.getByText('1/3 completed')).toBeVisible();
    expect(screen.getByText('Apply the changes')).toBeVisible();
    expect(screen.queryByText('update_plan')).not.toBeInTheDocument();
  });

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
    await user.click(screen.getByRole('button', { name: 'Allow all in this chat' }));
    await user.click(screen.getByRole('button', { name: 'Deny' }));

    expect(respondPermission).toHaveBeenNthCalledWith(1, 12, true);
    expect(respondPermission).toHaveBeenNthCalledWith(2, 12, true, true);
    expect(respondPermission).toHaveBeenNthCalledWith(3, 12, false);
  });
});

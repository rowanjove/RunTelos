import { describe, expect, it, vi } from 'vitest';
import { buildTaskActions } from './actionRegistry';
import type { TaskItem } from '../../types';

function sampleTask(type: TaskItem['type'] = 'bat'): TaskItem {
  return {
    id: 'task-1',
    name: 'Sample Task',
    type,
    favorite: false,
    path: 'C:\\Scripts\\test.bat',
    command: type === 'wsl' ? 'echo hello' : undefined,
    url: type === 'url' ? 'https://example.com' : undefined,
    args: '',
    runAsAdmin: false,
    keepWindowOpen: true,
    order: 0,
    aliases: [],
  };
}

describe('Action Registry', () => {
  it('builds full registry of standard task actions', () => {
    const handlers = {
      onRun: vi.fn(),
      onEdit: vi.fn(),
      onToggleFavorite: vi.fn(),
      onReveal: vi.fn(),
      onDuplicate: vi.fn(),
      onDelete: vi.fn(),
    };

    const actions = buildTaskActions(handlers);
    const actionIds = actions.map((a) => a.id);

    expect(actionIds).toContain('run');
    expect(actionIds).toContain('run-admin');
    expect(actionIds).toContain('toggle-favorite');
    expect(actionIds).toContain('edit');
    expect(actionIds).toContain('reveal');
    expect(actionIds).toContain('copy-path');
    expect(actionIds).toContain('duplicate');
    expect(actionIds).toContain('delete');
  });

  it('filters availability correctly for url vs file tasks', () => {
    const handlers = {
      onRun: vi.fn(),
      onEdit: vi.fn(),
      onToggleFavorite: vi.fn(),
      onReveal: vi.fn(),
      onDuplicate: vi.fn(),
      onDelete: vi.fn(),
    };

    const actions = buildTaskActions(handlers);
    const runAdminAction = actions.find((a) => a.id === 'run-admin')!;
    const revealAction = actions.find((a) => a.id === 'reveal')!;

    const fileTask = sampleTask('bat');
    const urlTask = sampleTask('url');

    expect(runAdminAction.isAvailable(fileTask)).toBe(true);
    expect(runAdminAction.isAvailable(urlTask)).toBe(false);

    expect(revealAction.isAvailable(fileTask)).toBe(true);
    expect(revealAction.isAvailable(urlTask)).toBe(false);
  });

  it('executes the bound handler when action is triggered', async () => {
    const onRun = vi.fn();
    const actions = buildTaskActions({
      onRun,
      onEdit: vi.fn(),
      onToggleFavorite: vi.fn(),
      onReveal: vi.fn(),
      onDuplicate: vi.fn(),
      onDelete: vi.fn(),
    });

    const task = sampleTask('bat');
    const runAction = actions.find((a) => a.id === 'run')!;
    await runAction.execute(task);

    expect(onRun).toHaveBeenCalledWith(task, false);

    const runAdminAction = actions.find((a) => a.id === 'run-admin')!;
    await runAdminAction.execute(task);

    expect(onRun).toHaveBeenCalledWith(task, true);
  });
});

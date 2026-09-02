import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import type { TaskAction, TaskGroup, TaskItem } from '../../types';

function sampleTask(id: string, name: string, aliases: string[] = []): TaskItem {
  return {
    id,
    name,
    type: 'bat',
    favorite: false,
    path: `C:\\Scripts\\${id}.bat`,
    args: '',
    runAsAdmin: false,
    keepWindowOpen: true,
    order: 0,
    aliases,
  };
}

const sampleGroups: TaskGroup[] = [
  { id: 'dev', name: 'Development', order: 0 },
];

const sampleActions: TaskAction[] = [
  { id: 'run', label: '运行', isAvailable: () => true, execute: vi.fn() },
  { id: 'edit', label: '编辑任务', isAvailable: () => true, execute: vi.fn() },
];

describe('CommandPalette', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette
        open={false}
        tasks={[sampleTask('1', 'Docker')]}
        groups={sampleGroups}
        actions={sampleActions}
        recentTaskIds={[]}
        onClose={vi.fn()}
        onRunTask={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders search input and task list when open', () => {
    render(
      <CommandPalette
        open={true}
        tasks={[
          sampleTask('1', 'Start Docker', ['dk']),
          sampleTask('2', 'Clean Temp', ['clean']),
        ]}
        groups={sampleGroups}
        actions={sampleActions}
        recentTaskIds={[]}
        onClose={vi.fn()}
        onRunTask={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('搜索任务、别名、分组或类型... (Alt+Space)')).toBeInTheDocument();
    expect(screen.getByText('Start Docker')).toBeInTheDocument();
    expect(screen.getByText('Clean Temp')).toBeInTheDocument();
  });

  it('filters tasks by alias or keyword', () => {
    render(
      <CommandPalette
        open={true}
        tasks={[
          sampleTask('1', 'Start Docker', ['dk']),
          sampleTask('2', 'Clean Temp', ['cleanup']),
        ]}
        groups={sampleGroups}
        actions={sampleActions}
        recentTaskIds={[]}
        onClose={vi.fn()}
        onRunTask={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('搜索任务、别名、分组或类型... (Alt+Space)');
    fireEvent.change(input, { target: { value: 'dk' } });

    expect(screen.getByText('Start Docker')).toBeInTheDocument();
    expect(screen.queryByText('Clean Temp')).not.toBeInTheDocument();
  });

  it('calls onRunTask on Enter key', () => {
    const onRunTask = vi.fn();
    const tasks = [sampleTask('1', 'Start Docker')];

    render(
      <CommandPalette
        open={true}
        tasks={tasks}
        groups={sampleGroups}
        actions={sampleActions}
        recentTaskIds={[]}
        onClose={vi.fn()}
        onRunTask={onRunTask}
      />,
    );

    const overlay = screen.getByText('Start Docker').closest('.palette-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter' });

    expect(onRunTask).toHaveBeenCalledWith(tasks[0], false);
  });
});

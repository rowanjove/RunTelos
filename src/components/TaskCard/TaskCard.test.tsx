import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskCard } from './TaskCard';
import type { TaskAction, TaskItem } from '../../types';

function sampleTask(id: string, name: string): TaskItem {
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
    aliases: [],
  };
}

const sampleActions: TaskAction[] = [
  { id: 'run', label: '运行', isAvailable: () => true, execute: vi.fn() },
  { id: 'edit', label: '编辑任务', isAvailable: () => true, execute: vi.fn() },
];

describe('TaskCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders task card with icon, name, and type label', () => {
    const task = sampleTask('t1', 'Start Backend');
    render(
      <TaskCard
        task={task}
        actions={sampleActions}
        onRun={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByText('Start Backend')).toBeInTheDocument();
    expect(screen.getByText('BAT / CMD')).toBeInTheDocument();
  });

  it('calls onRun when card is clicked', () => {
    const task = sampleTask('t1', 'Start Backend');
    const onRun = vi.fn();
    render(
      <TaskCard
        task={task}
        actions={sampleActions}
        onRun={onRun}
        onToggleFavorite={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Start Backend'));
    expect(onRun).toHaveBeenCalledWith(task);
  });

  it('calls onToggleFavorite when star is clicked', () => {
    const task = sampleTask('t1', 'Start Backend');
    const onToggleFavorite = vi.fn();
    render(
      <TaskCard
        task={task}
        actions={sampleActions}
        onRun={vi.fn()}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    const favBtn = screen.getByTitle('收藏');
    fireEvent.click(favBtn);
    expect(onToggleFavorite).toHaveBeenCalledWith(task);
  });

  it('supports keyboard shortcuts on the focused task card', () => {
    const run = vi.fn();
    const edit = vi.fn();
    const task = sampleTask('t1', 'Start Backend');
    const actions: TaskAction[] = [
      { id: 'run', label: '运行', isAvailable: () => true, execute: run },
      { id: 'edit', label: '编辑任务', isAvailable: () => true, execute: edit },
    ];
    const { container } = render(
      <TaskCard
        task={task}
        actions={actions}
        onRun={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const card = container.querySelector('[data-task-id="t1"]');
    expect(card).not.toBeNull();
    fireEvent.keyDown(card!, { key: 'Enter' });
    fireEvent.keyDown(card!, { key: 'F2' });

    expect(run).toHaveBeenCalledWith(task);
    expect(edit).toHaveBeenCalledWith(task);
  });

  it('opens the action menu with Ctrl+K', () => {
    const task = sampleTask('t1', 'Start Backend');
    const { container } = render(
      <TaskCard
        task={task}
        actions={sampleActions}
        onRun={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const card = container.querySelector('[data-task-id="t1"]');
    fireEvent.keyDown(card!, { key: 'k', ctrlKey: true });
    expect(screen.getByText('运行')).toBeInTheDocument();
  });

  it('moves focus between task cards with arrow keys', () => {
    const first = sampleTask('t1', 'First');
    const second = sampleTask('t2', 'Second');
    const { container } = render(
      <>
        <TaskCard
          task={first}
          actions={sampleActions}
          onRun={vi.fn()}
          onToggleFavorite={vi.fn()}
        />
        <TaskCard
          task={second}
          actions={sampleActions}
          onRun={vi.fn()}
          onToggleFavorite={vi.fn()}
        />
      </>,
    );

    const cards = container.querySelectorAll<HTMLElement>('[data-task-id]');
    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cards[1]);
  });
});

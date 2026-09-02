import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupSidebar } from './GroupSidebar';
import type { TaskGroup, TaskItem } from '../../types';

function sampleTask(id: string, name: string, groupId?: string, favorite: boolean = false): TaskItem {
  return {
    id,
    name,
    type: 'bat',
    groupId,
    favorite,
    path: `C:\\Scripts\\${id}.bat`,
    args: '',
    runAsAdmin: false,
    keepWindowOpen: true,
    order: 0,
    aliases: [],
  };
}

const sampleGroups: TaskGroup[] = [
  { id: 'dev', name: 'Development', order: 0 },
  { id: 'sys', name: 'System', order: 1 },
];

describe('GroupSidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders views and groups in expanded mode', () => {
    const onSelectCategory = vi.fn();
    render(
      <GroupSidebar
        groups={sampleGroups}
        tasks={[sampleTask('1', 'T1', 'dev', true), sampleTask('2', 'T2', 'sys')]}
        selectedCategory="all"
        onSelectCategory={onSelectCategory}
        onCreateGroup={vi.fn()}
        onUpdateGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        compact={false}
      />,
    );

    expect(screen.getByText('全部任务')).toBeInTheDocument();
    expect(screen.getByText('收藏')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Development'));
    expect(onSelectCategory).toHaveBeenCalledWith('dev');
  });

  it('renders pills in compact mode', () => {
    const onSelectCategory = vi.fn();
    render(
      <GroupSidebar
        groups={sampleGroups}
        tasks={[sampleTask('1', 'T1', 'dev')]}
        selectedCategory="all"
        onSelectCategory={onSelectCategory}
        onCreateGroup={vi.fn()}
        onUpdateGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        compact={true}
      />,
    );

    expect(screen.getByText('全部 (1)')).toBeInTheDocument();
    expect(screen.getByText('Development (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Development (1)'));
    expect(onSelectCategory).toHaveBeenCalledWith('dev');
  });
});

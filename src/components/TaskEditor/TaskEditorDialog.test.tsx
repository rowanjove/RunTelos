import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskEditorDialog } from './TaskEditorDialog';
import type { TaskGroup, TaskItem } from '../../types';

const sampleGroups: TaskGroup[] = [
  { id: 'dev', name: 'Development', order: 0 },
];

describe('TaskEditorDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders add tabs and inputs', () => {
    render(
      <TaskEditorDialog
        open={true}
        groups={sampleGroups}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('添加新任务')).toBeInTheDocument();
    expect(screen.getByText('本地文件 / 脚本')).toBeInTheDocument();
    expect(screen.getByText('命令行命令')).toBeInTheDocument();
    expect(screen.getByText('网站 / URL')).toBeInTheDocument();
  });

  it('switches between categories and shows relevant fields', () => {
    render(
      <TaskEditorDialog
        open={true}
        groups={sampleGroups}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('命令行命令'));
    expect(screen.getByText('执行环境 Shell（v2.0）')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'WSL (bash)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PowerShell' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'CMD' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('npm run build && npm start')).toBeInTheDocument();

    fireEvent.click(screen.getByText('网站 / URL'));
    expect(screen.getByPlaceholderText('https://localhost:3000 或 https://example.com')).toBeInTheDocument();
  });

  it('validates empty inputs on submit', () => {
    const onSave = vi.fn();
    render(
      <TaskEditorDialog
        open={true}
        groups={sampleGroups}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByText('确认添加'));

    expect(screen.getByText('请输入任务名称')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits valid task payload', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskEditorDialog
        open={true}
        groups={sampleGroups}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('例如: 启动本地开发环境'), {
      target: { value: 'Build Job' },
    });
    fireEvent.change(screen.getByPlaceholderText('C:\\Scripts\\run.bat'), {
      target: { value: 'C:\\Scripts\\run.bat' },
    });

    fireEvent.click(screen.getByText('确认添加'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Build Job',
        path: 'C:\\Scripts\\run.bat',
        type: 'bat',
      }),
    );
  });
});

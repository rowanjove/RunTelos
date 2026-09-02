import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLaunchHistory: vi.fn(),
}));

vi.mock('../../services/tauri', () => ({
  tauriService: {
    getLaunchHistory: mocks.getLaunchHistory,
  },
}));

import { LaunchHistoryDialog } from './LaunchHistoryDialog';

describe('LaunchHistoryDialog', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads and renders successful and failed launch records', async () => {
    mocks.getLaunchHistory.mockResolvedValue([
      {
        id: 'record-2',
        taskId: 'task-2',
        taskName: 'Deploy',
        startedAt: '1710000000',
        status: 'failed',
        error: '脚本退出码 1',
      },
      {
        id: 'record-1',
        taskId: 'task-1',
        taskName: 'Build',
        startedAt: '1709990000',
        status: 'launched',
      },
    ]);

    render(<LaunchHistoryDialog open onClose={vi.fn()} />);

    await waitFor(() => expect(mocks.getLaunchHistory).toHaveBeenCalledOnce());
    expect(screen.getByText('Deploy')).toBeInTheDocument();
    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('启动失败')).toBeInTheDocument();
    expect(
      screen.getByText((content, element) =>
        Boolean(element?.classList.contains('launch-history-error') && content.includes('脚本退出码 1')),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('已启动')).toBeInTheDocument();
    expect(screen.getByText('最近 2 条记录')).toBeInTheDocument();
  });

  it('refreshes records and shows the empty state', async () => {
    mocks.getLaunchHistory.mockResolvedValue([]);
    render(<LaunchHistoryDialog open onClose={vi.fn()} />);

    expect(await screen.findByText('还没有启动记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新启动历史' }));

    await waitFor(() => expect(mocks.getLaunchHistory).toHaveBeenCalledTimes(2));
    expect(screen.getByText('最近 0 条记录')).toBeInTheDocument();
  });

  it('does not load while closed', () => {
    render(<LaunchHistoryDialog open={false} onClose={vi.fn()} />);
    expect(mocks.getLaunchHistory).not.toHaveBeenCalled();
    expect(screen.queryByText('启动历史')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    mocks.getLaunchHistory.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<LaunchHistoryDialog open onClose={onClose} />);

    await screen.findByText('还没有启动记录');
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

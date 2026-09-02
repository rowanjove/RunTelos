import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../../types';

const mocks = vi.hoisted(() => ({
  restoreConfigBackup: vi.fn(),
  openConfigFolder: vi.fn(),
}));

vi.mock('../../services/tauri', () => ({
  tauriService: {
    restoreConfigBackup: mocks.restoreConfigBackup,
    openConfigFolder: mocks.openConfigFolder,
    saveConfig: vi.fn(),
    importConfig: vi.fn(),
  },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

import { RecoveryDialog } from './RecoveryDialog';

const config: Config = {
  version: 2,
  settings: {
    alwaysOnTop: false,
    theme: 'system',
    closeToTray: false,
    keepWindowOpen: true,
    pythonSilent: false,
    hideAfterRun: true,
    globalHotkey: 'Alt+Space',
    windowMode: 'compact',
  },
  groups: [],
  tasks: [],
};

describe('RecoveryDialog', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('restores the newest automatic backup', async () => {
    const onRecovered = vi.fn();
    mocks.restoreConfigBackup.mockResolvedValue(config);

    render(<RecoveryDialog error="invalid json" onRecovered={onRecovered} />);
    fireEvent.click(screen.getByText('恢复自动备份 (Restore automatic backup)'));

    await waitFor(() => {
      expect(mocks.restoreConfigBackup).toHaveBeenCalledWith(1);
      expect(onRecovered).toHaveBeenCalledWith(config);
    });
  });

  it('restores an older automatic backup slot', async () => {
    const onRecovered = vi.fn();
    mocks.restoreConfigBackup.mockResolvedValue(config);

    render(<RecoveryDialog error="invalid json" onRecovered={onRecovered} />);
    fireEvent.change(screen.getByLabelText('备份槽位（1 最新，3 最旧）'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('恢复自动备份 (Restore automatic backup)'));

    await waitFor(() => expect(mocks.restoreConfigBackup).toHaveBeenCalledWith(3));
  });

  it('opens the config folder without leaving recovery', async () => {
    mocks.openConfigFolder.mockResolvedValue(undefined);

    render(<RecoveryDialog error="invalid json" onRecovered={vi.fn()} />);
    fireEvent.click(screen.getByText('打开配置目录 (Open config folder)'));

    await waitFor(() => expect(mocks.openConfigFolder).toHaveBeenCalledOnce());
    expect(screen.getByText('配置文件读取异常')).toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types';

const mocks = vi.hoisted(() => ({
  getDiagnostics: vi.fn(),
}));

vi.mock('../../services/tauri', () => ({
  tauriService: {
    getDiagnostics: mocks.getDiagnostics,
    exportConfig: vi.fn(),
    importConfig: vi.fn(),
  },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

import { SettingsDialog } from './SettingsDialog';

const settings: Settings = {
  alwaysOnTop: false,
  theme: 'dark',
  closeToTray: true,
  keepWindowOpen: true,
  pythonSilent: false,
  hideAfterRun: true,
  globalHotkey: 'Alt+Space',
  windowMode: 'compact',
};

describe('SettingsDialog', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a sanitized diagnostics path', async () => {
    mocks.getDiagnostics.mockResolvedValue({
      appVersion: '0.9.1',
      configPath: '%APPDATA%\\ScriptLauncher\\config.json',
      configVersion: 2,
      taskCount: 4,
      groupCount: 2,
      osName: 'windows',
    });

    render(
      <SettingsDialog
        open
        settings={settings}
        onClose={vi.fn()}
        onUpdateSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('诊断信息 (Diagnostics)'));
    await waitFor(() => expect(screen.getByText('%APPDATA%\\ScriptLauncher\\config.json')).toBeInTheDocument());
    expect(screen.queryByText(/C:\\Users\\/)).not.toBeInTheDocument();
  });

  it('exposes the launch history entry from the data tab', () => {
    mocks.getDiagnostics.mockResolvedValue(null);
    const onOpenHistory = vi.fn();

    render(
      <SettingsDialog
        open
        settings={settings}
        onClose={vi.fn()}
        onUpdateSettings={vi.fn()}
        onOpenHistory={onOpenHistory}
      />,
    );

    fireEvent.click(screen.getByText('数据与备份 (Data)'));
    fireEvent.click(screen.getByText('查看启动历史'));

    expect(onOpenHistory).toHaveBeenCalledOnce();
  });

  it('keeps hotkey edits as a draft until the field is committed', async () => {
    mocks.getDiagnostics.mockResolvedValue(null);
    const onUpdateSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsDialog
        open
        settings={settings}
        onClose={vi.fn()}
        onUpdateSettings={onUpdateSettings}
      />,
    );

    fireEvent.click(screen.getByText('快捷键 (Hotkeys)'));
    const input = screen.getByLabelText('全局唤出快捷键');
    fireEvent.change(input, { target: { value: 'Ctrl+Shift+J' } });
    expect(onUpdateSettings).not.toHaveBeenCalled();

    fireEvent.blur(input);
    await waitFor(() =>
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ globalHotkey: 'CommandOrControl+Shift+J' }),
      ),
    );
  });
});

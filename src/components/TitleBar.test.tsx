import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TitleBar } from './TitleBar/TitleBar';

const mocks = vi.hoisted(() => ({
  minimize: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mocks,
}));

describe('TitleBar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders title logo, search trigger, and action buttons', () => {
    const onOpenPalette = vi.fn();
    const onOpenSettings = vi.fn();
    const onToggleTheme = vi.fn();
    const onToggleWindowMode = vi.fn();
    const onOpenAdd = vi.fn();

    render(
      <TitleBar
        theme="dark"
        windowMode="compact"
        onToggleWindowMode={onToggleWindowMode}
        onToggleTheme={onToggleTheme}
        onOpenSettings={onOpenSettings}
        onOpenPalette={onOpenPalette}
        onOpenAdd={onOpenAdd}
      />,
    );

    expect(screen.getByText('启动快捷运行')).toBeInTheDocument();
    expect(screen.getByText('RunTelos')).toBeInTheDocument();
    expect(screen.getByText('搜索任务...')).toBeInTheDocument();

    fireEvent.click(screen.getByText('搜索任务...'));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('设置 (Ctrl+,)'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('切换主题 (当前: dark)'));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('添加新任务 (Ctrl+N)'));
    expect(onOpenAdd).toHaveBeenCalledTimes(1);
  });
});

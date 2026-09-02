import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config, TaskItem } from './types';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  minimize: vi.fn(),
  close: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
  setFocus: vi.fn(),
  setSize: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setAlwaysOnTop: mocks.setAlwaysOnTop,
    minimize: mocks.minimize,
    close: mocks.close,
    hide: mocks.hide,
    show: mocks.show,
    setFocus: mocks.setFocus,
    setSize: mocks.setSize,
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mocks.open,
  save: mocks.save,
}));

import App from './App';

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

function sampleConfig(tasks: TaskItem[] = []): Config {
  return {
    version: 2,
    settings: {
      alwaysOnTop: false,
      theme: 'dark',
      closeToTray: true,
      keepWindowOpen: true,
      pythonSilent: false,
      hideAfterRun: true,
      globalHotkey: 'Alt+Space',
      windowMode: 'compact',
    },
    groups: [
      { id: 'dev', name: 'Development', order: 0 },
      { id: 'sys', name: 'System', order: 1 },
    ],
    tasks,
  };
}

describe('App v2', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders tasks and triggers run when task card is clicked', async () => {
    const config = sampleConfig([sampleTask('task-1', 'Build Project')]);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'load_config') return Promise.resolve(config);
      if (command === 'run_task') return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText('Build Project')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Build Project'));

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('run_task', {
        id: 'task-1',
        forceAdmin: false,
      }),
    );
  });

  it('opens command palette and searches for tasks', async () => {
    const config = sampleConfig([
      sampleTask('t1', 'Start Docker'),
      sampleTask('t2', 'Clean Temp'),
    ]);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'load_config') return Promise.resolve(config);
      return Promise.resolve(undefined);
    });

    render(<App />);

    await screen.findByText('Start Docker');

    // Click search trigger in title bar
    fireEvent.click(screen.getByText('搜索任务...'));

    const searchInput = await screen.findByPlaceholderText(
      '搜索任务、别名、分组或类型... (Alt+Space)',
    );
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Docker' } });

    expect(screen.getAllByText('Start Docker').length).toBeGreaterThan(0);
  });

  it('opens and saves new task dialog', async () => {
    const config = sampleConfig([]);
    mocks.invoke.mockImplementation((command: string, payload?: any) => {
      if (command === 'load_config') return Promise.resolve(config);
      if (command === 'create_task') {
        return Promise.resolve({
          ...config,
          tasks: [sampleTask('new-1', payload.request.name)],
        });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);

    const addBtn = await screen.findByText('添加任务 (Ctrl+N)');
    fireEvent.click(addBtn);

    expect(screen.getByText('添加新任务')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('例如: 启动本地开发环境'), {
      target: { value: 'My New Script' },
    });
    fireEvent.change(screen.getByPlaceholderText('C:\\Scripts\\run.bat'), {
      target: { value: 'C:\\Scripts\\run.bat' },
    });

    fireEvent.click(screen.getByText('确认添加'));

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('create_task', expect.anything()),
    );
  });

  it('opens settings dialog and toggles settings', async () => {
    const config = sampleConfig([]);
    mocks.invoke.mockImplementation((command: string, payload?: any) => {
      if (command === 'load_config') return Promise.resolve(config);
      if (command === 'update_settings') {
        return Promise.resolve({ ...config, settings: payload.settings });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);

    await screen.findByText('启动快捷运行');

    fireEvent.click(screen.getByTitle('设置 (Ctrl+,)'));

    expect(screen.getByText('常规 (General)')).toBeInTheDocument();
    expect(screen.getByText('窗口置顶 (Always on top)')).toBeInTheDocument();
  });

  it('opens the independent launch history from the data settings tab', async () => {
    const config = sampleConfig([]);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'load_config') return Promise.resolve(config);
      if (command === 'get_diagnostics') {
        return Promise.resolve({
          appVersion: '0.9.1',
          configPath: '%APPDATA%\\ScriptLauncher\\config.json',
          configVersion: 2,
          taskCount: 0,
          groupCount: 2,
          osName: 'windows',
        });
      }
      if (command === 'get_launch_history') {
        return Promise.resolve([
          {
            id: 'history-1',
            taskId: 'task-1',
            taskName: 'Build Project',
            startedAt: '1710000000',
            status: 'launched',
          },
        ]);
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    await screen.findByText('启动快捷运行');
    fireEvent.click(screen.getByTitle('设置 (Ctrl+,)'));
    fireEvent.click(screen.getByText('数据与备份 (Data)'));
    fireEvent.click(screen.getByText('查看启动历史'));

    expect(await screen.findByText('启动历史')).toBeInTheDocument();
    expect(await screen.findByText('Build Project')).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith('get_launch_history', { taskId: null });
  });

  it('applies the selected window mode to the native window size', async () => {
    const config = sampleConfig([]);
    mocks.invoke.mockImplementation((command: string, payload?: any) => {
      if (command === 'load_config') return Promise.resolve(config);
      if (command === 'update_settings') {
        return Promise.resolve({ ...config, settings: payload.settings });
      }
      return Promise.resolve(undefined);
    });

    render(<App />);
    await screen.findByText('暂无任务');

    fireEvent.click(screen.getByTitle('切换为展开双栏模式'));

    await waitFor(() =>
      expect(mocks.setSize).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'Logical', width: 680, height: 600 }),
      ),
    );
  });

  it('persists a dropped task move through the group-aware command', async () => {
    const source = sampleTask('source', 'Source Task');
    source.groupId = 'sys';
    const target = sampleTask('target', 'Target Task');
    target.groupId = 'dev';
    const config = sampleConfig([source, target]);
    mocks.invoke.mockImplementation((command: string, payload?: any) => {
      if (command === 'load_config') return Promise.resolve(config);
      if (command === 'move_task') {
        expect(payload).toEqual({ id: 'source', groupId: 'dev', order: 0 });
        return Promise.resolve({
          ...config,
          tasks: [
            { ...target, order: 0 },
            { ...source, groupId: 'dev', order: 1 },
          ],
        });
      }
      return Promise.resolve(undefined);
    });

    const { container } = render(<App />);
    await screen.findByText('Source Task');
    const targetCard = container.querySelector('[data-task-id="target"]');
    expect(targetCard).not.toBeNull();
    fireEvent.drop(targetCard!, {
      dataTransfer: { getData: () => 'source' },
    });

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('move_task', expect.anything()));
  });

  it('requires confirmation before deleting a task', async () => {
    const config = sampleConfig([sampleTask('task-1', 'Build Project')]);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'load_config') return Promise.resolve(config);
      return Promise.resolve(undefined);
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<App />);
    await screen.findByText('Build Project');
    fireEvent.click(screen.getByTitle('操作菜单'));
    fireEvent.click(screen.getByText('删除任务'));

    expect(confirm).toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalledWith('delete_task_item', expect.anything());
    confirm.mockRestore();
  });

  it('shows RecoveryDialog when configuration loading fails', async () => {
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'load_config') {
        return Promise.reject('JSON parse error at line 1');
      }
      return Promise.resolve(undefined);
    });

    render(<App />);

    expect(await screen.findByText('配置文件读取异常')).toBeInTheDocument();
    expect(screen.getByText('导入备份文件 (Import backup)')).toBeInTheDocument();
    expect(screen.getByText('恢复自动备份 (Restore automatic backup)')).toBeInTheDocument();
    expect(screen.getByText('打开配置目录 (Open config folder)')).toBeInTheDocument();
    expect(screen.getByText('以默认配置重新开始 (Start fresh)')).toBeInTheDocument();
  });
});

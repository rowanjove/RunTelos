import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import type { Config, DiagnosticsInfo, LaunchRecord, Settings, TaskItem } from '../types';

export interface CreateTaskParams {
  name: string;
  scriptType: string;
  groupId?: string;
  favorite?: boolean;
  path?: string;
  command?: string;
  url?: string;
  args?: string;
  workingDirectory?: string;
  runAsAdmin?: boolean;
  keepWindowOpen?: boolean;
  aliases?: string[];
}

export interface UpdateTaskParams {
  id: string;
  name: string;
  scriptType: string;
  groupId?: string;
  favorite?: boolean;
  path?: string;
  command?: string;
  url?: string;
  args: string;
  workingDirectory?: string;
  runAsAdmin?: boolean;
  keepWindowOpen?: boolean;
  aliases?: string[];
}

export const tauriService = {
  compactWindowSize: { width: 360, height: 560 },
  expandedWindowSize: { width: 680, height: 600 },

  async loadConfig(): Promise<Config> {
    return invoke<Config>('load_config');
  },

  async saveConfig(config: Config): Promise<Config> {
    return invoke<Config>('save_config', { config });
  },

  async createTask(params: CreateTaskParams): Promise<Config> {
    return invoke<Config>('create_task', { request: params });
  },

  async updateTask(params: UpdateTaskParams): Promise<Config> {
    return invoke<Config>('update_task_item', { request: params });
  },

  async deleteTask(id: string): Promise<Config> {
    return invoke<Config>('delete_task_item', { id });
  },

  async toggleTaskFavorite(id: string): Promise<Config> {
    return invoke<Config>('toggle_task_favorite', { id });
  },

  async reorderTasks(orderedIds: string[]): Promise<Config> {
    return invoke<Config>('reorder_task_items', { orderedIds });
  },

  async moveTask(id: string, groupId: string | undefined, order: number): Promise<Config> {
    return invoke<Config>('move_task', { id, groupId: groupId ?? null, order });
  },

  async createGroup(name: string, icon?: string): Promise<Config> {
    return invoke<Config>('create_group_item', { name, icon });
  },

  async updateGroup(id: string, name: string, icon?: string): Promise<Config> {
    return invoke<Config>('update_group_item', { id, name, icon });
  },

  async deleteGroup(id: string): Promise<Config> {
    return invoke<Config>('delete_group_item', { id });
  },

  async reorderGroups(orderedIds: string[]): Promise<Config> {
    return invoke<Config>('reorder_group_items', { orderedIds });
  },

  async updateSettings(settings: Settings): Promise<Config> {
    return invoke<Config>('update_settings', { settings });
  },

  async runTask(id: string, forceAdmin: boolean = false): Promise<void> {
    return invoke('run_task', { id, forceAdmin });
  },

  async revealTaskInExplorer(id: string): Promise<void> {
    return invoke('reveal_task_in_explorer', { id });
  },

  async exportConfig(path: string): Promise<void> {
    return invoke('export_config', { path });
  },

  async importConfig(path: string): Promise<Config> {
    return invoke<Config>('import_config', { path });
  },

  async getLaunchHistory(taskId?: string): Promise<LaunchRecord[]> {
    return invoke<LaunchRecord[]>('get_launch_history', { taskId: taskId ?? null });
  },

  async refreshTrayMenu(): Promise<void> {
    return invoke('refresh_tray_menu');
  },

  async openConfigFolder(): Promise<void> {
    return invoke('open_config_folder');
  },

  async restoreConfigBackup(slot: number = 1): Promise<Config> {
    return invoke<Config>('restore_config_backup', { slot });
  },

  async getDiagnostics(): Promise<DiagnosticsInfo> {
    return invoke<DiagnosticsInfo>('get_diagnostics');
  },

  async setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
    try {
      await getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
    } catch {
      // Ignore if not in desktop window environment
    }
  },

  async setWindowMode(mode: Settings['windowMode']): Promise<void> {
    const size = mode === 'expanded' ? this.expandedWindowSize : this.compactWindowSize;
    try {
      await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
    } catch {
      // Ignore when running the web UI outside a Tauri window.
    }
  },

  async minimizeWindow(): Promise<void> {
    try {
      await getCurrentWindow().minimize();
    } catch {
      // Ignore
    }
  },

  async closeWindow(): Promise<void> {
    try {
      await getCurrentWindow().close();
    } catch {
      // Ignore
    }
  },

  async hideWindow(): Promise<void> {
    try {
      await getCurrentWindow().hide();
    } catch {
      // Ignore
    }
  },

  async showWindow(): Promise<void> {
    try {
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();
    } catch {
      // Ignore
    }
  },
};

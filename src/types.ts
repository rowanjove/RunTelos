export type ScriptType = 'bat' | 'ps1' | 'py' | 'exe' | 'wsl' | 'url';

export interface TaskGroup {
  id: string;
  name: string;
  order: number;
  icon?: string;
}

export interface TaskItem {
  id: string;
  name: string;
  type: ScriptType;
  groupId?: string;
  favorite: boolean;
  path?: string;
  command?: string;
  url?: string;
  args: string;
  workingDirectory?: string;
  runAsAdmin: boolean;
  keepWindowOpen: boolean;
  order: number;
  aliases: string[];
}

export interface Settings {
  alwaysOnTop: boolean;
  theme: 'system' | 'dark' | 'light';
  closeToTray: boolean;
  keepWindowOpen: boolean;
  pythonSilent: boolean;
  hideAfterRun: boolean;
  globalHotkey: string;
  windowMode: 'compact' | 'expanded';
}

export interface Config {
  version: number;
  settings: Settings;
  groups: TaskGroup[];
  tasks: TaskItem[];
  // For backward compatibility during migration
  pages?: { items: TaskItem[] }[];
}

export interface TaskFormData {
  id?: string;
  name: string;
  type: ScriptType;
  groupId?: string;
  favorite: boolean;
  path?: string;
  command?: string;
  url?: string;
  args: string;
  workingDirectory?: string;
  runAsAdmin: boolean;
  keepWindowOpen: boolean;
  aliases: string[];
}

export interface DiagnosticsInfo {
  appVersion: string;
  configPath: string;
  configVersion: number;
  taskCount: number;
  groupCount: number;
  osName: string;
}

export interface TaskAction {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  isAvailable: (task: TaskItem) => boolean;
  execute: (task: TaskItem) => Promise<void> | void;
}

export interface LaunchRecord {
  id: string;
  taskId: string;
  taskName: string;
  startedAt: string;
  status: 'launched' | 'failed';
  error?: string;
}

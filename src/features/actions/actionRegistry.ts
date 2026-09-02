import type { TaskAction, TaskItem } from '../../types';

export interface ActionHandlers {
  onRun: (task: TaskItem, forceAdmin?: boolean) => Promise<void> | void;
  onEdit: (task: TaskItem) => void;
  onToggleFavorite: (task: TaskItem) => Promise<void> | void;
  onReveal: (task: TaskItem) => Promise<void> | void;
  onDuplicate: (task: TaskItem) => Promise<void> | void;
  onDelete: (task: TaskItem) => Promise<void> | void;
  onShowError?: (task: TaskItem) => void;
  lastErrors?: Record<string, string>;
}

export function buildTaskActions(handlers: ActionHandlers): TaskAction[] {
  return [
    {
      id: 'run',
      label: '运行',
      shortcut: 'Enter',
      isAvailable: () => true,
      execute: (task) => handlers.onRun(task, false),
    },
    {
      id: 'run-admin',
      label: '以管理员身份运行',
      shortcut: 'Ctrl+Shift+Enter',
      isAvailable: (task) => task.type !== 'url',
      execute: (task) => handlers.onRun(task, true),
    },
    {
      id: 'toggle-favorite',
      label: '收藏 / 取消收藏',
      shortcut: 'F',
      isAvailable: () => true,
      execute: (task) => handlers.onToggleFavorite(task),
    },
    {
      id: 'edit',
      label: '编辑任务',
      shortcut: 'F2',
      isAvailable: () => true,
      execute: (task) => handlers.onEdit(task),
    },
    {
      id: 'reveal',
      label: '在文件资源管理器中定位',
      shortcut: 'Ctrl+O',
      isAvailable: (task) =>
        ['bat', 'ps1', 'py', 'exe'].includes(task.type) && Boolean(task.path),
      execute: (task) => handlers.onReveal(task),
    },
    {
      id: 'copy-path',
      label: '复制路径 / 命令 / URL',
      shortcut: 'Ctrl+C',
      isAvailable: () => true,
      execute: (task) => {
        const val = task.path || task.command || task.url || '';
        if (val) {
          void navigator.clipboard.writeText(val);
        }
      },
    },
    {
      id: 'duplicate',
      label: '复制副本',
      isAvailable: () => true,
      execute: (task) => handlers.onDuplicate(task),
    },
    {
      id: 'view-error',
      label: '查看上次报错',
      danger: true,
      isAvailable: (task) => Boolean(handlers.lastErrors && handlers.lastErrors[task.id]),
      execute: (task) => handlers.onShowError && handlers.onShowError(task),
    },
    {
      id: 'delete',
      label: '删除任务',
      shortcut: 'Delete',
      danger: true,
      isAvailable: () => true,
      execute: (task) => handlers.onDelete(task),
    },
  ];
}

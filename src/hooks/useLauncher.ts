import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { tauriService } from '../services/tauri';
import {
  isValidGlobalShortcut,
  normalizeGlobalShortcut,
  registerGlobalShortcut,
  unregisterGlobalShortcut,
  isTauriRuntime,
} from '../services/hotkey';
import { buildTaskActions } from '../features/actions/actionRegistry';
import { watchTheme } from '../lib/theme';
import type { Config, Settings, TaskAction, TaskFormData, TaskItem } from '../types';

const defaultConfig: Config = {
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

export function useLauncher() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errorTarget, setErrorTarget] = useState<TaskItem | null>(null);

  const [runningIds, setRunningIds] = useState<string[]>([]);
  const [lastErrors, setLastErrors] = useState<Record<string, string>>({});
  const [recentTaskIds, setRecentTaskIds] = useState<string[]>([]);
  const registeredHotkeyRef = useRef<string | null>(null);
  const hasLoadedConfigRef = useRef(false);
  const hadStartupErrorRef = useRef(false);
  const configRef = useRef(config);
  const settingsSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  configRef.current = config;

  const reloadConfig = useCallback(async () => {
    try {
      const nextConfig = await tauriService.loadConfig();
      setConfig(nextConfig);
      setConfigLoaded(true);
      setStartupError(null);
      await tauriService.setAlwaysOnTop(nextConfig.settings.alwaysOnTop);
      // The native setup restores the last user-sized window before the
      // WebView loads. Do not overwrite that size on the first config load.
      if (hasLoadedConfigRef.current || hadStartupErrorRef.current) {
        await tauriService.setWindowMode(nextConfig.settings.windowMode);
      }
      hasLoadedConfigRef.current = true;
      hadStartupErrorRef.current = false;
      try {
        const history = await tauriService.getLaunchHistory();
        if (Array.isArray(history)) {
          setRecentTaskIds([...new Set(history.map((record) => record.taskId))].slice(0, 30));
        }
      } catch {
        // History is auxiliary; a damaged history file must not block startup.
      }
    } catch (err) {
      hadStartupErrorRef.current = true;
      setStartupError(String(err));
    }
  }, []);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  // Watch and apply theme
  useEffect(() => {
    return watchTheme(config.settings.theme, undefined, (resolved) => {
      document.documentElement.dataset.theme = resolved;
    });
  }, [config.settings.theme]);

  useEffect(() => {
    if (!configLoaded || !isTauriRuntime()) return;
    void tauriService.refreshTrayMenu().catch(() => {
      // Tray integration is auxiliary and must not block the launcher UI.
    });
  }, [config, recentTaskIds, configLoaded]);

  // Register the palette shortcut at the native layer. The in-window keydown
  // handler below remains as a browser/dev fallback.
  useEffect(() => {
    if (!configLoaded) return;
    let cancelled = false;
    const shortcut = normalizeGlobalShortcut(config.settings.globalHotkey);

    const registerShortcut = async () => {
      try {
        if (registeredHotkeyRef.current) {
          await unregisterGlobalShortcut(registeredHotkeyRef.current);
          registeredHotkeyRef.current = null;
        }
        if (!isValidGlobalShortcut(shortcut)) {
          throw new Error('快捷键格式无效，请至少包含一个修饰键和一个按键');
        }
        const registered = await registerGlobalShortcut(shortcut, (event) => {
          if (event.state === 'Pressed') {
            setPaletteOpen(true);
            void tauriService.showWindow();
          }
        });
        if (registered && cancelled) {
          // React StrictMode and a hotkey edit can tear down this effect while
          // the native registration is still in flight. Do not leak it.
          await unregisterGlobalShortcut(shortcut);
        } else if (!cancelled && registered) {
          registeredHotkeyRef.current = shortcut;
          setHotkeyError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setHotkeyError(String(err));
        }
      }
    };

    void registerShortcut();
    return () => {
      cancelled = true;
      if (registeredHotkeyRef.current === shortcut) {
        void unregisterGlobalShortcut(shortcut);
        registeredHotkeyRef.current = null;
      }
    };
  }, [configLoaded, config.settings.globalHotkey]);

  // Global keydown listeners within the app window
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Open Command Palette with Alt+Space or Ctrl+F
      if ((e.altKey && e.code === 'Space') || (e.ctrlKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // New task with Ctrl+N
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTask(null);
        setEditorOpen(true);
        return;
      }

      // Open settings with Ctrl+,
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const recordRecentTask = useCallback((taskId: string) => {
    setRecentTaskIds((prev) => {
      const next = [taskId, ...prev.filter((id) => id !== taskId)].slice(0, 30);
      return next;
    });
  }, []);

  const handleRunTask = useCallback(
    async (task: TaskItem, forceAdmin: boolean = false) => {
      setRunningIds((prev) => [...prev, task.id]);
      recordRecentTask(task.id);

      try {
        await Promise.all([
          tauriService.runTask(task.id, forceAdmin),
          new Promise((resolve) => setTimeout(resolve, 200)),
        ]);

        setLastErrors((prev) => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });

        if (config.settings.hideAfterRun) {
          void tauriService.hideWindow();
        }
      } catch (err) {
        const errorMsg = String(err);
        setLastErrors((prev) => ({ ...prev, [task.id]: errorMsg }));
      } finally {
        setRunningIds((prev) => prev.filter((id) => id !== task.id));
        void tauriService.refreshTrayMenu().catch(() => {
          // Keep task execution successful even if the tray cannot refresh.
        });
      }
    },
    [config.settings.hideAfterRun, recordRecentTask],
  );

  // Tray actions are emitted by the native menu so Quick Run follows the
  // same state/error path as a click in the main window.
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let active = true;
    let unlisteners: (() => void)[] = [];

    const setupTrayListeners = async () => {
      const listeners = await Promise.all([
        listen('tray://new-task', () => {
          setEditingTask(null);
          setEditorOpen(true);
          void tauriService.showWindow();
        }),
        listen('tray://settings', () => {
          setSettingsOpen(true);
          void tauriService.showWindow();
        }),
        listen<string>('tray://run-task', (event) => {
          const task = configRef.current.tasks.find((item) => item.id === event.payload);
          if (task) {
            void tauriService.showWindow();
            void handleRunTask(task, false);
          }
        }),
      ]);
      if (active) {
        unlisteners = listeners;
      } else {
        listeners.forEach((unlisten) => unlisten());
      }
    };

    void setupTrayListeners();
    return () => {
      active = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [handleRunTask]);

  const handleToggleFavorite = useCallback(async (task: TaskItem) => {
    try {
      const nextConfig = await tauriService.toggleTaskFavorite(task.id);
      setConfig(nextConfig);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleEditTask = useCallback((task: TaskItem) => {
    setEditingTask(task);
    setEditorOpen(true);
  }, []);

  const handleRevealTask = useCallback(async (task: TaskItem) => {
    try {
      await tauriService.revealTaskInExplorer(task.id);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleDuplicateTask = useCallback(async (task: TaskItem) => {
    try {
      const nextConfig = await tauriService.createTask({
        name: `${task.name} (副本)`,
        scriptType: task.type,
        groupId: task.groupId,
        favorite: false,
        path: task.path,
        command: task.command,
        url: task.url,
        args: task.args,
        workingDirectory: task.workingDirectory,
        runAsAdmin: task.runAsAdmin,
        keepWindowOpen: task.keepWindowOpen,
        aliases: task.aliases,
      });
      setConfig(nextConfig);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleDeleteTask = useCallback(async (task: TaskItem) => {
    if (!window.confirm(`确定删除任务“${task.name}”？此操作不可撤销。`)) return;
    try {
      const nextConfig = await tauriService.deleteTask(task.id);
      setConfig(nextConfig);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleMoveTask = useCallback(
    async (taskId: string, groupId: string | undefined, order: number) => {
      try {
        const nextConfig = await tauriService.moveTask(taskId, groupId, order);
        setConfig(nextConfig);
      } catch (err) {
        console.error(err);
      }
    },
    [],
  );

  const handleDropOnTask = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;
      const target = config.tasks.find((task) => task.id === targetId);
      if (!target) return;
      const targetGroupKey = target.groupId ?? null;
      const groupTasks = config.tasks
        .filter((task) => (task.groupId ?? null) === targetGroupKey && task.id !== draggedId)
        .sort((a, b) => a.order - b.order);
      const targetOrder = groupTasks.findIndex((task) => task.id === targetId);
      void handleMoveTask(draggedId, target.groupId, targetOrder < 0 ? groupTasks.length : targetOrder);
    },
    [config.tasks, handleMoveTask],
  );

  const handleDropToGroup = useCallback(
    (draggedId: string, groupId: string | undefined) => {
      const groupTasks = config.tasks.filter((task) => (task.groupId ?? undefined) === groupId);
      void handleMoveTask(draggedId, groupId, groupTasks.length);
    },
    [config.tasks, handleMoveTask],
  );

  const handleCreateTask = useCallback(
    async (taskData: TaskFormData) => {
      const nextConfig = await tauriService.createTask({
        name: taskData.name,
        scriptType: taskData.type,
        groupId: taskData.groupId,
        favorite: taskData.favorite,
        path: taskData.path,
        command: taskData.command,
        url: taskData.url,
        args: taskData.args,
        workingDirectory: taskData.workingDirectory,
        runAsAdmin: taskData.runAsAdmin,
        keepWindowOpen: taskData.keepWindowOpen,
        aliases: taskData.aliases,
      });
      setConfig(nextConfig);
    },
    [],
  );

  const handleUpdateTask = useCallback(
    async (taskData: TaskFormData) => {
      if (!taskData.id) return;
      const nextConfig = await tauriService.updateTask({
        id: taskData.id,
        name: taskData.name,
        scriptType: taskData.type,
        groupId: taskData.groupId,
        favorite: taskData.favorite,
        path: taskData.path,
        command: taskData.command,
        url: taskData.url,
        args: taskData.args,
        workingDirectory: taskData.workingDirectory,
        runAsAdmin: taskData.runAsAdmin,
        keepWindowOpen: taskData.keepWindowOpen,
        aliases: taskData.aliases,
      });
      setConfig(nextConfig);
    },
    [],
  );

  const handleCreateGroup = useCallback(async (name: string) => {
    const nextConfig = await tauriService.createGroup(name);
    setConfig(nextConfig);
  }, []);

  const handleUpdateGroup = useCallback(async (id: string, name: string) => {
    const nextConfig = await tauriService.updateGroup(id, name);
    setConfig(nextConfig);
  }, []);

  const handleDeleteGroup = useCallback(
    async (id: string) => {
      const group = config.groups.find((item) => item.id === id);
      if (group && !window.confirm(`确定删除分组“${group.name}”？其中任务将移至未分组。`)) return;
      const nextConfig = await tauriService.deleteGroup(id);
      setConfig(nextConfig);
      if (selectedCategory === id) {
        setSelectedCategory('all');
      }
    },
    [config.groups, selectedCategory],
  );

  const handleUpdateSettings = useCallback((settings: Settings) => {
    const operation = settingsSaveQueueRef.current.then(async () => {
      const nextConfig = await tauriService.updateSettings(settings);
      setConfig(nextConfig);
      await tauriService.setAlwaysOnTop(nextConfig.settings.alwaysOnTop);
      await tauriService.setWindowMode(nextConfig.settings.windowMode);
    });
    settingsSaveQueueRef.current = operation.catch(() => undefined);
    return operation;
  }, []);

  const handleToggleTheme = useCallback(async () => {
    const current = config.settings.theme;
    const next = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
    await handleUpdateSettings({ ...config.settings, theme: next });
  }, [config.settings, handleUpdateSettings]);

  const handleToggleWindowMode = useCallback(async () => {
    const nextMode = config.settings.windowMode === 'compact' ? 'expanded' : 'compact';
    await handleUpdateSettings({ ...config.settings, windowMode: nextMode });
  }, [config.settings, handleUpdateSettings]);

  const actions: TaskAction[] = useMemo(
    () =>
      buildTaskActions({
        onRun: handleRunTask,
        onEdit: handleEditTask,
        onToggleFavorite: handleToggleFavorite,
        onReveal: handleRevealTask,
        onDuplicate: handleDuplicateTask,
        onDelete: handleDeleteTask,
        onShowError: setErrorTarget,
        lastErrors,
      }),
    [
      handleRunTask,
      handleEditTask,
      handleToggleFavorite,
      handleRevealTask,
      handleDuplicateTask,
      handleDeleteTask,
      lastErrors,
    ],
  );

  // Filtered tasks based on selected category
  const displayedTasks = useMemo(() => {
    if (selectedCategory === 'all') {
      return [...config.tasks].sort((a, b) => a.order - b.order);
    }
    if (selectedCategory === 'favorites') {
      return config.tasks.filter((t) => t.favorite).sort((a, b) => a.order - b.order);
    }
    if (selectedCategory === 'recent') {
      return recentTaskIds
        .map((id) => config.tasks.find((t) => t.id === id))
        .filter((t): t is TaskItem => Boolean(t));
    }
    if (selectedCategory === 'ungrouped') {
      return config.tasks.filter((t) => !t.groupId).sort((a, b) => a.order - b.order);
    }
    // Specific group ID
    return config.tasks
      .filter((t) => t.groupId === selectedCategory)
      .sort((a, b) => a.order - b.order);
  }, [config.tasks, selectedCategory, recentTaskIds]);

  return {
    config,
    configLoaded,
    startupError,
    hotkeyError,
    selectedCategory,
    setSelectedCategory,
    paletteOpen,
    setPaletteOpen,
    editorOpen,
    setEditorOpen,
    editingTask,
    setEditingTask,
    settingsOpen,
    setSettingsOpen,
    errorTarget,
    setErrorTarget,
    runningIds,
    lastErrors,
    recentTaskIds,
    actions,
    displayedTasks,
    handleRunTask,
    handleToggleFavorite,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleDropOnTask,
    handleDropToGroup,
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleUpdateSettings,
    handleToggleTheme,
    handleToggleWindowMode,
    reloadConfig,
  };
}

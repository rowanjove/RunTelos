import React from 'react';
import { Plus, Terminal } from 'lucide-react';
import { useLauncher } from './hooks/useLauncher';
import { TitleBar } from './components/TitleBar/TitleBar';
import { GroupSidebar } from './components/GroupSidebar/GroupSidebar';
import { TaskCard } from './components/TaskCard/TaskCard';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { TaskEditorDialog } from './components/TaskEditor/TaskEditorDialog';
import { SettingsDialog } from './components/Settings/SettingsDialog';
import { RecoveryDialog } from './components/Recovery/RecoveryDialog';
import { LaunchHistoryDialog } from './components/LaunchHistory/LaunchHistoryDialog';
import ErrorDialog from './components/ErrorDialog';

export default function App() {
  const launcher = useLauncher();
  const [historyOpen, setHistoryOpen] = React.useState(false);

  if (launcher.startupError) {
    return (
      <RecoveryDialog
        error={launcher.startupError}
        onRecovered={() => void launcher.reloadConfig()}
      />
    );
  }

  const isCompact = launcher.config.settings.windowMode === 'compact';

  return (
    <main className="app-shell">
      <TitleBar
        theme={launcher.config.settings.theme}
        windowMode={launcher.config.settings.windowMode}
        onToggleWindowMode={launcher.handleToggleWindowMode}
        onToggleTheme={launcher.handleToggleTheme}
        onOpenSettings={() => launcher.setSettingsOpen(true)}
        onOpenPalette={() => launcher.setPaletteOpen(true)}
        onOpenAdd={() => {
          launcher.setEditingTask(null);
          launcher.setEditorOpen(true);
        }}
      />

      {launcher.hotkeyError ? (
        <div className="app-status-banner" role="status">
          全局快捷键不可用：{launcher.hotkeyError}。仍可在窗口内使用 Alt+Space。
        </div>
      ) : null}

      <div className={`app-main ${isCompact ? 'compact' : 'expanded'}`}>
        <GroupSidebar
          groups={launcher.config.groups}
          tasks={launcher.config.tasks}
          selectedCategory={launcher.selectedCategory}
          onSelectCategory={launcher.setSelectedCategory}
          onCreateGroup={launcher.handleCreateGroup}
          onUpdateGroup={launcher.handleUpdateGroup}
          onDeleteGroup={launcher.handleDeleteGroup}
          onDropTaskToGroup={launcher.handleDropToGroup}
          compact={isCompact}
        />

        <div className="task-content-area">
          {launcher.displayedTasks.length > 0 ? (
            <div className="task-grid">
              {launcher.displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  actions={launcher.actions}
                  isRunning={launcher.runningIds.includes(task.id)}
                  hasError={Boolean(launcher.lastErrors[task.id])}
                  onRun={(t) => launcher.handleRunTask(t, false)}
                  onToggleFavorite={launcher.handleToggleFavorite}
                  onShowError={launcher.setErrorTarget}
                  onDropTask={launcher.handleDropOnTask}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Terminal size={36} className="empty-state-icon" />
              <div className="empty-state-title">暂无任务</div>
              <div className="empty-state-desc">
                点击下方按钮添加 BAT、PowerShell、Python 脚本、程序或 URL 启动项
              </div>
              <button
                type="button"
                className="empty-state-btn"
                onClick={() => {
                  launcher.setEditingTask(null);
                  launcher.setEditorOpen(true);
                }}
              >
                <Plus size={15} />
                <span>添加任务 (Ctrl+N)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <CommandPalette
        open={launcher.paletteOpen}
        tasks={launcher.config.tasks}
        groups={launcher.config.groups}
        actions={launcher.actions}
        recentTaskIds={launcher.recentTaskIds}
        onClose={() => launcher.setPaletteOpen(false)}
        onRunTask={launcher.handleRunTask}
      />

      <TaskEditorDialog
        open={launcher.editorOpen}
        task={launcher.editingTask}
        groups={launcher.config.groups}
        defaultGroupId={launcher.selectedCategory}
        onClose={() => {
          launcher.setEditorOpen(false);
          launcher.setEditingTask(null);
        }}
        onSave={async (taskData) => {
          if (taskData.id) {
            await launcher.handleUpdateTask(taskData);
          } else {
            await launcher.handleCreateTask(taskData);
          }
        }}
      />

      <SettingsDialog
        open={launcher.settingsOpen}
        settings={launcher.config.settings}
        hotkeyError={launcher.hotkeyError}
        onClose={() => launcher.setSettingsOpen(false)}
        onUpdateSettings={launcher.handleUpdateSettings}
        onConfigReloaded={() => void launcher.reloadConfig()}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <LaunchHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <ErrorDialog
        open={launcher.errorTarget !== null}
        title={launcher.errorTarget ? `${launcher.errorTarget.name} 的运行报错` : '错误详情'}
        message={launcher.errorTarget ? launcher.lastErrors[launcher.errorTarget.id] ?? '' : ''}
        onClose={() => launcher.setErrorTarget(null)}
      />
    </main>
  );
}

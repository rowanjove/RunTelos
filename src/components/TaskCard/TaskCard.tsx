import React, { useState } from 'react';
import {
  Code,
  Globe,
  Terminal,
  FileCode,
  Play,
  Star,
  MoreHorizontal,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import type { TaskAction, TaskItem } from '../../types';

interface TaskCardProps {
  task: TaskItem;
  actions: TaskAction[];
  isRunning?: boolean;
  hasError?: boolean;
  onRun: (task: TaskItem) => void;
  onToggleFavorite: (task: TaskItem) => void;
  onShowError?: (task: TaskItem) => void;
  onDropTask?: (draggedId: string, targetId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  actions,
  isRunning,
  hasError,
  onRun,
  onToggleFavorite,
  onShowError,
  onDropTask,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [justRan, setJustRan] = useState(false);

  const getIcon = () => {
    switch (task.type) {
      case 'bat':
        return <Terminal size={16} className="task-type-icon bat" />;
      case 'ps1':
        return <Code size={16} className="task-type-icon ps1" />;
      case 'py':
        return <FileCode size={16} className="task-type-icon py" />;
      case 'exe':
        return <Play size={16} className="task-type-icon exe" />;
      case 'wsl':
        return <Terminal size={16} className="task-type-icon wsl" />;
      case 'url':
        return <Globe size={16} className="task-type-icon url" />;
      default:
        return <Play size={16} className="task-type-icon" />;
    }
  };

  const getTypeLabel = () => {
    switch (task.type) {
      case 'bat':
        return 'BAT / CMD';
      case 'ps1':
        return 'PowerShell';
      case 'py':
        return 'Python';
      case 'exe':
        return 'EXE';
      case 'wsl':
        return 'WSL';
      case 'url':
        return 'URL';
      default:
        return task.type;
    }
  };

  const handleCardClick = () => {
    setJustRan(true);
    setTimeout(() => setJustRan(false), 300);
    onRun(task);
  };

  const availableActions = actions.filter((a) => a.isAvailable(task));
  const executeAction = (actionId: string) => {
    const action = availableActions.find((item) => item.id === actionId);
    if (action) void action.execute(task);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!e.ctrlKey && !e.altKey && !e.metaKey && ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'));
      const currentIndex = cards.indexOf(e.currentTarget);
      if (currentIndex >= 0 && cards.length > 1) {
        const direction = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
        cards[(currentIndex + direction + cards.length) % cards.length]?.focus();
      }
      return;
    }
    if (e.key === 'Enter' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      executeAction('run-admin');
      return;
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      executeAction('run');
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      executeAction('edit');
      return;
    }
    if (e.key === 'Delete') {
      e.preventDefault();
      executeAction('delete');
      return;
    }
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      executeAction('toggle-favorite');
      return;
    }
    if (e.key.toLowerCase() === 'o' && e.ctrlKey) {
      e.preventDefault();
      executeAction('reveal');
      return;
    }
    if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
      e.preventDefault();
      executeAction('copy-path');
      return;
    }
    if (e.key.toLowerCase() === 'k' && e.ctrlKey) {
      e.preventDefault();
      setMenuOpen(true);
      return;
    }
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      setMenuOpen(true);
    }
  };

  return (
    <div
      className={`task-card ${isRunning ? 'running' : ''} ${justRan ? 'ran' : ''} ${
        hasError ? 'has-error' : ''
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId) onDropTask?.(draggedId, task.id);
      }}
      title={`${task.name}\n${task.path || task.command || task.url || ''}`}
    >
      <button
        type="button"
        className="task-card-launch"
        data-task-id={task.id}
        aria-label={`运行任务：${task.name}`}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
      >
        <div className="task-card-icon-wrapper">{getIcon()}</div>

        <div className="task-card-info">
          <div className="task-card-title-row">
            <span className="task-card-title">{task.name}</span>
            {task.runAsAdmin ? (
              <span title="管理员权限运行" style={{ display: 'inline-flex' }}>
                <ShieldAlert size={12} className="admin-badge-icon" />
              </span>
            ) : null}
          </div>
          <div className="task-card-sub">
            <span className="task-card-type">{getTypeLabel()}</span>
            {task.workingDirectory ? (
              <span className="task-card-cwd-hint" title={`工作目录: ${task.workingDirectory}`}>
                · cwd
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="task-card-actions">
        {hasError ? (
          <button
            type="button"
            className="card-btn error-btn"
            title="查看报错"
            aria-label={`查看 ${task.name} 的报错`}
            onClick={(e) => {
              e.stopPropagation();
              onShowError?.(task);
            }}
          >
            <AlertCircle size={14} />
          </button>
        ) : null}

        <button
          type="button"
          className={`card-btn fav-btn ${task.favorite ? 'active' : ''}`}
          title={task.favorite ? '取消收藏' : '收藏'}
          aria-label={task.favorite ? `取消收藏 ${task.name}` : `收藏 ${task.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(task);
          }}
        >
          <Star size={13} fill={task.favorite ? 'currentColor' : 'none'} />
        </button>

        <div className="card-menu-container">
          <button
            type="button"
            className="card-btn more-btn"
            title="操作菜单"
            aria-label={`打开 ${task.name} 的操作菜单`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen ? (
            <>
              <div
                className="card-menu-backdrop"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div className="card-menu-dropdown">
                {availableActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`card-menu-item ${action.danger ? 'danger' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      void action.execute(task);
                    }}
                  >
                    <span>{action.label}</span>
                    {action.shortcut ? (
                      <span className="card-menu-shortcut">{action.shortcut}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

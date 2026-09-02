import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Code,
  Globe,
  Terminal,
  FileCode,
  Play,
  Star,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import type { TaskAction, TaskGroup, TaskItem } from '../../types';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface CommandPaletteProps {
  open: boolean;
  tasks: TaskItem[];
  groups: TaskGroup[];
  actions: TaskAction[];
  recentTaskIds: string[];
  onClose: () => void;
  onRunTask: (task: TaskItem, forceAdmin?: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  tasks,
  groups,
  actions,
  recentTaskIds,
  onClose,
  onRunTask,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionMenuTask, setActionMenuTask] = useState<TaskItem | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useDialogAccessibility(open);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setActionMenuTask(null);
      setSelectedActionIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const groupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      map.set(g.id, g.name);
    }
    return map;
  }, [groups]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Return favorites and recent first
      return [...tasks].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        const aRecent = recentTaskIds.indexOf(a.id);
        const bRecent = recentTaskIds.indexOf(b.id);
        if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
        if (aRecent !== -1) return -1;
        if (bRecent !== -1) return 1;
        return a.order - b.order;
      });
    }

    const scored = tasks.map((task) => {
      let score = 0;
      const nameLower = task.name.toLowerCase();
      const typeLower = task.type.toLowerCase();
      const groupName = (task.groupId && groupMap.get(task.groupId)) || '';
      const groupLower = groupName.toLowerCase();

      if (nameLower === q) score += 100;
      else if (nameLower.startsWith(q)) score += 60;
      else if (nameLower.includes(q)) score += 30;

      // Check aliases
      if (task.aliases) {
        for (const alias of task.aliases) {
          const aLower = alias.toLowerCase();
          if (aLower === q) score += 80;
          else if (aLower.startsWith(q)) score += 50;
          else if (aLower.includes(q)) score += 25;
        }
      }

      if (groupLower.includes(q)) score += 20;
      if (typeLower.includes(q)) score += 15;

      if (task.favorite) score += 10;
      const recentIdx = recentTaskIds.indexOf(task.id);
      if (recentIdx !== -1) score += Math.max(0, 10 - recentIdx * 2);

      return { task, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.task);
  }, [tasks, query, recentTaskIds, groupMap]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector('.palette-item.selected');
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, selectedActionIndex]);

  const availableActions = useMemo(() => {
    if (!actionMenuTask) return [];
    return actions.filter((a) => a.isAvailable(actionMenuTask));
  }, [actionMenuTask, actions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (actionMenuTask) {
        setActionMenuTask(null);
      } else {
        onClose();
      }
      return;
    }

    if (actionMenuTask) {
      // Sub-action mode
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedActionIndex((prev) => (prev + 1) % Math.max(1, availableActions.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedActionIndex((prev) =>
          prev <= 0 ? availableActions.length - 1 : prev - 1,
        );
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActionMenuTask(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const action = availableActions[selectedActionIndex];
        if (action) {
          onClose();
          void action.execute(actionMenuTask);
        }
      }
      return;
    }

    // Normal task list mode
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredTasks.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? filteredTasks.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const task = filteredTasks[selectedIndex];
      if (task) {
        onClose();
        const forceAdmin = e.ctrlKey && e.shiftKey;
        onRunTask(task, forceAdmin);
      }
    } else if ((e.ctrlKey && e.key.toLowerCase() === 'k') || e.key === 'ArrowRight') {
      const task = filteredTasks[selectedIndex];
      if (task) {
        e.preventDefault();
        setActionMenuTask(task);
        setSelectedActionIndex(0);
      }
    }
  };

  if (!open) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bat':
        return <Terminal size={15} className="task-type-icon bat" />;
      case 'ps1':
        return <Code size={15} className="task-type-icon ps1" />;
      case 'py':
        return <FileCode size={15} className="task-type-icon py" />;
      case 'exe':
        return <Play size={15} className="task-type-icon exe" />;
      case 'wsl':
        return <Terminal size={15} className="task-type-icon wsl" />;
      case 'url':
        return <Globe size={15} className="task-type-icon url" />;
      default:
        return <Play size={15} className="task-type-icon" />;
    }
  };

  return (
    <div className="palette-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        className="palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {actionMenuTask ? (
          <div className="palette-header action-header">
            <button
              type="button"
              className="palette-back-btn"
              onClick={() => setActionMenuTask(null)}
              title="返回 (Esc / ←)"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="palette-task-name">{actionMenuTask.name}</span>
            <span className="palette-mode-hint">操作菜单</span>
          </div>
        ) : (
          <div className="palette-header">
            <Search size={16} className="palette-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="palette-input"
              placeholder="搜索任务、别名、分组或类型... (Alt+Space)"
              aria-label="搜索任务"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        <div className="palette-list" ref={listRef}>
          {actionMenuTask ? (
            availableActions.map((action, idx) => (
              <div
                key={action.id}
                className={`palette-item ${idx === selectedActionIndex ? 'selected' : ''} ${
                  action.danger ? 'danger' : ''
                }`}
                onClick={() => {
                  onClose();
                  void action.execute(actionMenuTask);
                }}
                onMouseEnter={() => setSelectedActionIndex(idx)}
              >
                <span className="palette-item-name">{action.label}</span>
                {action.shortcut ? (
                  <span className="palette-item-shortcut">{action.shortcut}</span>
                ) : null}
              </div>
            ))
          ) : filteredTasks.length > 0 ? (
            filteredTasks.map((task, idx) => {
              const groupName = task.groupId ? groupMap.get(task.groupId) : null;
              return (
                <div
                  key={task.id}
                  className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onClose();
                    onRunTask(task, false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="palette-item-left">
                    <div className="palette-item-icon">{getTypeIcon(task.type)}</div>
                    <div className="palette-item-text">
                      <span className="palette-item-name">{task.name}</span>
                      <span className="palette-item-meta">
                        {groupName ? `${groupName} · ` : ''}
                        {task.type.toUpperCase()}
                        {task.aliases && task.aliases.length > 0
                          ? ` [${task.aliases.join(', ')}]`
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="palette-item-right">
                    {task.runAsAdmin ? (
                      <span title="以管理员运行" style={{ display: 'inline-flex' }}>
                        <ShieldAlert size={13} className="admin-badge-icon" />
                      </span>
                    ) : null}
                    {task.favorite ? (
                      <Star size={13} className="fav-star-icon" fill="currentColor" />
                    ) : null}
                    <button
                      type="button"
                      className="palette-actions-trigger"
                      title="展开操作 (Ctrl+K)"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuTask(task);
                        setSelectedActionIndex(0);
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="palette-empty">没有匹配的任务</div>
          )}
        </div>

        <div className="palette-footer">
          {actionMenuTask ? (
            <>
              <span>↑↓ 选择操作</span>
              <span>Enter 确认执行</span>
              <span>Esc / ← 返回</span>
            </>
          ) : (
            <>
              <span>↑↓ 切换</span>
              <span>Enter 运行</span>
              <span>Ctrl+Shift+Enter 管理员运行</span>
              <span>Ctrl+K 动作</span>
              <span>Esc 退出</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

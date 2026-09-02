import React, { useState } from 'react';
import {
  Folder,
  Star,
  Clock,
  Layers,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import type { TaskGroup, TaskItem } from '../../types';

export type SelectedCategory = 'all' | 'favorites' | 'recent' | 'ungrouped' | string;

interface GroupSidebarProps {
  groups: TaskGroup[];
  tasks: TaskItem[];
  selectedCategory: SelectedCategory;
  onSelectCategory: (category: SelectedCategory) => void;
  onCreateGroup: (name: string) => Promise<void> | void;
  onUpdateGroup: (id: string, name: string) => Promise<void> | void;
  onDeleteGroup: (id: string) => Promise<void> | void;
  onDropTaskToGroup?: (taskId: string, groupId?: string) => void;
  compact?: boolean;
}

export const GroupSidebar: React.FC<GroupSidebarProps> = ({
  groups,
  tasks,
  selectedCategory,
  onSelectCategory,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onDropTaskToGroup,
  compact = false,
}) => {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null);

  const favCount = tasks.filter((t) => t.favorite).length;
  const ungroupedCount = tasks.filter((t) => !t.groupId).length;

  const handleStartCreate = () => {
    setCreatingGroup(true);
    setNewGroupName('');
  };

  const handleFinishCreate = async () => {
    if (newGroupName.trim()) {
      await onCreateGroup(newGroupName.trim());
    }
    setCreatingGroup(false);
    setNewGroupName('');
  };

  const handleStartEdit = (group: TaskGroup) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
    setMenuGroupId(null);
  };

  const handleFinishEdit = async () => {
    if (editingGroupId && editingName.trim()) {
      await onUpdateGroup(editingGroupId, editingName.trim());
    }
    setEditingGroupId(null);
    setEditingName('');
  };

  const handleDropOnGroup = (event: React.DragEvent, groupId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) onDropTaskToGroup?.(taskId, groupId);
  };

  if (compact) {
    return (
      <div className="compact-group-bar">
        <button
          type="button"
          className={`compact-pill ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          全部 ({tasks.length})
        </button>
        <button
          type="button"
          className={`compact-pill ${selectedCategory === 'favorites' ? 'active' : ''}`}
          onClick={() => onSelectCategory('favorites')}
        >
          ★ 收藏 ({favCount})
        </button>
        <button
          type="button"
          className={`compact-pill ${selectedCategory === 'recent' ? 'active' : ''}`}
          onClick={() => onSelectCategory('recent')}
        >
          最近
        </button>

        {groups.map((group) => {
          const count = tasks.filter((t) => t.groupId === group.id).length;
          return (
            <button
              key={group.id}
              type="button"
              className={`compact-pill ${selectedCategory === group.id ? 'active' : ''}`}
              onClick={() => onSelectCategory(group.id)}
            >
              {group.name} ({count})
            </button>
          );
        })}

        {ungroupedCount > 0 && groups.length > 0 ? (
          <button
            type="button"
            className={`compact-pill ${selectedCategory === 'ungrouped' ? 'active' : ''}`}
            onClick={() => onSelectCategory('ungrouped')}
          >
            未分组 ({ungroupedCount})
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="group-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">视图</div>
        <div
          className={`sidebar-item ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          <Layers size={14} className="sidebar-icon" />
          <span className="sidebar-item-label">全部任务</span>
          <span className="sidebar-badge">{tasks.length}</span>
        </div>

        <div
          className={`sidebar-item ${selectedCategory === 'favorites' ? 'active' : ''}`}
          onClick={() => onSelectCategory('favorites')}
        >
          <Star size={14} className="sidebar-icon" />
          <span className="sidebar-item-label">收藏</span>
          <span className="sidebar-badge">{favCount}</span>
        </div>

        <div
          className={`sidebar-item ${selectedCategory === 'recent' ? 'active' : ''}`}
          onClick={() => onSelectCategory('recent')}
        >
          <Clock size={14} className="sidebar-icon" />
          <span className="sidebar-item-label">最近使用</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">分组</span>
          <button
            type="button"
            className="sidebar-add-btn"
            title="新建分组"
            onClick={handleStartCreate}
          >
            <Plus size={13} />
          </button>
        </div>

        {creatingGroup ? (
          <div className="sidebar-inline-edit">
            <input
              type="text"
              autoFocus
              className="sidebar-input"
              placeholder="分组名称..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleFinishCreate();
                if (e.key === 'Escape') setCreatingGroup(false);
              }}
              onBlur={() => void handleFinishCreate()}
            />
          </div>
        ) : null}

        {groups.map((group) => {
          const count = tasks.filter((t) => t.groupId === group.id).length;
          const isSelected = selectedCategory === group.id;

          if (editingGroupId === group.id) {
            return (
              <div key={group.id} className="sidebar-inline-edit">
                <input
                  type="text"
                  autoFocus
                  className="sidebar-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleFinishEdit();
                    if (e.key === 'Escape') setEditingGroupId(null);
                  }}
                  onBlur={() => void handleFinishEdit()}
                />
              </div>
            );
          }

          return (
            <div
              key={group.id}
              className={`sidebar-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectCategory(group.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropOnGroup(event, group.id)}
            >
              <Folder size={14} className="sidebar-icon" />
              <span className="sidebar-item-label">{group.name}</span>
              <span className="sidebar-badge">{count}</span>

              <div className="sidebar-item-actions">
                <button
                  type="button"
                  className="sidebar-more-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuGroupId(menuGroupId === group.id ? null : group.id);
                  }}
                >
                  <MoreVertical size={13} />
                </button>

                {menuGroupId === group.id ? (
                  <>
                    <div
                      className="sidebar-menu-backdrop"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuGroupId(null);
                      }}
                    />
                    <div className="sidebar-menu-dropdown">
                      <button
                        type="button"
                        className="sidebar-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(group);
                        }}
                      >
                        <Edit2 size={12} />
                        <span>重命名</span>
                      </button>
                      <button
                        type="button"
                        className="sidebar-menu-item danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuGroupId(null);
                          void onDeleteGroup(group.id);
                        }}
                      >
                        <Trash2 size={12} />
                        <span>删除分组</span>
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        {ungroupedCount > 0 ? (
          <div
            className={`sidebar-item ${selectedCategory === 'ungrouped' ? 'active' : ''}`}
            onClick={() => onSelectCategory('ungrouped')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDropOnGroup(event)}
          >
            <Folder size={14} className="sidebar-icon text-muted" />
            <span className="sidebar-item-label">未分组</span>
            <span className="sidebar-badge">{ungroupedCount}</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

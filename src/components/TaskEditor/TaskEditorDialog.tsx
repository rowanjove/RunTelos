import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Terminal,
  Globe,
  UploadCloud,
  FolderOpen,
  X,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ScriptType, TaskFormData, TaskGroup, TaskItem } from '../../types';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface TaskEditorDialogProps {
  open: boolean;
  task?: TaskItem | null; // If null, mode is Add
  groups: TaskGroup[];
  defaultGroupId?: string;
  onClose: () => void;
  onSave: (taskData: TaskFormData) => Promise<void> | void;
}

type AddCategory = 'file' | 'command' | 'url';

export const TaskEditorDialog: React.FC<TaskEditorDialogProps> = ({
  open,
  task,
  groups,
  defaultGroupId,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(task);

  const [addCategory, setAddCategory] = useState<AddCategory>('file');
  const [name, setName] = useState('');
  const [scriptType, setScriptType] = useState<ScriptType>('bat');
  const [groupId, setGroupId] = useState<string>('');
  const [favorite, setFavorite] = useState(false);
  const [path, setPath] = useState('');
  const [command, setCommand] = useState('');
  const [url, setUrl] = useState('');
  const [args, setArgs] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [runAsAdmin, setRunAsAdmin] = useState(false);
  const [keepWindowOpen, setKeepWindowOpen] = useState(true);
  const [aliasesText, setAliasesText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogAccessibility(open, onClose);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (task) {
      setName(task.name);
      setScriptType(task.type);
      setGroupId(task.groupId || '');
      setFavorite(task.favorite);
      setPath(task.path || '');
      setCommand(task.command || '');
      setUrl(task.url || '');
      setArgs(task.args || '');
      setWorkingDirectory(task.workingDirectory || '');
      setRunAsAdmin(task.runAsAdmin);
      setKeepWindowOpen(task.keepWindowOpen ?? true);
      setAliasesText(task.aliases ? task.aliases.join(', ') : '');

      if (task.type === 'url') setAddCategory('url');
      else if (task.type === 'wsl') setAddCategory('command');
      else setAddCategory('file');
    } else {
      setName('');
      setScriptType('bat');
      setGroupId(defaultGroupId && defaultGroupId !== 'all' && defaultGroupId !== 'favorites' && defaultGroupId !== 'recent' && defaultGroupId !== 'ungrouped' ? defaultGroupId : '');
      setFavorite(false);
      setPath('');
      setCommand('');
      setUrl('');
      setArgs('');
      setWorkingDirectory('');
      setRunAsAdmin(false);
      setKeepWindowOpen(true);
      setAliasesText('');
      setAddCategory('file');
    }
  }, [open, task, defaultGroupId]);

  if (!open) return null;

  const detectTypeFromPath = (filePath: string): ScriptType => {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.ps1')) return 'ps1';
    if (lower.endsWith('.py')) return 'py';
    if (lower.endsWith('.exe')) return 'exe';
    return 'bat';
  };

  const getDirFromPath = (filePath: string): string => {
    const idx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    return idx > 0 ? filePath.substring(0, idx) : '';
  };

  const getBaseName = (filePath: string): string => {
    const idx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    const fileName = idx >= 0 ? filePath.substring(idx + 1) : filePath;
    const dotIdx = fileName.lastIndexOf('.');
    return dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
  };

  const handleBrowseFile = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [
          {
            name: '脚本与程序',
            extensions: ['bat', 'cmd', 'ps1', 'py', 'exe'],
          },
        ],
      });

      if (typeof selected === 'string') {
        setPath(selected);
        const detected = detectTypeFromPath(selected);
        setScriptType(detected);
        if (!name.trim()) {
          setName(getBaseName(selected));
        }
        if (!workingDirectory.trim()) {
          setWorkingDirectory(getDirFromPath(selected));
        }
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleBrowseCwd = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: true,
      });
      if (typeof selected === 'string') {
        setWorkingDirectory(selected);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入任务名称');
      return;
    }

    if (addCategory === 'file' && !path.trim()) {
      setError('请选择文件路径');
      return;
    }

    if (addCategory === 'command' && !command.trim()) {
      setError('请输入命令内容');
      return;
    }

    if (addCategory === 'url' && !url.trim()) {
      setError('请输入网页 URL');
      return;
    }

    if (addCategory === 'url' && !url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL 必须以 http:// 或 https:// 开头');
      return;
    }

    const aliases = aliasesText
      .split(/[,，]/)
      .map((a) => a.trim())
      .filter(Boolean);

    try {
      await onSave({
        id: task?.id,
        name: name.trim(),
        type:
          addCategory === 'url'
            ? 'url'
            : addCategory === 'command'
            ? scriptType === 'wsl'
              ? 'wsl'
              : scriptType
            : scriptType,
        groupId: groupId.trim() || undefined,
        favorite,
        path: addCategory === 'file' ? path.trim() : undefined,
        command: addCategory === 'command' ? command.trim() : undefined,
        url: addCategory === 'url' ? url.trim() : undefined,
        args: args.trim(),
        workingDirectory: workingDirectory.trim() || undefined,
        runAsAdmin,
        keepWindowOpen,
        aliases,
      });
      onClose();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog-modal editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <span className="dialog-title" id="task-editor-title">{isEditing ? '编辑任务' : '添加新任务'}</span>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label="关闭任务编辑器">
            <X size={16} />
          </button>
        </div>

        {!isEditing ? (
          <div className="editor-category-selector">
            <button
              type="button"
              className={`category-tab ${addCategory === 'file' ? 'active' : ''}`}
              onClick={() => {
                setAddCategory('file');
                setScriptType('bat');
              }}
            >
              <FileCode size={14} />
              <span>本地文件 / 脚本</span>
            </button>
            <button
              type="button"
              className={`category-tab ${addCategory === 'command' ? 'active' : ''}`}
              onClick={() => {
                setAddCategory('command');
                // v2.0 only supports standalone WSL commands. PowerShell/CMD
                // commands need a dedicated command task model in v2.1;
                // keeping them selectable here would produce an invalid
                // payload because those types require a file path.
                setScriptType('wsl');
              }}
            >
              <Terminal size={14} />
              <span>命令行命令</span>
            </button>
            <button
              type="button"
              className={`category-tab ${addCategory === 'url' ? 'active' : ''}`}
              onClick={() => {
                setAddCategory('url');
                setScriptType('url');
              }}
            >
              <Globe size={14} />
              <span>网站 / URL</span>
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="editor-form">
          {error ? <div className="editor-error">{error}</div> : null}

          {/* Target Section */}
          <div className="editor-section">
            <div className="editor-section-heading">目标配置</div>

            {addCategory === 'file' ? (
              <>
                <div className="editor-field">
                  <label className="editor-label">脚本或程序路径</label>
                  <div className="editor-input-group">
                    <input
                      type="text"
                      className="editor-input"
                      placeholder="C:\Scripts\run.bat"
                      value={path}
                      onChange={(e) => {
                        setPath(e.target.value);
                        if (e.target.value) {
                          setScriptType(detectTypeFromPath(e.target.value));
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="editor-btn-secondary"
                      onClick={handleBrowseFile}
                    >
                      <FolderOpen size={14} />
                      <span>浏览</span>
                    </button>
                  </div>
                </div>

                <div className="editor-row-2">
                  <div className="editor-field">
                    <label className="editor-label">启动类型</label>
                    <select
                      className="editor-select"
                      value={scriptType}
                      onChange={(e) => setScriptType(e.target.value as ScriptType)}
                    >
                      <option value="bat">BAT / CMD 批处理</option>
                      <option value="ps1">PowerShell 脚本 (.ps1)</option>
                      <option value="py">Python 脚本 (.py)</option>
                      <option value="exe">可执行程序 (.exe)</option>
                    </select>
                  </div>

                  <div className="editor-field">
                    <label className="editor-label">启动参数 (可选)</label>
                    <input
                      type="text"
                      className="editor-input"
                      placeholder='--arg1 "value 2"'
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                    />
                  </div>
                </div>

                <div className="editor-field">
                  <label className="editor-label">工作目录 Working Directory (可选)</label>
                  <div className="editor-input-group">
                    <input
                      type="text"
                      className="editor-input"
                      placeholder="默认自动为脚本所在目录"
                      value={workingDirectory}
                      onChange={(e) => setWorkingDirectory(e.target.value)}
                    />
                    <button
                      type="button"
                      className="editor-btn-secondary"
                      onClick={handleBrowseCwd}
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {addCategory === 'command' ? (
              <>
                <div className="editor-row-2">
                  <div className="editor-field">
                    <label className="editor-label">执行环境 Shell（v2.0）</label>
                    <select
                      className="editor-select"
                      value={scriptType}
                      disabled
                    >
                      <option value="wsl">WSL (bash)</option>
                    </select>
                  </div>

                  <div className="editor-field">
                    <label className="editor-label">工作目录 (可选)</label>
                    <div className="editor-input-group">
                      <input
                        type="text"
                        className="editor-input"
                        placeholder="C:\Projects\my-app"
                        value={workingDirectory}
                        onChange={(e) => setWorkingDirectory(e.target.value)}
                      />
                      <button
                        type="button"
                        className="editor-btn-secondary"
                        onClick={handleBrowseCwd}
                      >
                        <FolderOpen size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="editor-field">
                  <label className="editor-label">执行命令</label>
                  <textarea
                    rows={3}
                    className="editor-textarea"
                    placeholder="npm run build && npm start"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                  />
                </div>
              </>
            ) : null}

            {addCategory === 'url' ? (
              <div className="editor-field">
                <label className="editor-label">网页地址 (URL)</label>
                <input
                  type="text"
                  className="editor-input"
                  placeholder="https://localhost:3000 或 https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {/* Basic Section */}
          <div className="editor-section">
            <div className="editor-section-heading">基本信息</div>

            <div className="editor-row-2">
              <div className="editor-field">
                <label className="editor-label">显示名称</label>
                <input
                  type="text"
                  className="editor-input"
                  placeholder="例如: 启动本地开发环境"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="editor-field">
                <label className="editor-label">所属分组</label>
                <select
                  className="editor-select"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">(未分组)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="editor-field">
              <label className="editor-label">快捷别名 Aliases (用逗号分隔，方便搜索唤出)</label>
              <input
                type="text"
                className="editor-input"
                placeholder="dev, api, start"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
              />
            </div>
          </div>

          {/* Runtime Options */}
          {addCategory !== 'url' ? (
            <div className="editor-section">
              <div className="editor-section-heading">运行选项</div>

              <div className="editor-checkbox-group">
                <label className="editor-checkbox-label">
                  <input
                    type="checkbox"
                    checked={runAsAdmin}
                    onChange={(e) => setRunAsAdmin(e.target.checked)}
                  />
                  <span>默认以管理员权限运行 (UAC 提权)</span>
                </label>

                <label className="editor-checkbox-label">
                  <input
                    type="checkbox"
                    checked={keepWindowOpen}
                    onChange={(e) => setKeepWindowOpen(e.target.checked)}
                  />
                  <span>执行完毕后保持终端窗口开启</span>
                </label>

                <label className="editor-checkbox-label">
                  <input
                    type="checkbox"
                    checked={favorite}
                    onChange={(e) => setFavorite(e.target.checked)}
                  />
                  <span>加入常用收藏</span>
                </label>
              </div>
            </div>
          ) : null}

          <div className="dialog-footer">
            <button type="button" className="editor-btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="editor-btn-primary">
              {isEditing ? '保存修改' : '确认添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

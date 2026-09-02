import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  Palette,
  Keyboard,
  PlayCircle,
  Database,
  Info,
  X,
  Copy,
  Check,
  Download,
  Upload,
  Clock3,
} from 'lucide-react';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { tauriService } from '../../services/tauri';
import { isValidGlobalShortcut, normalizeGlobalShortcut } from '../../services/hotkey';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import type { DiagnosticsInfo, Settings } from '../../types';
import { BRAND } from '../../branding';

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onUpdateSettings: (settings: Settings) => Promise<void> | void;
  onConfigReloaded?: () => void;
  onOpenHistory?: () => void;
  hotkeyError?: string | null;
}

type SettingsTab = 'general' | 'appearance' | 'hotkeys' | 'execution' | 'data' | 'diagnostics';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  settings,
  onClose,
  onUpdateSettings,
  onConfigReloaded,
  onOpenHistory,
  hotkeyError,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [hotkeyDraftError, setHotkeyDraftError] = useState<string | null>(null);
  const lastSubmittedHotkeyRef = useRef(settings.globalHotkey);
  const dialogRef = useDialogAccessibility(open, onClose);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      setDataMessage(null);
      setHotkeyDraftError(null);
      lastSubmittedHotkeyRef.current = settings.globalHotkey;
      void tauriService.getDiagnostics().then(setDiagnostics).catch(() => null);
    }
  }, [open, settings]);

  if (!open) return null;

  const handleToggle = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    void Promise.resolve(onUpdateSettings(updated)).catch((error) => {
      setDataMessage(`保存设置失败: ${error}`);
    });
  };

  const commitHotkey = async () => {
    const normalized = normalizeGlobalShortcut(localSettings.globalHotkey);
    if (!isValidGlobalShortcut(normalized)) {
      setHotkeyDraftError('快捷键格式无效，请至少包含一个修饰键和一个按键');
      return;
    }
    setHotkeyDraftError(null);
    if (normalized === settings.globalHotkey || normalized === lastSubmittedHotkeyRef.current) return;
    const updated = { ...localSettings, globalHotkey: normalized };
    setLocalSettings(updated);
    lastSubmittedHotkeyRef.current = normalized;
    try {
      await onUpdateSettings(updated);
    } catch (error) {
      lastSubmittedHotkeyRef.current = settings.globalHotkey;
      setHotkeyDraftError(`保存快捷键失败: ${error}`);
    }
  };

  const handleExport = async () => {
    try {
      const path = await saveDialog({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'scriptlauncher-config.json',
      });
      if (typeof path === 'string') {
        await tauriService.exportConfig(path);
        setDataMessage('配置已成功导出');
        setTimeout(() => setDataMessage(null), 3000);
      }
    } catch (err) {
      setDataMessage(`导出失败: ${err}`);
    }
  };

  const handleImport = async () => {
    try {
      const path = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (typeof path === 'string') {
        await tauriService.importConfig(path);
        setDataMessage('配置已成功导入并刷新');
        onConfigReloaded?.();
        setTimeout(() => setDataMessage(null), 3000);
      }
    } catch (err) {
      setDataMessage(`导入失败: ${err}`);
    }
  };

  const handleCopyDiagnostics = () => {
    if (!diagnostics) return;
    const text = `${BRAND.display} (${BRAND.legacy}) v${diagnostics.appVersion}
OS: ${diagnostics.osName}
Config Schema: v${diagnostics.configVersion}
Config Path: ${diagnostics.configPath}
Tasks: ${diagnostics.taskCount}
Groups: ${diagnostics.groupCount}
Hotkey: ${localSettings.globalHotkey}
Window Mode: ${localSettings.windowMode}
Theme: ${localSettings.theme}`;

    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog-modal settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="settings-title-row">
            <SettingsIcon size={16} />
            <span className="dialog-title" id="settings-dialog-title">设置</span>
          </div>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label="关闭设置">
            <X size={16} />
          </button>
        </div>

        <div className="settings-body">
          {/* Navigation Sidebar */}
          <nav className="settings-nav">
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <Sliders size={14} />
              <span>常规 (General)</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              <Palette size={14} />
              <span>外观 (Appearance)</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'hotkeys' ? 'active' : ''}`}
              onClick={() => setActiveTab('hotkeys')}
            >
              <Keyboard size={14} />
              <span>快捷键 (Hotkeys)</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'execution' ? 'active' : ''}`}
              onClick={() => setActiveTab('execution')}
            >
              <PlayCircle size={14} />
              <span>运行选项 (Execution)</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              <Database size={14} />
              <span>数据与备份 (Data)</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnostics')}
            >
              <Info size={14} />
              <span>诊断信息 (Diagnostics)</span>
            </button>
          </nav>

          {/* Tab Content Panel */}
          <div className="settings-content">
            {activeTab === 'general' ? (
              <div className="settings-tab-pane">
                <div className="settings-group">
                  <div className="settings-group-title">窗口与驻留行为</div>

                  <label className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">窗口置顶 (Always on top)</span>
                      <span className="settings-row-desc">使启动器窗口始终浮动在其他窗口上方</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.alwaysOnTop}
                      onChange={(e) => handleToggle('alwaysOnTop', e.target.checked)}
                    />
                  </label>

                  <label className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">关闭时最小化到系统托盘</span>
                      <span className="settings-row-desc">点击窗口右上角关闭按钮时保持后台驻留</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.closeToTray}
                      onChange={(e) => handleToggle('closeToTray', e.target.checked)}
                    />
                  </label>

                  <label className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">执行任务后自动隐藏窗口</span>
                      <span className="settings-row-desc">通过 Command Palette 触发任务后自动隐藏面板</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.hideAfterRun}
                      onChange={(e) => handleToggle('hideAfterRun', e.target.checked)}
                    />
                  </label>

                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">默认窗口规格</span>
                      <span className="settings-row-desc">紧凑单栏模式或带分组侧栏的展开模式</span>
                    </div>
                    <select
                      className="settings-select"
                      value={localSettings.windowMode}
                      onChange={(e) => handleToggle('windowMode', e.target.value as Settings['windowMode'])}
                    >
                      <option value="compact">紧凑模式 (Compact 360px)</option>
                      <option value="expanded">展开模式 (Expanded 680px)</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'appearance' ? (
              <div className="settings-tab-pane">
                <div className="settings-group">
                  <div className="settings-group-title">主题配色</div>
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">应用主题</span>
                      <span className="settings-row-desc">支持跟随 Windows 系统或强制深色/浅色</span>
                    </div>
                    <select
                      className="settings-select"
                      value={localSettings.theme}
                      onChange={(e) => handleToggle('theme', e.target.value as Settings['theme'])}
                    >
                      <option value="system">跟随系统 (System)</option>
                      <option value="dark">暗色深邃 (Dark)</option>
                      <option value="light">清爽亮色 (Light)</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'hotkeys' ? (
              <div className="settings-tab-pane">
                <div className="settings-group">
                <div className="settings-group-title">全局与局部热键</div>
                {hotkeyError ? <div className="settings-error-banner">{hotkeyError}</div> : null}
                {hotkeyDraftError ? <div className="settings-error-banner">{hotkeyDraftError}</div> : null}

                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">全局唤出 Command Palette 快捷键</span>
                      <span className="settings-row-desc">在任何界面快速唤出搜索与运行面板</span>
                    </div>
                    <input
                      type="text"
                      className="settings-input-short"
                      value={localSettings.globalHotkey}
                      aria-label="全局唤出快捷键"
                      onChange={(e) => {
                        setLocalSettings({ ...localSettings, globalHotkey: e.target.value });
                        setHotkeyDraftError(null);
                      }}
                      onBlur={() => void commitHotkey()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void commitHotkey();
                        }
                      }}
                    />
                  </div>

                  <div className="settings-shortcuts-table">
                    <div className="shortcut-row">
                      <span className="shortcut-desc">窗口内唤出操作菜单</span>
                      <kbd>Ctrl + K</kbd>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-desc">以管理员身份直接运行任务</span>
                      <kbd>Ctrl + Shift + Enter</kbd>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-desc">新建任务</span>
                      <kbd>Ctrl + N</kbd>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-desc">打开设置</span>
                      <kbd>Ctrl + ,</kbd>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-desc">关闭当前弹层 / 隐藏</span>
                      <kbd>Esc</kbd>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'execution' ? (
              <div className="settings-tab-pane">
                <div className="settings-group">
                  <div className="settings-group-title">脚本执行默认偏好</div>

                  <label className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">默认保持终端窗口开启 (Keep window open)</span>
                      <span className="settings-row-desc">批处理 (/k) 及 PowerShell (-NoExit) 在执行完后不自动关闭</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.keepWindowOpen}
                      onChange={(e) => handleToggle('keepWindowOpen', e.target.checked)}
                    />
                  </label>

                  <label className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Python 脚本静默模式 (pythonw)</span>
                      <span className="settings-row-desc">使用 pythonw.exe 执行，不弹出黑色控制台</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.pythonSilent}
                      onChange={(e) => handleToggle('pythonSilent', e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeTab === 'data' ? (
              <div className="settings-tab-pane">
                <div className="settings-group">
                  <div className="settings-group-title">配置导入与导出</div>

                  {dataMessage ? <div className="settings-msg">{dataMessage}</div> : null}

                  <div className="settings-btn-row">
                    <button type="button" className="editor-btn-secondary" onClick={handleExport}>
                      <Download size={14} />
                      <span>导出全部配置 (JSON)</span>
                    </button>
                    <button type="button" className="editor-btn-secondary" onClick={handleImport}>
                      <Upload size={14} />
                      <span>导入并覆盖配置 (JSON)</span>
                    </button>
                    <button
                      type="button"
                      className="editor-btn-secondary"
                      onClick={onOpenHistory}
                      disabled={!onOpenHistory}
                    >
                      <Clock3 size={14} />
                      <span>查看启动历史</span>
                    </button>
                  </div>

                  <div className="settings-backup-info">
                    <p className="settings-row-desc">
                      系统会在重大结构保存前自动维护最多 3 份循环配置备份（<code>config.backup.1~3.json</code>），并在初次升级时保存 <code>config.v1.backup.json</code>。
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'diagnostics' ? (
              <div className="settings-tab-pane">
                <div className="settings-group">
                  <div className="settings-group-header-row">
                    <span className="settings-group-title">运行环境与诊断</span>
                    <button
                      type="button"
                      className="editor-btn-secondary"
                      onClick={handleCopyDiagnostics}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? '已复制' : '复制诊断信息'}</span>
                    </button>
                  </div>

                  {diagnostics ? (
                    <div className="diagnostics-box">
                      <div className="diag-row">
                        <span className="diag-key">应用版本:</span>
                        <span className="diag-val">v{diagnostics.appVersion}</span>
                      </div>
                      <div className="diag-row">
                        <span className="diag-key">系统架构:</span>
                        <span className="diag-val">{diagnostics.osName}</span>
                      </div>
                      <div className="diag-row">
                        <span className="diag-key">配置格式:</span>
                        <span className="diag-val">Schema v{diagnostics.configVersion}</span>
                      </div>
                      <div className="diag-row">
                        <span className="diag-key">配置文件位置:</span>
                        <span className="diag-val code">{diagnostics.configPath}</span>
                      </div>
                      <div className="diag-row">
                        <span className="diag-key">当前任务数:</span>
                        <span className="diag-val">{diagnostics.taskCount}</span>
                      </div>
                      <div className="diag-row">
                        <span className="diag-key">当前分组数:</span>
                        <span className="diag-val">{diagnostics.groupCount}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="settings-row-desc">正在加载诊断数据...</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

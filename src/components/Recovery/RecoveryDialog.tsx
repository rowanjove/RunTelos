import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Upload, FilePlus, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { tauriService } from '../../services/tauri';
import type { Config } from '../../types';
import { BRAND } from '../../branding';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface RecoveryDialogProps {
  error: string;
  onRecovered: (config: Config) => void;
}

export const RecoveryDialog: React.FC<RecoveryDialogProps> = ({ error, onRecovered }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [backupSlot, setBackupSlot] = useState(1);
  const dialogRef = useDialogAccessibility(true);

  const handleStartFresh = async () => {
    try {
      setBusy(true);
      const emptyConfig: Config = {
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
      const saved = await tauriService.saveConfig(emptyConfig);
      onRecovered(saved);
    } catch (err) {
      setActionError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      setBusy(true);
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (typeof selected === 'string') {
        const nextConfig = await tauriService.importConfig(selected);
        onRecovered(nextConfig);
      }
    } catch (err) {
      setActionError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreAutomaticBackup = async () => {
    try {
      setBusy(true);
      const restored = await tauriService.restoreConfigBackup(backupSlot);
      onRecovered(restored);
    } catch (err) {
      setActionError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenConfigFolder = async () => {
    try {
      setBusy(true);
      await tauriService.openConfigFolder();
    } catch (err) {
      setActionError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="recovery-overlay">
      <div
        ref={dialogRef}
        className="recovery-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recovery-dialog-title"
        aria-describedby="recovery-dialog-description"
        tabIndex={-1}
      >
        <div className="recovery-icon-row">
          <AlertTriangle size={32} className="recovery-icon" />
        </div>

        <h2 className="recovery-title" id="recovery-dialog-title">配置文件读取异常</h2>
        <p className="recovery-desc" id="recovery-dialog-description">
          {BRAND.display} 在加载您的配置时遇到问题，为防止误写覆盖您的数据，请选择恢复方案：
        </p>

        {actionError ? <div className="recovery-error-banner">{actionError}</div> : null}

        <div className="recovery-actions">
          <button
            type="button"
            className="recovery-btn primary"
            disabled={busy}
            onClick={handleImportBackup}
          >
            <Upload size={16} />
            <span>导入备份文件 (Import backup)</span>
          </button>

          <button
            type="button"
            className="recovery-btn"
            disabled={busy}
            onClick={handleRestoreAutomaticBackup}
          >
            <RefreshCw size={16} />
            <span>恢复自动备份 (Restore automatic backup)</span>
          </button>

          <label className="recovery-backup-slot">
            <span>备份槽位（1 最新，3 最旧）</span>
            <select
              value={backupSlot}
              disabled={busy}
              onChange={(event) => setBackupSlot(Number(event.target.value))}
            >
              <option value={1}>#1 最新</option>
              <option value={2}>#2</option>
              <option value={3}>#3 最旧</option>
            </select>
          </label>

          <button
            type="button"
            className="recovery-btn"
            disabled={busy}
            onClick={handleOpenConfigFolder}
          >
            <FolderOpen size={16} />
            <span>打开配置目录 (Open config folder)</span>
          </button>

          <button
            type="button"
            className="recovery-btn"
            disabled={busy}
            onClick={handleStartFresh}
          >
            <FilePlus size={16} />
            <span>以默认配置重新开始 (Start fresh)</span>
          </button>
        </div>

        <div className="recovery-details-section">
          <button
            type="button"
            className="recovery-details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>技术错误详情</span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showDetails ? (
            <pre className="recovery-error-code">{error}</pre>
          ) : null}
        </div>
      </div>
    </div>
  );
};

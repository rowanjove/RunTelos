import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, X } from 'lucide-react';
import { tauriService } from '../../services/tauri';
import type { LaunchRecord } from '../../types';

interface LaunchHistoryDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatStartedAt(value: string): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return value;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export const LaunchHistoryDialog: React.FC<LaunchHistoryDialogProps> = ({ open, onClose }) => {
  const [records, setRecords] = useState<LaunchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setRecords(await tauriService.getLaunchHistory());
    } catch (error) {
      setLoadError(`加载启动历史失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadHistory();
  }, [loadHistory, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-modal launch-history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="settings-title-row">
            <Clock3 size={16} />
            <span id="launch-history-title" className="dialog-title">
              启动历史
            </span>
          </div>
          <div className="launch-history-header-actions">
            <button
              type="button"
              className="dialog-close-btn"
              onClick={() => void loadHistory()}
              title="刷新启动历史"
              aria-label="刷新启动历史"
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
            <button type="button" className="dialog-close-btn" onClick={onClose} aria-label="关闭启动历史">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="launch-history-body">
          <div className="launch-history-summary">
            <span>最近 {records.length} 条记录</span>
            <span className="launch-history-retention">最多保留 200 条</span>
          </div>

          {loadError ? <div className="settings-error-banner">{loadError}</div> : null}

          {loading && records.length === 0 ? (
            <div className="launch-history-empty">正在加载启动历史...</div>
          ) : records.length === 0 ? (
            <div className="launch-history-empty">
              <Clock3 size={28} />
              <span>还没有启动记录</span>
              <span className="launch-history-empty-desc">运行任务后，最近的成功与失败记录会显示在这里。</span>
            </div>
          ) : (
            <div className="launch-history-list" role="list" aria-label="启动历史记录">
              {records.map((record) => {
                const failed = record.status === 'failed';
                return (
                  <div className={`launch-history-item ${failed ? 'failed' : 'launched'}`} key={record.id} role="listitem">
                    <div className="launch-history-status" aria-label={failed ? '启动失败' : '启动成功'}>
                      {failed ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                    </div>
                    <div className="launch-history-record">
                      <div className="launch-history-record-head">
                        <span className="launch-history-task-name">{record.taskName}</span>
                        <time dateTime={record.startedAt}>{formatStartedAt(record.startedAt)}</time>
                      </div>
                      <div className="launch-history-record-status">
                        {failed ? '启动失败' : '已启动'}
                        {failed && record.error ? <span className="launch-history-error">：{record.error}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

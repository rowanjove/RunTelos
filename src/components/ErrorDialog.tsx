import React from "react";
import { X, AlertCircle } from "lucide-react";

interface ErrorDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}
export default function ErrorDialog({
  open,
  title,
  message,
  onClose,
}: ErrorDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-modal"
        style={{ width: 440 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} color="var(--danger-text)" />
            <span className="dialog-title">{title}</span>
          </div>
          <button type="button" className="dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <pre className="recovery-error-code">{message}</pre>
          <div className="dialog-footer">
            <button
              type="button"
              className="editor-btn-secondary"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

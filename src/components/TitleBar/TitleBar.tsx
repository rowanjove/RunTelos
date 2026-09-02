import React from 'react';
import {
  Search,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Columns,
  Square,
  Minus,
  X,
  Plus,
} from 'lucide-react';
import { tauriService } from '../../services/tauri';
import { BRAND } from '../../branding';
import appIconUrl from '../../../src-tauri/icons/64x64.png';

interface TitleBarProps {
  theme: 'system' | 'dark' | 'light';
  windowMode: 'compact' | 'expanded';
  onToggleWindowMode: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenPalette: () => void;
  onOpenAdd: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  theme,
  windowMode,
  onToggleWindowMode,
  onToggleTheme,
  onOpenSettings,
  onOpenPalette,
  onOpenAdd,
}) => {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-logo" data-tauri-drag-region>
          <img src={appIconUrl} alt="" className="titlebar-logo-mark" draggable={false} />
          <span className="titlebar-logo-primary">{BRAND.chinese}</span>
          <span className="titlebar-logo-secondary">{BRAND.english}</span>
        </span>
      </div>

      <div className="titlebar-center" data-tauri-drag-region>
        <button
          type="button"
          className="titlebar-search-trigger"
          title="搜索并运行任务 (Alt+Space)"
          onClick={onOpenPalette}
        >
          <Search size={13} />
          <span>搜索任务...</span>
          <kbd>Alt+Space</kbd>
        </button>
      </div>

      <div className="titlebar-right">
        <button
          type="button"
          className="titlebar-btn"
          title="添加新任务 (Ctrl+N)"
          onClick={onOpenAdd}
        >
          <Plus size={14} />
        </button>

        <button
          type="button"
          className="titlebar-btn"
          title={windowMode === 'compact' ? '切换为展开双栏模式' : '切换为紧凑单栏模式'}
          onClick={onToggleWindowMode}
        >
          <Columns size={13} />
        </button>

        <button
          type="button"
          className="titlebar-btn"
          title={`切换主题 (当前: ${theme})`}
          onClick={onToggleTheme}
        >
          {theme === 'light' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <button
          type="button"
          className="titlebar-btn"
          title="设置 (Ctrl+,)"
          onClick={onOpenSettings}
        >
          <SettingsIcon size={13} />
        </button>

        <div className="titlebar-window-controls">
          <button
            type="button"
            className="titlebar-win-btn minimize"
            title="最小化"
            onClick={() => void tauriService.minimizeWindow()}
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            className="titlebar-win-btn close"
            title="关闭"
            onClick={() => void tauriService.closeWindow()}
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </header>
  );
};

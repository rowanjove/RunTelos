import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

type ShortcutEvent = { state: 'Pressed' | 'Released'; shortcut: string };
type ShortcutHandler = (event: ShortcutEvent) => void;

export function isTauriRuntime() {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as Window & { __TAURI_INTERNALS__?: unknown })
  );
}

export function normalizeGlobalShortcut(value: string): string {
  return value
    .trim()
    .replace(/\s*\+\s*/g, '+')
    .replace(/commandorcontrol/gi, 'CommandOrControl')
    .replace(/ctrl/gi, 'CommandOrControl')
    .replace(/alt/gi, 'Alt')
    .replace(/shift/gi, 'Shift')
    .replace(/(\+|^)space$/i, '$1Space');
}

export function isValidGlobalShortcut(value: string): boolean {
  const normalized = normalizeGlobalShortcut(value);
  if (!normalized || normalized.split('+').some((part) => !part)) return false;
  const parts = normalized.split('+');
  const key = parts.at(-1) ?? '';
  const modifiers = new Set(parts.slice(0, -1));
  const knownModifiers = new Set(['Alt', 'Shift', 'CommandOrControl', 'Super', 'Command', 'Control']);
  return Boolean(key) && modifiers.size > 0 && [...modifiers].every((part) => knownModifiers.has(part));
}

export async function registerGlobalShortcut(
  value: string,
  onPressed: ShortcutHandler,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const shortcut = normalizeGlobalShortcut(value);
  if (!isValidGlobalShortcut(shortcut)) {
    throw new Error('快捷键格式无效，请至少包含一个修饰键和一个按键');
  }
  await register(shortcut, onPressed);
  return true;
}

export async function unregisterGlobalShortcut(value: string): Promise<void> {
  if (!isTauriRuntime()) return;
  const shortcut = normalizeGlobalShortcut(value);
  if (shortcut) {
    await unregister(shortcut);
  }
}

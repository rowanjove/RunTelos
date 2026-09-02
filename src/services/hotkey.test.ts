import { describe, expect, it } from 'vitest';
import { isValidGlobalShortcut, normalizeGlobalShortcut } from './hotkey';

describe('global hotkey normalization', () => {
  it('normalizes the user-facing Ctrl and whitespace forms', () => {
    expect(normalizeGlobalShortcut(' Ctrl + Shift + P ')).toBe('CommandOrControl+Shift+P');
    expect(normalizeGlobalShortcut('alt + space')).toBe('Alt+Space');
  });

  it('requires a modifier and a key', () => {
    expect(isValidGlobalShortcut('Alt+Space')).toBe(true);
    expect(isValidGlobalShortcut('CommandOrControl+Shift+P')).toBe(true);
    expect(isValidGlobalShortcut('Space')).toBe(false);
    expect(isValidGlobalShortcut('Alt+')).toBe(false);
  });
});

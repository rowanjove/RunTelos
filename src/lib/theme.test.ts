import { describe, expect, it } from 'vitest';
import { nextExplicitTheme, resolveTheme, watchTheme } from './theme';
import { vi } from 'vitest';

describe('theme helpers', () => {
  it('resolves system theme from the current OS preference', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('picks the opposite explicit theme for the quick toggle', () => {
    expect(nextExplicitTheme('dark')).toBe('light');
    expect(nextExplicitTheme('light')).toBe('dark');
  });

  it('re-applies the system theme when the OS preference changes', () => {
    const listeners = new Set<() => void>();
    const media = {
      matches: false,
      addEventListener: vi.fn((_event: 'change', listener: () => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_event: 'change', listener: () => void) => listeners.delete(listener)),
    };
    const apply = vi.fn();

    const stopWatching = watchTheme('system', () => media, apply);
    expect(apply).toHaveBeenLastCalledWith('dark');

    media.matches = true;
    listeners.forEach((listener) => listener());
    expect(apply).toHaveBeenLastCalledWith('light');

    stopWatching();
    expect(media.removeEventListener).toHaveBeenCalledTimes(1);
  });
});

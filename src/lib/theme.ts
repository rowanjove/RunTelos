import type { Settings } from '../types';

export type ResolvedTheme = Exclude<Settings['theme'], 'system'>;

type MediaQueryLike = {
  matches: boolean;
  addEventListener: (event: 'change', listener: () => void) => void;
  removeEventListener: (event: 'change', listener: () => void) => void;
};

export function resolveTheme(theme: Settings['theme'], prefersLight: boolean): ResolvedTheme {
  if (theme === 'system') {
    return prefersLight ? 'light' : 'dark';
  }

  return theme;
}

export function nextExplicitTheme(theme: ResolvedTheme): ResolvedTheme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function watchTheme(
  theme: Settings['theme'],
  getMediaQuery: () => MediaQueryLike = () =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: light)')
      : {
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        },
  apply = (resolvedTheme: ResolvedTheme) => {
    document.documentElement.dataset.theme = resolvedTheme;
  },
): () => void {
  if (theme !== 'system') {
    apply(theme);
    return () => {};
  }

  const media = getMediaQuery();
  const syncTheme = () => apply(resolveTheme(theme, media.matches));
  syncTheme();
  media.addEventListener('change', syncTheme);

  return () => media.removeEventListener('change', syncTheme);
}

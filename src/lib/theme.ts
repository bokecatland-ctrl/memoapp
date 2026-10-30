import { KEYS, load, save } from './storage';

export type ThemeMode = 'auto' | 'light' | 'dark';

export function loadTheme(): ThemeMode {
  const v = load(KEYS.theme);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

/** auto のときは属性を外し、CSS の prefers-color-scheme に任せる */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'auto') delete root.dataset.theme;
  else root.dataset.theme = mode;
  save(KEYS.theme, mode === 'auto' ? null : mode);
}

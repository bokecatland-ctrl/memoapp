import type { ThemeMode } from '../lib/theme';

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: '自動' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
];

interface Props {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

export function ThemeSwitch({ mode, onChange }: Props) {
  return (
    <div className="theme-switch" role="group" aria-label="表示テーマ">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={mode === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

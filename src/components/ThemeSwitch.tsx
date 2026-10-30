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

/** PC は3つ並べ、幅の狭いスマホは押すたびに 自動→ライト→ダーク と切り替える1つのボタンにする */
export function ThemeSwitch({ mode, onChange }: Props) {
  const i = OPTIONS.findIndex((o) => o.value === mode);
  const next = OPTIONS[(i + 1) % OPTIONS.length];
  return (
    <>
      <div className="theme-switch" role="group" aria-label="表示テーマ">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" aria-pressed={mode === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="theme-cycle"
        aria-label={`表示テーマ:${OPTIONS[i].label}(押すと${next.label})`}
        onClick={() => onChange(next.value)}
      >
        {OPTIONS[i].label}
      </button>
    </>
  );
}

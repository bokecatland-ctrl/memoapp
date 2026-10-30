// 線のアイコン(文字色に合わせる)。すべて飾りとして扱い、ボタン側に aria-label をつける
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

type Props = { size?: number; filled?: boolean };

export function PinIcon({ size = 18, filled = false }: Props) {
  return (
    <svg {...base} width={size} height={size} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ArchiveIcon({ size = 18 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 13h4" />
    </svg>
  );
}

export function UndoIcon({ size = 18 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}

export function SendIcon({ size = 22 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export function CloseIcon({ size = 20 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function LogoutIcon({ size = 20 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h10" />
    </svg>
  );
}

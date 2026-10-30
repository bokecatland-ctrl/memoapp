const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 端末の時刻での日付(YYYY-MM-DD) */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DueState = 'overdue' | 'today' | 'later';

export function dueState(due: string | null, today: string): DueState | null {
  if (!due) return null;
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'later';
}

/** 10/30(金) */
export function formatDayWithWeekday(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

/** YYYY-MM-DD → 11/7 */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

/** 3分前、昨日 など */
export function formatRelative(iso: string, now: Date): string {
  const then = new Date(iso);
  const sec = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (sec < 60) return 'たった今';
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  const days = Math.round(
    (new Date(toISODate(now)).getTime() - new Date(toISODate(then)).getTime()) / 86_400_000,
  );
  if (days === 0) return `${Math.floor(sec / 3600)}時間前`;
  if (days === 1) return '昨日';
  if (days < 7) return `${days}日前`;
  return formatShortDate(toISODate(then));
}

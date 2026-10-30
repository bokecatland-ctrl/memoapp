import { dueState } from './dates';
import type { Category, Memo } from './types';

export type Tab = 'all' | Category | 'finished';

const newestFirst = (a: Memo, b: Memo) => b.created_at.localeCompare(a.created_at);

/** 「期限切れ」「今日」の帯に出すもの(期限の古い順) */
export function dueBand(memos: Memo[], today: string): Memo[] {
  return memos
    .filter((m) => m.status === 'active' && (dueState(m.due_date, today) === 'overdue' || dueState(m.due_date, today) === 'today'))
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || newestFirst(a, b));
}

export function pinnedMemos(memos: Memo[]): Memo[] {
  return memos.filter((m) => m.status === 'active' && m.pinned).sort(newestFirst);
}

/**
 * タブごとの一覧。「すべて」では、ピン留めボードと期限の帯に出ているものは重ねて出さない。
 * 「済み」は終わった順(新しい順)。
 */
export function listFor(tab: Tab, memos: Memo[], today: string): Memo[] {
  if (tab === 'finished') {
    return memos.filter((m) => m.status !== 'active').sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const active = memos.filter((m) => m.status === 'active');
  if (tab === 'all') {
    const shown = new Set([...dueBand(memos, today), ...pinnedMemos(memos)].map((m) => m.id));
    return active.filter((m) => !shown.has(m.id)).sort(newestFirst);
  }
  return active.filter((m) => m.category === tab).sort(newestFirst);
}

export function countFor(tab: Tab, memos: Memo[]): number {
  if (tab === 'finished') return memos.filter((m) => m.status !== 'active').length;
  const active = memos.filter((m) => m.status === 'active');
  return tab === 'all' ? active.length : active.filter((m) => m.category === tab).length;
}

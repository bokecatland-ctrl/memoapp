import { describe, expect, it } from 'vitest';
import { dueState, formatRelative } from './dates';
import { LocalMemoStore, type KeyValue } from './memoStore';
import { countFor, dueBand, listFor, pinnedMemos } from './selectors';
import type { Memo } from './types';

const TODAY = '2026-10-30';

function memo(id: string, over: Partial<Memo> = {}): Memo {
  return {
    id,
    body: id,
    category: 'inbox',
    due_date: null,
    share_to: null,
    pinned: false,
    status: 'active',
    source: 'text',
    created_at: `2026-10-30T0${id.length}:00:00.000Z`,
    updated_at: `2026-10-30T0${id.length}:00:00.000Z`,
    ...over,
  };
}

describe('dueState', () => {
  it('期限切れ・今日・先を見分ける', () => {
    expect(dueState('2026-10-29', TODAY)).toBe('overdue');
    expect(dueState(TODAY, TODAY)).toBe('today');
    expect(dueState('2026-11-01', TODAY)).toBe('later');
    expect(dueState(null, TODAY)).toBeNull();
  });
});

describe('dueBand', () => {
  it('未完了で期限が今日以前のものを、期限の古い順に出す', () => {
    const memos = [
      memo('a', { category: 'todo', due_date: TODAY }),
      memo('b', { category: 'todo', due_date: '2026-10-28' }),
      memo('c', { category: 'todo', due_date: '2026-11-02' }),
      memo('d', { category: 'share', due_date: '2026-10-01', status: 'done' }),
    ];
    expect(dueBand(memos, TODAY).map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('listFor', () => {
  const memos = [
    memo('pin', { pinned: true, category: 'idea' }),
    memo('due', { category: 'todo', due_date: TODAY }),
    memo('plain', { category: 'todo' }),
    memo('old', { category: 'idea', status: 'archived', updated_at: '2026-10-30T09:00:00.000Z' }),
  ];

  it('「すべて」ではピン留めと期限の帯に出ているものを重ねない', () => {
    expect(listFor('all', memos, TODAY).map((m) => m.id)).toEqual(['plain']);
  });

  it('カテゴリのタブでは、そのカテゴリの未完了をすべて出す', () => {
    expect(listFor('todo', memos, TODAY).map((m) => m.id).sort()).toEqual(['due', 'plain']);
  });

  it('「済み」には完了・アーカイブしたものだけ', () => {
    expect(listFor('finished', memos, TODAY).map((m) => m.id)).toEqual(['old']);
    expect(countFor('finished', memos)).toBe(1);
  });

  it('ピン留めは未完了だけ', () => {
    expect(pinnedMemos([...memos, memo('p2', { pinned: true, status: 'done' })]).map((m) => m.id)).toEqual(['pin']);
  });
});

describe('formatRelative', () => {
  const now = new Date(2026, 9, 30, 12, 0);
  it('分・時間・昨日', () => {
    expect(formatRelative(new Date(2026, 9, 30, 11, 57).toISOString(), now)).toBe('3分前');
    expect(formatRelative(new Date(2026, 9, 30, 9, 0).toISOString(), now)).toBe('3時間前');
    expect(formatRelative(new Date(2026, 9, 29, 23, 0).toISOString(), now)).toBe('昨日');
  });
});

describe('LocalMemoStore', () => {
  function memoryKV(): KeyValue & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
  }

  it('追加・更新・取り消しが保存され、読み直しても残る', async () => {
    const kv = memoryKV();
    const store = new LocalMemoStore(kv);
    const a = await store.add({ body: 'グラス発注', category: 'todo' });
    const b = await store.add({ body: 'ナプキン', category: 'inbox' });
    await store.update(a.id, { status: 'done' });
    await store.remove(b.id);

    const reopened = new LocalMemoStore(kv);
    expect(reopened.getAll()).toHaveLength(1);
    expect(reopened.getAll()[0]).toMatchObject({ body: 'グラス発注', status: 'done', pinned: false, source: 'text' });
  });

  it('壊れたデータでも止まらない', () => {
    const kv = memoryKV();
    kv.set('memoapp.memos', '{not json');
    expect(new LocalMemoStore(kv).getAll()).toEqual([]);
  });
});

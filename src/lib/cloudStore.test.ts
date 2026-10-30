import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, CloudMemoStore, type MemoApi } from './cloudStore';
import type { KeyValue } from './memoStore';
import type { Memo } from './types';

function memoryKV(): KeyValue {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

/** サーバーの代わり。online=false の間は通信エラー(あとで送り直せるもの)を返す */
function fakeApi() {
  const rows = new Map<string, Memo>();
  const state = { online: true, reject: null as string | null };
  const guard = () => {
    if (!state.online) throw new ApiError('Failed to fetch', true);
    if (state.reject) throw new ApiError(state.reject, false);
  };
  const api: MemoApi = {
    async fetchAll() {
      guard();
      return [...rows.values()];
    },
    async insert(memo) {
      guard();
      rows.set(memo.id, { ...memo });
    },
    async update(id, patch) {
      guard();
      const m = rows.get(id);
      if (m) rows.set(id, { ...m, ...patch });
    },
    async remove(id) {
      guard();
      rows.delete(id);
    },
    subscribe: () => () => {},
  };
  return { api, rows, state };
}

afterEach(() => vi.useRealTimers());

describe('CloudMemoStore', () => {
  it('追加はすぐ画面に出て、サーバーにも送られる', async () => {
    const { api, rows } = fakeApi();
    const store = new CloudMemoStore(api, 'u1', memoryKV());
    const memo = await store.add({ body: 'グラス発注', category: 'todo' });
    expect(store.getAll().map((m) => m.body)).toEqual(['グラス発注']);
    await store.add({ body: '2件目', category: 'idea' }); // 送信中に追加しても続けて送る
    await store.flush();
    expect(rows.size).toBe(2);
    expect(rows.get(memo.id)?.body).toBe('グラス発注');
    expect(store.getPendingCount()).toBe(0);
  });

  it('電波がないときは未送信として残し、閉じても消えず、つながったら送る', async () => {
    const { api, rows, state } = fakeApi();
    const kv = memoryKV();
    state.online = false;
    const store = new CloudMemoStore(api, 'u1', kv);
    const memo = await store.add({ body: '地下で書いたメモ', category: 'inbox' });
    await store.update(memo.id, { category: 'idea' });
    await store.flush();
    expect(store.getPendingCount()).toBe(2);
    expect(rows.size).toBe(0);

    // アプリを閉じて開き直す
    const reopened = new CloudMemoStore(api, 'u1', kv);
    expect(reopened.getAll()).toMatchObject([{ body: '地下で書いたメモ', category: 'idea' }]);
    expect(reopened.getPendingCount()).toBe(2);

    state.online = true;
    await reopened.flush();
    expect(reopened.getPendingCount()).toBe(0);
    expect(rows.get(memo.id)).toMatchObject({ body: '地下で書いたメモ', category: 'idea' });
  });

  it('読み直しても、未送信の変更は画面から消えない', async () => {
    const { api, rows, state } = fakeApi();
    const store = new CloudMemoStore(api, 'u1', memoryKV());
    const sent = await store.add({ body: '送れた', category: 'inbox' });
    await store.flush();
    state.online = false;
    await store.update(sent.id, { status: 'done' });
    await store.flush();
    state.online = true;
    rows.set('00000000-0000-4000-8000-000000000001', { ...sent, id: '00000000-0000-4000-8000-000000000001', body: 'PCで書いた' });
    await store.refresh();
    expect(store.getAll().find((m) => m.id === sent.id)?.status).toBe('done');
    expect(store.getAll().some((m) => m.body === 'PCで書いた')).toBe(true);
  });

  it('送り直しても通らないものは箱から出して知らせ、後ろのものは止めない', async () => {
    vi.useFakeTimers();
    const { api, rows, state } = fakeApi();
    const store = new CloudMemoStore(api, 'u1', memoryKV());
    const errors: string[] = [];
    store.onError((m) => errors.push(m));
    state.reject = 'new row violates check constraint';
    await store.add({ body: 'だめなメモ', category: 'inbox' });
    await store.flush();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('だめなメモ');
    expect(store.getPendingCount()).toBe(0);
    expect(store.getAll()).toEqual([]); // 通らなかったものは画面にも残さない
    state.reject = null;
    await store.add({ body: 'つぎのメモ', category: 'inbox' });
    await store.flush();
    expect([...rows.values()].map((m) => m.body)).toEqual(['つぎのメモ']);
  });

  it('端末保存版のメモをクラウドへ移せる', async () => {
    const { api, rows } = fakeApi();
    const store = new CloudMemoStore(api, 'u1', memoryKV());
    const old: Memo = {
      id: '00000000-0000-4000-8000-0000000000aa',
      body: '前から書いていたメモ',
      category: 'remember',
      due_date: null,
      share_to: null,
      pinned: true,
      status: 'active',
      source: 'text',
      created_at: '2026-10-29T01:00:00.000Z',
      updated_at: '2026-10-29T01:00:00.000Z',
    };
    store.importMemos([old]);
    await store.flush();
    expect(rows.get(old.id)).toMatchObject({ body: '前から書いていたメモ', pinned: true, created_at: old.created_at });
  });

  it('利用者ごとに端末の保存場所を分ける', async () => {
    const { api } = fakeApi();
    const kv = memoryKV();
    const a = new CloudMemoStore(api, 'u1', kv);
    await a.add({ body: 'A', category: 'inbox' });
    expect(new CloudMemoStore(api, 'u2', kv).getAll()).toEqual([]);
  });
});

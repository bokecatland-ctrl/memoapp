import { KEYS, load, save } from './storage';
import type { Memo, MemoPatch, NewMemo } from './types';

/**
 * メモの保存先。手順2は端末保存(localStorage)、手順3で Supabase 版に差し替える。
 * 画面はこのインターフェースだけを使う。
 */
export interface MemoStore {
  getAll(): Memo[];
  subscribe(listener: () => void): () => void;
  add(input: NewMemo): Promise<Memo>;
  update(id: string, patch: MemoPatch): Promise<void>;
  /** 削除(間違えて書いたものなど)。終わったものは消さずに「済み」へ移す */
  remove(id: string): Promise<void>;
  /** 削除の「取り消し」。消したメモを id・作成日時ごと戻す */
  restore(memo: Memo): Promise<void>;
  /** まだサーバーに送れていない変更の数(端末保存では常に 0) */
  getPendingCount(): number;
  /** 保存に失敗したときの知らせ(画面に出す文言) */
  onError(listener: (message: string) => void): () => void;
}

export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const browserKV: KeyValue = { get: load, set: save };

/** uuid v4(DB の id 列にそのまま入れられる形) */
export function newId(): string {
  // randomUUID は https でないと使えないので、なければ自分で作る
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function buildMemo(input: NewMemo, at: string): Memo {
  return {
    id: newId(),
    body: input.body,
    category: input.category,
    due_date: input.due_date ?? null,
    share_to: input.share_to ?? null,
    pinned: input.pinned ?? false,
    status: 'active',
    source: input.source ?? 'text',
    created_at: at,
    updated_at: at,
  };
}

export function parse(raw: string | null): Memo[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export class LocalMemoStore implements MemoStore {
  private memos: Memo[];
  private listeners = new Set<() => void>();

  constructor(
    private kv: KeyValue = browserKV,
    private now: () => Date = () => new Date(),
  ) {
    this.memos = parse(kv.get(KEYS.memos));
  }

  /** 別のタブで書き換えられたときに読み直す(PCで2つ開いている場合など) */
  reload(): void {
    this.memos = parse(this.kv.get(KEYS.memos));
    this.emit();
  }

  getAll(): Memo[] {
    return this.memos;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async add(input: NewMemo): Promise<Memo> {
    const memo = buildMemo(input, this.now().toISOString());
    this.commit([memo, ...this.memos]);
    return memo;
  }

  async update(id: string, patch: MemoPatch): Promise<void> {
    const at = this.now().toISOString();
    this.commit(this.memos.map((m) => (m.id === id ? { ...m, ...patch, updated_at: at } : m)));
  }

  async remove(id: string): Promise<void> {
    this.commit(this.memos.filter((m) => m.id !== id));
  }

  async restore(memo: Memo): Promise<void> {
    this.commit([memo, ...this.memos.filter((m) => m.id !== memo.id)]);
  }

  getPendingCount(): number {
    return 0;
  }

  onError(): () => void {
    return () => {};
  }

  private commit(next: Memo[]): void {
    this.memos = next;
    this.kv.set(KEYS.memos, JSON.stringify(next));
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}

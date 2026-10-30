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
  /** 保存直後の「取り消し」専用。それ以外は消さずに「済み」へ移す */
  remove(id: string): Promise<void>;
}

export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const browserKV: KeyValue = { get: load, set: save };

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function parse(raw: string | null): Memo[] {
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
    const at = this.now().toISOString();
    const memo: Memo = {
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

  private commit(next: Memo[]): void {
    this.memos = next;
    this.kv.set(KEYS.memos, JSON.stringify(next));
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}

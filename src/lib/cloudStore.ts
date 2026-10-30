import { browserKV, buildMemo, parse, type KeyValue, type MemoStore } from './memoStore';
import type { Memo, MemoPatch, NewMemo } from './types';

/** サーバーとのやりとり(Supabase 版は supabaseApi.ts。テストでは偽物を使う) */
export interface MemoApi {
  fetchAll(): Promise<Memo[]>;
  /** 同じ id で2回送っても1件になる(再送しても重複しない) */
  insert(memo: Memo): Promise<void>;
  update(id: string, patch: MemoPatch): Promise<void>;
  remove(id: string): Promise<void>;
  /** 別の端末での変更を知らせる */
  subscribe(onChange: () => void): () => void;
}

export class ApiError extends Error {
  /** true:電波が悪い・ログインの更新待ちなど、あとで送り直せば通るもの */
  constructor(message: string, readonly transient: boolean) {
    super(message);
  }
}

type Op =
  | { kind: 'insert'; memo: Memo }
  | { kind: 'update'; id: string; patch: MemoPatch; at: string }
  | { kind: 'remove'; id: string };

function applyOp(memos: Memo[], op: Op): Memo[] {
  switch (op.kind) {
    case 'insert':
      return memos.some((m) => m.id === op.memo.id)
        ? memos.map((m) => (m.id === op.memo.id ? op.memo : m))
        : [op.memo, ...memos];
    case 'update':
      return memos.map((m) => (m.id === op.id ? { ...m, ...op.patch, updated_at: op.at } : m));
    case 'remove':
      return memos.filter((m) => m.id !== op.id);
  }
}

function parseOps(raw: string | null): Op[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const RETRY_MS = 30_000;

/**
 * クラウド保存。画面にはすぐ反映し、サーバーへは「未送信の箱(outbox)」から順に送る。
 * 電波がないときは箱に残して、つながったら送る。箱と最後に読んだ内容は端末にも保存するので、
 * 起動直後でもすぐ表示でき、閉じても未送信のメモは消えない。
 */
export class CloudMemoStore implements MemoStore {
  private server: Memo[];
  private outbox: Op[];
  private view: Memo[];
  private listeners = new Set<() => void>();
  private errorListeners = new Set<(message: string) => void>();
  private flushing: Promise<void> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private api: MemoApi,
    private userId: string,
    private kv: KeyValue = browserKV,
    private now: () => Date = () => new Date(),
  ) {
    this.server = parse(kv.get(this.cacheKey));
    this.outbox = parseOps(kv.get(this.outboxKey));
    this.view = this.compute();
  }

  get cacheKey(): string {
    return `memoapp.cloud.${this.userId}`;
  }

  get outboxKey(): string {
    return `memoapp.outbox.${this.userId}`;
  }

  /** 読み込み・送信・他の端末の変更の受け取りを始める。戻り値で止める */
  start(): () => void {
    void this.refresh().then(() => this.flush());
    const unsubscribe = this.api.subscribe(() => this.scheduleRefresh());
    const onOnline = () => void this.flush().then(() => this.refresh());
    window.addEventListener('online', onOnline);
    // スマホでアプリに戻ってきたときにも最新にする
    const onVisible = () => {
      if (document.visibilityState === 'visible') onOnline();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (this.outbox.length > 0) void this.flush();
    }, RETRY_MS);
    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
      clearTimeout(this.refreshTimer);
    };
  }

  getAll(): Memo[] {
    return this.view;
  }

  getPendingCount(): number {
    return this.outbox.length;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onError(listener: (message: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  async add(input: NewMemo): Promise<Memo> {
    const memo = buildMemo(input, this.now().toISOString());
    this.enqueue({ kind: 'insert', memo });
    return memo;
  }

  async update(id: string, patch: MemoPatch): Promise<void> {
    this.enqueue({ kind: 'update', id, patch, at: this.now().toISOString() });
  }

  async remove(id: string): Promise<void> {
    this.enqueue({ kind: 'remove', id });
  }

  async restore(memo: Memo): Promise<void> {
    this.enqueue({ kind: 'insert', memo });
  }

  /** 端末保存版で書いたメモをクラウドへ移す(id・作成日時はそのまま) */
  importMemos(memos: Memo[]): void {
    for (const memo of memos) this.outbox.push({ kind: 'insert', memo });
    this.changed();
    void this.flush();
  }

  /** サーバーの内容を読み直す。失敗しても(電波がないなど)手元の内容で続ける */
  async refresh(): Promise<void> {
    try {
      this.server = await this.api.fetchAll();
      this.kv.set(this.cacheKey, JSON.stringify(this.server));
      this.view = this.compute();
      this.emit();
    } catch {
      // 次の機会に読み直す
    }
  }

  /** 未送信の箱を古い順に送る。送れないものが出たら、そこで止めてあとで再開する */
  flush(): Promise<void> {
    // 送信中なら同じ送信を待つ(送信中に増えた分も、その中で続けて送る)
    this.flushing ??= this.runFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async runFlush(): Promise<void> {
    let changedOnServer = false;
    while (this.outbox.length > 0) {
      const op = this.outbox[0];
      try {
        await this.send(op);
        this.server = applyOp(this.server, op);
      } catch (e) {
        // 想定外のエラーも、メモを失わないよう「あとで送り直す」側に倒す
        if (!(e instanceof ApiError) || e.transient) break;
        // 送り直しても通らないもの(内容の不備など)は箱から出して知らせる
        this.reportError(op, e);
      }
      changedOnServer = true;
      this.outbox.shift();
      this.changed();
    }
    if (changedOnServer) this.scheduleRefresh();
  }

  private send(op: Op): Promise<void> {
    switch (op.kind) {
      case 'insert':
        return this.api.insert(op.memo);
      case 'update':
        return this.api.update(op.id, op.patch);
      case 'remove':
        return this.api.remove(op.id);
    }
  }

  private reportError(op: Op, e: unknown): void {
    const detail = e instanceof Error ? e.message : String(e);
    const message =
      op.kind === 'insert'
        ? `保存できませんでした:「${op.memo.body.slice(0, 30)}」(${detail})`
        : `変更を保存できませんでした(${detail})`;
    this.errorListeners.forEach((l) => l(message));
  }

  private enqueue(op: Op): void {
    this.outbox.push(op);
    this.changed();
    void this.flush();
  }

  private scheduleRefresh(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(), 300);
  }

  private compute(): Memo[] {
    return this.outbox.reduce(applyOp, this.server);
  }

  private changed(): void {
    this.kv.set(this.outboxKey, JSON.stringify(this.outbox));
    this.kv.set(this.cacheKey, JSON.stringify(this.server));
    this.view = this.compute();
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}

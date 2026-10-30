import { createClient } from '@supabase/supabase-js';
import { ApiError, type MemoApi } from './cloudStore';
import type { Memo, MemoPatch } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 未設定なら端末保存だけで動かす(開発用) */
export const apiConfigured = Boolean(url && key);

export const supabase = apiConfigured
  ? createClient(url!, key!, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } })
  : null;

const COLUMNS = 'id, body, category, due_date, share_to, pinned, status, source, created_at, updated_at';

function check({ error, status }: { error: { message: string } | null; status: number }): void {
  if (!error) return;
  // 0 = 通信できなかった。401 = ログインの更新待ち。5xx・408・429 = 一時的なもの
  const transient =
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
  throw new ApiError(error.message, transient);
}

export function createSupabaseApi(): MemoApi {
  if (!supabase) throw new Error('Supabase が設定されていません');
  const sb = supabase;
  return {
    async fetchAll() {
      const res = await sb.from('memos').select(COLUMNS).order('created_at', { ascending: false });
      check(res);
      return (res.data ?? []) as Memo[];
    },
    async insert(memo: Memo) {
      check(await sb.from('memos').upsert(memo, { onConflict: 'id' }));
    },
    async update(id: string, patch: MemoPatch) {
      check(await sb.from('memos').update(patch).eq('id', id));
    },
    async remove(id: string) {
      check(await sb.from('memos').delete().eq('id', id));
    },
    subscribe(onChange) {
      const channel = sb
        .channel('memos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'memos' }, () => onChange())
        // つながり直したときも、そのあいだの変更を取りこぼさないよう読み直す
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') onChange();
        });
      return () => void sb.removeChannel(channel);
    },
  };
}

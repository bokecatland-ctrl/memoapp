import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { App } from './App';
import { LoginScreen } from './components/LoginScreen';
import { CloudMemoStore } from './lib/cloudStore';
import { LocalMemoStore, parse } from './lib/memoStore';
import { KEYS, load, save } from './lib/storage';
import { apiConfigured, createSupabaseApi, supabase } from './lib/supabase';

type Phase =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'denied'; email: string }
  | { kind: 'ready'; userId: string; email: string };

const allowedKey = (userId: string) => `memoapp.allowed.${userId}`;
const LAST_USER_KEY = 'memoapp.lastUser';

/** 前回この端末で使った人(電波がないときに、ログインの確認を待たずに開くため) */
function loadLastUser(): { userId: string; email: string } | null {
  try {
    const v = JSON.parse(load(LAST_USER_KEY) ?? 'null');
    return v && typeof v.userId === 'string' && load(allowedKey(v.userId)) === '1' ? v : null;
  } catch {
    return null;
  }
}

/** Supabase の設定がない開発環境では、端末保存版として動かす */
export function Root() {
  return apiConfigured ? <CloudRoot /> : <LocalRoot />;
}

function LocalRoot() {
  const store = useMemo(() => {
    const s = new LocalMemoStore();
    window.addEventListener('storage', (e) => {
      if (e.key === KEYS.memos) s.reload();
    });
    return s;
  }, []);
  return <App store={store} />;
}

function CloudRoot() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    const sb = supabase!;
    let cancelled = false;

    const handle = async (session: Session | null) => {
      if (!session) {
        setPhase({ kind: 'signedOut' });
        return;
      }
      const userId = session.user.id;
      const email = session.user.email ?? '';
      // 一度確認できた端末では、確認を待たずにすぐ開く(起動の速さを優先)。確認は裏で行う
      if (load(allowedKey(userId)) === '1') setPhase({ kind: 'ready', userId, email });
      const { data, error } = await sb.rpc('is_allowed');
      if (cancelled || error) return; // 電波がないときは、これまでの判定のまま
      if (data === true) {
        save(allowedKey(userId), '1');
        save(LAST_USER_KEY, JSON.stringify({ userId, email }));
        setPhase({ kind: 'ready', userId, email });
      } else {
        save(allowedKey(userId), null);
        setPhase({ kind: 'denied', email });
      }
    };

    // ログインの期限が切れていて電波がないと、確認に数十秒かかる。前回の人ですぐ開き、メモは未送信としてためる
    const last = loadLastUser();
    if (last) setPhase({ kind: 'ready', ...last });
    void sb.auth.getSession().then(({ data, error }) => {
      if (error && last) return; // 電波がない:そのまま使い、つながったら自動でログインを更新する
      void handle(data.session);
    });
    // ログイン・ログアウトのときだけ判定し直す(トークンの更新では何もしない)
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void handle(session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (phase.kind === 'loading') return null;
  if (phase.kind === 'signedOut') return <LoginScreen />;
  if (phase.kind === 'denied') return <LoginScreen deniedEmail={phase.email} />;
  return <CloudApp key={phase.userId} userId={phase.userId} email={phase.email} />;
}

function CloudApp({ userId, email }: { userId: string; email: string }) {
  const store = useMemo(() => new CloudMemoStore(createSupabaseApi(), userId), [userId]);

  useEffect(() => {
    const stop = store.start();
    // 端末保存版で書いたメモがあれば、クラウドへ移して端末からは消す
    const local = parse(load(KEYS.memos));
    if (local.length > 0) {
      store.importMemos(local);
      save(KEYS.memos, null);
    }
    return stop;
  }, [store]);

  const signOut = async () => {
    const pending = store.getPendingCount();
    if (pending > 0 && !window.confirm(`まだ送信できていない変更が${pending}件あります。ログアウトすると消えます。ログアウトしますか?`)) {
      return;
    }
    // 職場の PC で使うこともあるので、端末に残した内容も消す
    save(store.cacheKey, null);
    save(store.outboxKey, null);
    save(allowedKey(userId), null);
    save(LAST_USER_KEY, null);
    await supabase!.auth.signOut();
  };

  return <App store={store} account={{ email, onSignOut: signOut }} />;
}

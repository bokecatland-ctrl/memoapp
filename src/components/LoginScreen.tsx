import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  /** ログインできたが、使えないアカウントだったとき */
  deniedEmail?: string;
}

export function LoginScreen({ deniedEmail }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      setError('ログイン画面を開けませんでした。電波の良いところで、もう一度お試しください。');
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <h1>メモ</h1>
      {deniedEmail ? (
        <>
          <p className="login-error">
            {deniedEmail || 'このアカウント'} では使えません。
            <br />
            使えるアカウントでログインし直してください。
          </p>
          <button type="button" className="btn" onClick={() => supabase!.auth.signOut()}>
            ログアウト
          </button>
        </>
      ) : (
        <>
          <p className="login-lead">Google アカウントでログインしてください</p>
          <button type="button" className="btn btn-primary login-btn" disabled={busy} onClick={signIn}>
            Google でログイン
          </button>
          {error && <p className="login-error">{error}</p>}
        </>
      )}
    </main>
  );
}

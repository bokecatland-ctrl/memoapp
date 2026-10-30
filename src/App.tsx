import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CategoryTabs } from './components/CategoryTabs';
import { DueBand } from './components/DueBand';
import { EditSheet } from './components/EditSheet';
import { MemoCard, type CardActions } from './components/MemoCard';
import { PinBoard } from './components/PinBoard';
import { QuickInput } from './components/QuickInput';
import { ThemeSwitch } from './components/ThemeSwitch';
import { Toast, type ToastData } from './components/Toast';
import { LogoutIcon } from './components/icons';
import { ALL_CATEGORIES, CATEGORIES } from './lib/categories';
import { formatDayWithWeekday, formatShortDate, toISODate } from './lib/dates';
import type { MemoStore } from './lib/memoStore';
import { classify, detectDue } from './lib/parse';
import { countFor, dueBand, listFor, pinnedMemos, type Tab } from './lib/selectors';
import { KEYS, load, save } from './lib/storage';
import { applyTheme, loadTheme, type ThemeMode } from './lib/theme';
import type { Category, Memo, MemoPatch, Source } from './lib/types';
import { useSpeech } from './lib/useSpeech';

const TABS: Tab[] = ['all', ...ALL_CATEGORIES, 'finished'];

function loadTab(): Tab {
  const v = load(KEYS.tab) as Tab | null;
  return v && TABS.includes(v) ? v : 'all';
}

/** 日付と「〇分前」を更新するため、1分ごとに時刻を進める */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

const EMPTY_MESSAGE: Record<Tab, string> = {
  all: 'メモはまだありません。下の欄に書いて保存してください',
  inbox: '受信箱は空です',
  idea: 'アイデアはまだありません',
  todo: 'やることはありません',
  remember: '覚えておくことはありません',
  share: '共有事項はありません',
  finished: '完了・アーカイブしたメモはここに残ります',
};

interface Props {
  store: MemoStore;
  /** クラウド保存のとき(端末保存の開発モードでは無し) */
  account?: { email: string; onSignOut: () => void };
}

export function App({ store, account }: Props) {
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const memos = useSyncExternalStore(subscribe, () => store.getAll());
  const pending = useSyncExternalStore(subscribe, () => store.getPendingCount());
  const now = useNow();
  const today = toISODate(now);
  const [tab, setTabState] = useState<Tab>(loadTab);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(loadTheme);
  const [toast, setToast] = useState<ToastData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => store.onError((message) => setToast({ id: Date.now(), message })), [store]);

  const setTab = (t: Tab) => {
    setTabState(t);
    save(KEYS.tab, t === 'all' ? null : t);
  };

  const notify = (message: string, undo?: () => void) => setToast({ id: Date.now(), message, undo });
  const clearToast = useCallback(() => setToast(null), []);

  const pins = useMemo(() => pinnedMemos(memos), [memos]);
  const band = useMemo(() => dueBand(memos, today), [memos, today]);
  const list = useMemo(() => listFor(tab, memos, today), [tab, memos, today]);
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t, countFor(t, memos)])) as Record<Tab, number>,
    [memos],
  );
  const editing = editingId ? memos.find((m) => m.id === editingId) ?? null : null;

  /** 色ボタンで選んだときはそのカテゴリ、選んでいなければ先頭のキーワードで分ける */
  const addMemo = async (text: string, chosen: Category | null, source: Source = 'text') => {
    const { category, body } = chosen ? { category: chosen, body: text } : classify(text);
    // 期限のあるカテゴリ(やること・共有事項)だけ、「明日」などから期限の候補を入れる
    const due_date = CATEGORIES[category].hasDue ? detectDue(body, new Date()) : null;
    const memo = await store.add({ body, category, due_date, source });
    const label = CATEGORIES[category].label;
    const detail = due_date ? `(期限 ${formatShortDate(due_date)})` : '';
    notify(
      source === 'voice' ? `${label}${detail}:「${body}」` : `${label}に保存しました${detail}`,
      () => store.remove(memo.id),
    );
  };

  const speech = useSpeech({
    onFinal: (text) => void addMemo(text, null, 'voice'),
    onError: (message) => notify(message),
  });

  const finish = (memo: Memo) => {
    const info = CATEGORIES[memo.category];
    store.update(memo.id, { status: info.finishStatus });
    notify(`「${info.finishLabel}」にしました`, () => store.update(memo.id, { status: 'active' }));
  };

  const actions: CardActions = {
    onEdit: (m) => setEditingId(m.id),
    onFinish: finish,
    onSort: (m, c) => {
      // やること・共有事項に移したときは、本文の「明日」などから期限の候補を入れる(書いた日を基準に)
      const due_date = CATEGORIES[c].hasDue ? m.due_date ?? detectDue(m.body, new Date(m.created_at)) : null;
      store.update(m.id, { category: c, due_date });
      const detail = due_date ? `(期限 ${formatShortDate(due_date)})` : '';
      notify(`${CATEGORIES[c].label}に移しました${detail}`, () =>
        store.update(m.id, { category: m.category, due_date: m.due_date }),
      );
    },
    onTogglePin: (m) => store.update(m.id, { pinned: !m.pinned }),
    onRestore: (m) => {
      store.update(m.id, { status: 'active' });
      notify('一覧に戻しました', () => store.update(m.id, { status: m.status }));
    },
    // 確認は出さず、すぐ消して「取り消し」で戻せるようにする
    onDelete: (m) => {
      store.remove(m.id);
      notify(`削除しました:「${m.body}」`, () => store.restore(m));
    },
  };

  const closeEdit = useCallback(() => setEditingId(null), []);
  const saveEdit = (patch: MemoPatch) => {
    if (editing) store.update(editing.id, patch);
    setEditingId(null);
  };

  return (
    <div className="app">
      <header className="top">
        <h1>メモ</h1>
        <p className="top-date">{formatDayWithWeekday(now)}</p>
        {pending > 0 && (
          <span className="pending" title="電波がつながったら送ります">
            未送信 {pending}
          </span>
        )}
        <ThemeSwitch mode={theme} onChange={setTheme} />
        {account && (
          <button type="button" className="icon-btn top-logout" aria-label={`ログアウト(${account.email})`} title={account.email} onClick={account.onSignOut}>
            <LogoutIcon />
          </button>
        )}
      </header>

      <div className="input-area">
        <QuickInput
          ref={inputRef}
          onSave={(text, category) => void addMemo(text, category)}
          voice={{ supported: speech.supported, listening: speech.listening, onStart: speech.start, onStop: speech.stop }}
        />
      </div>

      <aside className="board">
        <PinBoard memos={pins} onEdit={actions.onEdit} />
      </aside>

      <main className="main">
        <DueBand memos={band} today={today} onEdit={actions.onEdit} onFinish={finish} />
        <CategoryTabs tab={tab} counts={counts} onChange={setTab} />
        {list.length === 0 ? (
          <p className="empty">{EMPTY_MESSAGE[tab]}</p>
        ) : (
          <ul className="list">
            {list.map((m) => (
              <li key={m.id}>
                <MemoCard memo={m} now={now} today={today} {...actions} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {speech.listening ? (
        <div className="listening" role="status" aria-live="polite">
          <span className="listening-dot" aria-hidden="true" />
          <p className="listening-text">{speech.interim || '聞き取り中…(先頭に「やること」などと言うと分けられます)'}</p>
          <button type="button" className="listening-cancel" onClick={speech.cancel}>
            やめる
          </button>
        </div>
      ) : (
        <Toast toast={toast} onDone={clearToast} />
      )}

      {editing && (
        <EditSheet
          key={editing.id}
          memo={editing}
          onSave={saveEdit}
          onFinish={() => {
            finish(editing);
            closeEdit();
          }}
          onRestore={() => {
            actions.onRestore(editing);
            closeEdit();
          }}
          onDelete={() => {
            actions.onDelete(editing);
            closeEdit();
          }}
          onClose={closeEdit}
        />
      )}
    </div>
  );
}

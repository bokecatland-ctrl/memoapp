import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CategoryTabs } from './components/CategoryTabs';
import { DueBand } from './components/DueBand';
import { EditSheet } from './components/EditSheet';
import { MemoCard, type CardActions } from './components/MemoCard';
import { PinBoard } from './components/PinBoard';
import { QuickInput } from './components/QuickInput';
import { ThemeSwitch } from './components/ThemeSwitch';
import { Toast, type ToastData } from './components/Toast';
import { ALL_CATEGORIES, CATEGORIES } from './lib/categories';
import { formatDayWithWeekday, toISODate } from './lib/dates';
import { LocalMemoStore } from './lib/memoStore';
import { countFor, dueBand, listFor, pinnedMemos, type Tab } from './lib/selectors';
import { KEYS, load, save } from './lib/storage';
import { applyTheme, loadTheme, type ThemeMode } from './lib/theme';
import type { Category, Memo, MemoPatch } from './lib/types';

const store = new LocalMemoStore();
window.addEventListener('storage', (e) => {
  if (e.key === KEYS.memos) store.reload();
});

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

export function App() {
  const memos = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getAll(),
  );
  const now = useNow();
  const today = toISODate(now);
  const [tab, setTabState] = useState<Tab>(loadTab);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(loadTheme);
  const [toast, setToast] = useState<ToastData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => applyTheme(theme), [theme]);

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

  const addMemo = async (body: string, category: Category) => {
    const memo = await store.add({ body, category });
    notify(`${CATEGORIES[category].label}に保存しました`, () => store.remove(memo.id));
  };

  const finish = (memo: Memo) => {
    const info = CATEGORIES[memo.category];
    store.update(memo.id, { status: info.finishStatus });
    notify(`「${info.finishLabel}」にしました`, () => store.update(memo.id, { status: 'active' }));
  };

  const actions: CardActions = {
    onEdit: (m) => setEditingId(m.id),
    onFinish: finish,
    onSort: (m, c) => {
      store.update(m.id, { category: c });
      notify(`${CATEGORIES[c].label}に移しました`, () => store.update(m.id, { category: m.category }));
    },
    onTogglePin: (m) => store.update(m.id, { pinned: !m.pinned }),
    onRestore: (m) => {
      store.update(m.id, { status: 'active' });
      notify('一覧に戻しました', () => store.update(m.id, { status: m.status }));
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
        <ThemeSwitch mode={theme} onChange={setTheme} />
      </header>

      <div className="input-area">
        <QuickInput ref={inputRef} onSave={addMemo} />
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

      <Toast toast={toast} onDone={clearToast} />

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
          onClose={closeEdit}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ALL_CATEGORIES, CATEGORIES } from '../lib/categories';
import type { Category, Memo, MemoPatch } from '../lib/types';
import { CloseIcon } from './icons';

interface Props {
  memo: Memo;
  onSave: (patch: MemoPatch) => void;
  onFinish: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EditSheet({ memo, onSave, onFinish, onRestore, onDelete, onClose }: Props) {
  const [body, setBody] = useState(memo.body);
  const [category, setCategory] = useState<Category>(memo.category);
  const [due, setDue] = useState(memo.due_date ?? '');
  const [shareTo, setShareTo] = useState(memo.share_to ?? '');
  const [pinned, setPinned] = useState(memo.pinned);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const info = CATEGORIES[category];
  const finished = memo.status !== 'active';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    const text = body.trim();
    if (!text) {
      bodyRef.current?.focus();
      return;
    }
    // 期限・相手が使えないカテゴリに移したときは消す
    onSave({
      body: text,
      category,
      due_date: info.hasDue && due ? due : null,
      share_to: info.hasShareTo && shareTo.trim() ? shareTo.trim() : null,
      pinned,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet note-edge-${category}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id="sheet-title">メモを編集</h2>
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <label className="field">
          <span className="field-label">本文</span>
          <textarea ref={bodyRef} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        <fieldset className="field">
          <legend className="field-label">カテゴリ</legend>
          <div className="cat-picker">
            {ALL_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`cat-option note-${c}${c === category ? ' is-selected' : ''}`}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {CATEGORIES[c].short}
              </button>
            ))}
          </div>
        </fieldset>

        {info.hasDue && (
          <div className="field">
            <label className="field-label" htmlFor="edit-due">
              期限(任意)
            </label>
            <div className="field-row">
              <input id="edit-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              {due && (
                <button type="button" className="text-btn" onClick={() => setDue('')}>
                  期限を消す
                </button>
              )}
            </div>
          </div>
        )}

        {info.hasShareTo && (
          <label className="field">
            <span className="field-label">伝える相手(任意)</span>
            <input type="text" value={shareTo} placeholder="例:早番、料理長" onChange={(e) => setShareTo(e.target.value)} />
          </label>
        )}

        <label className="toggle">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <span>ピン留めボードに貼る</span>
        </label>

        <footer className="sheet-foot">
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            削除
          </button>
          {finished ? (
            <button type="button" className="btn" onClick={onRestore}>
              一覧に戻す
            </button>
          ) : (
            <button type="button" className="btn" onClick={onFinish}>
              {CATEGORIES[memo.category].finishLabel}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={save}>
            保存
          </button>
        </footer>
      </div>
    </div>
  );
}

import { forwardRef, useState, type KeyboardEvent } from 'react';
import { CATEGORIES, SORTABLE } from '../lib/categories';
import type { Category } from '../lib/types';
import { SendIcon } from './icons';

interface Props {
  onSave: (body: string, category: Category) => void;
}

/** 入力欄+カテゴリの色ボタン。色ボタンを押せばそのカテゴリ、押さずに送れば受信箱 */
export const QuickInput = forwardRef<HTMLInputElement, Props>(function QuickInput({ onSave }, ref) {
  const [text, setText] = useState('');

  const submit = (category: Category) => {
    const body = text.trim();
    if (!body) {
      if (ref && typeof ref !== 'function') ref.current?.focus();
      return;
    }
    onSave(body, category);
    setText('');
    if (ref && typeof ref !== 'function') ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 日本語変換の確定の Enter では保存しない
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit('inbox');
  };

  return (
    <div className="quick">
      <div className="quick-cats" role="group" aria-label="このカテゴリで保存">
        {SORTABLE.map((c) => (
          <button key={c} type="button" className={`quick-cat note-${c}`} onClick={() => submit(c)}>
            {CATEGORIES[c].short}
          </button>
        ))}
      </div>
      <div className="quick-row">
        <label htmlFor="memo-input" className="sr-only">
          メモを入力
        </label>
        <input
          id="memo-input"
          ref={ref}
          type="text"
          autoFocus
          autoComplete="off"
          enterKeyHint="send"
          placeholder="思いついたことをすぐ書く"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="quick-send" aria-label="受信箱に保存" onClick={() => submit('inbox')}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
});

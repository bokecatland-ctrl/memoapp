import { forwardRef, useState, type KeyboardEvent } from 'react';
import { CATEGORIES, SORTABLE } from '../lib/categories';
import type { Category } from '../lib/types';
import { MicIcon, SendIcon, StopIcon } from './icons';

interface Props {
  /** category が null なら、先頭のキーワードで決める(なければ受信箱) */
  onSave: (text: string, category: Category | null) => void;
  voice: {
    supported: boolean;
    listening: boolean;
    onStart: () => void;
    onStop: () => void;
  };
}

/**
 * 入力欄+カテゴリの色ボタン+マイク。色ボタンを押せばそのカテゴリ、押さずに送れば
 * 「やること、…」のような先頭のキーワードで分け、なければ受信箱。
 * 入力欄が空のときは、送信ボタンの代わりに大きなマイクボタンを出す
 */
export const QuickInput = forwardRef<HTMLInputElement, Props>(function QuickInput({ onSave, voice }, ref) {
  const [text, setText] = useState('');
  const focus = () => {
    if (ref && typeof ref !== 'function') ref.current?.focus();
  };

  const submit = (category: Category | null) => {
    const body = text.trim();
    if (!body) {
      focus();
      return;
    }
    onSave(body, category);
    setText('');
    focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 日本語変換の確定の Enter では保存しない
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit(null);
  };

  const showMic = voice.supported && (voice.listening || text.trim() === '');

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
          placeholder={voice.supported ? '書くか、マイクで話す' : '思いついたことをすぐ書く'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {showMic ? (
          <button
            type="button"
            className={`quick-mic${voice.listening ? ' is-listening' : ''}`}
            aria-label={voice.listening ? '聞き取りを終えて保存' : '音声で記録'}
            onClick={voice.listening ? voice.onStop : voice.onStart}
          >
            {voice.listening ? <StopIcon /> : <MicIcon />}
          </button>
        ) : (
          <button type="button" className="quick-send" aria-label="保存" onClick={() => submit(null)}>
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  );
});

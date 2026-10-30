import { CATEGORIES, SORTABLE } from '../lib/categories';
import { dueState, formatRelative, formatShortDate } from '../lib/dates';
import type { Category, Memo } from '../lib/types';
import { ArchiveIcon, CheckIcon, PinIcon, UndoIcon } from './icons';

export interface CardActions {
  onEdit: (memo: Memo) => void;
  onFinish: (memo: Memo) => void;
  onSort: (memo: Memo, category: Category) => void;
  onTogglePin: (memo: Memo) => void;
  onRestore: (memo: Memo) => void;
}

interface Props extends CardActions {
  memo: Memo;
  now: Date;
  today: string;
}

function metaLine(memo: Memo, now: Date, today: string): string {
  const parts: string[] = [CATEGORIES[memo.category].label];
  if (memo.share_to) parts.push(`相手:${memo.share_to}`);
  if (memo.due_date) {
    const s = dueState(memo.due_date, today);
    parts.push(s === 'today' ? '今日まで' : s === 'overdue' ? `${formatShortDate(memo.due_date)}まで(期限切れ)` : `${formatShortDate(memo.due_date)}まで`);
  }
  if (memo.source === 'voice') parts.push('音声');
  parts.push(formatRelative(memo.status === 'active' ? memo.created_at : memo.updated_at, now));
  return parts.join(' · ');
}

export function MemoCard({ memo, now, today, onEdit, onFinish, onSort, onTogglePin, onRestore }: Props) {
  const info = CATEGORIES[memo.category];
  const finished = memo.status !== 'active';

  return (
    <article className={`card note-${memo.category}${finished ? ' is-finished' : ''}`}>
      <button type="button" className="card-main" onClick={() => onEdit(memo)} aria-label={`編集:${memo.body}`}>
        <span className="card-meta">{metaLine(memo, now, today)}</span>
        <span className="card-body">{memo.body}</span>
      </button>

      <div className="card-actions">
        {memo.category === 'inbox' && !finished && (
          <div className="sort-buttons" role="group" aria-label="仕分け">
            {SORTABLE.map((c) => (
              <button
                key={c}
                type="button"
                className={`sort-btn note-${c}`}
                aria-label={`${CATEGORIES[c].label}に仕分け`}
                title={CATEGORIES[c].label}
                onClick={() => onSort(memo, c)}
              />
            ))}
          </div>
        )}
        <span className="spacer" />
        {finished ? (
          <button type="button" className="icon-btn" onClick={() => onRestore(memo)}>
            <UndoIcon />
            <span>戻す</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`icon-btn${memo.pinned ? ' is-on' : ''}`}
              aria-label={memo.pinned ? 'ピンを外す' : 'ピン留めする'}
              aria-pressed={memo.pinned}
              onClick={() => onTogglePin(memo)}
            >
              <PinIcon filled={memo.pinned} />
            </button>
            <button
              type="button"
              className="icon-btn"
              // 受信箱は仕分けボタンで幅を使うので、アイコンだけにする
              aria-label={memo.category === 'inbox' ? info.finishLabel : undefined}
              title={info.finishLabel}
              onClick={() => onFinish(memo)}
            >
              {info.finishStatus === 'done' ? <CheckIcon /> : <ArchiveIcon />}
              {memo.category !== 'inbox' && <span>{info.finishLabel}</span>}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

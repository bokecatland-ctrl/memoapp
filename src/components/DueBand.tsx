import { CATEGORIES } from '../lib/categories';
import { dueState, formatShortDate } from '../lib/dates';
import type { Memo } from '../lib/types';

interface Props {
  memos: Memo[];
  today: string;
  onEdit: (memo: Memo) => void;
  onFinish: (memo: Memo) => void;
}

/** 期限切れ・今日のものを一覧より上に出す。何もなければ出さない */
export function DueBand({ memos, today, onEdit, onFinish }: Props) {
  if (memos.length === 0) return null;
  return (
    <section className="due" aria-label="期限切れ・今日">
      <ul>
        {memos.map((m) => {
          const overdue = dueState(m.due_date, today) === 'overdue';
          return (
            <li key={m.id} className="due-row">
              <span className={`due-badge ${overdue ? 'is-overdue' : 'is-today'}`}>{overdue ? '期限切れ' : '今日'}</span>
              <button type="button" className="due-body" onClick={() => onEdit(m)}>
                {m.body}
              </button>
              {overdue && <span className="due-date">{formatShortDate(m.due_date!)}</span>}
              <button
                type="button"
                className="due-check"
                aria-label={`${CATEGORIES[m.category].finishLabel}にする:${m.body}`}
                onClick={() => onFinish(m)}
              >
                <span aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

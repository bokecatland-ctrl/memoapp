import { CATEGORIES } from '../lib/categories';
import { formatShortDate } from '../lib/dates';
import type { Memo } from '../lib/types';
import { PinIcon } from './icons';

interface Props {
  memos: Memo[];
  onEdit: (memo: Memo) => void;
}

// 付箋を少しだけ傾けて、紙を貼った感じにする(id から決めるので開くたびに変わらない)
const TILTS = [-1.5, 1, 0.5, -0.8, 1.3, -0.4];
function tilt(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return TILTS[Math.abs(h) % TILTS.length];
}

export function PinBoard({ memos, onEdit }: Props) {
  return (
    <section className="pins" aria-labelledby="pins-title">
      <h2 id="pins-title" className="section-title">
        <PinIcon size={14} />
        ピン留めボード
      </h2>
      {memos.length === 0 ? (
        <p className="pins-empty">大事なメモのピンを押すと、ここに貼られます</p>
      ) : (
        <ul className="pins-list">
          {memos.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={`pin-note note-${m.category}`}
                style={{ transform: `rotate(${tilt(m.id)}deg)` }}
                onClick={() => onEdit(m)}
              >
                <span className="pin-meta">
                  {CATEGORIES[m.category].short}
                  {m.due_date && ` · ${formatShortDate(m.due_date)}まで`}
                </span>
                <span className="pin-body">{m.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

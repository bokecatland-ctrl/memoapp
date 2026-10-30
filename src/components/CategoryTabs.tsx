import { ALL_CATEGORIES, CATEGORIES } from '../lib/categories';
import type { Tab } from '../lib/selectors';

interface Props {
  tab: Tab;
  counts: Record<Tab, number>;
  onChange: (tab: Tab) => void;
}

const TABS: Tab[] = ['all', ...ALL_CATEGORIES, 'finished'];

function label(tab: Tab): string {
  if (tab === 'all') return 'すべて';
  if (tab === 'finished') return '済み';
  return CATEGORIES[tab].short;
}

export function CategoryTabs({ tab, counts, onChange }: Props) {
  return (
    <nav className="tabs" aria-label="カテゴリ">
      {TABS.map((t) => (
        <button key={t} type="button" className={`tab${t === tab ? ' is-active' : ''}`} aria-current={t === tab ? 'page' : undefined} onClick={() => onChange(t)}>
          {t !== 'all' && t !== 'finished' && <span className={`tab-dot dot-${t}`} aria-hidden="true" />}
          {label(t)}
          {t === 'inbox' && counts.inbox > 0 && <span className="tab-count">{counts.inbox}</span>}
        </button>
      ))}
    </nav>
  );
}

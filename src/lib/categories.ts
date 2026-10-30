import type { Category, Status } from './types';

interface CategoryInfo {
  label: string;
  short: string; // 入力欄横のボタンなど、狭い場所用
  hasDue: boolean;
  hasShareTo: boolean;
  /** 終わり方:ボタンの文言と、押したあとの status */
  finishLabel: string;
  finishStatus: Exclude<Status, 'active'>;
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
  inbox: { label: '受信箱', short: '受信箱', hasDue: false, hasShareTo: false, finishLabel: 'アーカイブ', finishStatus: 'archived' },
  idea: { label: 'アイデア', short: 'アイデア', hasDue: false, hasShareTo: false, finishLabel: 'アーカイブ', finishStatus: 'archived' },
  todo: { label: 'やること', short: 'やること', hasDue: true, hasShareTo: false, finishLabel: '完了', finishStatus: 'done' },
  remember: { label: '覚えておくこと', short: '覚えておく', hasDue: false, hasShareTo: false, finishLabel: 'アーカイブ', finishStatus: 'archived' },
  share: { label: '共有事項', short: '共有', hasDue: true, hasShareTo: true, finishLabel: '伝えた', finishStatus: 'done' },
};

/** 受信箱から仕分けできる4カテゴリ(表示順) */
export const SORTABLE: Exclude<Category, 'inbox'>[] = ['idea', 'todo', 'remember', 'share'];
export const ALL_CATEGORIES: Category[] = ['inbox', ...SORTABLE];

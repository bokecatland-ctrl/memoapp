import { toISODate } from './dates';
import type { Category } from './types';

interface KeywordRule {
  word: string;
  category: Exclude<Category, 'inbox'>;
  /**
   * true:キーワードのあとに区切り(、や空白)があるときだけ当てはめる。
   * 「メモ帳を買う」「共有スペースの掃除」のように、普通の言葉の頭と区別するため
   */
  needsSeparator?: boolean;
}

/**
 * 先頭に言うとカテゴリが決まる言葉。言いやすさを試しながら、ここを足したり変えたりする。
 * 音声認識はひらがなで返すこともあるので、ひらがなの形も入れておく
 */
export const KEYWORDS: KeywordRule[] = [
  { word: 'アイデア', category: 'idea' },
  { word: 'アイディア', category: 'idea' },
  { word: 'やること', category: 'todo' },
  { word: 'タスク', category: 'todo', needsSeparator: true },
  { word: '覚えておくこと', category: 'remember' },
  { word: '覚えておく', category: 'remember' },
  { word: 'おぼえておく', category: 'remember' },
  { word: 'メモ', category: 'remember', needsSeparator: true },
  { word: '共有事項', category: 'share' },
  { word: '共有', category: 'share', needsSeparator: true },
  { word: '伝えること', category: 'share' },
  { word: '伝える', category: 'share' },
  { word: 'つたえる', category: 'share' },
];

// 長い言葉から試す(「覚えておくこと」を「覚えておく」より先に)
const RULES = [...KEYWORDS].sort((a, b) => b.word.length - a.word.length);
const SEPARATOR = /^[\s、,,。.::・!!]+/;

/** 先頭のキーワードでカテゴリを決め、キーワードを本文から除く。当てはまらなければ受信箱 */
export function classify(text: string): { category: Category; body: string } {
  const t = text.trim();
  for (const rule of RULES) {
    if (!t.startsWith(rule.word)) continue;
    const rest = t.slice(rule.word.length);
    const sep = SEPARATOR.exec(rest);
    if (rule.needsSeparator && !sep) continue;
    const body = rest.slice(sep ? sep[0].length : 0).trim();
    if (!body) continue; // キーワードだけのときは、そのまま受信箱に残す
    return { category: rule.category, body };
  }
  return { category: 'inbox', body: t };
}

/** 月日から日付を作る。過ぎてから1か月以上たつ日付なら来年のこととみなす */
function monthDay(month: number, day: number, today: Date): string | null {
  const y = today.getFullYear();
  const d = new Date(y, month - 1, day);
  if (d.getMonth() !== month - 1) return null; // 2月30日などはなし
  const monthAgo = new Date(y, today.getMonth(), today.getDate() - 31);
  return toISODate(d < monthAgo ? new Date(y + 1, month - 1, day) : d);
}

/**
 * 本文から期限の候補を読む。「11月5日」「11/5」「5日まで」「今日」「明日」「明後日」
 * (見つからなければ null)
 */
export function detectDue(text: string, today: Date): string | null {
  const t = text.normalize('NFKC'); // 全角の数字もそろえる
  const md = /(\d{1,2})月(\d{1,2})日/.exec(t) ?? /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/.exec(t);
  if (md) return monthDay(Number(md[1]), Number(md[2]), today);

  const dayOnly = /(?<![\d月/])(\d{1,2})日(?:まで|中)/.exec(t);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    // 今日より前の日なら来月のこと
    const month = day >= today.getDate() ? today.getMonth() : today.getMonth() + 1;
    const d = new Date(today.getFullYear(), month, day);
    return d.getDate() === day ? toISODate(d) : null;
  }

  const offset = /明後日|あさって/.test(t) ? 2 : /明日|あした/.test(t) ? 1 : /今日/.test(t) ? 0 : null;
  if (offset === null) return null;
  return toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
}

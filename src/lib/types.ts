export type Category = 'inbox' | 'idea' | 'todo' | 'remember' | 'share';
export type Status = 'active' | 'done' | 'archived';
export type Source = 'text' | 'voice';

/** 仕様書の memos テーブルと同じ形(手順3で Supabase にそのまま移せるようにする) */
export interface Memo {
  id: string;
  body: string;
  category: Category;
  due_date: string | null; // YYYY-MM-DD
  share_to: string | null;
  pinned: boolean;
  status: Status;
  source: Source;
  created_at: string; // ISO 8601
  updated_at: string;
}

export type NewMemo = Pick<Memo, 'body' | 'category'> & Partial<Pick<Memo, 'due_date' | 'share_to' | 'pinned' | 'source'>>;
export type MemoPatch = Partial<Omit<Memo, 'id' | 'created_at' | 'updated_at'>>;

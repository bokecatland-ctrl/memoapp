-- クイックメモ:メモのテーブルと、自分だけが読み書きできるようにする権限
--
-- ・ログインは Supabase Auth(Google)
-- ・ログインできても、allowed_emails に入っているメールアドレスでなければ何も読み書きできない
-- ・メールアドレスはリポジトリに書かず、SQL Editor で allowed_emails に入れる(README 参照)

-- ---- 使ってよいメールアドレス ----
create table public.allowed_emails (
  email text primary key check (email = lower(email))
);
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

-- ログイン中の人が allowed_emails に入っているか
create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
     where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

-- ---- メモ ----
create table public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (length(body) between 1 and 10000),
  category text not null default 'inbox' check (category in ('inbox', 'idea', 'todo', 'remember', 'share')),
  due_date date,
  share_to text check (length(share_to) <= 100),
  pinned boolean not null default false,
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  source text not null default 'text' check (source in ('text', 'voice')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memos_user_created on public.memos (user_id, created_at desc);

-- 更新日時は DB 側で入れる(端末の時計がずれていても順番が狂わないように)
create or replace function public.memos_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.user_id := old.user_id; -- 持ち主は変えられない
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger memos_touch before update on public.memos
  for each row execute function public.memos_touch();

alter table public.memos enable row level security;
revoke all on public.memos from anon, authenticated;
grant select, insert, update, delete on public.memos to authenticated;

create policy memos_owner on public.memos
  for all to authenticated
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());

-- スマホと PC で同期するため、変更を Realtime で流す(RLS が効くので自分のものだけ届く)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.memos;
  end if;
end $$;

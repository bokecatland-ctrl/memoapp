-- 権限のテスト:許可したメールの本人だけが、自分のメモだけを読み書きできること
\set ON_ERROR_STOP 1
set client_min_messages = notice;

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'me@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'other@example.com');
insert into public.allowed_emails values ('me@example.com');

create function pg_temp.login(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email)::text, false);
$$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok: %', label;
end $$;

-- 本人:書けて読める
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'Me@Example.com');
set role authenticated;
insert into public.memos (body, category) values ('グラス発注', 'todo');
select pg_temp.check((select count(*) from public.memos) = 1, '本人は追加して読める(メールの大文字小文字は区別しない)');
select pg_temp.check((select user_id from public.memos) = '00000000-0000-0000-0000-00000000000a', 'user_id は自動で本人になる');
update public.memos set status = 'done', user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select status from public.memos) = 'done', '本人は更新できる');
select pg_temp.check((select user_id from public.memos) = '00000000-0000-0000-0000-00000000000a', '持ち主は書き換えられない');
select pg_temp.check(public.is_allowed(), 'is_allowed は本人で true');
reset role;

-- 許可されていない人:ログインできても何も見えず、書けない
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'other@example.com');
set role authenticated;
select pg_temp.check((select count(*) from public.memos) = 0, '他人には見えない');
select pg_temp.check(not public.is_allowed(), 'is_allowed は他人で false');
do $$ begin
  insert into public.memos (body) values ('のっとり');
  raise exception 'FAIL: 他人が追加できてしまった';
exception when insufficient_privilege then
  raise notice 'ok: 他人は追加できない';
end $$;
update public.memos set body = 'x';
delete from public.memos;
reset role;
select pg_temp.check((select body from public.memos) = 'グラス発注', '他人の更新・削除は効かない');

-- 他人のメモを本人の名前で入れることもできない
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'me@example.com');
set role authenticated;
do $$ begin
  insert into public.memos (body, user_id) values ('なりすまし', '00000000-0000-0000-0000-00000000000b');
  raise exception 'FAIL: 他人の user_id で追加できてしまった';
exception when insufficient_privilege then
  raise notice 'ok: 他人の user_id では追加できない';
end $$;
reset role;

-- ログインしていない人(anon)
select set_config('request.jwt.claims', '', false);
set role anon;
do $$ begin
  perform count(*) from public.memos;
  raise exception 'FAIL: anon が読めてしまった';
exception when insufficient_privilege then
  raise notice 'ok: ログインしていないと読めない';
end $$;
do $$ begin
  perform count(*) from public.allowed_emails;
  raise exception 'FAIL: anon が allowed_emails を読めてしまった';
exception when insufficient_privilege then
  raise notice 'ok: allowed_emails は誰からも読めない';
end $$;
reset role;

-- 許可された本人でも allowed_emails は読めない(書き換えもできない)
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'me@example.com');
set role authenticated;
do $$ begin
  insert into public.allowed_emails values ('other@example.com');
  raise exception 'FAIL: allowed_emails を書き換えられてしまった';
exception when insufficient_privilege then
  raise notice 'ok: allowed_emails は画面から書き換えられない';
end $$;
reset role;

\echo ALL OK

-- ============================================================
-- 命のカルテ (sitte) セキュリティ改修  ロールバック（元に戻す）
--
-- 改修後にアプリが動かなくなった場合、これを実行すると
-- 改修前のアクセス設定に戻り、旧バージョンのアプリが動くようになります。
-- （関数は残しますが、残っていても害はありません）
--
-- 実行場所: Supabase ダッシュボード → SQL Editor → 全文を貼り付けて RUN
-- ============================================================

begin;

alter table public.registrations     enable row level security;
alter table public.pet_registrations enable row level security;

-- registrations: 改修前のポリシーを復元
drop policy if exists "registrations_select_public" on public.registrations;
create policy "registrations_select_public" on public.registrations
  for select to public using (true);

drop policy if exists "registrations_insert_public" on public.registrations;
create policy "registrations_insert_public" on public.registrations
  for insert to public with check (true);

drop policy if exists "registrations_update_public" on public.registrations;
create policy "registrations_update_public" on public.registrations
  for update to public using (true);

drop policy if exists "allow anon delete registrations" on public.registrations;
create policy "allow anon delete registrations" on public.registrations
  for delete to anon using (true);

-- pet_registrations: 改修前のポリシーを復元
drop policy if exists "pet_select" on public.pet_registrations;
create policy "pet_select" on public.pet_registrations
  for select to anon, authenticated using (true);

drop policy if exists "pet_insert" on public.pet_registrations;
create policy "pet_insert" on public.pet_registrations
  for insert to anon, authenticated with check (true);

drop policy if exists "pet_update" on public.pet_registrations;
create policy "pet_update" on public.pet_registrations
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "allow anon delete pet_registrations" on public.pet_registrations;
create policy "allow anon delete pet_registrations" on public.pet_registrations
  for delete to anon using (true);

commit;

-- 確認: registrations=4件、pet_registrations=4件 のポリシーが戻れば成功
select tablename as "テーブル名", count(*) as "ポリシー数"
from pg_policies
where schemaname = 'public'
  and tablename in ('registrations','pet_registrations')
group by tablename
order by tablename;

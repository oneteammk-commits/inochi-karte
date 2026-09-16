-- ============================================================
-- 命のカルテ (sitte) セキュリティ改修  STEP 2 / 2 : 直接アクセスの停止
--
-- ★★ 実行の前に必ず確認してください ★★
--   1. STEP 1 のSQLを実行済みであること
--   2. アプリの新バージョンがVercelにデプロイ済みであること
--
-- この2つが済む前に実行すると、アプリが一時的に動かなくなります。
-- （元に戻したいときは security_rollback.sql を実行してください）
--
-- 対象プロジェクト: oneteammk-commits (esuvecruxlbovlnjgvyb)
-- 実行場所: Supabase ダッシュボード → SQL Editor → 全文を貼り付けて RUN
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 11. テーブルへの直接アクセスを全面停止
--     （RLSを有効のまま、ポリシーを1つも残さない = 匿名は何もできない）
-- ------------------------------------------------------------
alter table public.registrations     enable row level security;
alter table public.pet_registrations enable row level security;

-- 実DBに存在するポリシー名
drop policy if exists "registrations_select_public" on public.registrations;
drop policy if exists "registrations_insert_public" on public.registrations;
drop policy if exists "registrations_update_public" on public.registrations;
drop policy if exists "allow anon delete registrations" on public.registrations;
-- schema.sql に記載されていた旧ポリシー名（存在すれば削除）
drop policy if exists "allow anon select registrations" on public.registrations;
drop policy if exists "allow anon insert registrations" on public.registrations;
drop policy if exists "allow anon update registrations" on public.registrations;

drop policy if exists "pet_select" on public.pet_registrations;
drop policy if exists "pet_insert" on public.pet_registrations;
drop policy if exists "pet_update" on public.pet_registrations;
drop policy if exists "allow anon delete pet_registrations" on public.pet_registrations;
drop policy if exists "allow anon select pet_registrations" on public.pet_registrations;
drop policy if exists "allow anon insert pet_registrations" on public.pet_registrations;
drop policy if exists "allow anon update pet_registrations" on public.pet_registrations;

-- ------------------------------------------------------------
-- 12. バックアップ表の遮断（STEP A 未実施の場合もここで揃う）
-- ------------------------------------------------------------
alter table public."_backup_meds_20260908" enable row level security;

commit;

-- ============================================================
-- 確認: registrations と pet_registrations が RLS有効=true かつ ポリシー数=0 なら成功
-- ============================================================
select c.relname           as "テーブル名",
       c.relrowsecurity    as "RLS有効",
       count(p.policyname) as "ポリシー数"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
       on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public' and c.relkind in ('r','p')
group by c.relname, c.relrowsecurity
order by c.relname;

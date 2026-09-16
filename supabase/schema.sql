-- ============================================================
-- 命のカルテ (sitte) データベース定義
-- Supabase ダッシュボードの SQL Editor で実行してください
--
-- ★セキュリティ方針★
--   アプリはテーブルを直接読み書きしません。
--   「二次元コードのID(UUID)を1件渡すと、その1件だけ返す」関数を経由します。
--   そのため registrations / pet_registrations には
--   匿名ユーザー向けのポリシーを1つも作りません（= 直接アクセス不可）。
--
--   関数の定義は security_step1_functions.sql
--   直接アクセスの停止は security_step2_lockdown.sql
--   元に戻すときは   security_rollback.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. 登録テーブル
-- ------------------------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  furigana text,
  birth_date text not null,
  edit_password_hash text,
  emergency_contact_relationship text,
  emergency_contact_name text not null,
  emergency_contact_furigana text,
  emergency_contact_phone text not null,
  postal_code text,
  prefecture text not null,
  city text not null,
  address_detail text,
  facility_name text,
  facility_type text not null,
  allergies text[] not null default '{}',
  diseases text[] not null default '{}',
  allergy_other text,
  disease_other text,
  hospital_name text,
  daily_notes text,
  medications text[] not null default '{}'
);

-- 既存DB向け（列が無い場合のみ追加）
alter table public.registrations add column if not exists furigana text;
alter table public.registrations add column if not exists emergency_contact_furigana text;
alter table public.registrations add column if not exists emergency_contact_relationship text;
alter table public.registrations add column if not exists edit_password_hash text;
alter table public.registrations add column if not exists address_detail text;
alter table public.registrations add column if not exists postal_code text;
alter table public.registrations add column if not exists hospital_name text;

-- ------------------------------------------------------------
-- 2. ペット登録テーブル
-- ------------------------------------------------------------
create table if not exists public.pet_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pet_name text,
  species text,
  breed text,
  age text,
  sex text,
  owner_name text,
  owner_contact text,
  medical_history text,
  medications text,
  allergies text,
  vet_clinic text,
  vaccine_info text,
  microchip text,
  food text,
  medication_photo_url text,
  photo_url text,
  features text,
  owner_id text not null
);

alter table public.pet_registrations add column if not exists medication_photo_url text;
alter table public.pet_registrations add column if not exists photo_url text;
alter table public.pet_registrations add column if not exists features text;

-- ------------------------------------------------------------
-- 3. 行レベルセキュリティ
--    ポリシーを作らない = 匿名ユーザーからは一切アクセスできない。
--    アプリからの読み書きは security_step1_functions.sql の関数経由。
-- ------------------------------------------------------------
alter table public.registrations     enable row level security;
alter table public.pet_registrations enable row level security;

-- ------------------------------------------------------------
-- 4. ペット・お薬の写真ストレージ
--    公開バケット（URLを知っていれば画像を表示できる）だが、
--    一覧表示とファイル削除は匿名から不可にしている。
--    ・一覧できると、フォルダ名からカルテのIDが全件漏れるため
--    ・削除は delete_card がまとめて行う（取り残しを防ぐ）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pet-meds', 'pet-meds', true)
on conflict (id) do update set public = true;

-- 写真の登録（アップロード）のみ許可
drop policy if exists "allow anon upload pet-meds" on storage.objects;
create policy "allow anon upload pet-meds"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'pet-meds');

-- 一覧表示・削除のポリシーは作らない（作ると全件のIDが漏れる）
drop policy if exists "allow public read pet-meds" on storage.objects;
drop policy if exists "allow anon delete pet-meds" on storage.objects;

-- ------------------------------------------------------------
-- 5. 関数の作成
--    続けて security_step1_functions.sql、
--    さらに security_step3_storage_and_delete.sql を実行してください。
-- ------------------------------------------------------------

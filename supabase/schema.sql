-- 命のカルテ: Supabase ダッシュボードの SQL Editor で実行してください

-- 1. 登録テーブル
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  birth_date date not null,
  emergency_contact_relationship text,
  emergency_contact_name text not null,
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
  daily_notes text,
  medications jsonb not null default '[]'::jsonb
);

alter table public.registrations enable row level security;

-- 匿名（フォーム）からの登録のみ許可
drop policy if exists "allow anon insert registrations" on public.registrations;
create policy "allow anon insert registrations"
  on public.registrations
  for insert
  to anon
  with check (true);

-- カルテ表示（QR）用：登録データの参照
drop policy if exists "allow anon select registrations" on public.registrations;
create policy "allow anon select registrations"
  on public.registrations
  for select
  to anon
  using (true);

-- 2. ペット登録テーブル
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
  owner_id text not null
);

-- 既存DB向け（列が無い場合のみ追加）
alter table public.registrations add column if not exists emergency_contact_relationship text;
alter table public.pet_registrations add column if not exists medication_photo_url text;

alter table public.pet_registrations enable row level security;

drop policy if exists "allow anon insert pet_registrations" on public.pet_registrations;
create policy "allow anon insert pet_registrations"
  on public.pet_registrations
  for insert
  to anon
  with check (true);

drop policy if exists "allow anon select pet_registrations" on public.pet_registrations;
create policy "allow anon select pet_registrations"
  on public.pet_registrations
  for select
  to anon
  using (true);

drop policy if exists "allow anon update pet_registrations" on public.pet_registrations;
create policy "allow anon update pet_registrations"
  on public.pet_registrations
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "allow anon delete pet_registrations" on public.pet_registrations;
create policy "allow anon delete pet_registrations"
  on public.pet_registrations
  for delete
  to anon
  using (true);

drop policy if exists "allow anon update registrations" on public.registrations;
create policy "allow anon update registrations"
  on public.registrations
  for update
  to anon
  using (true)
  with check (true);

-- 3. ペットお薬写真ストレージ
insert into storage.buckets (id, name, public)
values ('pet-meds', 'pet-meds', true)
on conflict (id) do update set public = true;

drop policy if exists "allow anon upload pet-meds" on storage.objects;
create policy "allow anon upload pet-meds"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'pet-meds');

drop policy if exists "allow public read pet-meds" on storage.objects;
create policy "allow public read pet-meds"
  on storage.objects
  for select
  to public
  using (bucket_id = 'pet-meds');

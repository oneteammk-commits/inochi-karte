-- 命のカルテ: Supabase ダッシュボードの SQL Editor で実行してください

-- 1. 登録テーブル
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  birth_date date not null,
  emergency_contact_name text not null,
  emergency_contact_phone text not null,
  prefecture text not null,
  city text not null,
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

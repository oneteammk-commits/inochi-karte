-- ============================================================
-- 「かかりつけ病院」欄の追加（人のカルテ）
--
-- 【このSQLですること】
--  registrations に hospital_name 列を追加し、
--  登録・保存の関数がその項目を扱えるようにします。
--
-- 【安全性】
--  ・列を足すだけなので、既存のデータには影響しません
--  ・いまのアプリは hospital_name を送らないだけで、そのまま動きます
--  → アプリの更新より先に実行して問題ありません
--
-- 実行場所: Supabase ダッシュボード → SQL Editor → 全文を貼り付けて RUN
-- ============================================================

begin;

-- 1. 列の追加
alter table public.registrations add column if not exists hospital_name text;

-- 2. 新規登録に「かかりつけ病院」を反映
create or replace function public.create_card(
  p_payload jsonb,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
begin
  if p_password is null or p_password !~ '^\d{4}$' then
    raise exception '編集用パスワードは数字4桁で入力してください。';
  end if;
  if coalesce(p_payload->>'name', '') = '' then
    raise exception 'お名前が入力されていません。';
  end if;

  insert into public.registrations (
    name, furigana, birth_date,
    emergency_contact_relationship, emergency_contact_name,
    emergency_contact_furigana, emergency_contact_phone,
    postal_code, prefecture, city, address_detail,
    facility_name, facility_type,
    allergies, allergy_other, diseases, disease_other,
    hospital_name, daily_notes, medications, edit_password_hash
  ) values (
    p_payload->>'name',
    p_payload->>'furigana',
    p_payload->>'birth_date',
    p_payload->>'emergency_contact_relationship',
    p_payload->>'emergency_contact_name',
    p_payload->>'emergency_contact_furigana',
    p_payload->>'emergency_contact_phone',
    p_payload->>'postal_code',
    p_payload->>'prefecture',
    p_payload->>'city',
    p_payload->>'address_detail',
    p_payload->>'facility_name',
    p_payload->>'facility_type',
    public._sitte_text_array(p_payload->'allergies'),
    p_payload->>'allergy_other',
    public._sitte_text_array(p_payload->'diseases'),
    p_payload->>'disease_other',
    p_payload->>'hospital_name',
    p_payload->>'daily_notes',
    public._sitte_text_array(p_payload->'medications'),
    encode(sha256(convert_to(p_password, 'UTF8')), 'hex')
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

-- 3. 編集の保存に「かかりつけ病院」を反映
create or replace function public.save_card(
  p_id uuid,
  p_password text,
  p_payload jsonb,
  p_pets_enabled boolean default null,
  p_pets jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_auth jsonb;
begin
  v_auth := public.verify_card_password(p_id, p_password, false);
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  update public.registrations set
    name                           = p_payload->>'name',
    furigana                       = p_payload->>'furigana',
    birth_date                     = p_payload->>'birth_date',
    emergency_contact_relationship = p_payload->>'emergency_contact_relationship',
    emergency_contact_name         = p_payload->>'emergency_contact_name',
    emergency_contact_furigana     = p_payload->>'emergency_contact_furigana',
    emergency_contact_phone        = p_payload->>'emergency_contact_phone',
    postal_code                    = p_payload->>'postal_code',
    prefecture                     = p_payload->>'prefecture',
    city                           = p_payload->>'city',
    address_detail                 = p_payload->>'address_detail',
    facility_name                  = p_payload->>'facility_name',
    facility_type                  = p_payload->>'facility_type',
    allergies                      = public._sitte_text_array(p_payload->'allergies'),
    allergy_other                  = p_payload->>'allergy_other',
    diseases                       = public._sitte_text_array(p_payload->'diseases'),
    disease_other                  = p_payload->>'disease_other',
    -- 旧アプリから保存された場合に消えないよう、項目が無ければ今の値を残す
    hospital_name                  = case when p_payload ? 'hospital_name'
                                          then p_payload->>'hospital_name'
                                          else hospital_name end,
    daily_notes                    = p_payload->>'daily_notes',
    medications                    = public._sitte_text_array(p_payload->'medications')
  where id = p_id;

  if p_pets is not null then
    perform public._sitte_sync_pets(p_id, coalesce(p_pets_enabled, false), p_pets);
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.create_card(jsonb, text) from public;
revoke all on function public.save_card(uuid, text, jsonb, boolean, jsonb) from public;
grant execute on function public.create_card(jsonb, text)                     to anon, authenticated;
grant execute on function public.save_card(uuid, text, jsonb, boolean, jsonb) to anon, authenticated;

commit;

-- 確認: hospital_name 列が追加されていれば成功
select column_name as "列名", data_type as "型"
from information_schema.columns
where table_schema='public' and table_name='registrations' and column_name='hospital_name';

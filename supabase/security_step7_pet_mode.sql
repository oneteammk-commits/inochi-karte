-- ============================================================
-- ペット版の改修（2026年11月・愛犬家の方々のご意見による）
--
-- 【このSQLですること】
--  1. registrations に card_mode 列を足す
--       'pet' = 「わたしとペット」で登録したカルテ（飼い主は名前と電話だけでも登録できる）
--       空    = これまでどおりの登録
--  2. pet_registrations に列を足す
--       license_number      … 犬の鑑札番号（持っていなければ空のまま）
--       document_photo_urls … 書類の写真（ワクチン証明書・血液検査・マイクロチップ登録証など）
--  3. 登録・保存の関数（create_card / save_card / _sitte_sync_pets）を新しい列に対応させる
--  4. ペット用の二次元コードで開く画面のための関数 get_pet_card を作る
--       ペット1匹の情報と「飼い主に電話する」ための番号・名前だけを返す。
--       飼い主の持病・お薬・アレルギー・住所・生年月日は一切返さない。
--
-- 【安全性】
--  ・列を足して関数を置き換えるだけなので、既存のデータは変わりません
--  ・いまのアプリは新しい項目を送らないだけで、そのまま動きます
--  → アプリの更新より先に実行して問題ありません（先に実行してください）
--
-- 実行場所: Supabase ダッシュボード → SQL Editor → 全文を貼り付けて RUN
-- ============================================================

begin;

-- 1・2. 列の追加（既存データには影響なし）
alter table public.registrations     add column if not exists card_mode text;
alter table public.pet_registrations add column if not exists license_number text;
alter table public.pet_registrations add column if not exists document_photo_urls text[] not null default '{}';

-- 3-1. 新規登録（card_mode を記録する）
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
    hospital_name, daily_notes, medications, edit_password_hash, card_mode
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
    encode(sha256(convert_to(p_password, 'UTF8')), 'hex'),
    nullif(p_payload->>'card_mode', '')
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

-- 3-2. 編集の保存（card_mode が送られなければ今の値を残す）
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
    medications                    = public._sitte_text_array(p_payload->'medications'),
    -- 登録の種類（ペット中心かどうか）。項目が無ければ今の値を残す
    card_mode                      = case when p_payload ? 'card_mode'
                                          then nullif(p_payload->>'card_mode', '')
                                          else card_mode end
  where id = p_id;

  if p_pets is not null then
    perform public._sitte_sync_pets(p_id, coalesce(p_pets_enabled, false), p_pets);
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;


-- 3-3. ペットの同期（鑑札番号・書類の写真に対応）
create or replace function public._sitte_sync_pets(
  p_id uuid,
  p_pets_enabled boolean,
  p_pets jsonb
)
returns integer
language plpgsql
as $fn$
declare
  v_owner  text := p_id::text;
  v_keep   uuid[] := '{}';
  v_pet    jsonb;
  v_petid  uuid;
  v_count  integer := 0;
begin
  if not coalesce(p_pets_enabled, false) then
    delete from public.pet_registrations where owner_id = v_owner;
    return 0;
  end if;

  if p_pets is null or jsonb_typeof(p_pets) <> 'array' then
    p_pets := '[]'::jsonb;
  end if;

  -- 残すペットのID一覧
  select coalesce(array_agg((e->>'id')::uuid), '{}'::uuid[])
    into v_keep
    from jsonb_array_elements(p_pets) e
   where e->>'id' is not null and e->>'id' <> '';

  delete from public.pet_registrations
   where owner_id = v_owner
     and not (id = any(v_keep));

  for v_pet in select * from jsonb_array_elements(p_pets)
  loop
    v_petid := nullif(v_pet->>'id', '')::uuid;

    if v_petid is not null then
      -- 送られてきた項目（キーがあるもの）だけ更新。キーのない項目はいまの値のまま
      update public.pet_registrations p set
        pet_name                 = case when v_pet ? 'pet_name'                 then v_pet->>'pet_name'                 else p.pet_name end,
        species                  = case when v_pet ? 'species'                  then v_pet->>'species'                  else p.species end,
        breed                    = case when v_pet ? 'breed'                    then v_pet->>'breed'                    else p.breed end,
        age                      = case when v_pet ? 'age'                      then v_pet->>'age'                      else p.age end,
        sex                      = case when v_pet ? 'sex'                      then v_pet->>'sex'                      else p.sex end,
        medical_history          = case when v_pet ? 'medical_history'          then v_pet->>'medical_history'          else p.medical_history end,
        medications              = case when v_pet ? 'medications'              then v_pet->>'medications'              else p.medications end,
        allergies                = case when v_pet ? 'allergies'                then v_pet->>'allergies'                else p.allergies end,
        vet_clinic               = case when v_pet ? 'vet_clinic'               then v_pet->>'vet_clinic'               else p.vet_clinic end,
        vaccine_info             = case when v_pet ? 'vaccine_info'             then v_pet->>'vaccine_info'             else p.vaccine_info end,
        microchip                = case when v_pet ? 'microchip'                then v_pet->>'microchip'                else p.microchip end,
        food                     = case when v_pet ? 'food'                     then v_pet->>'food'                     else p.food end,
        medication_photo_url     = case when v_pet ? 'medication_photo_url'     then v_pet->>'medication_photo_url'     else p.medication_photo_url end,
        photo_url                = case when v_pet ? 'photo_url'                then v_pet->>'photo_url'                else p.photo_url end,
        features                 = case when v_pet ? 'features'                 then v_pet->>'features'                 else p.features end,
        rabies_status            = case when v_pet ? 'rabies_status'            then v_pet->>'rabies_status'            else p.rabies_status end,
        rabies_date              = case when v_pet ? 'rabies_date'              then v_pet->>'rabies_date'              else p.rabies_date end,
        rabies_exempt_reason     = case when v_pet ? 'rabies_exempt_reason'     then v_pet->>'rabies_exempt_reason'     else p.rabies_exempt_reason end,
        vaccine_date             = case when v_pet ? 'vaccine_date'             then v_pet->>'vaccine_date'             else p.vaccine_date end,
        parasite_status          = case when v_pet ? 'parasite_status'          then v_pet->>'parasite_status'          else p.parasite_status end,
        parasite_date            = case when v_pet ? 'parasite_date'            then v_pet->>'parasite_date'            else p.parasite_date end,
        neuter_status            = case when v_pet ? 'neuter_status'            then v_pet->>'neuter_status'            else p.neuter_status end,
        vet_doctor               = case when v_pet ? 'vet_doctor'               then v_pet->>'vet_doctor'               else p.vet_doctor end,
        microchip_fitted         = case when v_pet ? 'microchip_fitted'         then v_pet->>'microchip_fitted'         else p.microchip_fitted end,
        microchip_registry       = case when v_pet ? 'microchip_registry'       then v_pet->>'microchip_registry'       else p.microchip_registry end,
        microchip_registry_other = case when v_pet ? 'microchip_registry_other' then v_pet->>'microchip_registry_other' else p.microchip_registry_other end,
        license_number           = case when v_pet ? 'license_number'           then v_pet->>'license_number'           else p.license_number end,
        document_photo_urls      = case when v_pet ? 'document_photo_urls'      then coalesce(public._sitte_text_array(v_pet->'document_photo_urls'), '{}') else p.document_photo_urls end
      where p.id = v_petid and p.owner_id = v_owner;
    else
      insert into public.pet_registrations (
        pet_name, species, breed, age, sex, medical_history, medications,
        allergies, vet_clinic, vaccine_info, microchip, food,
        medication_photo_url, photo_url, features,
        rabies_status, rabies_date, rabies_exempt_reason, vaccine_date,
        parasite_status, parasite_date, neuter_status, vet_doctor,
        microchip_fitted, microchip_registry, microchip_registry_other,
        license_number, document_photo_urls,
        owner_id
      ) values (
        v_pet->>'pet_name', v_pet->>'species', v_pet->>'breed', v_pet->>'age',
        v_pet->>'sex', v_pet->>'medical_history', v_pet->>'medications',
        v_pet->>'allergies', v_pet->>'vet_clinic', v_pet->>'vaccine_info',
        v_pet->>'microchip', v_pet->>'food', v_pet->>'medication_photo_url',
        v_pet->>'photo_url', v_pet->>'features',
        v_pet->>'rabies_status', v_pet->>'rabies_date', v_pet->>'rabies_exempt_reason', v_pet->>'vaccine_date',
        v_pet->>'parasite_status', v_pet->>'parasite_date', v_pet->>'neuter_status', v_pet->>'vet_doctor',
        v_pet->>'microchip_fitted', v_pet->>'microchip_registry', v_pet->>'microchip_registry_other',
        v_pet->>'license_number', coalesce(public._sitte_text_array(v_pet->'document_photo_urls'), '{}'),
        v_owner
      );
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

-- 4. ペット用の二次元コードで開く画面（迷子・保護のとき）
--    ペット1匹の情報＋飼い主に電話するための番号・名前だけを返す。
--    飼い主の持病・お薬・アレルギー・住所・生年月日は返さない。
create or replace function public.get_pet_card(p_pet_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $fn$
  select jsonb_build_object(
    'pet', to_jsonb(p),
    'owner_name', r.name,
    'owner_phone', r.emergency_contact_phone
  )
  from public.pet_registrations p
  left join public.registrations r on r.id::text = p.owner_id
  where p.id = p_pet_id;
$fn$;

revoke all on function public.create_card(jsonb, text) from public;
revoke all on function public.save_card(uuid, text, jsonb, boolean, jsonb) from public;
revoke all on function public._sitte_sync_pets(uuid, boolean, jsonb) from public;
revoke all on function public.get_pet_card(uuid) from public;
grant execute on function public.create_card(jsonb, text)                     to anon, authenticated;
grant execute on function public.save_card(uuid, text, jsonb, boolean, jsonb) to anon, authenticated;
grant execute on function public.get_pet_card(uuid)                           to anon, authenticated;

commit;

-- 確認用（実行後に列が増えていること）
-- select table_name, column_name from information_schema.columns
--  where table_schema='public' and column_name in ('card_mode','license_number','document_photo_urls');

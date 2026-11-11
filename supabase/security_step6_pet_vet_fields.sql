-- ============================================================
-- ペット欄の項目追加（獣医師の助言による改修・2026年11月）
--
-- 【このSQLですること】
--  1. pet_registrations に新しい列を足す（すべて NULL 可。既存データには影響なし）
--       狂犬病予防注射（状態・最新の接種日・猶予の理由）
--       混合ワクチンの最新の接種日
--       ノミ・ダニ・フィラリア予防（状態・最終実施日）
--       不妊・去勢手術の状態
--       担当獣医師名
--       マイクロチップ（装着の有無・登録先・登録先その他）
--  2. ペット保存の内部関数 _sitte_sync_pets を
--     「送られてきた項目だけ更新する」形に変える
--     → 古い画面（新項目を送らない版）から保存しても、新項目の値が消えない
--
-- 【安全性】
--  ・列を足すだけ＋関数の置き換えなので、既存のデータは変わりません
--  ・いまのアプリは新しい項目を送らないだけで、そのまま動きます
--  → アプリの更新より先に実行して問題ありません（先に実行してください）
--
-- 実行場所: Supabase ダッシュボード → SQL Editor → 全文を貼り付けて RUN
-- ============================================================

begin;

-- 1. 列の追加（日付は 'YYYY-MM-DD' の文字で保存。画面の日付入力がこの形で渡す）
alter table public.pet_registrations add column if not exists rabies_status text;            -- done / not / exempt
alter table public.pet_registrations add column if not exists rabies_date text;              -- 最新の接種日
alter table public.pet_registrations add column if not exists rabies_exempt_reason text;     -- 猶予の理由
alter table public.pet_registrations add column if not exists vaccine_date text;             -- 混合ワクチンの最新の接種日
alter table public.pet_registrations add column if not exists parasite_status text;          -- done / not
alter table public.pet_registrations add column if not exists parasite_date text;            -- 最終実施日
alter table public.pet_registrations add column if not exists neuter_status text;            -- done / not / unknown
alter table public.pet_registrations add column if not exists vet_doctor text;               -- 担当獣医師名
alter table public.pet_registrations add column if not exists microchip_fitted text;         -- yes / no / unknown
alter table public.pet_registrations add column if not exists microchip_registry text;       -- moe / aipo / jkc / shop / unknown / other
alter table public.pet_registrations add column if not exists microchip_registry_other text; -- 登録先（その他・自由記入）

-- 2. ペットの同期関数: 送られてきたキーだけ更新する
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
        microchip_registry_other = case when v_pet ? 'microchip_registry_other' then v_pet->>'microchip_registry_other' else p.microchip_registry_other end
      where p.id = v_petid and p.owner_id = v_owner;
    else
      insert into public.pet_registrations (
        pet_name, species, breed, age, sex, medical_history, medications,
        allergies, vet_clinic, vaccine_info, microchip, food,
        medication_photo_url, photo_url, features,
        rabies_status, rabies_date, rabies_exempt_reason, vaccine_date,
        parasite_status, parasite_date, neuter_status, vet_doctor,
        microchip_fitted, microchip_registry, microchip_registry_other,
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
        v_owner
      );
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

-- 内部関数なので、これまでどおり外からは呼べないままにする
revoke all on function public._sitte_sync_pets(uuid, boolean, jsonb) from public;

commit;

-- 確認用（実行後に列が増えていること）
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='pet_registrations' order by ordinal_position;

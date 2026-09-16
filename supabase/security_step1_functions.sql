-- ============================================================
-- 命のカルテ (sitte) セキュリティ改修  STEP 1 / 2 : 関数の作成
--
-- このSQLは「安全な入口（関数）を用意するだけ」です。
-- 既存のアクセス設定はまだ変えないので、
-- 今動いているアプリは今までどおり動きます。いつ実行しても安全です。
--
-- 対象プロジェクト: oneteammk-commits (esuvecruxlbovlnjgvyb)
-- 実行場所: Supabase ダッシュボード → SQL Editor → 全文を貼り付けて RUN
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. 補助関数（jsonb配列 → text[]）
-- ------------------------------------------------------------
create or replace function public._sitte_text_array(p jsonb)
returns text[]
language sql
immutable
as $fn$
  select case
    when p is null or jsonb_typeof(p) <> 'array' then '{}'::text[]
    else coalesce((select array_agg(x) from jsonb_array_elements_text(p) as t(x)), '{}'::text[])
  end;
$fn$;

-- ------------------------------------------------------------
-- 1. パスワード試行の記録（総当たり攻撃の防止用）
-- ------------------------------------------------------------
create table if not exists public.card_auth_attempts (
  id bigserial primary key,
  card_id uuid not null,
  ok boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists card_auth_attempts_card_time
  on public.card_auth_attempts (card_id, attempted_at desc);

alter table public.card_auth_attempts enable row level security;
-- ポリシーを1つも作らない = 匿名からは一切アクセス不可（関数の中からのみ読み書きされる）

-- ------------------------------------------------------------
-- 2. 読み取り: カルテ1件（パスワードのハッシュは返さない）
-- ------------------------------------------------------------
create or replace function public.get_card(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $fn$
  select jsonb_build_object(
    'registration', (
      select to_jsonb(r) - 'edit_password_hash'
      from public.registrations r
      where r.id = p_id
    ),
    'has_password', coalesce((
      select (r.edit_password_hash is not null and r.edit_password_hash <> '')
      from public.registrations r
      where r.id = p_id
    ), false),
    'pets', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.pet_registrations p
      where p.owner_id = p_id::text
    ), '[]'::jsonb)
  );
$fn$;

-- ------------------------------------------------------------
-- 3. 読み取り: 自分の端末に保存したカルテの氏名一覧（ホーム画面用）
--    IDを知っているものだけ、最大50件まで
-- ------------------------------------------------------------
create or replace function public.get_cards_summary(p_ids uuid[])
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $fn$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select r.id, r.name, r.emergency_contact_phone
    from public.registrations r
    where r.id = any(coalesce(p_ids, '{}'::uuid[]))
    limit 50
  ) t;
$fn$;

-- ------------------------------------------------------------
-- 4. 編集用パスワードの照合（DB側で行う。ハッシュは外に出さない）
-- ------------------------------------------------------------
create or replace function public.verify_card_password(
  p_id uuid,
  p_password text,
  p_allow_initial_set boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_found   boolean := false;
  v_hash    text;
  v_input   text;
  v_fails   integer;
begin
  if p_password is null or p_password !~ '^\d{4}$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;

  select true, r.edit_password_hash
    into v_found, v_hash
    from public.registrations r
   where r.id = p_id;

  if not coalesce(v_found, false) then
    return jsonb_build_object('ok', false, 'reason', 'notfound');
  end if;

  -- 直近15分で15回以上失敗していたら一時的に受け付けない
  select count(*) into v_fails
    from public.card_auth_attempts a
   where a.card_id = p_id
     and a.ok = false
     and a.attempted_at > now() - interval '15 minutes';

  if v_fails >= 15 then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  v_input := encode(sha256(convert_to(p_password, 'UTF8')), 'hex');

  -- パスワード未設定のカルテ（初回設定の救済フロー）
  if v_hash is null or v_hash = '' then
    if not coalesce(p_allow_initial_set, false) then
      return jsonb_build_object('ok', false, 'reason', 'notset');
    end if;
    update public.registrations set edit_password_hash = v_input where id = p_id;
    insert into public.card_auth_attempts(card_id, ok) values (p_id, true);
    return jsonb_build_object('ok', true, 'initialSet', true);
  end if;

  if v_hash = v_input then
    insert into public.card_auth_attempts(card_id, ok) values (p_id, true);
    return jsonb_build_object('ok', true);
  end if;

  insert into public.card_auth_attempts(card_id, ok) values (p_id, false);
  return jsonb_build_object('ok', false, 'reason', 'mismatch');
end;
$fn$;

-- ------------------------------------------------------------
-- 5. ペット情報の同期（新規登録・編集の両方で使う）
--    ※内部用。必ずパスワード照合済みの経路から呼ぶこと
-- ------------------------------------------------------------
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
      update public.pet_registrations set
        pet_name             = v_pet->>'pet_name',
        species              = v_pet->>'species',
        breed                = v_pet->>'breed',
        age                  = v_pet->>'age',
        sex                  = v_pet->>'sex',
        medical_history      = v_pet->>'medical_history',
        medications          = v_pet->>'medications',
        allergies            = v_pet->>'allergies',
        vet_clinic           = v_pet->>'vet_clinic',
        vaccine_info         = v_pet->>'vaccine_info',
        microchip            = v_pet->>'microchip',
        food                 = v_pet->>'food',
        medication_photo_url = v_pet->>'medication_photo_url',
        photo_url            = v_pet->>'photo_url',
        features             = v_pet->>'features'
      where id = v_petid and owner_id = v_owner;
    else
      insert into public.pet_registrations (
        pet_name, species, breed, age, sex, medical_history, medications,
        allergies, vet_clinic, vaccine_info, microchip, food,
        medication_photo_url, photo_url, features, owner_id
      ) values (
        v_pet->>'pet_name', v_pet->>'species', v_pet->>'breed', v_pet->>'age',
        v_pet->>'sex', v_pet->>'medical_history', v_pet->>'medications',
        v_pet->>'allergies', v_pet->>'vet_clinic', v_pet->>'vaccine_info',
        v_pet->>'microchip', v_pet->>'food', v_pet->>'medication_photo_url',
        v_pet->>'photo_url', v_pet->>'features', v_owner
      );
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

-- ------------------------------------------------------------
-- 6. 新規登録
-- ------------------------------------------------------------
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
    daily_notes, medications, edit_password_hash
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
    p_payload->>'daily_notes',
    public._sitte_text_array(p_payload->'medications'),
    encode(sha256(convert_to(p_password, 'UTF8')), 'hex')
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

-- ------------------------------------------------------------
-- 7. 編集の保存（パスワード照合つき）
-- ------------------------------------------------------------
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
    daily_notes                    = p_payload->>'daily_notes',
    medications                    = public._sitte_text_array(p_payload->'medications')
  where id = p_id;

  -- p_pets を渡したときだけペットを同期する（未指定なら既存のペットには触れない）
  if p_pets is not null then
    perform public._sitte_sync_pets(p_id, coalesce(p_pets_enabled, false), p_pets);
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;

-- ------------------------------------------------------------
-- 8. 新規登録時のペット保存（パスワード照合つき）
-- ------------------------------------------------------------
create or replace function public.save_card_pets(
  p_id uuid,
  p_password text,
  p_pets_enabled boolean,
  p_pets jsonb
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

  perform public._sitte_sync_pets(p_id, p_pets_enabled, p_pets);
  return jsonb_build_object('ok', true);
end;
$fn$;

-- ------------------------------------------------------------
-- 9. 登録の完全削除
--    ※現行アプリと同じく、IDを知っていれば削除できる（操作を変えないため）
-- ------------------------------------------------------------
create or replace function public.delete_card(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_remaining integer;
begin
  delete from public.pet_registrations where owner_id = p_id::text;
  delete from public.registrations where id = p_id;
  delete from public.card_auth_attempts where card_id = p_id;

  select count(*) into v_remaining from public.registrations where id = p_id;
  if v_remaining > 0 then
    return jsonb_build_object('ok', false, 'reason', 'notdeleted');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

-- ------------------------------------------------------------
-- 10. 実行権限：匿名ユーザーには「上の関数だけ」を許可する
-- ------------------------------------------------------------
revoke all on function public._sitte_text_array(jsonb) from public;
revoke all on function public._sitte_sync_pets(uuid, boolean, jsonb) from public;

revoke all on function public.get_card(uuid) from public;
revoke all on function public.get_cards_summary(uuid[]) from public;
revoke all on function public.verify_card_password(uuid, text, boolean) from public;
revoke all on function public.create_card(jsonb, text) from public;
revoke all on function public.save_card(uuid, text, jsonb, boolean, jsonb) from public;
revoke all on function public.save_card_pets(uuid, text, boolean, jsonb) from public;
revoke all on function public.delete_card(uuid) from public;

grant execute on function public.get_card(uuid)                                to anon, authenticated;
grant execute on function public.get_cards_summary(uuid[])                     to anon, authenticated;
grant execute on function public.verify_card_password(uuid, text, boolean)     to anon, authenticated;
grant execute on function public.create_card(jsonb, text)                      to anon, authenticated;
grant execute on function public.save_card(uuid, text, jsonb, boolean, jsonb)  to anon, authenticated;
grant execute on function public.save_card_pets(uuid, text, boolean, jsonb)    to anon, authenticated;
grant execute on function public.delete_card(uuid)                             to anon, authenticated;


commit;

-- ============================================================
-- 確認: 7つの関数が作られていれば成功
-- ============================================================
select p.proname as "関数名"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_card','get_cards_summary','verify_card_password',
                    'create_card','save_card','save_card_pets','delete_card')
order by p.proname;

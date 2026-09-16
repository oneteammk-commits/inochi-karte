-- ============================================================
-- STEP 3 のロールバック（写真ストレージと削除を元に戻す）
--
-- 写真が表示されなくなった等の不具合が出た場合に実行してください。
-- STEP 1・STEP 2（カルテ本体の保護）はそのまま維持されます。
-- ============================================================

-- 1. 写真ストレージのポリシーを改修前の状態に戻す
drop policy if exists "allow public read pet-meds" on storage.objects;
create policy "allow public read pet-meds"
  on storage.objects for select to public
  using (bucket_id = 'pet-meds');

drop policy if exists "allow anon delete pet-meds" on storage.objects;
create policy "allow anon delete pet-meds"
  on storage.objects for delete to anon
  using (bucket_id = 'pet-meds');

drop policy if exists "allow anon upload pet-meds" on storage.objects;
create policy "allow anon upload pet-meds"
  on storage.objects for insert to anon
  with check (bucket_id = 'pet-meds');

-- 2. 削除関数をパスワード不要版に戻す（旧アプリ用）
drop function if exists public.delete_card(uuid, text);

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

revoke all on function public.delete_card(uuid) from public;
grant execute on function public.delete_card(uuid) to anon, authenticated;

select policyname as "ポリシー名", cmd as "種類"
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

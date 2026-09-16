-- ============================================================
-- 命のカルテ (sitte) セキュリティ改修  STEP 3 : 写真ストレージと削除の保護
--
-- 【なぜ必要か】
--  写真の入れ物(pet-medsバケット)は、匿名から中身を「一覧表示」できる状態でした。
--  写真はカルテのID(UUID)の名前のフォルダに入っているため、一覧を取れば
--  全員分のカルテIDが分かってしまい、STEP2で閉じたはずの入口が
--  結果的に開いてしまいます。ここを塞ぎます。
--
-- 【このSQLで変わること】
--  1. 匿名からの一覧表示・ファイル削除を止める（写真の表示・登録はそのまま）
--  2. 写真の削除はカルテ削除の関数がまとめて行う（取り残しを防ぐ）
--  3. カルテの削除に編集用パスワードを必須にする
--
-- ★重要★ アプリの新バージョンとセットです。
--   必ず「アプリのデプロイ完了」を確認してから実行してください。
--   戻したいときは security_step3_rollback.sql を実行してください。
--
-- 実行場所: Supabase ダッシュボード → SQL Editor → 全文を貼り付けて RUN
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. 旧 delete_card（パスワード不要版）を廃止する
--    ※残したままだと、パスワード無しで削除できる抜け道になる
-- ------------------------------------------------------------
drop function if exists public.delete_card(uuid);

-- ------------------------------------------------------------
-- 2. 新 delete_card（パスワード必須・写真もまとめて削除）
-- ------------------------------------------------------------
create or replace function public.delete_card(p_id uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_auth      jsonb;
  v_paths     text[] := '{}';
  v_remaining integer;
begin
  v_auth := public.verify_card_password(p_id, p_password, false);
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  -- カルテ本体とペット登録の中に書かれている写真URLを、すべて拾い出す
  begin
    select coalesce(array_agg(distinct path), '{}')
      into v_paths
      from (
        select (regexp_matches(
                 src,
                 '/storage/v1/object/public/pet-meds/([^"\\ ]+)',
                 'g'
               ))[1] as path
        from (
          select coalesce(to_jsonb(r)::text, '') || ' ' ||
                 coalesce((
                   select string_agg(to_jsonb(p)::text, ' ')
                   from public.pet_registrations p
                   where p.owner_id = p_id::text
                 ), '') as src
          from public.registrations r
          where r.id = p_id
        ) s
      ) u;
  exception when others then
    v_paths := '{}';
  end;

  -- 写真の削除（URLで拾ったもの＋このカルテのフォルダの中身すべて）
  begin
    delete from storage.objects
     where bucket_id = 'pet-meds'
       and (name = any(v_paths) or name like p_id::text || '/%');
  exception when others then
    -- 写真の削除に失敗しても、カルテ本体の削除は続行する
    null;
  end;

  delete from public.pet_registrations where owner_id = p_id::text;
  delete from public.registrations      where id = p_id;
  delete from public.card_auth_attempts where card_id = p_id;

  select count(*) into v_remaining from public.registrations where id = p_id;
  if v_remaining > 0 then
    return jsonb_build_object('ok', false, 'reason', 'notdeleted');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.delete_card(uuid, text) from public;
grant execute on function public.delete_card(uuid, text) to anon, authenticated;

commit;

-- ------------------------------------------------------------
-- 3. 写真ストレージのアクセス設定
--    ※ storage スキーマはトランザクション外で変更する
-- ------------------------------------------------------------

-- 一覧表示を止める（公開バケットのため、写真の「表示」はこれまでどおり可能）
drop policy if exists "allow public read pet-meds" on storage.objects;
drop policy if exists "allow anon read pet-meds"   on storage.objects;

-- 匿名からのファイル削除を止める（削除は上の delete_card がまとめて行う）
drop policy if exists "allow anon delete pet-meds" on storage.objects;

-- 写真の登録（アップロード）はこれまでどおり許可
drop policy if exists "allow anon upload pet-meds" on storage.objects;
create policy "allow anon upload pet-meds"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'pet-meds');

-- ============================================================
-- 確認1: pet-meds のポリシーが「insert の1本だけ」になれば成功
-- ============================================================
select policyname as "ポリシー名", cmd as "種類", roles::text as "対象"
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- ============================================================
-- 確認2: 匿名から写真の一覧が取れないこと（0 になれば成功）
-- ============================================================
set local role anon;
select count(*) as "匿名から見える写真の件数" from storage.objects where bucket_id = 'pet-meds';
reset role;

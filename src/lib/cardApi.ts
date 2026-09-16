import { supabase } from './supabase'
import type { PetRegistrationRow } from '../types/petRegistration'

/**
 * カルテのデータベースアクセスをまとめた窓口。
 *
 * 個人情報を守るため、アプリはテーブルを直接読み書きしない。
 * 「二次元コードのID(UUID)を1件渡すと、その1件だけ返す」関数を
 * データベース側に用意し、必ずその関数を経由する。
 * 編集用パスワードの照合もデータベース側で行うため、
 * パスワードのハッシュがブラウザに渡ることはない。
 */

export type CardBundle = {
  registration: any
  hasPassword: boolean
  pets: PetRegistrationRow[]
}

export type AuthResult = {
  ok: boolean
  /** format=4桁でない / notfound=IDが無い / locked=試行回数超過 / notset=未設定 / mismatch=不一致 */
  reason?: 'format' | 'notfound' | 'locked' | 'notset' | 'mismatch' | 'notdeleted'
  initialSet?: boolean
}

/** 編集用パスワードの入力形式（数字4桁） */
export function isValidPasswordFormat(password: string): boolean {
  return /^\d{4}$/.test(password)
}

/** カルテ1件（本人情報＋ペット）を取得する。見つからなければ null */
export async function fetchCard(id: string): Promise<CardBundle | null> {
  const { data, error } = await supabase.rpc('get_card', { p_id: id })
  if (error) return null
  const registration = (data as any)?.registration
  if (!registration) return null
  return {
    registration,
    hasPassword: Boolean((data as any)?.has_password),
    pets: (((data as any)?.pets ?? []) as PetRegistrationRow[]),
  }
}

export type CardSummary = {
  id: string
  name: string
  emergency_contact_phone: string | null
}

/** 自分の端末に保存したカルテの氏名・緊急連絡先だけを取得する（ホーム画面用） */
export async function fetchCardsSummary(ids: string[]): Promise<CardSummary[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.rpc('get_cards_summary', { p_ids: ids })
  if (error) return []
  return ((data ?? []) as CardSummary[])
}

/** 編集用パスワードを照合する（照合はデータベース側で行う） */
export async function verifyCardPassword(
  id: string,
  password: string,
  allowInitialSet = false,
): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('verify_card_password', {
    p_id: id,
    p_password: password,
    p_allow_initial_set: allowInitialSet,
  })
  if (error) throw new Error(error.message || 'パスワードの確認に失敗しました。')
  return ((data ?? { ok: false }) as AuthResult)
}

/** 新規登録。登録されたカルテのIDを返す */
export async function createCard(
  payload: Record<string, unknown>,
  password: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_card', {
    p_payload: payload,
    p_password: password,
  })
  if (error) throw new Error(error.message || 'データベースへの保存に失敗しました。')
  if (!data) throw new Error('登録IDを取得できませんでした。')
  return data as string
}

/** 本人情報の保存（ペットには触れない） */
export async function saveCard(
  id: string,
  password: string,
  payload: Record<string, unknown>,
): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('save_card', {
    p_id: id,
    p_password: password,
    p_payload: payload,
  })
  if (error) throw new Error(error.message || 'データベースへの更新に失敗しました。')
  return ((data ?? { ok: false }) as AuthResult)
}

/** ペット情報の保存（渡した内容に合わせて追加・更新・削除する） */
export async function saveCardPets(
  id: string,
  password: string,
  petsEnabled: boolean,
  pets: Record<string, unknown>[],
): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('save_card_pets', {
    p_id: id,
    p_password: password,
    p_pets_enabled: petsEnabled,
    p_pets: pets,
  })
  if (error) throw new Error(error.message || 'ペット情報の保存に失敗しました。')
  return ((data ?? { ok: false }) as AuthResult)
}

/**
 * 登録の完全削除（本人情報＋ペット＋写真）。
 * 編集用パスワードが合っているときだけ実行される。
 * 写真の削除もデータベース側の関数がまとめて行う。
 */
export async function deleteCard(id: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('delete_card', {
    p_id: id,
    p_password: password,
  })
  if (error) throw new Error(error.message || '登録の削除に失敗しました。')
  return ((data ?? { ok: false }) as AuthResult)
}

/** パスワード照合の結果を、画面に出す日本語メッセージに変換する */
export function authErrorMessage(result: AuthResult): string {
  switch (result.reason) {
    case 'format':
      return '数字4桁を入力してください。'
    case 'locked':
      return 'パスワードの入力を続けて間違えたため、しばらく編集できません。15分ほど時間をおいてから、もう一度お試しください。'
    case 'notfound':
      return 'カルテが見つかりませんでした。'
    case 'notset':
      return 'このカルテは編集用パスワードが未設定です。登録したご本人のスマホ(登録に使った端末)から開くと、パスワードを設定できます。'
    case 'notdeleted':
      return 'サーバー側で削除が完了しませんでした。通信環境をご確認のうえ、もう一度お試しください。'
    default:
      return 'パスワードが一致しません（登録時に決めた4桁と異なります）'
  }
}

import { deleteCard, authErrorMessage, isValidPasswordFormat } from './cardApi'

/**
 * 登録を完全に削除する。
 *
 * 本人情報・ペット登録・お薬やペットの写真まで、
 * すべてデータベース側の関数 delete_card がまとめて削除する。
 * 編集用パスワードが合っていない場合は何も削除されない。
 */
export async function deleteRegistration(id: string, password: string): Promise<void> {
  if (!isValidPasswordFormat(password)) {
    throw new Error('数字4桁を入力してください。')
  }
  const result = await deleteCard(id, password)
  if (!result.ok) {
    throw new Error(authErrorMessage(result))
  }
}

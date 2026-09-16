import { supabase } from './supabase'
import { deleteCard } from './cardApi'

// ペットのお薬写真をストレージから削除（失敗しても本体の削除は続行する）
async function deletePetPhotos(ownerId: string): Promise<void> {
  try {
    const bucket = supabase.storage.from('pet-meds')
    const { data: entries } = await bucket.list(ownerId)
    if (!entries || entries.length === 0) return
    const paths: string[] = []
    for (const entry of entries) {
      if (entry.id) {
        // owner直下のファイル
        paths.push(`${ownerId}/${entry.name}`)
      } else {
        // ペットごとのフォルダ
        const { data: files } = await bucket.list(`${ownerId}/${entry.name}`)
        if (files) {
          for (const f of files) {
            if (f.id) paths.push(`${ownerId}/${entry.name}/${f.name}`)
          }
        }
      }
    }
    if (paths.length > 0) {
      await bucket.remove(paths)
    }
  } catch (e) {
    console.error('pet photo delete failed:', e)
  }
}

/**
 * 登録を完全に削除する。
 * ペットのお薬写真 → 登録本体（ペット登録も同時に削除）の順で消す。
 * 本体の削除はデータベース側の関数が行い、消え残りがあればエラーを返す。
 */
export async function deleteRegistration(id: string): Promise<void> {
  await deletePetPhotos(String(id))
  await deleteCard(id)
}

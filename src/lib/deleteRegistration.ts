import { supabase } from './supabase'

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
 * ペットのお薬写真 → ペット登録 → 本人登録 の順に削除し、
 * 削除後もサーバーに本人登録が残っている場合はエラーにする
 * （Supabase側の削除許可設定が未実施のケースを検知するため）。
 */
export async function deleteRegistration(id: string): Promise<void> {
  await deletePetPhotos(String(id))

  const { error: petError } = await supabase
    .from('pet_registrations')
    .delete()
    .eq('owner_id', String(id))
  if (petError) {
    throw new Error(petError.message || 'ペット登録の削除に失敗しました。')
  }

  const { error } = await supabase.from('registrations').delete().eq('id', id)
  if (error) {
    throw new Error(error.message || '登録の削除に失敗しました。')
  }

  // 本当に消えたか確認（削除ポリシー未設定だとエラーなしで0件削除になるため）
  const { data: still } = await supabase
    .from('registrations')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (still) {
    throw new Error('サーバー側で削除が許可されていません。管理者にお問い合わせください。')
  }
}

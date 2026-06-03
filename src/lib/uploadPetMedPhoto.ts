import { supabase } from './supabase'

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** ペットのお薬写真を pet-meds バケットにアップロードし公開URLを返す */
export async function uploadPetMedicationPhoto(
  ownerId: string,
  petKey: string,
  source: string | File,
): Promise<string> {
  const blob =
    typeof source === 'string' ? await dataUrlToBlob(source) : source
  const ext =
    typeof source === 'string'
      ? 'jpg'
      : source.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${ownerId}/${petKey}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('pet-meds').upload(path, blob, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) {
    throw new Error(error.message || 'ペットのお薬写真のアップロードに失敗しました。')
  }

  const { data } = supabase.storage.from('pet-meds').getPublicUrl(path)
  return data.publicUrl
}

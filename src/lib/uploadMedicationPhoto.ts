import { supabase } from './supabase'

/** 長辺1280pxのJPEGに圧縮する(失敗時は元ファイルをそのまま使う) */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const maxDim = 1280
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8),
    )
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/**
 * お薬の写真を圧縮してストレージに保存し、公開URLを返す。
 * カルテ本体にはURL(短い文字列)だけを記録するため、枚数が増えても
 * カルテの読み込み・保存が重くならない。
 */
export async function uploadMedicationPhoto(file: File): Promise<string> {
  const blob = await compressImage(file)
  const path = `meds/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from('pet-meds').upload(path, blob, {
    cacheControl: '3600',
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) {
    throw new Error(error.message || 'お薬写真のアップロードに失敗しました。')
  }
  const { data } = supabase.storage.from('pet-meds').getPublicUrl(path)
  return data.publicUrl
}

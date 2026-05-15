import type { RegistrationFormState } from '../types/registration'
import { isSupabaseConfigured, supabase } from './supabase'
import { hashPassword } from './passwordHash'

export async function persistRegistration(form: RegistrationFormState): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  // 編集用パスワードのチェック（数字4桁）
  if (!/^\d{4}$/.test(form.editPassword)) {
    throw new Error('編集用パスワードは数字4桁で入力してください。')
  }

  // パスワードをハッシュ化
  const editPasswordHash = await hashPassword(form.editPassword)

  const medications: string[] = []
  for (const m of form.medications) {
    if (!m.name.trim()) continue
    const photo_url = m.photoPreviews.length > 0 ? m.photoPreviews[0] : null
    medications.push(JSON.stringify({ name: m.name.trim(), photo_url }))
  }

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      name: form.fullName.trim(),
      furigana: form.furigana.trim() || null,
      birth_date: form.birthDate,
      emergency_contact_name: form.emergencyContactName.trim(),
      emergency_contact_furigana: form.emergencyContactFurigana.trim() || null,
      emergency_contact_phone: form.emergencyContactPhone.trim(),
      prefecture: form.prefecture,
      city: form.city.trim(),
      postal_code: form.postalCode?.trim() || null,
      facility_name: form.facilityName.trim() || null,
      facility_type: form.facilityType,
      allergies: form.allergyTags,
      allergy_other: form.allergyOther.trim() || null,
      diseases: form.chronicTags,
      disease_other: form.chronicOther.trim() || null,
      daily_notes: form.dailyNotes.trim() || null,
      medications,
      edit_password_hash: editPasswordHash,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message || 'データベースへの保存に失敗しました。')
  }
  if (!data?.id) {
    throw new Error('登録IDを取得できませんでした。')
  }
  return data.id
}

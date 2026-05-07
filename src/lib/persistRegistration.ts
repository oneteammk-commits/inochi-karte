import type { RegistrationFormState } from '../types/registration'
import { isSupabaseConfigured, supabase } from './supabase'

async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function persistRegistration(form: RegistrationFormState): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  const medications: string[] = []
  for (const m of form.medications) {
    if (!m.name.trim()) continue
    let photo_url: string | null = null
    if (m.photoPreviews.length > 0) {
      photo_url = await toBase64(m.photoPreviews[0])
    }
    medications.push(JSON.stringify({ name: m.name.trim(), photo_url }))
  }

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      name: form.fullName.trim(),
      birth_date: form.birthDate,
      emergency_contact_name: form.emergencyContactName.trim(),
      emergency_contact_phone: form.emergencyContactPhone.trim(),
      prefecture: form.prefecture,
      city: form.city.trim(),
      facility_name: form.facilityName.trim() || null,
      facility_type: form.facilityType,
      allergies: form.allergyTags,
      allergy_other: form.allergyOther.trim() || null,
      diseases: form.chronicTags,
      disease_other: form.chronicOther.trim() || null,
      daily_notes: form.dailyNotes.trim() || null,
      medications,
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

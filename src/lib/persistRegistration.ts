import type { RegistrationFormState } from '../types/registration'
import { isSupabaseConfigured, supabase } from './supabase'

export type MedicationPayload = {
  name: string
  photo_url: string | null
}

async function uploadPhoto(dataUrl: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const { error } = await supabase.storage
      .from('medication-photos')
      .upload(path, blob, { contentType: blob.type, upsert: true })
    if (error) return null
    const { data } = supabase.storage
      .from('medication-photos')
      .getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

async function buildMedicationsPayload(
  form: RegistrationFormState,
  registrationId: string
): Promise<MedicationPayload[]> {
  const results: MedicationPayload[] = []
  for (const m of form.medications) {
    if (!m.name.trim()) continue
    let photo_url: string | null = null
    if (m.photoPreviews.length > 0) {
      const path = `${registrationId}/${m.id}.jpg`
      photo_url = await uploadPhoto(m.photoPreviews[0], path)
    }
    results.push({ name: m.name.trim(), photo_url })
  }
  return results
}

export async function persistRegistration(form: RegistrationFormState): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  const registrationId = crypto.randomUUID()
  const medications = await buildMedicationsPayload(form, registrationId)

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      id: registrationId,
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

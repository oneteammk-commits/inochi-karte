import type { RegistrationFormState } from '../types/registration'
import { isSupabaseConfigured, supabase } from './supabase'

export async function updateRegistration(id: string, form: RegistrationFormState): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  const medications: string[] = []
  for (const m of form.medications) {
    if (!m.name.trim()) continue
    medications.push(JSON.stringify({ name: m.name.trim(), photo_urls: m.photoPreviews }))
  }

  const { error } = await supabase
    .from('registrations')
    .update({
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
    })
    .eq('id', id)

  if (error) {
    throw new Error(error.message || 'データベースへの更新に失敗しました。')
  }
}

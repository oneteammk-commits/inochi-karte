import type { PetRow } from '../types/pet'
import { petRowHasAnyData } from '../types/pet'
import { isSupabaseConfigured, supabase } from './supabase'
import { uploadPetMedicationPhoto } from './uploadPetMedPhoto'

function resolveSpecies(pet: PetRow): string | null {
  if (pet.speciesKind === 'dog') return '犬'
  if (pet.speciesKind === 'cat') return '猫'
  if (pet.speciesKind === 'other') return pet.speciesOther.trim() || null
  return null
}

async function resolveMedicationPhotoUrl(
  ownerId: string,
  pet: PetRow,
): Promise<string | null> {
  if (pet.medicationPhotoUrl && !pet.medicationPhotoUrl.startsWith('data:')) {
    return pet.medicationPhotoUrl
  }
  const preview = pet.medicationPhotoPreview
  if (!preview) return null
  if (preview.startsWith('http')) return preview
  if (preview.startsWith('data:')) {
    return uploadPetMedicationPhoto(ownerId, pet.id, preview)
  }
  return null
}

function petToRow(pet: PetRow, ownerId: string, medicationPhotoUrl: string | null) {
  return {
    pet_name: pet.petName.trim() || null,
    species: resolveSpecies(pet),
    breed: pet.breed.trim() || null,
    age: pet.age.trim() || null,
    sex: pet.sex.trim() || null,
    medical_history: pet.medicalHistory.trim() || null,
    medications: pet.medications.trim() || null,
    allergies: pet.allergies.trim() || null,
    vet_clinic: pet.vetClinic.trim() || null,
    vaccine_info: pet.vaccineInfo.trim() || null,
    microchip: pet.microchip.trim() || null,
    food: pet.food.trim() || null,
    medication_photo_url: medicationPhotoUrl,
    owner_id: String(ownerId),
  }
}

/** 編集時: ペット一覧を owner_id 単位で同期（削除・更新・追加） */
export async function syncPetRegistrations(
  ownerId: string,
  registerPetsEnabled: boolean,
  pets: PetRow[],
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  if (!registerPetsEnabled) {
    const { error } = await supabase
      .from('pet_registrations')
      .delete()
      .eq('owner_id', String(ownerId))
    if (error) {
      throw new Error(error.message || 'ペット情報の削除に失敗しました。')
    }
    return
  }

  const activePets = pets.filter(petRowHasAnyData)
  const keepDbIds = activePets.map((p) => p.dbId).filter(Boolean) as string[]

  const { data: existing } = await supabase
    .from('pet_registrations')
    .select('id')
    .eq('owner_id', String(ownerId))

  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepDbIds.includes(id))

  if (toDelete.length > 0) {
    const { error } = await supabase.from('pet_registrations').delete().in('id', toDelete)
    if (error) {
      throw new Error(error.message || 'ペット情報の削除に失敗しました。')
    }
  }

  for (const pet of activePets) {
    const photoUrl = await resolveMedicationPhotoUrl(ownerId, pet)
    const row = petToRow(pet, ownerId, photoUrl)

    if (pet.dbId) {
      const { error } = await supabase
        .from('pet_registrations')
        .update(row)
        .eq('id', pet.dbId)
      if (error) {
        throw new Error(error.message || 'ペット情報の更新に失敗しました。')
      }
    } else {
      const { error } = await supabase.from('pet_registrations').insert(row)
      if (error) {
        throw new Error(error.message || 'ペット情報の追加に失敗しました。')
      }
    }
  }
}

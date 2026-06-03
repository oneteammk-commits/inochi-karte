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

function petToInsertRow(pet: PetRow, ownerId: string, medicationPhotoUrl: string | null) {
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

export async function persistPetRegistrations(
  ownerId: string,
  pets: PetRow[],
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  const rowsWithData = pets.filter(petRowHasAnyData)
  if (rowsWithData.length === 0) return

  const rows = await Promise.all(
    rowsWithData.map(async (pet) => {
      const photoUrl = await resolveMedicationPhotoUrl(ownerId, pet)
      return petToInsertRow(pet, ownerId, photoUrl)
    }),
  )

  const { error } = await supabase.from('pet_registrations').insert(rows)
  if (error) {
    throw new Error(error.message || 'ペット情報の保存に失敗しました。')
  }
}

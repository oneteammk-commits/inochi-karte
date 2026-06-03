import type { PetRow, PetSpeciesKind } from '../types/pet'
import type { PetRegistrationRow } from '../types/petRegistration'

function speciesToKind(species: string | null): PetSpeciesKind {
  if (!species) return ''
  if (species === '犬') return 'dog'
  if (species === '猫') return 'cat'
  return 'other'
}

export function petRegistrationToFormRow(row: PetRegistrationRow): PetRow {
  const kind = speciesToKind(row.species)
  return {
    id: crypto.randomUUID(),
    dbId: row.id,
    petName: row.pet_name ?? '',
    speciesKind: kind,
    speciesOther: kind === 'other' ? row.species ?? '' : '',
    breed: row.breed ?? '',
    age: row.age ?? '',
    sex: row.sex ?? '',
    medicalHistory: row.medical_history ?? '',
    medications: row.medications ?? '',
    allergies: row.allergies ?? '',
    vetClinic: row.vet_clinic ?? '',
    vaccineInfo: row.vaccine_info ?? '',
    microchip: row.microchip ?? '',
    food: row.food ?? '',
    medicationPhotoPreview: row.medication_photo_url ?? null,
    medicationPhotoUrl: row.medication_photo_url ?? null,
  }
}

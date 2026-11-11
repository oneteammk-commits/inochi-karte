import type {
  PetMicrochipFitted,
  PetMicrochipRegistry,
  PetNeuterStatus,
  PetParasiteStatus,
  PetRabiesStatus,
  PetRow,
  PetSpeciesKind,
} from '../types/pet'
import type { PetRegistrationRow } from '../types/petRegistration'

function speciesToKind(species: string | null): PetSpeciesKind {
  if (!species) return ''
  if (species === '犬') return 'dog'
  if (species === '猫') return 'cat'
  return 'other'
}

/** 決まった値のどれかなら返し、それ以外（古いデータ・想定外）は空にする */
function pick<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | '' {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : ''
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
    vetDoctor: row.vet_doctor ?? '',
    vaccineInfo: row.vaccine_info ?? '',
    vaccineDate: row.vaccine_date ?? '',
    rabiesStatus: pick<Exclude<PetRabiesStatus, ''>>(row.rabies_status, ['done', 'not', 'exempt']),
    rabiesDate: row.rabies_date ?? '',
    rabiesExemptReason: row.rabies_exempt_reason ?? '',
    parasiteStatus: pick<Exclude<PetParasiteStatus, ''>>(row.parasite_status, ['done', 'not']),
    parasiteDate: row.parasite_date ?? '',
    neuterStatus: pick<Exclude<PetNeuterStatus, ''>>(row.neuter_status, ['done', 'not', 'unknown']),
    microchipFitted: pick<Exclude<PetMicrochipFitted, ''>>(row.microchip_fitted, ['yes', 'no', 'unknown']),
    microchipRegistry: pick<Exclude<PetMicrochipRegistry, ''>>(row.microchip_registry, ['moe', 'aipo', 'jkc', 'shop', 'unknown', 'other']),
    microchipRegistryOther: row.microchip_registry_other ?? '',
    microchip: row.microchip ?? '',
    food: row.food ?? '',
    features: row.features ?? '',
    photoUrl: row.photo_url ?? null,
    medicationPhotoPreview: row.medication_photo_url ?? null,
    medicationPhotoUrl: row.medication_photo_url ?? null,
  }
}

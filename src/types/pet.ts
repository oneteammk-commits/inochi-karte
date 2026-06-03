export type PetSpeciesKind = '' | 'dog' | 'cat' | 'other'

export type PetRow = {
  /** フォーム内の安定した React key */
  id: string
  /** 既存レコードの UUID（編集時） */
  dbId?: string
  petName: string
  speciesKind: PetSpeciesKind
  speciesOther: string
  breed: string
  age: string
  sex: string
  medicalHistory: string
  medications: string
  allergies: string
  vetClinic: string
  vaccineInfo: string
  microchip: string
  food: string
  medicationPhotoPreview: string | null
  medicationPhotoUrl: string | null
}

export function createEmptyPetRow(): PetRow {
  return {
    id: crypto.randomUUID(),
    petName: '',
    speciesKind: '',
    speciesOther: '',
    breed: '',
    age: '',
    sex: '',
    medicalHistory: '',
    medications: '',
    allergies: '',
    vetClinic: '',
    vaccineInfo: '',
    microchip: '',
    food: '',
    medicationPhotoPreview: null,
    medicationPhotoUrl: null,
  }
}

export function petRowHasAnyData(pet: PetRow): boolean {
  return !!(
    pet.petName.trim() ||
    pet.speciesKind ||
    pet.speciesOther.trim() ||
    pet.breed.trim() ||
    pet.age.trim() ||
    pet.sex ||
    pet.medicalHistory.trim() ||
    pet.medications.trim() ||
    pet.allergies.trim() ||
    pet.vetClinic.trim() ||
    pet.vaccineInfo.trim() ||
    pet.microchip.trim() ||
    pet.food.trim() ||
    pet.medicationPhotoPreview ||
    pet.medicationPhotoUrl
  )
}

export type PetSpeciesKind = '' | 'dog' | 'cat' | 'other'
/** 狂犬病予防注射: 接種済み / 未接種 / 猶予（獣医師の証明など） */
export type PetRabiesStatus = '' | 'done' | 'not' | 'exempt'
/** ノミ・ダニ・フィラリア予防: している / していない */
export type PetParasiteStatus = '' | 'done' | 'not'
/** 不妊・去勢手術: 済み / していない / 不明 */
export type PetNeuterStatus = '' | 'done' | 'not' | 'unknown'
/** マイクロチップの装着: あり / なし / 分からない */
export type PetMicrochipFitted = '' | 'yes' | 'no' | 'unknown'
/** マイクロチップの登録先 */
export type PetMicrochipRegistry = '' | 'moe' | 'aipo' | 'jkc' | 'shop' | 'unknown' | 'other'

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
  /** 担当獣医師名（複数可・自由記入） */
  vetDoctor: string
  vaccineInfo: string
  /** 混合ワクチンの最新の接種日（YYYY-MM-DD） */
  vaccineDate: string
  rabiesStatus: PetRabiesStatus
  /** 狂犬病予防注射の最新の接種日（YYYY-MM-DD） */
  rabiesDate: string
  rabiesExemptReason: string
  parasiteStatus: PetParasiteStatus
  /** ノミ・ダニ予防の最終実施日（YYYY-MM-DD） */
  parasiteDate: string
  neuterStatus: PetNeuterStatus
  microchipFitted: PetMicrochipFitted
  microchipRegistry: PetMicrochipRegistry
  microchipRegistryOther: string
  microchip: string
  food: string
  features: string
  photoUrl: string | null
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
    vetDoctor: '',
    vaccineInfo: '',
    vaccineDate: '',
    rabiesStatus: '',
    rabiesDate: '',
    rabiesExemptReason: '',
    parasiteStatus: '',
    parasiteDate: '',
    neuterStatus: '',
    microchipFitted: '',
    microchipRegistry: '',
    microchipRegistryOther: '',
    microchip: '',
    food: '',
    features: '',
    photoUrl: null,
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
    pet.vetDoctor.trim() ||
    pet.vaccineInfo.trim() ||
    pet.vaccineDate ||
    pet.rabiesStatus ||
    pet.rabiesDate ||
    pet.rabiesExemptReason.trim() ||
    pet.parasiteStatus ||
    pet.parasiteDate ||
    pet.neuterStatus ||
    pet.microchipFitted ||
    pet.microchipRegistry ||
    pet.microchipRegistryOther.trim() ||
    pet.microchip.trim() ||
    pet.food.trim() ||
    pet.features.trim() ||
    pet.photoUrl ||
    pet.medicationPhotoPreview ||
    pet.medicationPhotoUrl
  )
}

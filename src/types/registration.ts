import type { PetRow } from './pet'

export type { PetRow } from './pet'

export type MedicationRow = {
  id: string
  name: string
  photoPreviews: string[]
}
export type RegistrationFormState = {
  fullName: string
  furigana: string
  birthDate: string
  /** 続柄プルダウンの値（preset key または other） */
  emergencyContactRelationshipKey: string
  /** 続柄が other のときの自由入力 */
  emergencyContactRelationshipOther: string
  emergencyContactName: string
  emergencyContactFurigana: string
  emergencyContactPhone: string
  postalCode: string
  prefecture: string
  city: string
  addressDetail: string
  facilityName: string
  facilityType: string
  allergyTags: string[]
  chronicTags: string[]
  allergyOther: string
  chronicOther: string
  dailyNotes: string
  medications: MedicationRow[]
  registerPetsEnabled: boolean
  pets: PetRow[]
  editPassword: string
}

export type MedicationRow = {
  id: string
  name: string
  photoPreviews: string[]
}
export type RegistrationFormState = {
  fullName: string
  furigana: string
  birthDate: string
  emergencyContactName: string
  emergencyContactFurigana: string
  emergencyContactPhone: string
  prefecture: string
  city: string
  postalCode: string
  facilityName: string
  facilityType: string
  allergyTags: string[]
  chronicTags: string[]
  allergyOther: string
  chronicOther: string
  dailyNotes: string
  medications: MedicationRow[]
  editPassword: string
}

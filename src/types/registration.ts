export type MedicationRow = {
  id: string
  name: string
  photoPreviews: string[]
}

export type RegistrationFormState = {
  fullName: string
  birthDate: string
  emergencyContactName: string
  emergencyContactPhone: string
  prefecture: string
  city: string
  facilityName: string
  facilityType: string
  allergyTags: string[]
  chronicTags: string[]
  allergyOther: string
  chronicOther: string
  dailyNotes: string
  medications: MedicationRow[]
}

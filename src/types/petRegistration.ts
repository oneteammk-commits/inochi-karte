export type PetRegistrationRow = {
  id: string
  pet_name: string | null
  species: string | null
  breed: string | null
  age: string | null
  sex: string | null
  medical_history: string | null
  medications: string | null
  allergies: string | null
  vet_clinic: string | null
  vaccine_info: string | null
  microchip: string | null
  food: string | null
  medication_photo_url: string | null
  photo_url?: string | null
  features?: string | null
  rabies_status?: string | null
  rabies_date?: string | null
  rabies_exempt_reason?: string | null
  vaccine_date?: string | null
  parasite_status?: string | null
  parasite_date?: string | null
  neuter_status?: string | null
  vet_doctor?: string | null
  microchip_fitted?: string | null
  microchip_registry?: string | null
  microchip_registry_other?: string | null
  owner_id: string
}

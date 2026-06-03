import type { PetRegistrationRow } from '../types/petRegistration'

function PetField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value?.trim()) return null
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-sm text-amber-900/70">{label}</p>
      <p className="text-base font-semibold text-black whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function formatPetSex(sex: string | null, t: (key: string) => string): string | null {
  if (!sex?.trim()) return null
  if (sex === 'male') return t('register.petSexMale')
  if (sex === 'female') return t('register.petSexFemale')
  if (sex === 'unknown') return t('register.petSexUnknown')
  return sex
}

type PetViewSectionProps = {
  pets: PetRegistrationRow[]
  t: (key: string, options?: { num?: number }) => string
}

export function PetViewSection({ pets, t }: PetViewSectionProps) {
  if (pets.length === 0) return null

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 shadow-sm p-5 mb-3 rounded-r-2xl">
      <h2 className="text-lg font-bold text-amber-800 border-b-2 border-amber-200 pb-2 mb-4">
        🐾 {t('view.petsTitle')}
      </h2>
      <div className="space-y-5">
        {pets.map((pet, index) => (
          <div
            key={pet.id}
            className="rounded-xl border border-amber-200/80 bg-white/70 p-4"
          >
            <p className="mb-3 text-base font-bold text-amber-900">
              {t('view.petLabel', { num: index + 1 })}
            </p>
            <PetField label={t('view.labelPetName')} value={pet.pet_name} />
            <PetField label={t('view.labelPetSpecies')} value={pet.species} />
            <PetField label={t('view.labelPetBreed')} value={pet.breed} />
            <PetField label={t('view.labelPetAge')} value={pet.age} />
            <PetField label={t('view.labelPetSex')} value={formatPetSex(pet.sex, t)} />
            <PetField label={t('view.labelPetMedicalHistory')} value={pet.medical_history} />
            <PetField label={t('view.labelPetMedications')} value={pet.medications} />
            {pet.medication_photo_url && (
              <div className="mb-3">
                <p className="text-sm text-amber-900/70">{t('view.labelPetMedicinePhoto')}</p>
                <img
                  src={pet.medication_photo_url}
                  alt={t('view.labelPetMedicinePhoto')}
                  className="mt-1 max-h-48 w-full rounded-lg border border-amber-200 object-contain"
                />
              </div>
            )}
            <PetField label={t('view.labelPetAllergies')} value={pet.allergies} />
            <PetField label={t('view.labelPetVetClinic')} value={pet.vet_clinic} />
            <PetField label={t('view.labelPetVaccine')} value={pet.vaccine_info} />
            <PetField label={t('view.labelPetMicrochip')} value={pet.microchip} />
            <PetField label={t('view.labelPetFood')} value={pet.food} />
          </div>
        ))}
      </div>
    </div>
  )
}

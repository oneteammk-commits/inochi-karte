import { memo } from 'react'
import type { PetRow } from '../types/pet'
import type { RegistrationFormState } from '../types/registration'
import { ImeAwareInput, ImeAwareTextarea } from './ImeAwareField'

type PetFormBlockProps = {
  pet: PetRow
  index: number
  canRemove: boolean
  onRemovePet: (id: string) => void
  onUpdatePet: (id: string, patch: Partial<Omit<PetRow, 'id'>>) => void
  onAddPetPhoto: (id: string, files: FileList | null) => Promise<void>
  onRemovePetPhoto: (id: string) => void
  t: (key: string, options?: { num?: number }) => string
}

const PetFormBlock = memo(function PetFormBlock({
  pet,
  index,
  canRemove,
  onRemovePet,
  onUpdatePet,
  onAddPetPhoto,
  onRemovePetPhoto,
  t,
}: PetFormBlockProps) {
  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-stone-800">
          {t('register.petLabel', { num: index + 1 })}
          <span className="ml-1.5 font-normal text-stone-500">{t('register.optional')}</span>
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemovePet(pet.id)}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            {t('register.buttonDeletePet')}
          </button>
        )}
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelPetName')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareInput
            value={pet.petName}
            onValueChange={(v) => onUpdatePet(pet.id, { petName: v })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderPetName')}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelSpecies')}
              <span className="font-normal text-stone-500">{t('register.optional')}</span>
            </span>
            <select
              value={pet.speciesKind}
              onChange={(e) =>
                onUpdatePet(pet.id, {
                  speciesKind: e.target.value as PetRow['speciesKind'],
                })
              }
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            >
              <option value="">{t('register.selectPlaceholder')}</option>
              <option value="dog">{t('register.speciesDog')}</option>
              <option value="cat">{t('register.speciesCat')}</option>
              <option value="other">{t('register.speciesOther')}</option>
            </select>
          </label>
          {pet.speciesKind === 'other' && (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-stone-600">
                {t('register.labelSpeciesOther')}
              </span>
              <ImeAwareInput
                value={pet.speciesOther}
                onValueChange={(v) => onUpdatePet(pet.id, { speciesOther: v })}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
                placeholder={t('register.placeholderSpeciesOther')}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelBreed')}
              <span className="font-normal text-stone-500">{t('register.optional')}</span>
            </span>
            <ImeAwareInput
              value={pet.breed}
              onValueChange={(v) => onUpdatePet(pet.id, { breed: v })}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderBreed')}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelPetAge')}
              <span className="font-normal text-stone-500">{t('register.optional')}</span>
            </span>
            <ImeAwareInput
              value={pet.age}
              onValueChange={(v) => onUpdatePet(pet.id, { age: v })}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderPetAge')}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelPetSex')}
              <span className="font-normal text-stone-500">{t('register.optional')}</span>
            </span>
            <select
              value={pet.sex}
              onChange={(e) => onUpdatePet(pet.id, { sex: e.target.value })}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            >
              <option value="">{t('register.selectPlaceholder')}</option>
              <option value="male">{t('register.petSexMale')}</option>
              <option value="female">{t('register.petSexFemale')}</option>
              <option value="unknown">{t('register.petSexUnknown')}</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelPetMedicalHistory')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareTextarea
            value={pet.medicalHistory}
            onValueChange={(v) => onUpdatePet(pet.id, { medicalHistory: v })}
            rows={2}
            className="w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderPetMedicalHistory')}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelPetMedications')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareTextarea
            value={pet.medications}
            onValueChange={(v) => onUpdatePet(pet.id, { medications: v })}
            rows={2}
            className="w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderPetMedications')}
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelPetMedicinePhoto')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-white px-4 py-5 transition hover:border-brand/50 hover:bg-brand-50/20">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                void onAddPetPhoto(pet.id, e.target.files)
                e.currentTarget.value = ''
              }}
            />
            <span className="text-center text-sm text-stone-500">
              {t('register.tapToSelectPetMedicinePhoto')}
            </span>
          </label>
          {pet.medicationPhotoPreview && (
            <div className="relative mt-3 inline-block">
              <img
                src={pet.medicationPhotoPreview}
                alt={t('register.altPetMedicinePhoto')}
                className="h-28 rounded-lg border border-amber-200 object-cover"
              />
              <button
                type="button"
                onClick={() => onRemovePetPhoto(pet.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white"
              >
                ×
              </button>
            </div>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelPetAllergies')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareTextarea
            value={pet.allergies}
            onValueChange={(v) => onUpdatePet(pet.id, { allergies: v })}
            rows={2}
            className="w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderPetAllergies')}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelVetClinic')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareInput
            value={pet.vetClinic}
            onValueChange={(v) => onUpdatePet(pet.id, { vetClinic: v })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderVetClinic')}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelVaccineInfo')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareInput
            value={pet.vaccineInfo}
            onValueChange={(v) => onUpdatePet(pet.id, { vaccineInfo: v })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderVaccineInfo')}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelMicrochip')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareInput
            value={pet.microchip}
            onValueChange={(v) => onUpdatePet(pet.id, { microchip: v })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderMicrochip')}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelPetFood')}
            <span className="font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <ImeAwareInput
            value={pet.food}
            onValueChange={(v) => onUpdatePet(pet.id, { food: v })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderPetFood')}
          />
          <p className="mt-1.5 text-xs text-stone-500">{t('register.hintPetFood')}</p>
        </label>
      </div>
    </div>
  )
})

type StepPetSectionProps = {
  form: RegistrationFormState
  onChange: (patch: Partial<RegistrationFormState>) => void
  onAddPet: () => void
  onRemovePet: (id: string) => void
  onUpdatePet: (id: string, patch: Partial<Omit<PetRow, 'id'>>) => void
  onAddPetPhoto: (id: string, files: FileList | null) => Promise<void>
  onRemovePetPhoto: (id: string) => void
  t: (key: string, options?: { num?: number }) => string
}

export function StepPetSection({
  form,
  onChange,
  onAddPet,
  onRemovePet,
  onUpdatePet,
  onAddPetPhoto,
  onRemovePetPhoto,
  t,
}: StepPetSectionProps) {
  const handleToggle = (enabled: boolean) => {
    if (enabled && form.pets.length === 0) {
      onChange({ registerPetsEnabled: true })
      onAddPet()
      return
    }
    onChange({ registerPetsEnabled: enabled })
  }

  return (
    <section
      aria-labelledby="step-pet-title"
      className="mb-8 mt-8 rounded-2xl border-2 border-brand bg-amber-100/50 p-5 sm:p-6"
    >
      <div className="mb-4 rounded-xl bg-amber-100/80 px-4 py-3 ring-1 ring-amber-200/70">
        <h2 id="step-pet-title" className="text-lg font-bold text-amber-900">
          🐾 {t('register.petsSectionTitle')}
        </h2>
        <p className="mt-1 text-sm text-amber-800/90">{t('register.petsSectionSubtitle')}</p>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
        <span className="text-sm font-bold text-stone-800">
          {t('register.petsToggleLabel')}
        </span>
        <span className="relative inline-flex shrink-0">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={form.registerPetsEnabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <span
            className="h-7 w-12 rounded-full bg-stone-300 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40"
            aria-hidden
          />
          <span
            className="absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition peer-checked:translate-x-5"
            aria-hidden
          />
        </span>
      </label>

      {form.registerPetsEnabled && (
        <div className="mt-6 space-y-6">
          {form.pets.map((pet, index) => (
            <PetFormBlock
              key={pet.id}
              pet={pet}
              index={index}
              canRemove={form.pets.length > 1}
              onRemovePet={onRemovePet}
              onUpdatePet={onUpdatePet}
              onAddPetPhoto={onAddPetPhoto}
              onRemovePetPhoto={onRemovePetPhoto}
              t={t}
            />
          ))}

          <button
            type="button"
            onClick={onAddPet}
            className="w-full rounded-xl border-2 border-dashed border-amber-300 py-3 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-50"
          >
            {t('register.buttonAddPet')}
          </button>
        </div>
      )}
    </section>
  )
}

import { memo, useState } from 'react'
import type { PetRow } from '../types/pet'
import type { RegistrationFormState } from '../types/registration'
import { ImeAwareInput, ImeAwareTextarea } from './ImeAwareField'
import { uploadMedicationPhoto } from '../lib/uploadMedicationPhoto'

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

/** 「なぜこの項目が要るの？」— ？を押すと獣医師の助言に基づく理由が開く */
function WhyHint({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="inline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400 bg-white text-[11px] font-bold text-amber-700 align-middle"
      >
        ?
      </button>
      {open && (
        <span className="mt-1 block rounded-md bg-amber-100/70 px-2.5 py-1.5 text-xs font-normal leading-relaxed text-stone-700">
          {text}
        </span>
      )}
    </span>
  )
}

const FIELD =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2'

/** 幅を中身に合わせる版（横並び・自動で2段にするプルダウン用） */
const FIELD_AUTO = FIELD.replace('w-full ', '')

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
          </span>
          <ImeAwareInput
            value={pet.petName}
            onValueChange={(v) => onUpdatePet(pet.id, { petName: v })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderPetName')}
          />
        </label>
        {/* ペットの写真(迷子時の特定用) */}
        <div className="mb-4">
          <span className="mb-1 block text-xs font-medium text-stone-600">ペットの写真</span>
          {pet.photoUrl ? (
            <div className="relative inline-block">
              <img src={pet.photoUrl} alt="pet" className="h-28 w-28 rounded-lg border border-stone-200 object-cover" />
              <button
                style={{ color: '#ffffff' }}
                type="button"
                onClick={() => onUpdatePet(pet.id, { photoUrl: null })}
                aria-label="delete photo"
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-base font-bold text-white shadow-md"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white px-4 py-4">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0]
                  e.currentTarget.value = ''
                  if (!f) return
                  void uploadMedicationPhoto(f).then((url) => onUpdatePet(pet.id, { photoUrl: url }))
                }}
              />
              <span className="text-center text-sm text-stone-500">タップして写真を選択</span>
            </label>
          )}
          <p className="mt-1 text-xs text-stone-500">災害時に迷子になったとき、保護された子の特定に役立ちます</p>
        </div>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-stone-600">特徴(色・模様・首輪・性格など)</span>
          <ImeAwareTextarea
            value={pet.features}
            onValueChange={(v) => onUpdatePet(pet.id, { features: v })}
            rows={2}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder="例:茶白のハチワレ、赤い首輪、人なつっこい"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelSpecies')}
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
            </span>
            <ImeAwareInput
              value={pet.age}
              onValueChange={(v) => onUpdatePet(pet.id, { age: v })}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderPetAge')}
            />
          </label>
          {/* 性別・不妊去勢: 見出し1つに、性別と手術の有無のプルダウンを横並び（獣医師の助言: 雄も雌も「している／していない／分からない」） */}
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelPetSex')}
              <WhyHint text={t('register.whyNeuter')} label={t('register.whyLabel')} />
            </span>
            {/* 横並びで入るときは横に、言葉が長い言語（英語など）で入らないときは自動で2段にする（文字が切れないように） */}
            <div className="flex flex-wrap gap-2" data-pet-sex-neuter>
              <select
                aria-label={t('register.labelPetSexOnly')}
                value={pet.sex}
                onChange={(e) => onUpdatePet(pet.id, { sex: e.target.value })}
                className={`${FIELD_AUTO} flex-auto px-2`}
              >
                <option value="">{t('register.labelPetSexOnly')}</option>
                <option value="male">{t('register.petSexMale')}</option>
                <option value="female">{t('register.petSexFemale')}</option>
                <option value="unknown">{t('register.petSexUnknown')}</option>
                {/* 古い自由記入の値が入っているときだけ、その値をそのまま見せる */}
                {pet.sex.trim() && !['male', 'female', 'unknown'].includes(pet.sex) && (
                  <option value={pet.sex}>{pet.sex}</option>
                )}
              </select>
              <select
                aria-label={t('register.labelNeuter')}
                value={pet.neuterStatus}
                onChange={(e) => onUpdatePet(pet.id, { neuterStatus: e.target.value as PetRow['neuterStatus'] })}
                className={`${FIELD_AUTO} flex-auto px-2`}
              >
                <option value="">{t('register.labelNeuterShort')}</option>
                <option value="done">{t('register.neuterOptDone')}</option>
                <option value="not">{t('register.neuterOptNot')}</option>
                <option value="unknown">{t('register.neuterOptUnknown')}</option>
              </select>
            </div>
          </div>
        </div>
        {/* ── 避難所の受付で最初に見られる項目（獣医師の助言による並び）── */}
        <div className="rounded-lg border border-amber-200 bg-white/60 p-3">
          <span className="mb-2 block text-xs font-medium text-stone-600">
            {t('register.labelRabies')}
            <WhyHint text={t('register.whyRabies')} label={t('register.whyLabel')} />
          </span>
          {pet.speciesKind === 'cat' || pet.speciesKind === 'other' ? (
            <p className="text-sm text-stone-600">{t('register.rabiesNotApplicable')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-stone-500">{t('register.labelStatus')}</span>
                <select
                  aria-label={t('register.labelRabies')}
                  value={pet.rabiesStatus}
                  onChange={(e) => onUpdatePet(pet.id, { rabiesStatus: e.target.value as PetRow['rabiesStatus'] })}
                  className={FIELD}
                >
                  <option value="">{t('register.selectPlaceholder')}</option>
                  <option value="done">{t('register.rabiesDone')}</option>
                  <option value="not">{t('register.rabiesNot')}</option>
                  <option value="exempt">{t('register.rabiesExempt')}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-stone-500">{t('register.labelRabiesDate')}</span>
                <input
                  type="date"
                  aria-label={`${t('register.labelRabies')} ${t('register.labelRabiesDate')}`}
                  value={pet.rabiesDate}
                  max="9999-12-31"
                  onChange={(e) => onUpdatePet(pet.id, { rabiesDate: e.target.value })}
                  className={FIELD}
                />
              </label>
              {pet.rabiesStatus === 'exempt' && (
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs text-stone-500">{t('register.labelRabiesExemptReason')}</span>
                  <ImeAwareInput
                    aria-label={`${t('register.labelRabies')} ${t('register.labelRabiesExemptReason')}`}
                    value={pet.rabiesExemptReason}
                    onValueChange={(v) => onUpdatePet(pet.id, { rabiesExemptReason: v })}
                    className={FIELD}
                    placeholder={t('register.placeholderRabiesExemptReason')}
                  />
                </label>
              )}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-amber-200 bg-white/60 p-3">
          <span className="mb-2 block text-xs font-medium text-stone-600">
            {t('register.labelVaccineInfo')}
            <WhyHint text={t('register.whyVaccine')} label={t('register.whyLabel')} />
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">{t('register.labelVaccineContent')}</span>
              <ImeAwareInput
                aria-label={t('register.labelVaccineInfo')}
                value={pet.vaccineInfo}
                onValueChange={(v) => onUpdatePet(pet.id, { vaccineInfo: v })}
                className={FIELD}
                placeholder={t('register.placeholderVaccineInfo')}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">{t('register.labelVaccineDate')}</span>
              <input
                type="date"
                aria-label={`${t('register.labelVaccineInfo')} ${t('register.labelVaccineDate')}`}
                value={pet.vaccineDate}
                max="9999-12-31"
                onChange={(e) => onUpdatePet(pet.id, { vaccineDate: e.target.value })}
                className={FIELD}
              />
            </label>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white/60 p-3">
          <span className="mb-2 block text-xs font-medium text-stone-600">
            {t('register.labelParasite')}
            <WhyHint text={t('register.whyParasite')} label={t('register.whyLabel')} />
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">{t('register.labelStatus')}</span>
              <select
                aria-label={t('register.labelParasite')}
                value={pet.parasiteStatus}
                onChange={(e) => onUpdatePet(pet.id, { parasiteStatus: e.target.value as PetRow['parasiteStatus'] })}
                className={FIELD}
              >
                <option value="">{t('register.selectPlaceholder')}</option>
                <option value="done">{t('register.parasiteDone')}</option>
                <option value="not">{t('register.parasiteNot')}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">{t('register.labelParasiteDate')}</span>
              <input
                type="date"
                aria-label={`${t('register.labelParasite')} ${t('register.labelParasiteDate')}`}
                value={pet.parasiteDate}
                max="9999-12-31"
                onChange={(e) => onUpdatePet(pet.id, { parasiteDate: e.target.value })}
                className={FIELD}
              />
            </label>
          </div>
        </div>
        {/* ── 持病・お薬・ごはん ── */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">
            {t('register.labelPetMedicalHistory')}
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
                style={{ color: '#ffffff' }}
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
            {t('register.labelPetFood')}
          </span>
          <ImeAwareInput
            value={pet.food}
            onValueChange={(v) => onUpdatePet(pet.id, { food: v })}
            className={FIELD}
            placeholder={t('register.placeholderPetFood')}
          />
          <p className="mt-1.5 text-xs text-stone-500">{t('register.hintPetFood')}</p>
        </label>
        {/* ── かかりつけ・担当医 ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelVetClinic')}
            </span>
            <ImeAwareInput
              value={pet.vetClinic}
              onValueChange={(v) => onUpdatePet(pet.id, { vetClinic: v })}
              className={FIELD}
              placeholder={t('register.placeholderVetClinic')}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">
              {t('register.labelVetDoctor')}
              <WhyHint text={t('register.whyVetDoctor')} label={t('register.whyLabel')} />
            </span>
            <ImeAwareInput
              value={pet.vetDoctor}
              onValueChange={(v) => onUpdatePet(pet.id, { vetDoctor: v })}
              className={FIELD}
              placeholder={t('register.placeholderVetDoctor')}
            />
          </label>
        </div>
        {/* ── マイクロチップ（装着 → 登録先 → 番号）── */}
        <div className="rounded-lg border border-amber-200 bg-white/60 p-3">
          <span className="mb-2 block text-xs font-medium text-stone-600">
            {t('register.labelMicrochipGroup')}
            <WhyHint text={t('register.whyMicrochip')} label={t('register.whyLabel')} />
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">{t('register.labelMicrochipFitted')}</span>
              <select
                aria-label={`${t('register.labelMicrochipGroup')} ${t('register.labelMicrochipFitted')}`}
                value={pet.microchipFitted}
                onChange={(e) => onUpdatePet(pet.id, { microchipFitted: e.target.value as PetRow['microchipFitted'] })}
                className={FIELD}
              >
                <option value="">{t('register.selectPlaceholder')}</option>
                <option value="yes">{t('register.microchipYes')}</option>
                <option value="no">{t('register.microchipNo')}</option>
                <option value="unknown">{t('register.microchipUnknown')}</option>
              </select>
            </label>
            {pet.microchipFitted !== 'no' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-stone-500">{t('register.labelMicrochipRegistry')}</span>
                  <select
                    aria-label={`${t('register.labelMicrochipGroup')} ${t('register.labelMicrochipRegistry')}`}
                    value={pet.microchipRegistry}
                    onChange={(e) => onUpdatePet(pet.id, { microchipRegistry: e.target.value as PetRow['microchipRegistry'] })}
                    className={FIELD}
                  >
                    <option value="">{t('register.selectPlaceholder')}</option>
                    <option value="moe">{t('register.registryMoe')}</option>
                    <option value="aipo">{t('register.registryAipo')}</option>
                    <option value="jkc">{t('register.registryJkc')}</option>
                    <option value="shop">{t('register.registryShop')}</option>
                    <option value="unknown">{t('register.registryUnknown')}</option>
                    <option value="other">{t('register.registryOther')}</option>
                  </select>
                </label>
                {pet.microchipRegistry === 'other' && (
                  <label className="block">
                    <span className="mb-1 block text-xs text-stone-500">{t('register.labelMicrochipRegistryOther')}</span>
                    <ImeAwareInput
                      aria-label={`${t('register.labelMicrochipGroup')} ${t('register.labelMicrochipRegistryOther')}`}
                      value={pet.microchipRegistryOther}
                      onValueChange={(v) => onUpdatePet(pet.id, { microchipRegistryOther: v })}
                      className={FIELD}
                      placeholder={t('register.placeholderMicrochipRegistryOther')}
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs text-stone-500">{t('register.labelMicrochip')}</span>
                  <ImeAwareInput
                    aria-label={`${t('register.labelMicrochipGroup')} ${t('register.labelMicrochip')}`}
                    value={pet.microchip}
                    onValueChange={(v) => onUpdatePet(pet.id, { microchip: v })}
                    className={FIELD}
                    placeholder={t('register.placeholderMicrochip')}
                  />
                </label>
              </>
            )}
          </div>
        </div>
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
  // 削除は確認ダイアログを挟む（押し間違いでペット情報を失わないため）
  const [pendingDelete, setPendingDelete] = useState<PetRow | null>(null)

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
          <span aria-hidden="true">🐾</span> {t('register.petsSectionTitle')}
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
              canRemove={form.pets.length > 0}
              onRemovePet={(id) => {
                const target = form.pets.find((x) => x.id === id)
                if (target) setPendingDelete(target)
              }}
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

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-center text-lg font-bold text-black">
              {t('register.petDeleteTitle')}
            </h3>
            <p className="mb-2 text-base leading-relaxed text-black">
              {pendingDelete.petName.trim()
                ? t('register.petDeleteConfirmNamed').replace('{{name}}', pendingDelete.petName.trim())
                : t('register.petDeleteConfirm')}
            </p>
            <p className="mb-5 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm font-bold leading-relaxed text-amber-900">
              {t('register.petDeleteWarning')}
            </p>
            <div className="space-y-3">
              <button
                style={{ color: '#ffffff' }}
                type="button"
                onClick={() => {
                  onRemovePet(pendingDelete.id)
                  setPendingDelete(null)
                }}
                className="block w-full rounded-xl bg-red-700 py-4 text-center text-base font-bold text-white shadow-md hover:bg-red-800"
              >
                {t('register.petDeleteYes')}
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="block w-full rounded-xl border-2 border-stone-400 bg-white py-4 text-center text-base font-bold text-black shadow-sm hover:bg-stone-50"
              >
                {t('register.petDeleteNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

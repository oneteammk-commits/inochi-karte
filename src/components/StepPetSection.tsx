import { memo, useState } from 'react'
import type { PetRow } from '../types/pet'
import type { RegistrationFormState } from '../types/registration'
import { ImeAwareInput, ImeAwareTextarea } from './ImeAwareField'
import { getLocalPreview, uploadMedicationPhoto } from '../lib/uploadMedicationPhoto'
import { ImportantBadge, WhyGroup, WhyHint } from './WhyHint'
import { FoldSection, useCompare } from './CompareModes'

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

const FIELD =
  'ud-field w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2'

/** 幅を中身に合わせる版（横並び・自動で2段にするプルダウン用） */
const FIELD_AUTO = FIELD.replace('w-full ', '')

/** 日付の欄（iPhone では日付の欄が中身の幅から縮まらず枠からはみ出すため、幅を枠に合わせる。index.css の .date-field も参照） */
const DATE_FIELD = `${FIELD} date-field`

/** 入力欄の見出し（文字は少し濃くして読みやすく） */
const LABEL = 'ud-label mb-1 block text-sm font-semibold text-stone-800'
/** 見出しの下の小見出し */
const SUBLABEL = 'ud-sublabel mb-1 block text-xs font-semibold text-stone-700'
/** 補足の説明文 */
const HINT = 'ud-hint mt-1 text-xs font-medium text-stone-700'

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
  const why = (key: string) => (
    <WhyHint text={t(`register.${key}`)} label={t('register.whyLabel')} buttonText={t('register.whyButton')} />
  )
  const important = <ImportantBadge text={t('register.important')} />
  const [docUploading, setDocUploading] = useState(0)
  const addDocPhotos = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    setDocUploading((n) => n + 1)
    try {
      const urls = await Promise.all(Array.from(files).map((f) => uploadMedicationPhoto(f)))
      onUpdatePet(pet.id, { documentPhotoUrls: [...pet.documentPhotoUrls, ...urls] })
    } finally {
      setDocUploading((n) => Math.max(0, n - 1))
    }
  }
  const isDogOrUnset = pet.speciesKind !== 'cat' && pet.speciesKind !== 'other'
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
          <span className={LABEL}>
            {t('register.labelPetName')}
          </span>
          <ImeAwareInput
            value={pet.petName}
            onValueChange={(v) => onUpdatePet(pet.id, { petName: v })}
            className="ud-field w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderPetName')}
          />
        </label>
        {/* ペットの写真(迷子時の特定用) */}
        <div className="mb-4">
          <span className={LABEL}>{t('register.petPhotoLabel')}</span>
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
              <span className="text-center text-sm font-medium text-stone-700">{t('register.petPhotoTap')}</span>
            </label>
          )}
          <p className={HINT}>{t('register.petPhotoHint')}</p>
        </div>
        <FoldSection title={t('register.petFeaturesLabel')} optional={true} filled={!!pet.features.trim()}>
        <label className="mb-4 block">
          <span className={LABEL}>{t('register.petFeaturesLabel')}</span>
          <ImeAwareTextarea
            value={pet.features}
            onValueChange={(v) => onUpdatePet(pet.id, { features: v })}
            rows={2}
            className="ud-field w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            placeholder={t('register.petFeaturesPlaceholder')}
          />
        </label>
        </FoldSection>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>
              {t('register.labelSpecies')}
            </span>
            <select
              value={pet.speciesKind}
              onChange={(e) =>
                onUpdatePet(pet.id, {
                  speciesKind: e.target.value as PetRow['speciesKind'],
                })
              }
              className="ud-field w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
            >
              <option value="">{t('register.selectPlaceholder')}</option>
              <option value="dog">{t('register.speciesDog')}</option>
              <option value="cat">{t('register.speciesCat')}</option>
              <option value="other">{t('register.speciesOther')}</option>
            </select>
          </label>
          {pet.speciesKind === 'other' && (
            <label className="block sm:col-span-2">
              <span className={LABEL}>
                {t('register.labelSpeciesOther')}
              </span>
              <ImeAwareInput
                value={pet.speciesOther}
                onValueChange={(v) => onUpdatePet(pet.id, { speciesOther: v })}
                className="ud-field w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
                placeholder={t('register.placeholderSpeciesOther')}
              />
            </label>
          )}
          <label className="block">
            <span className={LABEL}>
              {t('register.labelBreed')}
            </span>
            <ImeAwareInput
              value={pet.breed}
              onValueChange={(v) => onUpdatePet(pet.id, { breed: v })}
              className="ud-field w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderBreed')}
            />
          </label>
          <label className="block">
            <span className={LABEL}>
              {t('register.labelPetAge')}
            </span>
            <ImeAwareInput
              value={pet.age}
              onValueChange={(v) => onUpdatePet(pet.id, { age: v })}
              className="ud-field w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderPetAge')}
            />
          </label>
          {/* 性別・不妊去勢: 見出し1つに、性別と手術の有無のプルダウンを横並び（獣医師の助言: 雄も雌も「している／していない／分からない」） */}
          <FoldSection title={t('register.labelPetSex')} optional={false} filled={!!(pet.sex || pet.neuterStatus)} className="sm:col-span-2">
          <WhyGroup className="sm:col-span-2">
            <span className={LABEL}>
              {t('register.labelPetSex')}
              {why('whyNeuter')}
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
          </WhyGroup>
          </FoldSection>
        </div>
        {/* ── 避難所の受付で最初に見られる項目（獣医師の助言による並び）── */}
        <FoldSection title={t('register.labelRabies')} optional={false} important importantText={t('register.important')} filled={!!(pet.rabiesStatus || pet.rabiesDate)}>
        <WhyGroup important className="rounded-lg border-2 border-amber-300 bg-white/70 p-3">
          <span className={`${LABEL} mb-2`}>
            {t('register.labelRabies')}
            {important}
            {why('whyRabies')}
          </span>
          {pet.speciesKind === 'cat' || pet.speciesKind === 'other' ? (
            <p className="text-sm font-medium text-stone-700">{t('register.rabiesNotApplicable')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={SUBLABEL}>{t('register.labelStatus')}</span>
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
              <label className="block min-w-0">
                <span className={SUBLABEL}>{t('register.labelRabiesDate')}</span>
                <input
                  type="date"
                  aria-label={`${t('register.labelRabies')} ${t('register.labelRabiesDate')}`}
                  value={pet.rabiesDate}
                  max="9999-12-31"
                  onChange={(e) => onUpdatePet(pet.id, { rabiesDate: e.target.value })}
                  className={DATE_FIELD}
                />
              </label>
              {pet.rabiesStatus === 'exempt' && (
                <label className="block sm:col-span-2">
                  <span className={SUBLABEL}>{t('register.labelRabiesExemptReason')}</span>
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
        </WhyGroup>
        </FoldSection>
        <FoldSection title={t('register.labelVaccineInfo')} optional={false} important importantText={t('register.important')} filled={!!(pet.vaccineInfo.trim() || pet.vaccineDate)}>
        <WhyGroup important className="rounded-lg border-2 border-amber-300 bg-white/70 p-3">
          <span className={`${LABEL} mb-2`}>
            {t('register.labelVaccineInfo')}
            {important}
            {why('whyVaccine')}
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={SUBLABEL}>{t('register.labelVaccineContent')}</span>
              <ImeAwareInput
                aria-label={t('register.labelVaccineInfo')}
                value={pet.vaccineInfo}
                onValueChange={(v) => onUpdatePet(pet.id, { vaccineInfo: v })}
                className={FIELD}
                placeholder={t('register.placeholderVaccineInfo')}
              />
            </label>
            <label className="block min-w-0">
              <span className={SUBLABEL}>{t('register.labelVaccineDate')}</span>
              <input
                type="date"
                aria-label={`${t('register.labelVaccineInfo')} ${t('register.labelVaccineDate')}`}
                value={pet.vaccineDate}
                max="9999-12-31"
                onChange={(e) => onUpdatePet(pet.id, { vaccineDate: e.target.value })}
                className={DATE_FIELD}
              />
            </label>
          </div>
        </WhyGroup>
        </FoldSection>
        <FoldSection title={t('register.labelParasite')} optional={false} important importantText={t('register.important')} filled={!!(pet.parasiteStatus || pet.parasiteDate)}>
        <WhyGroup important className="rounded-lg border-2 border-amber-300 bg-white/70 p-3">
          <span className={`${LABEL} mb-2`}>
            {t('register.labelParasite')}
            {important}
            {why('whyParasite')}
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={SUBLABEL}>{t('register.labelStatus')}</span>
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
            <label className="block min-w-0">
              <span className={SUBLABEL}>{t('register.labelParasiteDate')}</span>
              <input
                type="date"
                aria-label={`${t('register.labelParasite')} ${t('register.labelParasiteDate')}`}
                value={pet.parasiteDate}
                max="9999-12-31"
                onChange={(e) => onUpdatePet(pet.id, { parasiteDate: e.target.value })}
                className={DATE_FIELD}
              />
            </label>
          </div>
        </WhyGroup>
        </FoldSection>
        {/* ── 持病・お薬・ごはん ── */}
        <FoldSection title={t('register.foldHealth')} optional={true} filled={!!(pet.medicalHistory.trim() || pet.medications.trim() || pet.allergies.trim() || pet.food.trim() || pet.medicationPhotoUrl)}>
        <label className="block">
          <span className={LABEL}>
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
          <span className={LABEL}>
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
          <span className={LABEL}>
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
            <span className="text-center text-sm font-medium text-stone-700">
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
          <span className={LABEL}>
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
          <span className={LABEL}>
            {t('register.labelPetFood')}
          </span>
          <ImeAwareInput
            value={pet.food}
            onValueChange={(v) => onUpdatePet(pet.id, { food: v })}
            className={FIELD}
            placeholder={t('register.placeholderPetFood')}
          />
          <p className={HINT}>{t('register.hintPetFood')}</p>
        </label>
        </FoldSection>
        {/* ── かかりつけ・担当医 ── */}
        <FoldSection title={t('register.labelVetClinic')} optional={true} filled={!!(pet.vetClinic.trim() || pet.vetClinicAddress.trim() || pet.vetDoctor.trim())}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 病院名と住所は並べて1組にする（同じ名前の病院が全国にあるため住所で見分ける。持田様のご依頼 11/18） */}
          <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2" data-vet-clinic-group>
            <label className="block min-w-0">
              <span className={LABEL}>
                {t('register.labelVetClinic')}
              </span>
              <ImeAwareInput
                value={pet.vetClinic}
                onValueChange={(v) => onUpdatePet(pet.id, { vetClinic: v })}
                className={FIELD}
                placeholder={t('register.placeholderVetClinic')}
              />
            </label>
            <label className="block min-w-0">
              <span className={LABEL}>
                {t('register.labelVetClinicAddress')}
              </span>
              <ImeAwareInput
                aria-label={t('register.labelVetClinicAddress')}
                value={pet.vetClinicAddress}
                onValueChange={(v) => onUpdatePet(pet.id, { vetClinicAddress: v })}
                className={FIELD}
                placeholder={t('register.placeholderVetClinicAddress')}
              />
            </label>
          </div>
          <WhyGroup>
            <label className="block">
              <span className={LABEL}>
                {t('register.labelVetDoctor')}
                {why('whyVetDoctor')}
              </span>
              <ImeAwareInput
                value={pet.vetDoctor}
                onValueChange={(v) => onUpdatePet(pet.id, { vetDoctor: v })}
                className={FIELD}
                placeholder={t('register.placeholderVetDoctor')}
              />
            </label>
          </WhyGroup>
        </div>
        </FoldSection>
        {/* ── マイクロチップ（装着 → 登録先 → 番号）── */}
        <FoldSection title={t('register.labelMicrochipGroup')} optional={false} filled={!!(pet.microchipFitted || pet.microchip.trim())}>
        <WhyGroup className="rounded-lg border border-amber-200 bg-white/60 p-3">
          <span className={`${LABEL} mb-2`}>
            {t('register.labelMicrochipGroup')}
            {why('whyMicrochip')}
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={SUBLABEL}>{t('register.labelMicrochipFitted')}</span>
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
                  <span className={SUBLABEL}>{t('register.labelMicrochipRegistry')}</span>
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
                    <span className={SUBLABEL}>{t('register.labelMicrochipRegistryOther')}</span>
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
                  <span className={SUBLABEL}>{t('register.labelMicrochip')}</span>
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
        </WhyGroup>
        </FoldSection>
        {/* ── 鑑札番号（犬だけ。持っていなければ空欄のままでよい）── */}
        {isDogOrUnset && (
          <FoldSection title={t('register.labelLicenseNumber')} optional={false} filled={!!pet.licenseNumber.trim()}>
          <label className="block rounded-lg border border-amber-200 bg-white/60 p-3">
            <span className={LABEL}>{t('register.labelLicenseNumber')}</span>
            <ImeAwareInput
              aria-label={t('register.labelLicenseNumber')}
              value={pet.licenseNumber}
              onValueChange={(v) => onUpdatePet(pet.id, { licenseNumber: v })}
              className={FIELD}
              placeholder={t('register.placeholderLicenseNumber')}
            />
            <p className={HINT}>
              {t('register.hintLicenseNumber')}
              {/* 「持っていなければ空欄のままで大丈夫」は、迷わないよう濃く太く（近藤さんの要望 11/17） */}
              <span className="mt-0.5 block font-bold text-stone-900" data-license-blank-ok>
                {t('register.hintLicenseBlank')}
              </span>
            </p>
          </label>
          </FoldSection>
        )}
        {/* ── 書類の写真（ワクチン証明書・血液検査・マイクロチップ登録証など）── */}
        <FoldSection title={t('register.labelDocPhotos')} optional={true} filled={pet.documentPhotoUrls.length > 0}>
        <div className="rounded-lg border border-amber-200 bg-white/60 p-3">
          <span className={LABEL}>{t('register.labelDocPhotos')}</span>
          <p className={`${HINT} mb-2`}>{t('register.hintDocPhotos')}</p>
          {pet.documentPhotoUrls.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-2" data-doc-photos>
              {pet.documentPhotoUrls.map((src, i) => (
                <div key={src + i} className="relative">
                  <img src={getLocalPreview(src) ?? src} alt={t('register.labelDocPhotos')} className="h-24 w-full rounded-lg border border-stone-300 object-cover" />
                  <button
                    style={{ color: '#ffffff' }}
                    type="button"
                    aria-label={t('register.deletePhoto')}
                    onClick={() =>
                      onUpdatePet(pet.id, { documentPhotoUrls: pet.documentPhotoUrls.filter((_, j) => j !== i) })
                    }
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-base font-bold text-white shadow-md"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-white px-4 py-4">
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              data-doc-input
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : []
                e.currentTarget.value = ''
                void addDocPhotos(files)
              }}
            />
            <span className="text-center text-sm font-medium text-stone-700">
              {docUploading > 0 ? t('register.photoUploading') : t('register.tapToAddDocPhotos')}
            </span>
          </label>
        </div>
        </FoldSection>
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
  /** 「わたしとペット」で登録するとき: ペット欄が最初のページになり、オン・オフの切り替えは出さない */
  petMode?: boolean
  /** ページの上に出すエラー（「わたしとペット」のときに使う） */
  error?: string | null
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
  petMode = false,
  error = null,
}: StepPetSectionProps) {
  // 削除は確認ダイアログを挟む（押し間違いでペット情報を失わないため）
  const [pendingDelete, setPendingDelete] = useState<PetRow | null>(null)
  // 重要ラベル・文字と色・画面の長さの形（登録画面と編集画面の両方で同じ見た目にする）
  const compare = useCompare()

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
      data-imp={compare.imp}
      data-ud={compare.ud}
      data-fold={compare.fold}
      className="mb-8 mt-8 rounded-2xl border-2 border-brand bg-amber-100/50 p-5 sm:p-6"
    >
      <div className="mb-4 rounded-xl bg-amber-100/80 px-4 py-3 ring-1 ring-amber-200/70">
        <h2 id="step-pet-title" className="text-lg font-bold text-amber-900">
          <span aria-hidden="true">🐾</span> {petMode ? t('register.petModeTitle') : t('register.petsSectionTitle')}
        </h2>
        <p className="mt-1 text-sm font-medium text-amber-900">
          {petMode ? t('register.petModeSubtitle') : t('register.petsSectionSubtitle')}
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      )}

      {!petMode && (
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
      )}

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

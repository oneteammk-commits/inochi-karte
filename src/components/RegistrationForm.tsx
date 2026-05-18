import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import {
ALLERGY_TAGS,  CHRONIC_TAGS,
  FACILITY_TYPES,
  PREFECTURES,
  STEP_LABELS,
} from '../data/registrationConstants'
import { persistRegistration } from '../lib/persistRegistration'
import { saveMyCardId } from '../lib/storage'
import type { MedicationRow, RegistrationFormState } from '../types/registration'

export type { MedicationRow, RegistrationFormState }

function createEmptyMedicationRow(): MedicationRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    photoPreviews: [],
  }
}

const initialForm: RegistrationFormState = {
  fullName: '',
  furigana: '',
  birthDate: '',
  emergencyContactName: '',
  emergencyContactFurigana: '',
  emergencyContactPhone: '',
  prefecture: '',
  city: '',
  postalCode: '',
  facilityName: '',
  facilityType: '',
  allergyTags: [],
  chronicTags: [],
  allergyOther: '',
  chronicOther: '',
  dailyNotes: '',
  medications: [createEmptyMedicationRow()],
  editPassword: '',
}

function toggleInList(list: string[], value: string): string[] {
  if (list.includes(value)) {
    return list.filter((v) => v !== value)
  }
  return [...list, value]
}

function validateRegistrationStep(s: number, data: RegistrationFormState, t: (key: string) => string): string | null {
  switch (s) {
    case 0: {
      if (!data.fullName.trim()) return t('register.errorName')
      if (!data.birthDate) return t('register.errorBirthDate')
      if (!data.emergencyContactName.trim()) return t('register.errorEmergencyName')
      if (!data.emergencyContactPhone.trim()) return t('register.errorEmergencyPhone')
      return null
    }
    case 1: {
      if (!data.prefecture) return t('register.errorPrefecture')
      if (!data.city.trim()) return t('register.errorCity')
      if (!data.facilityType) return t('register.errorFacilityType')
      return null
    }
    case 2:
      return null
    case 3:
      return null
    case 4: {
      if (!data.editPassword) return t('register.errorPassword')
      if (!/^\d{4}$/.test(data.editPassword)) return t('register.errorPasswordFormat')
      return null
    }
    default:
      return null
  }
}type WizardState = {
  step: number
  registrationId: string | null
}

export function RegistrationForm() {
  const { t } = useTranslation()
  const [wizard, setWizard] = useState<WizardState>({ step: 0, registrationId: null })
  const [form, setForm] = useState<RegistrationFormState>(initialForm)
  const [stepError, setStepError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLockRef = useRef(false)
  const formRef = useRef(form)
  formRef.current = form
  const wizardRef = useRef(wizard)
  wizardRef.current = wizard

  const activeStep = wizard.step
  const registrationId = wizard.registrationId

  const qrPayload = useMemo(() => {
    if (!registrationId) return ''
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'https://inochi-karte.app'
    return `${base}/card/${registrationId}`
  }, [registrationId])

  const updateForm = useCallback((patch: Partial<RegistrationFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const goNext = async () => {
    if (submitLockRef.current) return
    const currentStep = wizardRef.current.step
    const data = formRef.current
    const err = validateRegistrationStep(currentStep, data, t)
    setStepError(err)
    if (err) return
    setStepError(null)

    if (currentStep === 4) {
      submitLockRef.current = true
      setIsSubmitting(true)
      try {
        const savedId = await persistRegistration(data)
        saveMyCardId(savedId)
        setWizard((w) => ({
          step: Math.min(w.step + 1, STEP_LABELS.length - 1),
          registrationId: savedId,
        }))
      } catch (e) {
        setStepError(e instanceof Error ? e.message : '登録に失敗しました。')
      } finally {
        submitLockRef.current = false
        setIsSubmitting(false)
      }
      return
    }

    setWizard((w) => {
      const maxIdx = STEP_LABELS.length - 1
      const nextStep = Math.min(w.step + 1, maxIdx)
      return { step: nextStep, registrationId: w.registrationId }
    })
  }

  const goBack = () => {
    setStepError(null)
    setWizard((w) => ({ ...w, step: Math.max(w.step - 1, 0) }))
  }

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (activeStep >= 5 || isSubmitting) return
    void goNext()
  }

  const addMedicationRow = () => {
    setForm((prev) => ({
      ...prev,
      medications: [...prev.medications, createEmptyMedicationRow()],
    }))
  }

  const removeMedicationRow = (id: string) => {
    setForm((prev) => {
      const next = prev.medications.filter((m) => m.id !== id)
      return {
        ...prev,
        medications: next.length ? next : [createEmptyMedicationRow()],
      }
    })
  }

  const updateMedication = (id: string, patch: Partial<Omit<MedicationRow, 'id'>>) => {
    setForm((prev) => ({
      ...prev,
      medications: prev.medications.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }

  const updateMedicationPhotos = async (id: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => reject(new Error('画像の読み込みに失敗しました。'))
        reader.readAsDataURL(file)
      })

    try {
      const encoded = (await Promise.all(Array.from(files).map((f) => toBase64(f)))).filter(
        Boolean,
      )
      setForm((prev) => ({
        ...prev,
        medications: prev.medications.map((m) =>
          m.id === id ? { ...m, photoPreviews: [...m.photoPreviews, ...encoded] } : m,
        ),
      }))
    } catch {
      setStepError('画像の読み込みに失敗しました。別の画像でお試しください。')
    }
  }

  const removeMedicationPhoto = (id: string, index: number) => {
    setForm((prev) => ({
      ...prev,
      medications: prev.medications.map((m) =>
        m.id === id
          ? { ...m, photoPreviews: m.photoPreviews.filter((_, i) => i !== index) }
          : m,
      ),
    }))
  }

  return (
    <div className="min-h-screen bg-stone-100 pb-16 pt-6 sm:pt-10">
      <div className="mx-auto max-w-lg px-4">
      <header className="mb-8 text-center">
          <p className="text-sm font-medium tracking-wide text-brand">{t('register.headerLabel')}</p>
          <div className="mt-1 flex items-center justify-center gap-3">
            <img src="/icon-192x192.png" alt="命のカルテ" className="w-12 h-12 rounded-2xl shadow-md" />
            <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">{t('register.title')}</h1>
          </div>
            <p className="mt-3 text-sm text-stone-600 leading-relaxed">
              {t('register.subtitle1')}<br />
              {t('register.subtitle2')}
            </p>
                      </header>

        <StepIndicator current={activeStep} labels={[t('register.step1'), t('register.step2'), t('register.step3'), t('register.step4'), t('register.step5'), t('register.step6')]} />

        <form onSubmit={handleFormSubmit} noValidate className="block">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-8">
            {activeStep === 0 && (
<StepBasic form={form} onChange={updateForm} error={stepError} t={t} />            )}
            {activeStep === 1 && (
<StepRegion form={form} onChange={updateForm} error={stepError} t={t} />            )}
            {activeStep === 2 && (
<StepMedicalTags form={form} onChange={updateForm} error={stepError} t={t} />            )}
           {activeStep === 3 && (
  <StepMedications
    form={form}
    onAddRow={addMedicationRow}
    onRemoveRow={removeMedicationRow}
    onUpdateMedication={updateMedication}
    onAddPhotos={updateMedicationPhotos}
    onRemovePhoto={removeMedicationPhoto}
error={stepError}
    t={t}  />
)}
{activeStep === 4 && (
<StepEditPassword form={form} onChange={updateForm} error={stepError} t={t} />)}
{activeStep === 5 && registrationId && (
  <StepComplete registrationId={registrationId} qrValue={qrPayload} t={t} />
)}
          </div>

          {activeStep < 5 && (
            <nav className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={activeStep === 0 || isSubmitting}
                className="flex-1 rounded-xl border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('register.buttonBack')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? t('register.saving')
                  : activeStep === 4
                    ? t('register.buttonRegister')
                    : t('register.buttonNext')}
              </button>
            </nav>
          )}
        </form>
      </div>
    </div>
  )
}

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="mb-8 flex justify-between gap-1 text-[10px] font-medium text-stone-500 sm:text-xs">
      {labels.map((label, i) => {
        const active = i === current
        const done = i < current
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-9 sm:w-9 ${
                active
                  ? 'bg-brand text-white shadow-md shadow-brand/30'
                  : done
                    ? 'bg-brand-muted text-brand'
                    : 'bg-stone-200 text-stone-500'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={`line-clamp-2 text-center leading-tight ${active ? 'text-brand font-semibold' : ''}`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
      {message}
    </p>
  )
}

export function StepBasic({
  form,
  onChange,
  error,
  t,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
  t: (key: string) => string
}) {
  return (
    <section aria-labelledby="step-basic-title">
      <h2 id="step-basic-title" className="mb-6 text-lg font-bold text-stone-900">
        {t('register.basicTitle')}
      </h2>
      <FieldError message={error} />
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelName')}</span>
          <input
            type="text"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderName')}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelFurigana')}</span>
          <input
            type="text"
            value={form.furigana}
            onChange={(e) => onChange({ furigana: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderFurigana')}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelBirthDate')}</span>
         <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="mb-1 block text-xs font-medium text-stone-500">{t('register.unitYear')}</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder={t('register.placeholderYear')}
                value={form.birthDate.split('年')[0] ?? ''}
                onChange={(e) => {
                  const y = e.target.value
                  const rest = form.birthDate.includes('年') ? form.birthDate.split('年')[1] : '月日'
                  onChange({ birthDate: `${y}年${rest}` })
                }}
                className="w-full rounded-xl border border-stone-300 px-3 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-stone-500">{t('register.unitMonth')}</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder={t('register.placeholderMonth')}
                value={form.birthDate.includes('年') ? (form.birthDate.split('年')[1]?.split('月')[0] ?? '') : ''}
                onChange={(e) => {
                  const m = e.target.value
                  const y = form.birthDate.split('年')[0] ?? ''
                  const d = form.birthDate.includes('月') ? (form.birthDate.split('月')[1]?.replace('日','') ?? '') : ''
                  onChange({ birthDate: `${y}年${m}月${d}日` })
                }}
                className="w-full rounded-xl border border-stone-300 px-3 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-stone-500">{t('register.unitDay')}</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder={t('register.placeholderDay')}
                value={form.birthDate.includes('月') ? (form.birthDate.split('月')[1]?.replace('日','') ?? '') : ''}
                onChange={(e) => {
                  const d = e.target.value
                  const y = form.birthDate.split('年')[0] ?? ''
                  const m = form.birthDate.includes('年') ? (form.birthDate.split('年')[1]?.split('月')[0] ?? '') : ''
                  onChange({ birthDate: `${y}年${m}月${d}日` })
                }}
                className="w-full rounded-xl border border-stone-300 px-3 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              />
            </div>
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelEmergencyName')}</span>
          <input
            type="text"
            value={form.emergencyContactName}
            onChange={(e) => onChange({ emergencyContactName: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderEmergencyName')}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelEmergencyFurigana')}</span>
          <input
            type="text"
            value={form.emergencyContactFurigana}
            onChange={(e) => onChange({ emergencyContactFurigana: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderEmergencyFurigana')}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelEmergencyPhone')}</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.emergencyContactPhone}
            onChange={(e) => onChange({ emergencyContactPhone: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderEmergencyPhone')}
          />
        </label>
      </div>
    </section>
  )
}
export function StepRegion({
  form,
  onChange,
  error,
  t,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
  t: (key: string) => string
}) {
  return (
    <section aria-labelledby="step-region-title">
      <h2 id="step-region-title" className="mb-6 text-lg font-bold text-stone-900">
        {t('register.regionTitle')}
      </h2>
      <FieldError message={error} />
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelPostalCode')}</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder={t('register.placeholderPostalCode')}
            value={form.postalCode ?? ''}
            onChange={(e) => onChange({ postalCode: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelPrefecture')}</span>
          <select
            value={form.prefecture}
            onChange={(e) => onChange({ prefecture: e.target.value })}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          >
            <option value="">{t('register.selectPlaceholder')}</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
{t(`prefectures.${p}`)}              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelCity')}</span>
          <input
            type="text"
            value={form.city}
            onChange={(e) => onChange({ city: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderCity')}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            {t('register.labelFacilityName')}<span className="ml-1.5 font-normal text-stone-500">{t('register.optional')}</span>
          </span>
          <input
            type="text"
            value={form.facilityName}
            onChange={(e) => onChange({ facilityName: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderFacilityName')}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelFacilityType')}</span>
          <select
            value={form.facilityType}
            onChange={(e) => onChange({ facilityType: e.target.value })}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          >
            <option value="">{t('register.selectPlaceholder')}</option>
            {FACILITY_TYPES.map((type) => (
              <option key={type} value={type}>
{t(`facilityTypes.${type}`)}              </option>
            ))}
          </select>
        </label>
        {form.facilityType.includes('その他') && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('register.labelOtherFacility')}</span>
            <input
              type="text"
              value={form.facilityName}
              onChange={(e) => onChange({ facilityName: e.target.value })}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderOtherFacility')}
            />
          </label>
        )}
      </div>
    </section>
  )
}function TagGrid({
  title,
  tags,
  selected,
onToggle,
  t,
  tKey,}: {
  title: string
  tags: readonly string[]
  selected: string[]
onToggle: (tag: string) => void
  t: (key: string) => string
  tKey: string}) {
  return (
    <div>
    <p className="mb-2 text-lg font-bold text-stone-700">{title}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const on = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? 'border-brand bg-brand-muted text-brand ring-1 ring-brand/30'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'
              }`}
            >
{t(`${tKey}.${tag}`)}            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StepMedicalTags({
  form,
  onChange,
  error,
  t,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
  t: (key: string) => string
}) {
  return (
    <section aria-labelledby="step-tags-title">
      <h2 id="step-tags-title" className="mb-2 text-lg font-bold text-stone-900">
        {t('register.medicalTagsTitle')}
      </h2>
      <p className="mb-6 text-sm text-stone-600">
        {t('register.medicalTagsSubtitle')}
      </p>
      <FieldError message={error} />
      <div className="space-y-8">
        <div>
          <TagGrid
            title={t('register.tagsAllergyTitle')}
            tags={ALLERGY_TAGS}
            selected={form.allergyTags}
onToggle={(tag) => onChange({ allergyTags: toggleInList(form.allergyTags, tag) })}
            t={t}
            tKey="allergyTags"          />
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              {t('register.labelOtherFreeInput')}
            </span>
            <textarea
              value={form.allergyOther}
              onChange={(e) => onChange({ allergyOther: e.target.value })}
              rows={3}
              className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderAllergyOther')}
            />
          </label>
        </div>
        <div>
          <TagGrid
            title={t('register.tagsChronicTitle')}
            tags={CHRONIC_TAGS}
            selected={form.chronicTags}
onToggle={(tag) => onChange({ chronicTags: toggleInList(form.chronicTags, tag) })}
            t={t}
            tKey="chronicTags"          />
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              {t('register.labelOtherFreeInput')}
            </span>
            <textarea
              value={form.chronicOther}
              onChange={(e) => onChange({ chronicOther: e.target.value })}
              rows={3}
              className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              placeholder={t('register.placeholderChronicOther')}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            {t('register.labelDailyNotes')}
          </span>
          <textarea
            value={form.dailyNotes}
            onChange={(e) => onChange({ dailyNotes: e.target.value })}
            rows={4}
            className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder={t('register.placeholderDailyNotes')}
          />
        </label>
      </div>
    </section>
  )
  }
export function StepMedications({
  form,
  onAddRow,
  onRemoveRow,
  onUpdateMedication,
  onAddPhotos,
  onRemovePhoto,
  error,
  t,
}: {
  form: RegistrationFormState
  onAddRow: () => void
  onRemoveRow: (id: string) => void
  onUpdateMedication: (id: string, patch: Partial<Omit<MedicationRow, 'id'>>) => void
  onAddPhotos: (id: string, files: FileList | null) => Promise<void>
  onRemovePhoto: (id: string, index: number) => void
  error: string | null
  t: (key: string, options?: { num?: number }) => string
}) {
  return (
    <section aria-labelledby="step-med-title">
      <h2 id="step-med-title" className="mb-2 text-lg font-bold text-stone-900">
        {t('register.medicationsTitle')}
      </h2>
      <p className="mb-6 text-sm text-stone-600">
        {t('register.medicationsSubtitle')}
      </p>
      <FieldError message={error} />

      <div className="space-y-6">
        {form.medications.map((med, index) => (
          <div
            key={med.id}
            className="rounded-xl border border-stone-200 bg-stone-50/80 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-800">
                {t('register.medicineLabel', { num: index + 1 })}
                <span className="ml-1.5 font-normal text-stone-500">{t('register.optional')}</span>
              </span>
              {form.medications.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveRow(med.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  {t('register.buttonDeleteRow')}
                </button>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-600">
                {t('register.labelMedicineName')}<span className="font-normal text-stone-500">{t('register.optional')}</span>
              </span>
              <input
                type="text"
                value={med.name}
                onChange={(e) => onUpdateMedication(med.id, { name: e.target.value })}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
                placeholder={t('register.placeholderMedicineName')}
              />
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                {t('register.medicineNote')}
              </p>
            </label>
            <div className="mt-4">
              <span className="mb-1 block text-xs font-medium text-stone-600">
                {t('register.labelMedicinePhotos')}<span className="font-normal text-stone-500">{t('register.optionalMultiple')}</span>
              </span>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white px-4 py-5 transition hover:border-brand/50 hover:bg-brand-50/20">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    void onAddPhotos(med.id, e.target.files)
                    e.currentTarget.value = ''
                  }}
                />
                <span className="text-center text-sm text-stone-500">
                  {t('register.tapToSelectImage')}
                </span>
              </label>
              
              {med.photoPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {med.photoPreviews.map((src, idx) => (
                    <div key={`${med.id}-img-${idx}`} className="relative">
                      <img
                        src={src}
                        alt={t('register.altMedicineImage', { num: idx + 1 })}
                        className="h-24 w-full rounded-md border border-stone-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onRemovePhoto(med.id, idx)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddRow}
          className="w-full rounded-xl border-2 border-dashed border-stone-300 py-3 text-sm font-semibold text-brand transition hover:border-brand hover:bg-brand-50"
        >
          {t('register.buttonAddMedicine')}
        </button>
      </div>
    </section>
  )
}

function StepEditPassword({
  form,
  onChange,
  error,
  t,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
  t: (key: string) => string
}) {
  return (
    <section aria-labelledby="step-edit-password-title">
      <h2 id="step-edit-password-title" className="mb-6 text-lg font-bold text-stone-900">
        {t('register.editPasswordTitle')}
      </h2>
      <FieldError message={error} />
      <div className="space-y-5">
        <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
          <p className="mb-2 font-semibold text-stone-900">
            {t('register.editPasswordDescription')}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('register.editPasswordRule1')}</li>
            <li>{t('register.editPasswordRule2')}</li>
            <li>{t('register.editPasswordRule3')}</li>
          </ul>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            {t('register.editPasswordLabel')}
          </span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={form.editPassword}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '')
              onChange({ editPassword: value })
            }}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-2xl tracking-[0.5em] text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder="••••"
          />
        </label>
      </div>
    </section>
  )
}function StepComplete({
  registrationId,
  qrValue,
  t,
}: {
  registrationId: string
  qrValue: string
  t: (key: string) => string
}) {
  const viewUrl = "/card/" + registrationId
  return (
  <section className="text-center" aria-labelledby="step-done-title">
      <div className="mb-4 flex items-center justify-center gap-3">
        <img src="/icon-192x192.png" alt="命のカルテ" className="w-12 h-12 rounded-2xl shadow-md" />
        <h2 id="step-done-title" className="text-xl font-bold text-black">
          {t('register.doneTitle')}
        </h2>
      </div>
      <p className="mb-8 text-base leading-relaxed text-black">
        {t('register.doneMessage')}
      </p>
      <div className="mx-auto mb-6 flex justify-center rounded-2xl border border-stone-200 bg-white p-6 shadow-inner">
        <QRCodeSVG
          value={qrValue}
          size={200}
          level="M"
          includeMargin
          fgColor="#C0392B"
          bgColor="#ffffff"
        />
      </div>
      <p className="mb-1 text-sm font-medium tracking-wide text-stone-600">
        {t('register.registrationId')}
      </p>
      <p className="mb-8 font-mono text-sm text-black break-all">{registrationId}</p>
      <a href={viewUrl} className="block w-full bg-red-700 hover:bg-red-800 text-white text-center py-5 rounded-2xl text-lg font-bold shadow-md mb-3">{t('register.buttonViewCard')}</a>
      <a href="/" className="block w-full bg-white border-2 border-stone-400 hover:bg-stone-50 text-black text-center py-4 rounded-2xl text-base font-bold">{t('register.buttonHome')}</a>
    </section>
  )
}

import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ALLERGY_TAGS,
  CHRONIC_TAGS,
  FACILITY_TYPES,
  PREFECTURES,
  STEP_LABELS,
} from '../data/registrationConstants'
import { persistRegistration } from '../lib/persistRegistration'
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

function validateRegistrationStep(s: number, data: RegistrationFormState): string | null {
  switch (s) {
    case 0: {
      if (!data.fullName.trim()) return 'お名前を入力してください。'
      if (!data.birthDate) return '生年月日を選択してください。'
      if (!data.emergencyContactName.trim()) return '緊急連絡先のお名前を入力してください。'
      if (!data.emergencyContactPhone.trim()) return '緊急連絡先の電話番号を入力してください。'
      return null
    }
    case 1: {
      if (!data.prefecture) return '都道府県を選択してください。'
      if (!data.city.trim()) return '住所を入力してください。'
      if (!data.facilityType) return '居住種別を選択してください。'
      return null
    }
    case 2:
      return null
    case 3:
      return null
      case 4: {
        if (!data.editPassword) return '編集用パスワードを入力してください。'
        if (!/^\d{4}$/.test(data.editPassword)) return '編集用パスワードは数字4桁で入力してください。'
        return null
      }
    default:
      return null
  }
}

type WizardState = {
  step: number
  registrationId: string | null
}

export function RegistrationForm() {
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
    const err = validateRegistrationStep(currentStep, data)
    setStepError(err)
    if (err) return
    setStepError(null)

    if (currentStep === 4) {
      submitLockRef.current = true
      setIsSubmitting(true)
      try {
        const savedId = await persistRegistration(data)
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
          <p className="text-sm font-medium tracking-wide text-brand">健康情報登録</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            命のカルテ
          </h1>
            <p className="mt-3 text-sm text-stone-600 leading-relaxed">
              これは命を守る情報を医療従事者に伝えるアプリです。<br />
              情報はご自身のスマートフォンにだけに、登録されます。
            </p>
          </header>

        <StepIndicator current={activeStep} />

        <form onSubmit={handleFormSubmit} noValidate className="block">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-8">
            {activeStep === 0 && (
              <StepBasic form={form} onChange={updateForm} error={stepError} />
            )}
            {activeStep === 1 && (
              <StepRegion form={form} onChange={updateForm} error={stepError} />
            )}
            {activeStep === 2 && (
              <StepMedicalTags form={form} onChange={updateForm} error={stepError} />
            )}
           {activeStep === 3 && (
  <StepMedications
    form={form}
    onAddRow={addMedicationRow}
    onRemoveRow={removeMedicationRow}
    onUpdateMedication={updateMedication}
    onAddPhotos={updateMedicationPhotos}
    onRemovePhoto={removeMedicationPhoto}
    error={stepError}
  />
)}
{activeStep === 4 && (
  <StepEditPassword form={form} onChange={updateForm} error={stepError} />
)}
{activeStep === 5 && registrationId && (
  <StepComplete registrationId={registrationId} qrValue={qrPayload} />
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
                戻る
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? '登録中…'
                  : activeStep === 3
                    ? '登録して完了へ'
                    : '次へ'}
              </button>
            </nav>
          )}
        </form>
      </div>
    </div>
  )
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex justify-between gap-1 text-[10px] font-medium text-stone-500 sm:text-xs">
      {STEP_LABELS.map((label, i) => {
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

function StepBasic({
  form,
  onChange,
  error,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
}) {
  return (
    <section aria-labelledby="step-basic-title">
      <h2 id="step-basic-title" className="mb-6 text-lg font-bold text-stone-900">
        基本情報
      </h2>
      <FieldError message={error} />
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">お名前（フルネーム）</span>
          <input
            type="text"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder="山田 太郎"
          />
       <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">フリガナ</span>
            <input
              type="text"
              value={form.furigana}
              onChange={(e) => onChange({ furigana: e.target.value })}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              placeholder="ヤマダ タロウ"
            />
          </label>
          <span className="mb-1.5 block text-sm font-medium text-stone-700">生年月日</span><div className="flex gap-2 items-center">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="1970"
                value={form.birthDate.split('年')[0] ?? ''}
                onChange={(e) => {
                  const y = e.target.value
                  const rest = form.birthDate.includes('年') ? form.birthDate.split('年')[1] : '月日'
                  onChange({ birthDate: `${y}年${rest}` })
                }}
                className="w-24 rounded-xl border border-stone-300 px-3 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              />
              <span>年</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="1"
                value={form.birthDate.includes('年') ? (form.birthDate.split('年')[1]?.split('月')[0] ?? '') : ''}
                onChange={(e) => {
                  const m = e.target.value
                  const y = form.birthDate.split('年')[0] ?? ''
                  const d = form.birthDate.includes('月') ? (form.birthDate.split('月')[1]?.replace('日','') ?? '') : ''
                  onChange({ birthDate: `${y}年${m}月${d}日` })
                }}
                className="w-16 rounded-xl border border-stone-300 px-3 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              />
              <span>月</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="1"
                value={form.birthDate.includes('月') ? (form.birthDate.split('月')[1]?.replace('日','') ?? '') : ''}
                onChange={(e) => {
                  const d = e.target.value
                  const y = form.birthDate.split('年')[0] ?? ''
                  const m = form.birthDate.includes('年') ? (form.birthDate.split('年')[1]?.split('月')[0] ?? '') : ''
                  onChange({ birthDate: `${y}年${m}月${d}日` })
                }}
                className="w-16 rounded-xl border border-stone-300 px-3 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              />
              <span>日</span>
            </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            緊急連絡先のお名前
          </span>
          <input
            type="text"
            value={form.emergencyContactName}
            onChange={(e) => onChange({ emergencyContactName: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
           placeholder="山田 花子（続柄：配偶者）"
            />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">緊急連絡先のフリガナ</span>
          <input
            type="text"
            value={form.emergencyContactFurigana}
            onChange={(e) => onChange({ emergencyContactFurigana: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder="ヤマダ ハナコ"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">緊急連絡先の電話番号</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.emergencyContactPhone}
            onChange={(e) => onChange({ emergencyContactPhone: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder="090-1234-5678"
          />
        </label>
      </div>
    </section>
  )
}

function StepRegion({
  form,
  onChange,
  error,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
}) {
  return (
    <section aria-labelledby="step-region-title">
      <h2 id="step-region-title" className="mb-6 text-lg font-bold text-stone-900">
        現在お住まいのお家・施設などの情報
      </h2>
      <FieldError message={error} />
      <div className="space-y-5">
       <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">郵便番号</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="例：123-4567"
            value={form.postalCode ?? ''}
            onChange={(e) => onChange({ postalCode: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          />
        </label> <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">都道府県</span>
          <select
            value={form.prefecture}
            onChange={(e) => onChange({ prefecture: e.target.value })}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">住所</span>
          <input
            type="text"
            value={form.city}
            onChange={(e) => onChange({ city: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder="〇〇市△△区"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            施設名<span className="ml-1.5 font-normal text-stone-500">（任意）</span>
          </span>
          <input
            type="text"
            value={form.facilityName}
            onChange={(e) => onChange({ facilityName: e.target.value })}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder="未入力のまま次へ進めます"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">居住種別</span>
          <select
            value={form.facilityType}
            onChange={(e) => onChange({ facilityType: e.target.value })}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
          >
            <option value="">選択してください</option>
            {FACILITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
         </select>
        </label>
        {form.facilityType.includes('その他') && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">その他の情報を入力してください</span>
            <input
              type="text"
              value={form.facilityName}
              onChange={(e) => onChange({ facilityName: e.target.value })}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              placeholder="例：自宅、グループホームなど"
            />
          </label>
        )}
      </div>
    </section>
  )
}

function TagGrid({
  title,
  tags,
  selected,
  onToggle,
}: {
  title: string
  tags: readonly string[]
  selected: string[]
  onToggle: (tag: string) => void
}) {
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
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepMedicalTags({
  form,
  onChange,
  error,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
}) {
  return (
    <section aria-labelledby="step-tags-title">
      <h2 id="step-tags-title" className="mb-2 text-lg font-bold text-stone-900">
        アレルギー・持病
      </h2>
      <p className="mb-6 text-sm text-stone-600">
        該当するものをタップして選択してください。自由記入欄に補足を書けます。
      </p>
      <FieldError message={error} />
      <div className="space-y-8">
        <div>
          <TagGrid
            title="アレルギー"
            tags={ALLERGY_TAGS}
            selected={form.allergyTags}
            onToggle={(tag) => onChange({ allergyTags: toggleInList(form.allergyTags, tag) })}
          />
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              その他（自由記入）
            </span>
            <textarea
              value={form.allergyOther}
              onChange={(e) => onChange({ allergyOther: e.target.value })}
              rows={3}
              className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              placeholder="タグにない内容や、検査結果・禁忌の補足など"
            />
          </label>
        </div>
        <div>
          <TagGrid
            title="持病・既往歴"
            tags={CHRONIC_TAGS}
            selected={form.chronicTags}
            onToggle={(tag) => onChange({ chronicTags: toggleInList(form.chronicTags, tag) })}
          />
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              その他（自由記入）
            </span>
            <textarea
              value={form.chronicOther}
              onChange={(e) => onChange({ chronicOther: e.target.value })}
              rows={3}
              className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
              placeholder="タグにない病名や、治療状況の補足など"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            日常生活で伝えておきたいこと
          </span>
          <textarea
            value={form.dailyNotes}
            onChange={(e) => onChange({ dailyNotes: e.target.value })}
            rows={4}
            className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
            placeholder="嚥下に注意、車椅子利用、コミュニケーションの工夫など"
          />
        </label>
      </div>
    </section>
  )
}

function StepMedications({
  form,
  onAddRow,
  onRemoveRow,
  onUpdateMedication,
  onAddPhotos,
  onRemovePhoto,
  error,
}: {
  form: RegistrationFormState
  onAddRow: () => void
  onRemoveRow: (id: string) => void
  onUpdateMedication: (id: string, patch: Partial<Omit<MedicationRow, 'id'>>) => void
  onAddPhotos: (id: string, files: FileList | null) => Promise<void>
  onRemovePhoto: (id: string, index: number) => void
  error: string | null
}) {
  return (
    <section aria-labelledby="step-med-title">
      <h2 id="step-med-title" className="mb-2 text-lg font-bold text-stone-900">
        投薬情報
      </h2>
      <p className="mb-6 text-sm text-stone-600">
        お薬の名前や画像を入れたり、お薬手帳などのページを撮影して画像登録ができます。
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
                お薬 {index + 1}
                <span className="ml-1.5 font-normal text-stone-500">（任意）</span>
              </span>
              {form.medications.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveRow(med.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  この行を削除
                </button>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-600">
                薬品名・用量メモ<span className="font-normal text-stone-500">（任意）</span>
              </span>
              <input
                type="text"
                value={med.name}
                onChange={(e) => onUpdateMedication(med.id, { name: e.target.value })}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
                placeholder="例：アムロジピン 5mg 朝1錠"
              />
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                お薬手帳に記載されている情報でも可
              </p>
            </label>
            <div className="mt-4">
              <span className="mb-1 block text-xs font-medium text-stone-600">
                お薬、お薬手帳、医療や福祉手帳などの写真<span className="font-normal text-stone-500">（複数可）</span>
              </span>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white px-4 py-5 transition hover:border-brand/50 hover:bg-brand-50/20">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void onAddPhotos(med.id, e.target.files)
                    e.currentTarget.value = ''
                  }}
                />
                <span className="text-center text-sm text-stone-500">
                  タップして画像を選択（複数枚）
                </span>
              </label>
              
              {med.photoPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {med.photoPreviews.map((src, idx) => (
                    <div key={`${med.id}-img-${idx}`} className="relative">
                      <img
                        src={src}
                        alt={`お薬画像 ${idx + 1}`}
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
          ＋ お薬を追加
        </button>
      </div>
    </section>
  )
}
function StepEditPassword({
  form,
  onChange,
  error,
}: {
  form: RegistrationFormState
  onChange: (p: Partial<RegistrationFormState>) => void
  error: string | null
}) {
  return (
    <section aria-labelledby="step-edit-password-title">
      <h2 id="step-edit-password-title" className="mb-6 text-lg font-bold text-stone-900">
        編集用パスワード
      </h2>
      <FieldError message={error} />
      <div className="space-y-5">
        <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
          <p className="mb-2 font-semibold text-stone-900">
            登録内容を後から変更するために必要なパスワードです。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>数字4桁で設定してください</li>
            <li>忘れないように必ずメモしてください</li>
            <li>ご家族など、登録内容を変更したい方に伝えてください</li>
          </ul>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            編集用パスワード（数字4桁）
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
}
function StepComplete({
  registrationId,
  qrValue,
}: {
  registrationId: string
  qrValue: string
}) {
  return (
    <section className="text-center" aria-labelledby="step-done-title">
      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-brand-muted text-2xl text-brand">
        ✓
      </div>
      <h2 id="step-done-title" className="mb-2 text-xl font-bold text-stone-900">
        登録が完了しました
      </h2>
      <p className="mb-8 text-sm leading-relaxed text-stone-600">
        スマートフォンからいつでも情報を確認することができます。QRコードを読み込んでもらうことで、あなたの命を守る情報を救護の方に伝えることができます。
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
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
        登録ID
      </p>
      <p className="mb-8 font-mono text-sm text-stone-800 break-all">{registrationId}</p>

      <p className="rounded-lg bg-stone-50 px-3 py-2 text-left text-xs text-stone-500 break-all">
        {qrValue}
      </p>
    </section>
  )
}

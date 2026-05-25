import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { verifyPassword } from '../lib/passwordHash'
import { updateRegistration } from '../lib/updateRegistration'
import type { RegistrationFormState, MedicationRow } from '../types/registration'
import {
  StepBasic,
  StepRegion,
  StepMedicalTags,
  StepMedications,
} from './RegistrationForm'

function createEmptyMedicationRow(): MedicationRow {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    photoPreviews: [],
  }
}

function dataToForm(data: any): RegistrationFormState {
  const rawMeds = Array.isArray(data.medications)
    ? data.medications
    : typeof data.medications === 'string'
    ? [data.medications]
    : []

  const medications: MedicationRow[] = rawMeds.length > 0
    ? rawMeds.map((m: any) => {
        const parsed = typeof m === 'string' ? JSON.parse(m) : m
        return {
          id: Math.random().toString(36).slice(2),
          name: parsed.name || '',
photoPreviews: parsed.photo_urls || (parsed.photo_url ? [parsed.photo_url] : []),
        }      })
    : [createEmptyMedicationRow()]

  return {
    fullName: data.name || '',
    furigana: data.furigana || '',
    birthDate: data.birth_date || '',
    emergencyContactName: data.emergency_contact_name || '',
    emergencyContactFurigana: data.emergency_contact_furigana || '',
    emergencyContactPhone: data.emergency_contact_phone || '',
    prefecture: data.prefecture || '',
    city: data.city || '',
    addressDetail: data.address_detail || '',
    postalCode: data.postal_code || '',
    facilityName: data.facility_name || '',
    facilityType: data.facility_type || '',
    allergyTags: data.allergies || [],
    chronicTags: data.diseases || [],
    allergyOther: data.allergy_other || '',
    chronicOther: data.disease_other || '',
    dailyNotes: data.daily_notes || '',
    medications,
    editPassword: '',
  }
}

export function EditPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storedHash, setStoredHash] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [inputPassword, setInputPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  const [form, setForm] = useState<RegistrationFormState | null>(null)
  const [editStep, setEditStep] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const STEP_LABELS_EDIT = [t('edit.step1'), t('edit.step2'), t('edit.step3'), t('edit.step4')]

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    setLangOpen(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) {
        setError(t('edit.notFound'))
      } else {
        setStoredHash(data.edit_password_hash)
        setName(data.name)
        setForm(dataToForm(data))
      }
      setLoading(false)
    }
    fetchData()
  }, [id, t])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    if (!/^\d{4}$/.test(inputPassword)) {
      setAuthError(t('edit.passwordError'))
      return
    }
    if (!storedHash) {
      setAuthError(t('edit.passwordError'))
      return
    }
    setIsChecking(true)
    try {
      const ok = await verifyPassword(inputPassword, storedHash)
      if (ok) {
        setIsAuthenticated(true)
      } else {
        setAuthError(t('edit.passwordError'))
      }
    } catch {
      setAuthError(t('edit.passwordError'))
    } finally {
      setIsChecking(false)
    }
  }

  const updateForm = (patch: Partial<RegistrationFormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const addMedicationRow = () => {
    setForm((prev) =>
      prev
        ? { ...prev, medications: [...prev.medications, createEmptyMedicationRow()] }
        : prev
    )
  }

  const removeMedicationRow = (mid: string) => {
    setForm((prev) => {
      if (!prev) return prev
      const next = prev.medications.filter((m) => m.id !== mid)
      return { ...prev, medications: next.length ? next : [createEmptyMedicationRow()] }
    })
  }

  const updateMedication = (mid: string, patch: Partial<Omit<MedicationRow, 'id'>>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            medications: prev.medications.map((m) => (m.id === mid ? { ...m, ...patch } : m)),
          }
        : prev
    )
  }

  const updateMedicationPhotos = async (mid: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => reject(new Error('image read failed'))
        reader.readAsDataURL(file)
      })

    try {
      const encoded = (await Promise.all(Array.from(files).map((f) => toBase64(f)))).filter(Boolean)
      setForm((prev) =>
        prev
          ? {
              ...prev,
              medications: prev.medications.map((m) =>
                m.id === mid ? { ...m, photoPreviews: [...m.photoPreviews, ...encoded] } : m
              ),
            }
          : prev
      )
    } catch {
      setStepError('error')
    }
  }

  const removeMedicationPhoto = (mid: string, index: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            medications: prev.medications.map((m) =>
              m.id === mid
                ? { ...m, photoPreviews: m.photoPreviews.filter((_, i) => i !== index) }
                : m
            ),
          }
        : prev
    )
  }

  const goNext = () => {
    setStepError(null)
    setEditStep((s) => Math.min(s + 1, STEP_LABELS_EDIT.length - 1))
  }

  const goBack = () => {
    setStepError(null)
    setEditStep((s) => Math.max(s - 1, 0))
  }

  const handleSave = async () => {
    if (!form) return
    setStepError(null)
    setIsSaving(true)
    try {
      await updateRegistration(id, form)
      setIsSaved(true)
    } catch (e) {
      setStepError(e instanceof Error ? e.message : 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const LanguageSwitcher = () => (
    <div className="fixed top-2 right-2 z-50">
      <button onClick={() => setLangOpen(!langOpen)} className="bg-white border-2 border-red-700 text-red-700 font-bold px-3 py-2 rounded-xl shadow-md text-sm">🌍 {t('language')}</button>
      {langOpen && (
        <div className="mt-2 bg-white border-2 border-stone-300 rounded-xl shadow-lg overflow-hidden">
          <button onClick={() => changeLanguage('ja')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">日本語</button>
          <button onClick={() => changeLanguage('en')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">English</button>
          <button onClick={() => changeLanguage('zh')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">中文</button>
          <button onClick={() => changeLanguage('ko')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">한국어</button>
          <button onClick={() => changeLanguage('my')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 text-black font-bold">မြန်မာ</button>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LanguageSwitcher />
        <p>{t('edit.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LanguageSwitcher />
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (isSaved) {
    const backUrl = "/card/" + id
    return (
      <div className="min-h-screen bg-stone-100 p-4">
        <LanguageSwitcher />
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6 mt-8 text-center">
          <h1 className="text-2xl font-bold text-green-700 mb-4">{t('edit.savedTitle')}</h1>
          <p className="mb-6 text-stone-700">{t('edit.savedMessage', { name })}</p>
          <a href={backUrl} className="block w-full bg-red-700 hover:bg-red-800 text-white text-center py-3 rounded-xl font-semibold">{t('edit.buttonViewCard')}</a>
        </div>
      </div>
    )
  }

  if (isAuthenticated && form) {
    return (
      <div className="min-h-screen bg-stone-100 pb-16 pt-6">
        <LanguageSwitcher />
        <div className="mx-auto max-w-lg px-4">
          <header className="mb-6 text-center mt-12">
            <p className="text-sm font-medium text-red-700">{t('edit.title')}</p>
            <h1 className="mt-1 text-2xl font-bold text-stone-900">{t('home.title')}</h1>
            <p className="mt-2 text-sm text-stone-600">{t('edit.subtitle')}</p>
          </header>

          <div className="mb-6 flex justify-between items-center">
            {STEP_LABELS_EDIT.map((label, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={"mx-auto w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold " + (i === editStep ? "bg-red-700 text-white" : i < editStep ? "bg-stone-400 text-white" : "bg-stone-200 text-stone-500")}>
                  {i + 1}
                </div>
                <p className="text-xs mt-1 text-stone-600">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
            {editStep === 0 && (
<StepBasic form={form} onChange={updateForm} error={stepError} t={t} />            )}
            {editStep === 1 && (
<StepRegion form={form} onChange={updateForm} error={stepError} t={t} />            )}
            {editStep === 2 && (
<StepMedicalTags form={form} onChange={updateForm} error={stepError} t={t} />            )}
            {editStep === 3 && (
              <StepMedications
                form={form}
                onAddRow={addMedicationRow}
                onRemoveRow={removeMedicationRow}
                onUpdateMedication={updateMedication}
                onAddPhotos={updateMedicationPhotos}
                onRemovePhoto={removeMedicationPhoto}
error={stepError}
    t={t}              />
            )}
          </div>

          <nav className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={editStep === 0 || isSaving}
              className="flex-1 rounded-xl border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {t('edit.buttonBack')}
            </button>
            {editStep < STEP_LABELS_EDIT.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800"
              >
                {t('edit.buttonNext')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {isSaving ? t('edit.saving') : t('edit.buttonSave')}
              </button>
            )}
          </nav>
        </div>
      </div>
    )
  }

  const cancelUrl = "/card/" + id

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <LanguageSwitcher />
      <div className="max-w-lg mx-auto">
        <header className="mb-8 text-center mt-12">
          <p className="text-sm font-medium text-red-700">{t('edit.title')}</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">{t('home.title')}</h1>
        </header>

        <form onSubmit={handleVerify} className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4">{t('edit.passwordPrompt')}</h2>

          <p className="text-sm text-stone-600 mb-4">
            <span className="font-semibold">{name}</span>
          </p>

          {authError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{authError}</div>
          )}

          <label className="block mb-6">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">{t('edit.passwordPlaceholder')}</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-2xl tracking-widest text-stone-900 focus:border-red-700 focus:outline-none"
              placeholder="----"
            />
          </label>

          <div className="flex gap-3">
            <a href={cancelUrl} className="flex-1 text-center rounded-xl border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">{t('edit.passwordCancel')}</a>
            <button
              type="submit"
              disabled={isChecking}
              className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {isChecking ? t('edit.loading') : t('edit.passwordSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

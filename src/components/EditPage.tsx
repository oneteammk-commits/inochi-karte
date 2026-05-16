import { useEffect, useState } from 'react'
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

const STEP_LABELS_EDIT = ['基本情報', '地域・施設', 'アレルギー・持病', '投薬'] as const

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
          photoPreviews: parsed.photo_url ? [parsed.photo_url] : [],
        }
      })
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storedHash, setStoredHash] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [inputPassword, setInputPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const [form, setForm] = useState<RegistrationFormState | null>(null)
  const [editStep, setEditStep] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) {
        setError('データが見つかりませんでした')
      } else {
        setStoredHash(data.edit_password_hash)
        setName(data.name)
        setForm(dataToForm(data))
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    if (!/^\d{4}$/.test(inputPassword)) {
      setAuthError('編集用パスワードは数字4桁です。')
      return
    }
    if (!storedHash) {
      setAuthError('このカルテにはパスワードが設定されていません。')
      return
    }
    setIsChecking(true)
    try {
      const ok = await verifyPassword(inputPassword, storedHash)
      if (ok) {
        setIsAuthenticated(true)
      } else {
        setAuthError('パスワードが正しくありません。')
      }
    } catch {
      setAuthError('照合中にエラーが発生しました。')
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
        reader.onerror = () => reject(new Error('画像の読み込みに失敗しました。'))
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
      setStepError('画像の読み込みに失敗しました。')
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
      setStepError(e instanceof Error ? e.message : '更新に失敗しました。')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (isSaved) {
    const backUrl = "/card/" + id
    return (
      <div className="min-h-screen bg-stone-100 p-4">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6 mt-8 text-center">
          <h1 className="text-2xl font-bold text-green-700 mb-4">変更を保存しました</h1>
          <p className="mb-6 text-stone-700">{name} さんのカルテを更新しました。</p>
          <a href={backUrl} className="block w-full bg-red-700 hover:bg-red-800 text-white text-center py-3 rounded-xl font-semibold">カルテ表示に戻る</a>
        </div>
      </div>
    )
  }

  if (isAuthenticated && form) {
    return (
      <div className="min-h-screen bg-stone-100 pb-16 pt-6">
        <div className="mx-auto max-w-lg px-4">
          <header className="mb-6 text-center">
            <p className="text-sm font-medium text-red-700">登録内容の変更</p>
            <h1 className="mt-1 text-2xl font-bold text-stone-900">命のカルテ</h1>
            <p className="mt-2 text-sm text-stone-600">{name} さんのカルテを編集中</p>
          </header>

          <div className="mb-6 flex justify-between items-center">
            {STEP_LABELS_EDIT.map((label, i) => (
              <div key={label} className="flex-1 text-center">
                <div className={"mx-auto w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold " + (i === editStep ? "bg-red-700 text-white" : i < editStep ? "bg-stone-400 text-white" : "bg-stone-200 text-stone-500")}>
                  {i + 1}
                </div>
                <p className="text-xs mt-1 text-stone-600">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
            {editStep === 0 && (
              <StepBasic form={form} onChange={updateForm} error={stepError} />
            )}
            {editStep === 1 && (
              <StepRegion form={form} onChange={updateForm} error={stepError} />
            )}
            {editStep === 2 && (
              <StepMedicalTags form={form} onChange={updateForm} error={stepError} />
            )}
            {editStep === 3 && (
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
          </div>

          <nav className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={editStep === 0 || isSaving}
              className="flex-1 rounded-xl border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              戻る
            </button>
            {editStep < STEP_LABELS_EDIT.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800"
              >
                次へ
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {isSaving ? '保存中...' : '保存する'}
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
      <div className="max-w-lg mx-auto">
        <header className="mb-8 text-center mt-6">
          <p className="text-sm font-medium text-red-700">登録内容の変更</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">命のカルテ</h1>
        </header>

        <form onSubmit={handleVerify} className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4">編集用パスワードを入力してください</h2>

          <p className="text-sm text-stone-600 mb-4">
            <span className="font-semibold">{name}</span> さんのカルテです。
          </p>

          {authError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{authError}</div>
          )}

          <label className="block mb-6">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">編集用パスワード(数字4桁)</span>
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
            <a href={cancelUrl} className="flex-1 text-center rounded-xl border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">キャンセル</a>
            <button
              type="submit"
              disabled={isChecking}
              className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {isChecking ? '確認中...' : '認証する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

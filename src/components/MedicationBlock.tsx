import { memo, useState } from 'react'
import type { MedicationRow } from '../types/registration'
import { ImeAwareInput } from './ImeAwareField'
import { getLocalPreview } from '../lib/uploadMedicationPhoto'

export type MedicationBlockProps = {
  med: MedicationRow
  index: number
  canRemove: boolean
  onRemoveRow: (id: string) => void
  onUpdateMedication: (id: string, patch: Partial<Omit<MedicationRow, 'id'>>) => void
  onAddPhotos: (id: string, files: FileList | File[] | null) => Promise<void>
  onRemovePhoto: (id: string, index: number) => void
  t: (key: string, options?: { num?: number }) => string
}

export const MedicationBlock = memo(function MedicationBlock({
  med,
  index,
  canRemove,
  onRemoveRow,
  onUpdateMedication,
  onAddPhotos,
  onRemovePhoto,
  t,
}: MedicationBlockProps) {
  // 写真のアップロード中は「アップロード中…」を出し、二重選択を防ぐ
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (input: FileList | null) => {
    // input.value を空に戻すと FileList も空になるため、先に配列へ写しておく
    const files = input ? Array.from(input) : []
    if (files.length === 0) return
    setUploading(true)
    try {
      await onAddPhotos(med.id, files)
    } finally {
      setUploading(false)
    }
  }

  const photoButtonClass =
    'flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-2 py-4 text-center transition ' +
    (uploading
      ? 'pointer-events-none border-stone-200 bg-stone-100 opacity-60'
      : 'border-stone-300 bg-white hover:border-brand/50 hover:bg-brand-50/20')

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-sm font-semibold leading-snug text-stone-800">
          {t('register.medicineLabel', { num: index + 1 })}
          <span className="ml-1.5 whitespace-nowrap font-normal text-stone-500">{t('register.optional')}</span>
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemoveRow(med.id)}
            className="shrink-0 whitespace-nowrap text-xs font-medium text-red-600 hover:underline"
          >
            {t('register.buttonDeleteRow')}
          </button>
        )}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-600">
          {t('register.labelMedicineName')}
          <span className="font-normal text-stone-500">{t('register.optional')}</span>
        </span>
        <ImeAwareInput
          value={med.name}
          onValueChange={(v) => onUpdateMedication(med.id, { name: v })}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-brand/30 focus:border-brand focus:ring-2"
          placeholder={t('register.placeholderMedicineName')}
        />
        <p className="mt-2 text-xs leading-relaxed text-stone-500">{t('register.medicineNote')}</p>
      </label>
      <div className="mt-4">
        <span className="mb-1 block text-xs font-medium text-stone-600">
          {t('register.labelMedicinePhotos')}
          <span className="font-normal text-stone-500">{t('register.optionalMultiple')}</span>
        </span>
        {/* 「カメラで撮る」と「アルバムから選ぶ」を分けて置く(OSの選択メニュー任せにしない)。
            カメラ側は capture 指定でその場撮影、アルバム側は multiple で複数枚を一度に選べる。 */}
        <div className="flex gap-2">
          <label className={photoButtonClass}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.currentTarget.value = ''
              }}
            />
            <span className="text-2xl leading-none" aria-hidden="true">📷</span>
            <span className="text-sm font-semibold text-stone-700">{t('register.photoTakeCamera')}</span>
          </label>
          <label className={photoButtonClass}>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.currentTarget.value = ''
              }}
            />
            <span className="text-2xl leading-none" aria-hidden="true">🖼️</span>
            <span className="text-sm font-semibold text-stone-700">{t('register.photoFromAlbum')}</span>
          </label>
        </div>
        {uploading && (
          <p
            role="status"
            className="mt-2 flex items-center gap-2 text-sm font-medium text-brand"
          >
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />
            {t('register.photoUploading')}
          </p>
        )}
        {med.photoPreviews.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {med.photoPreviews.map((src, idx) => (
              <div key={`${med.id}-img-${idx}`} className="relative">
                <img
                  src={getLocalPreview(src) ?? src}
                  alt={t('register.altMedicineImage', { num: idx + 1 })}
                  className="h-24 w-full rounded-md border border-stone-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(med.id, idx)}
                  aria-label="delete photo"
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-base font-bold text-white shadow-md"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

import { memo } from 'react'
import type { MedicationRow } from '../types/registration'
import { ImeAwareInput } from './ImeAwareField'

export type MedicationBlockProps = {
  med: MedicationRow
  index: number
  canRemove: boolean
  onRemoveRow: (id: string) => void
  onUpdateMedication: (id: string, patch: Partial<Omit<MedicationRow, 'id'>>) => void
  onAddPhotos: (id: string, files: FileList | null) => Promise<void>
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
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-stone-800">
          {t('register.medicineLabel', { num: index + 1 })}
          <span className="ml-1.5 font-normal text-stone-500">{t('register.optional')}</span>
        </span>
        {canRemove && (
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
  )
})

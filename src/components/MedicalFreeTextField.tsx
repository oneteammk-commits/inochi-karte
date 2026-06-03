import { memo } from 'react'
import { ImeAwareTextarea } from './ImeAwareField'

type MedicalFreeTextFieldProps = {
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  rows?: number
}

export const MedicalFreeTextField = memo(function MedicalFreeTextField({
  label,
  value,
  onValueChange,
  placeholder,
  rows = 3,
}: MedicalFreeTextFieldProps) {
  return (
    <label className="mt-4 block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      <ImeAwareTextarea
        value={value}
        onValueChange={onValueChange}
        rows={rows}
        className="w-full resize-y rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
        placeholder={placeholder}
      />
    </label>
  )
})

import {
  EMERGENCY_RELATIONSHIP_KEYS,
  EMERGENCY_RELATIONSHIP_OTHER_KEY,
} from '../data/registrationConstants'
import { ImeAwareInput } from './ImeAwareField'

type EmergencyRelationshipFieldProps = {
  relationshipKey: string
  relationshipOther: string
  onChange: (patch: {
    emergencyContactRelationshipKey?: string
    emergencyContactRelationshipOther?: string
  }) => void
  t: (key: string) => string
  selectClassName?: string
  inputClassName?: string
}

export function EmergencyRelationshipField({
  relationshipKey,
  relationshipOther,
  onChange,
  t,
  selectClassName = 'w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2',
  inputClassName = 'w-full rounded-xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2',
}: EmergencyRelationshipFieldProps) {
  return (
    <div className="space-y-3">
      <select
        value={relationshipKey}
        onChange={(e) => {
          const nextKey = e.target.value
          onChange({
            emergencyContactRelationshipKey: nextKey,
            ...(nextKey !== EMERGENCY_RELATIONSHIP_OTHER_KEY
              ? { emergencyContactRelationshipOther: '' }
              : {}),
          })
        }}
        className={selectClassName}
      >
        <option value="">{t('register.selectPlaceholder')}</option>
        {EMERGENCY_RELATIONSHIP_KEYS.map((key) => (
          <option key={key} value={key}>
            {t(`register.relationshipOptions.${key}`)}
          </option>
        ))}
        <option value={EMERGENCY_RELATIONSHIP_OTHER_KEY}>
          {t('register.relationshipOptions.other')}
        </option>
      </select>
      {relationshipKey === EMERGENCY_RELATIONSHIP_OTHER_KEY && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            {t('register.labelEmergencyRelationshipOther')}
          </span>
          <ImeAwareInput
            value={relationshipOther}
            onValueChange={(v) => onChange({ emergencyContactRelationshipOther: v })}
            className={inputClassName}
            placeholder={t('register.placeholderEmergencyRelationshipOther')}
          />
        </label>
      )}
    </div>
  )
}

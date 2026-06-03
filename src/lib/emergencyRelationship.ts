import {
  EMERGENCY_RELATIONSHIP_JA_VALUES,
  EMERGENCY_RELATIONSHIP_KEYS,
  EMERGENCY_RELATIONSHIP_OTHER_KEY,
  type EmergencyRelationshipPresetKey,
} from '../data/registrationConstants'

export function resolveEmergencyRelationshipForSave(
  key: string,
  otherText: string,
): string {
  if (!key) return ''
  if (key === EMERGENCY_RELATIONSHIP_OTHER_KEY) return otherText.trim()
  if (EMERGENCY_RELATIONSHIP_KEYS.includes(key as EmergencyRelationshipPresetKey)) {
    return EMERGENCY_RELATIONSHIP_JA_VALUES[key as EmergencyRelationshipPresetKey]
  }
  return ''
}

export function parseEmergencyRelationshipFromDb(stored: string): {
  key: string
  other: string
} {
  const trimmed = stored.trim()
  if (!trimmed) return { key: '', other: '' }

  const preset = EMERGENCY_RELATIONSHIP_KEYS.find(
    (k) => EMERGENCY_RELATIONSHIP_JA_VALUES[k] === trimmed,
  )
  if (preset) return { key: preset, other: '' }

  return { key: EMERGENCY_RELATIONSHIP_OTHER_KEY, other: trimmed }
}

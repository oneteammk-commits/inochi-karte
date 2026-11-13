import { formatPetSexNeuter } from '../lib/petSexNeuter'
import type { PetRegistrationRow } from '../types/petRegistration'

function PetField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value?.trim()) return null
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-sm text-amber-900/70">{label}</p>
      <p className="text-base font-semibold text-black whitespace-pre-wrap">{value}</p>
    </div>
  )
}

/** 見出し付きの小さなまとまり（狂犬病・混合ワクチンなど、状態と日付をひと組で見せる） */
function PetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2">
      <p className="mb-1 text-sm font-bold text-amber-900">{title}</p>
      {children}
    </div>
  )
}


/** 'YYYY-MM-DD' を表示用（日本語なら 2026年4月10日、ほかは各言語の書き方）にする。形が違えばそのまま */
export function formatPetDate(value: string | null | undefined, lang: string): string | null {
  if (!value?.trim()) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return value
  const [, y, mo, d] = m
  if (lang.startsWith('ja')) return `${Number(y)}年${Number(mo)}月${Number(d)}日`
  if (lang.startsWith('zh')) return `${Number(y)}年${Number(mo)}月${Number(d)}日`
  if (lang.startsWith('ko')) return `${Number(y)}년 ${Number(mo)}월 ${Number(d)}일`
  try {
    return new Date(Number(y), Number(mo) - 1, Number(d)).toLocaleDateString(lang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

/** 決まった値（done など）を、その言語の言葉にする。知らない値はそのまま出す */
function label(value: string | null | undefined, map: Record<string, string>): string | null {
  if (!value?.trim()) return null
  return map[value] ?? value
}

type PetViewSectionProps = {
  pets: PetRegistrationRow[]
  t: (key: string, options?: { num?: number }) => string
  /** 表示中の言語（日付の書き方に使う） */
  lang?: string
  /** 飼い主＝このカルテのご本人。ペット欄の最後に出す */
  owner?: {
    name?: string | null
    emergencyName?: string | null
    emergencyPhone?: string | null
  }
}

export function PetViewSection({ pets, t, lang = 'ja', owner }: PetViewSectionProps) {
  if (pets.length === 0) return null

  const rabiesLabel = {
    done: t('register.rabiesDone'),
    not: t('register.rabiesNot'),
    exempt: t('register.rabiesExempt'),
  }
  const parasiteLabel = { done: t('register.parasiteDone'), not: t('register.parasiteNot') }
  const fittedLabel = {
    yes: t('register.microchipYes'),
    no: t('register.microchipNo'),
    unknown: t('register.microchipUnknown'),
  }
  const registryLabel = {
    moe: t('register.registryMoe'),
    aipo: t('register.registryAipo'),
    jkc: t('register.registryJkc'),
    shop: t('register.registryShop'),
    unknown: t('register.registryUnknown'),
    other: t('register.registryOther'),
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 shadow-sm p-5 mb-3 rounded-r-2xl">
      <h2 className="text-lg font-bold text-amber-800 border-b-2 border-amber-200 pb-2 mb-4">
        <span aria-hidden="true">🐾</span> {t('view.petsTitle')}
      </h2>
      <div className="space-y-5">
        {pets.map((pet, index) => {
          const isDog = pet.species === '犬'
          const hasRabies = !!(pet.rabies_status || pet.rabies_date || pet.rabies_exempt_reason)
          const hasVaccine = !!(pet.vaccine_info || pet.vaccine_date)
          const hasParasite = !!(pet.parasite_status || pet.parasite_date)
          const hasChip = !!(pet.microchip_fitted || pet.microchip_registry || pet.microchip)
          const registry =
            pet.microchip_registry === 'other'
              ? [t('register.registryOther'), pet.microchip_registry_other].filter(Boolean).join('：')
              : label(pet.microchip_registry, registryLabel)
          return (
            <div key={pet.id} className="rounded-xl border border-amber-200/80 bg-white/70 p-4">
              <p className="mb-3 text-base font-bold text-amber-900">
                {t('view.petLabel', { num: index + 1 })}
              </p>
              {pet.photo_url && (
                <img
                  src={pet.photo_url}
                  alt="pet"
                  className="mb-3 h-32 w-32 rounded-xl border border-amber-200 object-cover"
                />
              )}
              <PetField label={t('view.labelPetName')} value={pet.pet_name} />
              <PetField label={t('view.labelPetFeatures')} value={pet.features} />
              <PetField label={t('view.labelPetSpecies')} value={pet.species} />
              <PetField label={t('view.labelPetBreed')} value={pet.breed} />
              <PetField label={t('view.labelPetAge')} value={pet.age} />
              <PetField label={t('view.labelPetSex')} value={formatPetSexNeuter(pet.sex, pet.neuter_status, t)} />

              {/* ── 避難所の受付が最初に見る順 ── */}
              {(isDog || !pet.species) && hasRabies && (
                <PetGroup title={t('view.labelPetRabies')}>
                  <PetField label={t('view.labelStatus')} value={label(pet.rabies_status, rabiesLabel)} />
                  <PetField label={t('view.labelPetRabiesDate')} value={formatPetDate(pet.rabies_date, lang)} />
                  {pet.rabies_status === 'exempt' && (
                    <PetField label={t('view.labelPetRabiesExemptReason')} value={pet.rabies_exempt_reason} />
                  )}
                </PetGroup>
              )}
              {!isDog && pet.species && (
                <PetField label={t('view.labelPetRabies')} value={t('view.petRabiesNotApplicable')} />
              )}
              {hasVaccine && (
                <PetGroup title={t('view.labelPetVaccine')}>
                  <PetField label={t('view.labelVaccineContent')} value={pet.vaccine_info} />
                  <PetField label={t('view.labelPetVaccineDate')} value={formatPetDate(pet.vaccine_date, lang)} />
                </PetGroup>
              )}
              {hasParasite && (
                <PetGroup title={t('view.labelPetParasite')}>
                  <PetField label={t('view.labelStatus')} value={label(pet.parasite_status, parasiteLabel)} />
                  <PetField label={t('view.labelPetParasiteDate')} value={formatPetDate(pet.parasite_date, lang)} />
                </PetGroup>
              )}

              {/* ── 持病・お薬・ごはん ── */}
              <PetField label={t('view.labelPetMedicalHistory')} value={pet.medical_history} />
              <PetField label={t('view.labelPetMedications')} value={pet.medications} />
              {pet.medication_photo_url && (
                <div className="mb-3">
                  <p className="text-sm text-amber-900/70">{t('view.labelPetMedicinePhoto')}</p>
                  <img
                    src={pet.medication_photo_url}
                    alt={t('view.labelPetMedicinePhoto')}
                    className="mt-1 max-h-48 w-full rounded-lg border border-amber-200 object-contain"
                  />
                </div>
              )}
              <PetField label={t('view.labelPetAllergies')} value={pet.allergies} />
              <PetField label={t('view.labelPetFood')} value={pet.food} />

              {/* ── かかりつけ・担当医 ── */}
              <PetField label={t('view.labelPetVetClinic')} value={pet.vet_clinic} />
              <PetField label={t('view.labelPetVetDoctor')} value={pet.vet_doctor} />

              {/* ── マイクロチップ ── */}
              {hasChip && (
                <PetGroup title={t('view.labelPetMicrochipGroup')}>
                  <PetField label={t('view.labelPetMicrochipFitted')} value={label(pet.microchip_fitted, fittedLabel)} />
                  <PetField label={t('view.labelPetMicrochipRegistry')} value={registry} />
                  <PetField label={t('view.labelPetMicrochip')} value={pet.microchip} />
                </PetGroup>
              )}

              {/* ── 飼い主（このカルテのご本人） ── */}
              {owner && (owner.name || owner.emergencyPhone) && (
                <PetGroup title={t('view.labelPetOwner')}>
                  <PetField label={t('view.labelPetOwnerName')} value={owner.name} />
                  <PetField
                    label={t('view.labelPetOwnerEmergency')}
                    value={[owner.emergencyName, owner.emergencyPhone].filter(Boolean).join('　')}
                  />
                </PetGroup>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

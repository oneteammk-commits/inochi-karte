import type { PetRow } from '../types/pet'
import { petRowHasAnyData } from '../types/pet'
import { uploadPetMedicationPhoto } from './uploadPetMedPhoto'

function resolveSpecies(pet: PetRow): string | null {
  if (pet.speciesKind === 'dog') return '犬'
  if (pet.speciesKind === 'cat') return '猫'
  if (pet.speciesKind === 'other') return pet.speciesOther.trim() || null
  return null
}

async function resolveMedicationPhotoUrl(
  ownerId: string,
  pet: PetRow,
): Promise<string | null> {
  if (pet.medicationPhotoUrl && !pet.medicationPhotoUrl.startsWith('data:')) {
    return pet.medicationPhotoUrl
  }
  const preview = pet.medicationPhotoPreview
  if (!preview) return null
  if (preview.startsWith('http')) return preview
  if (preview.startsWith('data:')) {
    return uploadPetMedicationPhoto(ownerId, pet.id, preview)
  }
  return null
}

/**
 * 画面のペット入力欄を、データベースに渡す形に変換する。
 * 写真は先にストレージへ保存し、URLだけを載せる。
 * 既にデータベースにあるペットは id を付けて渡す（付いていないものは新規追加になる）。
 */
export async function buildPetRows(
  ownerId: string,
  pets: PetRow[],
): Promise<Record<string, unknown>[]> {
  const activePets = pets.filter(petRowHasAnyData)
  return Promise.all(
    activePets.map(async (pet) => {
      const medicationPhotoUrl = await resolveMedicationPhotoUrl(ownerId, pet)
      return {
        id: pet.dbId || null,
        pet_name: pet.petName.trim() || null,
        species: resolveSpecies(pet),
        breed: pet.breed.trim() || null,
        age: pet.age.trim() || null,
        sex: pet.sex.trim() || null,
        medical_history: pet.medicalHistory.trim() || null,
        medications: pet.medications.trim() || null,
        allergies: pet.allergies.trim() || null,
        vet_clinic: pet.vetClinic.trim() || null,
        vet_doctor: pet.vetDoctor.trim() || null,
        vaccine_info: pet.vaccineInfo.trim() || null,
        vaccine_date: pet.vaccineDate || null,
        // 狂犬病は犬だけの項目。犬でなくなったら消す
        rabies_status: pet.speciesKind === 'dog' ? pet.rabiesStatus || null : null,
        rabies_date: pet.speciesKind === 'dog' ? pet.rabiesDate || null : null,
        rabies_exempt_reason:
          pet.speciesKind === 'dog' && pet.rabiesStatus === 'exempt' ? pet.rabiesExemptReason.trim() || null : null,
        parasite_status: pet.parasiteStatus || null,
        parasite_date: pet.parasiteDate || null,
        neuter_status: pet.neuterStatus || null,
        microchip_fitted: pet.microchipFitted || null,
        // 「装着なし」なら登録先・番号は消す（画面でも出さない）
        microchip_registry: pet.microchipFitted !== 'no' ? pet.microchipRegistry || null : null,
        microchip_registry_other:
          pet.microchipFitted !== 'no' && pet.microchipRegistry === 'other' ? pet.microchipRegistryOther.trim() || null : null,
        microchip: pet.microchipFitted !== 'no' ? pet.microchip.trim() || null : null,
        food: pet.food.trim() || null,
        medication_photo_url: medicationPhotoUrl,
        photo_url: pet.photoUrl || null,
        features: pet.features.trim() || null,
      }
    }),
  )
}

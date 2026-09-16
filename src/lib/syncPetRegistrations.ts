import type { PetRow } from '../types/pet'
import { isSupabaseConfigured } from './supabase'
import { buildPetRows } from './petPayload'
import { saveCardPets, authErrorMessage } from './cardApi'

/** 編集時: ペット一覧を owner_id 単位で同期（削除・更新・追加） */
export async function syncPetRegistrations(
  ownerId: string,
  registerPetsEnabled: boolean,
  pets: PetRow[],
  password: string,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  const rows = registerPetsEnabled ? await buildPetRows(ownerId, pets) : []
  const result = await saveCardPets(ownerId, password, registerPetsEnabled, rows)
  if (!result.ok) {
    throw new Error(authErrorMessage(result))
  }
}

import type { PetRow } from '../types/pet'
import { isSupabaseConfigured } from './supabase'
import { buildPetRows } from './petPayload'
import { saveCardPets, authErrorMessage } from './cardApi'

/** 新規登録時: ペット情報をまとめて保存する */
export async function persistPetRegistrations(
  ownerId: string,
  pets: PetRow[],
  password: string,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  const rows = await buildPetRows(ownerId, pets)
  if (rows.length === 0) return

  const result = await saveCardPets(ownerId, password, true, rows)
  if (!result.ok) {
    throw new Error(authErrorMessage(result))
  }
}

import type { RegistrationFormState } from '../types/registration'
import { isSupabaseConfigured } from './supabase'
import { buildRegistrationPayload } from './persistRegistration'
import { saveCard, authErrorMessage } from './cardApi'

export async function updateRegistration(
  id: string,
  form: RegistrationFormState,
  password: string,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase が未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }

  const result = await saveCard(id, password, buildRegistrationPayload(form))
  if (!result.ok) {
    throw new Error(authErrorMessage(result))
  }
}

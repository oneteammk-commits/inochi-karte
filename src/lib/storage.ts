const KEY = 'myCardId'

export function saveMyCardId(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch (e) {
    console.error('localStorage save failed:', e)
  }
  try {
    const oneYear = 365 * 24 * 60 * 60
    document.cookie = KEY + "=" + encodeURIComponent(id) + "; max-age=" + oneYear + "; path=/; SameSite=Lax"
  } catch (e) {
    console.error('cookie save failed:', e)
  }
}

export function getMyCardId(): string | null {
  try {
    const fromLocalStorage = localStorage.getItem(KEY)
    if (fromLocalStorage) return fromLocalStorage
  } catch (e) {
    console.error('localStorage read failed:', e)
  }
  try {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + KEY + '=([^;]+)'))
    if (match) {
      const id = decodeURIComponent(match[1])
      try {
        localStorage.setItem(KEY, id)
      } catch {
      }
      return id
    }
  } catch (e) {
    console.error('cookie read failed:', e)
  }
  return null
}

export function clearMyCardId(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
  }
  try {
    document.cookie = KEY + "=; max-age=0; path=/; SameSite=Lax"
  } catch {
  }
}

const KEY = 'myCardId'
const CARDS_KEY = 'myCards'

export type MyCard = {
  id: string
  name: string
}

function readCardsRaw(): MyCard[] {
  try {
    const raw = localStorage.getItem(CARDS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c) => c && typeof c.id === 'string' && c.id.length > 0)
          .map((c) => ({ id: c.id, name: typeof c.name === 'string' ? c.name : '' }))
      }
    }
  } catch (e) {
    console.error('localStorage read failed:', e)
  }
  return []
}

function writeCards(cards: MyCard[]): void {
  try {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards))
  } catch (e) {
    console.error('localStorage save failed:', e)
  }
  // 互換性のため、1人目のIDは従来のキーにも保存しておく
  const firstId = cards.length > 0 ? cards[0].id : null
  try {
    if (firstId) {
      localStorage.setItem(KEY, firstId)
    } else {
      localStorage.removeItem(KEY)
    }
  } catch (e) {
    console.error('localStorage save failed:', e)
  }
  try {
    if (firstId) {
      const oneYear = 365 * 24 * 60 * 60
      document.cookie = KEY + '=' + encodeURIComponent(firstId) + '; max-age=' + oneYear + '; path=/; SameSite=Lax'
    } else {
      document.cookie = KEY + '=; max-age=0; path=/; SameSite=Lax'
    }
  } catch (e) {
    console.error('cookie save failed:', e)
  }
}

function readLegacyId(): string | null {
  try {
    const fromLocalStorage = localStorage.getItem(KEY)
    if (fromLocalStorage) return fromLocalStorage
  } catch (e) {
    console.error('localStorage read failed:', e)
  }
  try {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + KEY + '=([^;]+)'))
    if (match) {
      return decodeURIComponent(match[1])
    }
  } catch (e) {
    console.error('cookie read failed:', e)
  }
  return null
}

// この端末に登録されている全員分のカード一覧を返す（旧形式からの自動移行つき）
export function getMyCards(): MyCard[] {
  const cards = readCardsRaw()
  const legacyId = readLegacyId()
  if (legacyId && !cards.some((c) => c.id === legacyId)) {
    const migrated = [{ id: legacyId, name: '' }, ...cards]
    writeCards(migrated)
    return migrated
  }
  return cards
}

// 家族を1人追加（登録完了時に呼ぶ）。既にあるIDは重複追加しない
export function addMyCard(id: string, name: string): void {
  const cards = getMyCards()
  const existing = cards.find((c) => c.id === id)
  if (existing) {
    if (name && existing.name !== name) {
      existing.name = name
      writeCards(cards)
    }
    return
  }
  cards.push({ id, name })
  writeCards(cards)
}

// 家族を1人、この端末の一覧から取り除く（完全削除の仕上げに呼ぶ）
export function removeMyCard(id: string): void {
  const cards = getMyCards().filter((c) => c.id !== id)
  writeCards(cards)
}

// サーバーから取得した氏名で表示名を最新化する
export function updateMyCardNames(names: { id: string; name: string }[]): void {
  const cards = getMyCards()
  let changed = false
  for (const n of names) {
    const card = cards.find((c) => c.id === n.id)
    if (card && n.name && card.name !== n.name) {
      card.name = n.name
      changed = true
    }
  }
  if (changed) writeCards(cards)
}

// ---- 以下は互換用（従来の1人分API）----

export function saveMyCardId(id: string): void {
  addMyCard(id, '')
}

export function getMyCardId(): string | null {
  const cards = getMyCards()
  return cards.length > 0 ? cards[0].id : null
}

export function clearMyCardId(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
  }
  try {
    localStorage.removeItem(CARDS_KEY)
  } catch {
  }
  try {
    document.cookie = KEY + '=; max-age=0; path=/; SameSite=Lax'
  } catch {
  }
}

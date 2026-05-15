// パスワードをハッシュ化（暗号化）する処理
// SHA-256という方式で、4桁の数字を64文字の文字列に変換する
// 元のパスワードには戻せないので、漏れても安全

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// 入力されたパスワードが、保存されているハッシュと一致するかチェック
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

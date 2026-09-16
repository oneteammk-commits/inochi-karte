// 【注意】このファイルは現在どこからも使われていません。
//
// 以前はブラウザ側で編集用パスワードを照合していましたが、
// 4桁の数字をソルトなしでSHA-256にかけただけのハッシュは、
// 10,000通りを総当たりすれば元の数字が復元できてしまいます。
// そのためハッシュをブラウザに渡すこと自体をやめ、
// 照合はデータベース側の関数 verify_card_password が行う方式に変更しました。
//
// 参照が無いことを確認のうえ、いずれ削除して構いません。

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash
}

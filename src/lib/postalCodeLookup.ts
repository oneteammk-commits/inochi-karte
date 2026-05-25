type ZipcloudResult = {
  address1: string
  address2: string
  address3: string
}

type ZipcloudResponse = {
  status: number
  results: ZipcloudResult[] | null
}

/** 郵便番号（7桁）から都道府県・市区町村＋町名を取得（zipcloud API） */
export async function lookupPostalCode(
  postalCode: string,
): Promise<{ prefecture: string; city: string } | null> {
  const digits = postalCode.replace(/\D/g, '')
  if (digits.length !== 7) return null

  const res = await fetch(
    `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`,
  )
  if (!res.ok) return null

  const json = (await res.json()) as ZipcloudResponse
  if (json.status !== 200 || !json.results?.[0]) return null

  const r = json.results[0]
  return {
    prefecture: r.address1,
    city: `${r.address2}${r.address3}`,
  }
}

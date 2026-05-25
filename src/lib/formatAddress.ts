/** カルテ表示用：市区町村・町名と番地・建物名を1行に結合 */
export function formatDisplayAddress(
  city: string,
  addressDetail: string | null | undefined,
): string {
  const base = city.trim()
  const detail = addressDetail?.trim() ?? ''
  if (!detail) return base
  if (!base) return detail
  return `${base} ${detail}`
}

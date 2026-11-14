/**
 * ペットの「性別・不妊去勢」をカルテ画面で 1 行にまとめて見せるための決まりごと。
 *
 * 登録画面では、見出し「性別・不妊去勢」の下に 2 つのプルダウンを並べる
 * （獣医師の助言: 雄も雌も「手術している／手術していない／分からない」の共通の 3 択）。
 *   性別: オス／メス／不明                       → sex: male / female / unknown
 *   手術: 手術している／手術していない／分からない → neuter_status: done / not / unknown
 * データベースの列はこれまでと同じ（sex と neuter_status）なので、
 * 以前の 7 択で登録したデータ（例: メス（避妊済み）= female + done）もそのまま正しく表示される。
 */

/** カルテ画面に出す文字（例: 「メス・手術している」）。何も入っていなければ null */
export function formatPetSexNeuter(
  sex: string | null | undefined,
  neuter: string | null | undefined,
  t: (key: string) => string,
): string | null {
  const s = (sex ?? '').trim()
  const n = (neuter ?? '').trim()

  let sexText = ''
  if (s === 'male') sexText = t('register.petSexMale')
  else if (s === 'female') sexText = t('register.petSexFemale')
  else if (s === 'unknown') sexText = t('register.petSexUnknown')
  else if (s) sexText = s // 想定外の値（古い自由記入など）はそのまま

  let neuterText = ''
  if (n === 'done') neuterText = t('register.neuterDone')
  else if (n === 'not') neuterText = t('register.neuterNot')
  else if (n === 'unknown') neuterText = t('view.petNeuterUnknown')

  const parts = [sexText, neuterText].filter(Boolean)
  return parts.length ? parts.join(t('view.petSexNeuterSep')) : null
}

/**
 * ペットの「性別・不妊去勢」を1つの選択肢で扱うための決まりごと。
 *
 * データベースは今までどおり 2 つの列（sex: male/female/unknown、neuter_status: done/not/unknown）に保存する。
 * 画面では次の 7 つの選択肢を 1 つのプルダウンで見せる（獣医師の助言を受け、項目を 1 つ減らすため）。
 *   オス（去勢済み）／オス（未去勢）／オス（去勢は不明）
 *   メス（避妊済み）／メス（未避妊）／メス（避妊は不明）
 *   性別不明
 * 既存データ（性別だけ入っていて不妊去勢が空 など）も、表示のときに自動でこの 7 つに置き換わる。
 */

export type PetSexNeuterKey =
  | 'male:done'
  | 'male:not'
  | 'male:unknown'
  | 'female:done'
  | 'female:not'
  | 'female:unknown'
  | 'unknown'

/** 画面に並べる順と、言語ファイルのキー */
export const PET_SEX_NEUTER_OPTIONS: { key: PetSexNeuterKey; i18n: string }[] = [
  { key: 'male:done', i18n: 'register.petSexMaleNeutered' },
  { key: 'male:not', i18n: 'register.petSexMaleIntact' },
  { key: 'male:unknown', i18n: 'register.petSexMaleNeuterUnknown' },
  { key: 'female:done', i18n: 'register.petSexFemaleSpayed' },
  { key: 'female:not', i18n: 'register.petSexFemaleIntact' },
  { key: 'female:unknown', i18n: 'register.petSexFemaleSpayUnknown' },
  { key: 'unknown', i18n: 'register.petSexUnknownCombined' },
]

/**
 * 保存されている 2 つの値から、選択肢のキーを決める。
 * ・オス／メス＋不妊去勢が空 → 「（〜は不明）」
 * ・性別が不明 → 「性別不明」
 * ・性別が空 → ''（未選択）
 * ・想定外の値（古い自由記入など） → ''（呼び出し側でそのまま表示する）
 */
export function toSexNeuterKey(sex: string | null | undefined, neuter: string | null | undefined): PetSexNeuterKey | '' {
  const s = (sex ?? '').trim()
  const n = (neuter ?? '').trim()
  if (s === 'male' || s === 'female') {
    const part = n === 'done' || n === 'not' ? n : 'unknown'
    return `${s}:${part}` as PetSexNeuterKey
  }
  if (s === 'unknown') return 'unknown'
  return ''
}

/** 選択肢のキーを、保存する 2 つの値に戻す */
export function fromSexNeuterKey(key: string): { sex: string; neuterStatus: '' | 'done' | 'not' | 'unknown' } {
  if (key === 'unknown') return { sex: 'unknown', neuterStatus: '' }
  const [s, n] = key.split(':')
  if ((s === 'male' || s === 'female') && (n === 'done' || n === 'not' || n === 'unknown')) {
    return { sex: s, neuterStatus: n }
  }
  return { sex: '', neuterStatus: '' }
}

/** カルテ画面などで見せる文字（その言語の言葉で） */
export function formatPetSexNeuter(
  sex: string | null | undefined,
  neuter: string | null | undefined,
  t: (key: string) => string,
): string | null {
  const key = toSexNeuterKey(sex, neuter)
  if (key) {
    const base = t(PET_SEX_NEUTER_OPTIONS.find((o) => o.key === key)!.i18n)
    // 性別は不明だが手術の有無だけ分かっている古いデータは、手術の有無も添える
    if (key === 'unknown' && (neuter === 'done' || neuter === 'not')) {
      return `${base}（${t(neuter === 'done' ? 'register.neuterDone' : 'register.neuterNot')}）`
    }
    return base
  }
  // 性別が空で、手術の有無だけ入っている古いデータ
  if (!sex?.trim() && (neuter === 'done' || neuter === 'not')) {
    return t(neuter === 'done' ? 'register.neuterDone' : 'register.neuterNot')
  }
  // 想定外の値はそのまま
  return sex?.trim() ? sex.trim() : null
}

/**
 * 音声ガイド用の文字の下ごしらえ
 * - 読み上げ: 画面の文字はそのままに、声だけ読みやすくする（漢字1文字・記号・絵文字・数字の読み）
 * - 聞き取り: 声で返ってきた文字（漢数字・ひらがな・言い換え）を、画面の項目に合わせる
 */

/** 選択肢・ボタン1つ分の読み方（日本語）。単独の漢字は読み上げエンジンが誤読しやすい（親→ちか 等） */
export const ITEM_READING_JA: Record<string, string> = {
  子: 'こども',
  親: 'おや',
  孫: 'まご',
  親戚: 'しんせき',
  友人: 'ゆうじん',
  兄弟姉妹: 'きょうだい、しまい',
  '配偶者・パートナー': 'はいぐうしゃ、パートナー',
  '施設職員・ケアマネージャー': 'しせつの、しょくいん、ケアマネージャー',
  犬: 'いぬ',
  猫: 'ねこ',
  卵: 'たまご',
  牛乳: 'ぎゅうにゅう',
  小麦: 'こむぎ',
  落花生: 'らっかせい',
  薬剤: 'やくざい',
  '金属（ニッケル等）': 'きんぞく、ニッケルなど',
  'キウイ・バナナ': 'キウイ、バナナ',
  不明: 'ふめい',
  自宅: 'じたく',
  喘息: 'ぜんそく',
  心疾患: 'しんしっかん',
  脳卒中既往: 'のうそっちゅうの、きおう',
  精神疾患: 'せいしんしっかん',
  オス: 'おす',
  メス: 'めす',
}

/** 文章の中で読み間違えやすい言葉（日本語） */
const PHRASE_READING_JA: [string, string][] = [
  ['色・模様', 'いろ、もよう'],
  ['色', 'いろ'],
  ['茶白', 'ちゃしろ'],
  ['既往歴', 'きおうれき'],
  ['既往', 'きおう'],
  ['続柄', 'つづきがら'],
  ['犬種・猫種', 'いぬや、ねこの、しゅるい'],
  ['飼い主', 'かいぬし'],
  ['嚥下', 'えんげ'],
  ['療法食', 'りょうほうしょく'],
  ['人なつっこい', 'ひとなつっこい'],
  ['首輪', 'くびわ'],
  ['○○', 'なになに'],
  ['5mg', '5ミリグラム'],
  ['等）', 'など）'],
]

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu

/** 読み上げ用に整える（絵文字を消す・記号を区切りに・誤読しやすい言葉を言い換え） */
export function toSpeechText(text: string, lang: string): string {
  let s = text.replace(EMOJI, '')
  if (lang === 'ja') {
    for (const [from, to] of PHRASE_READING_JA) s = s.split(from).join(to)
  }
  s = s
    .replace(/[・／/]/g, '、')
    .replace(/[（(）)]/g, '、')
    .replace(/X{2,}/g, '')
    .replace(/、\s*、+/g, '、')
    .replace(/、\s*。/g, '。')
    .replace(/。{2,}/g, '。')
    .replace(/^\s*、+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s
}

/** 選択肢1つ分の読み方 */
export function itemReading(text: string, lang: string): string {
  return lang === 'ja' ? (ITEM_READING_JA[text] ?? text) : text
}

/** 数字を1けたずつ読ませる（郵便番号・電話番号）。6310056 → 6 3 1 0 0 5 6 */
export function spellDigits(text: string): string {
  return text.replace(/\d+/g, (m) => m.split('').join(' '))
}

/** カタカナ→ひらがな（比べるとき用） */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

/** ひらがな→カタカナ（フリガナ欄用） */
export function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

export function hasKanji(s: string): boolean {
  return /[㐀-䶿一-鿿々]/.test(s)
}

const KANJI_DIGIT: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const KANJI_UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }

/** 漢数字（例: 二, 十二, 四十七, 千九百七十二）を数に */
function kanjiToNumber(s: string): number | null {
  if (!s) return null
  let total = 0
  let current = 0
  let seen = false
  for (const ch of s) {
    if (ch in KANJI_DIGIT) {
      current = current * 10 + KANJI_DIGIT[ch]
      seen = true
    } else if (ch in KANJI_UNIT) {
      total += (current || 1) * KANJI_UNIT[ch]
      current = 0
      seen = true
    } else return null
  }
  return seen ? total + current : null
}

/** 声で返りやすい「日」「月」の言い方 */
const SPOKEN_NUMBER_WORDS: [string, number][] = [
  ['じゅういちがつ', 11],
  ['じゅうにがつ', 12],
  ['じゅうがつ', 10],
  ['いちがつ', 1],
  ['にがつ', 2],
  ['さんがつ', 3],
  ['しがつ', 4],
  ['ごがつ', 5],
  ['ろくがつ', 6],
  ['しちがつ', 7],
  ['はちがつ', 8],
  ['くがつ', 9],
  ['ついたち', 1],
  ['ふつか', 2],
  ['みっか', 3],
  ['よっか', 4],
  ['いつか', 5],
  ['むいか', 6],
  ['なのか', 7],
  ['ようか', 8],
  ['ここのか', 9],
  ['とおか', 10],
  ['はつか', 20],
]

/** 声で返った文字を数字だけの文字列に（漢数字・「ついたち」なども） */
export function parseSpokenNumber(text: string): string | null {
  const t = text.normalize('NFKC')
  const digits = t.replace(/[^\d]/g, '')
  if (digits) return digits
  const h = toHiragana(t).replace(/\s/g, '')
  for (const [word, n] of SPOKEN_NUMBER_WORDS) if (h.includes(word)) return String(n)
  const k = t.match(/[〇零一二三四五六七八九十百千]+/)
  if (k) {
    const n = kanjiToNumber(k[0])
    if (n !== null) return String(n)
  }
  return null
}

/** 「昭和47年」「昭和四十七年」「平成元年」などを西暦に */
export function parseSpokenYear(text: string): string | null {
  const t = text.normalize('NFKC')
  const eras: [string, number][] = [
    ['令和', 2018],
    ['平成', 1988],
    ['昭和', 1925],
    ['大正', 1911],
    ['明治', 1867],
  ]
  for (const [name, base] of eras) {
    const i = t.indexOf(name)
    if (i === -1) continue
    const rest = t.slice(i + name.length).trim()
    if (rest.startsWith('元')) return String(base + 1)
    const n = parseSpokenNumber(rest.split('年')[0])
    if (n) return String(base + Number(n))
  }
  const four = t.match(/\d{4}/)
  if (four) return four[0]
  const n = parseSpokenNumber(t.split('年')[0])
  return n && n.length === 4 ? n : null
}

/** 選択ボタン・選択肢の言い換え（声で返りやすい言い方 → 画面の文字） */
export const ALIASES_JA: Record<string, string[]> = {
  // アレルギー
  なし: ['無し'],
  卵: ['たまご', '玉子'],
  牛乳: ['ぎゅうにゅう', 'ミルク'],
  小麦: ['こむぎ'],
  そば: ['蕎麦'],
  落花生: ['らっかせい', 'ピーナッツ', 'ピーナツ'],
  エビ: ['海老', '蝦'],
  かに: ['蟹'],
  くるみ: ['胡桃'],
  'キウイ・バナナ': ['キウイ', 'バナナ'],
  薬剤: ['やくざい', '薬'],
  '金属（ニッケル等）': ['金属', 'きんぞく', 'ニッケル'],
  // 持病
  高血圧: ['こうけつあつ'],
  糖尿病: ['とうにょうびょう', '糖尿'],
  心疾患: ['しんしっかん', '心臓病', '心臓'],
  脳卒中既往: ['脳卒中', 'のうそっちゅう', '脳梗塞', '脳出血'],
  喘息: ['ぜんそく'],
  てんかん: ['癲癇'],
  腎臓病: ['じんぞうびょう', '腎臓'],
  認知症: ['にんちしょう'],
  精神疾患: ['せいしんしっかん'],
  // 続柄
  '配偶者・パートナー': ['配偶者', 'パートナー', '夫', '妻', 'おっと', 'つま', '主人', '旦那', '嫁'],
  子: ['こども', '子ども', '子供', '息子', '娘', 'むすこ', 'むすめ'],
  親: ['おや', '父', '母', 'ちち', 'はは', 'お父さん', 'お母さん'],
  兄弟姉妹: ['きょうだい', '兄', '弟', '姉', '妹'],
  孫: ['まご'],
  親戚: ['しんせき'],
  友人: ['ゆうじん', '友達', 'ともだち', '友だち'],
  '施設職員・ケアマネージャー': ['ケアマネ', '施設職員', '施設の職員'],
  // 居住種別・ペット
  自宅: ['じたく', '家', 'いえ'],
  犬: ['いぬ'],
  猫: ['ねこ'],
}

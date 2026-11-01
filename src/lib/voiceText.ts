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

/** 日にちの言い方（「じゅうよっか」「にじゅうよっか」は前に「じゅう」「にじゅう」が付く） */
const DAY_WORDS: [string, number][] = [
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

/** かなの数（「に」「じゅうご」「にじゅうさん」など） */
const KANA_DIGIT: [string, number][] = [
  ['きゅう', 9],
  ['いち', 1],
  ['さん', 3],
  ['よん', 4],
  ['ろく', 6],
  ['なな', 7],
  ['しち', 7],
  ['はち', 8],
  ['に', 2],
  ['よ', 4],
  ['し', 4],
  ['ご', 5],
  ['く', 9],
]

function kanaToNumber(h: string): number | null {
  if (!h) return null
  let total = 0
  let current = 0
  let i = 0
  while (i < h.length) {
    if (h.startsWith('じゅう', i)) {
      total += (current || 1) * 10
      current = 0
      i += 3
      continue
    }
    const hit = KANA_DIGIT.find(([w]) => h.startsWith(w, i))
    if (!hit) return null
    current = current * 10 + hit[1]
    i += hit[0].length
  }
  return total + current
}

/**
 * 一音だけで言われたとき、同じ音の別の漢字で返ってくることがある（「に」→「荷」、「ご」→「後」など）。
 * 月・日など数字の欄では、それを数字として扱う。
 */
const SOUND_ALIKE: Record<string, number> = {
  壱: 1, 位置: 1,
  荷: 2, 似: 2, 煮: 2, 児: 2, 弐: 2,
  産: 3, 山: 3, 参: 3, 酸: 3,
  死: 4, 詩: 4, 氏: 4, 余: 4,
  後: 5, 語: 5, 碁: 5, 御: 5, 誤: 5, 午: 5,
  録: 6,
  蜂: 8, 鉢: 8,
  急: 9, 級: 9, 球: 9, 旧: 9, 苦: 9,
  銃: 10,
}

/** 声で返った文字を数字だけの文字列に（漢数字・かなの数・「いつか」・同じ音の漢字なども） */
export function parseSpokenNumber(text: string): string | null {
  const t = text.normalize('NFKC')
  const digits = t.replace(/[^\d]/g, '')
  if (digits) return digits
  // 力を入れて言ったときの「っ」「ー」や、後ろの「がつ」「にち」などを取る
  let h = toHiragana(t)
    .replace(/[\s、。,.!?！？「」ー〜]/g, '')
    .replace(/っ+$/, '')
  for (let k = 0; k < 3; k++) h = h.replace(/(がつ|月|にち|日|ねん|年|です|ばん|番|ごう|号)$/, '')
  if (!h) return null
  for (const [word, n] of DAY_WORDS) {
    if (!h.endsWith(word)) continue
    const head = h.slice(0, -word.length)
    if (!head) return String(n)
    if (n === 4 && (head === 'じゅう' || head === '十')) return '14'
    if (n === 4 && (head === 'にじゅう' || head === '二十')) return '24'
  }
  const kanji = kanjiToNumber(h)
  if (kanji !== null) return String(kanji)
  const kana = kanaToNumber(h)
  if (kana !== null) return String(kana)
  if (h in SOUND_ALIKE) return String(SOUND_ALIKE[h])
  return null
}

const ERAS: [string[], number][] = [
  [['令和', 'れいわ'], 2018],
  [['平成', 'へいせい'], 1988],
  [['昭和', 'しょうわ'], 1925],
  [['大正', 'たいしょう'], 1911],
  [['明治', 'めいじ'], 1867],
]

/** 「昭和47年」「しょうわよんじゅうななねん」「平成元年」などを西暦に */
export function parseSpokenYear(text: string): string | null {
  const t = toHiragana(text.normalize('NFKC')).replace(/\s/g, '').replace(/ねん/g, '年')
  for (const [names, base] of ERAS) {
    const name = names.find((nm) => t.includes(nm))
    if (!name) continue
    const rest = t.slice(t.indexOf(name) + name.length)
    if (rest.startsWith('元') || rest.startsWith('がん')) return String(base + 1)
    const n = parseSpokenNumber(rest.split('年')[0])
    if (n) return String(base + Number(n))
  }
  const four = t.match(/\d{4}/)
  if (four) return four[0]
  const n = parseSpokenNumber(t.split('年')[0])
  return n && n.length === 4 ? n : null
}

/**
 * 生年月日をひと言で言われたとき（「しょうわ47ねん2がつ5にち」）に、年・月・日に分ける。
 * 「年」「月」「日」の目印がある部分だけを返す（目印がなければ空）。
 */
export function parseSpokenDate(text: string): { year?: string; month?: string; day?: string } {
  let t = toHiragana(text.normalize('NFKC')).replace(/[\s、。,.]/g, '')
  const out: { year?: string; month?: string; day?: string } = {}
  const ym = t.match(/年|ねん/)
  if (ym && ym.index !== undefined) {
    const y = parseSpokenYear(t.slice(0, ym.index) + '年')
    if (y && Number(y) >= 1900 && Number(y) <= new Date().getFullYear()) out.year = y
    t = t.slice(ym.index + ym[0].length)
  }
  const mm = t.match(/月|がつ/)
  if (mm && mm.index !== undefined) {
    const m = parseSpokenNumber(t.slice(0, mm.index))
    if (m && Number(m) >= 1 && Number(m) <= 12) out.month = String(Number(m))
    t = t.slice(mm.index + mm[0].length)
  }
  const hasDayMark = /日|にち|か$|たち$/.test(t)
  if (t && (hasDayMark || out.month)) {
    const d = parseSpokenNumber(t)
    if (d && Number(d) >= 1 && Number(d) <= 31) out.day = String(Number(d))
  }
  return out
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

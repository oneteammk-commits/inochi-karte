import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ALIASES_JA,
  hasKanji,
  itemReading,
  parseSpokenDate,
  parseSpokenNumber,
  parseSpokenYear,
  spellDigits,
  toHiragana,
  toKatakana,
  toSpeechText,
} from '../lib/voiceText'

/**
 * 音声ガイド（第1段階）
 * - 「声でご案内」を押した人にだけ有効。押さない人には何も起きない（画面も今までと同じ）。
 * - 読み上げ: ステップが変わったとき・項目をタップしたとき・選択ボタンを押したとき・エラーのとき。
 *   ステップの最初と、入力が終わるたびに「次は〇〇」と、まだ入っていない項目を順番に案内する。
 * - 声で答える: 🎤ボタン → 案内中の項目に入れる／選択肢・ボタンを声で選ぶ／「つぎへ」「もどる」。
 *   少し間があいても途切れないよう、黙ってから3秒たつまで聞き続ける。
 * - 声が通らない端末でも、読み上げ＋画面のボタンで最後まで進める（声は補助）。
 * - 編集用パスワードは声に出さない（読み上げない・声で入れない）。
 * - フリガナは声だと漢字で返ってくることが多いので、漢字のときは入れずに案内する（空欄でも登録できる）。
 */

type RecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal?: boolean }

/** 聞き取りの候補の中から、漢字を含まない（かなの）候補を選ぶ。なければ1番目の候補 */
function pickKana(r: RecognitionResultLike): string {
  const alts = Array.from({ length: r.length }, (_, i) => r[i]?.transcript ?? '').filter(Boolean)
  return alts.find((a) => !hasKanji(a)) ?? alts[0] ?? ''
}

/** フリガナ用に整える（「こ、ん、ど、う」のように区切って言われた場合はつなげる） */
function toFurigana(text: string): string {
  const parts = text
    .normalize('NFKC')
    .replace(/[、。,.・]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const spelled = parts.length > 1 && parts.every((p) => p.length <= 2)
  return toKatakana(spelled ? parts.join('') : parts.join(' '))
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: { resultIndex?: number; results: ArrayLike<RecognitionResultLike> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop?: () => void
  abort: () => void
}

const SPEECH_LANG: Record<string, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  zh: 'zh-CN',
  ko: 'ko-KR',
  fr: 'fr-FR',
  id: 'id-ID',
  my: 'my-MM',
}

const STORAGE_KEY = 'sitte_voice_guide'
/** 話し終わってから、聞き取りを終えるまでの待ち時間 */
const SILENCE_MS = 1000
/** 電話番号（けたが足りないうち）や生年月日のように、区切って言うことが多い項目での待ち時間 */
const SILENCE_LONG_MS = 2000
/** 1回の聞き取りの上限 */
const MAX_LISTEN_MS = 30000
/** 読み上げを止めてから、マイクを開くまでの間（スピーカーの残りの声を拾わないため） */
const AFTER_SPEECH_MS = 350
/** 自動の聞き取りで、何も聞こえなかったときに続けて待つ回数（これを超えたらボタンを押してもらう） */
const AUTO_EMPTY_LIMIT = 3
/** 日本語の読み上げの速さ（1 が標準。ゆっくりめ） */
const SPEECH_RATE_JA = 0.78

/**
 * 聞き取った言葉の先頭に、sitte 自身の読み上げ（スピーカーの声）が混ざっていたら取り除く。
 * 読み上げ中はマイクを閉じているが、機種によっては声の終わりを拾うことがあるための保険。
 * 混ざるのは読み上げの「終わりの部分」なので、読み上げ文の末尾（句読点で区切った続き）と一致するときだけ取り除く。
 * 本人の答えが読み上げの末尾と同じ（選択肢の最後を言った など）ときは、取り除かずそのまま使う
 */
function stripEcho(raw: string, spoken: string): string {
  if (!raw || !spoken) return raw
  const squash = (x: string) => x.replace(/[\s、。,.!?！？「」『』()（）]/g, '')
  const sq = squash(raw)
  let best = 0
  for (const variant of spoken.split('\n')) {
    const clauses = variant
      .split(/[、。,.!?！？「」『』()（）]+/)
      .map(squash)
      .filter(Boolean)
    for (let k = 0; k < clauses.length; k++) {
      const tail = clauses.slice(k).join('')
      if (tail.length >= 4 && sq.startsWith(tail)) best = Math.max(best, tail.length)
    }
  }
  if (!best) return raw
  // 読み上げの分だけ、空白や句読点を飛ばしながら先頭から消す
  let used = 0
  let i = 0
  while (i < raw.length && used < best) {
    if (squash(raw[i])) used++
    i++
  }
  const rest = raw.slice(i).replace(/^[\s、。,.!?！？]+/, '')
  // 残りが無いときは、本人が読み上げの末尾と同じ言葉（選択肢の最後・例の通り など）を言ったとみなして、そのまま使う
  return rest || raw
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionLike)
    | null
}

function hasSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** 比較用に正規化（空白・句読点・全角半角・カタカナとひらがなの差をなくす） */
function norm(s: string): string {
  return toHiragana(
    s
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s、。,.・()（）「」!?！？:：]/g, ''),
  )
}

/** 入力欄の名前（ラベル）を画面から拾う */
function fieldLabel(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return clean(aria)
  const group = el.closest('label')?.querySelector('span')?.textContent
  const prev = el.previousElementSibling
  const own = prev && prev.tagName === 'SPAN' ? prev.textContent : ''
  const parts = [clean(group), clean(own)].filter(Boolean)
  // 同じ文言が続く場合は1回だけ
  return parts.filter((p, i) => parts.indexOf(p) === i).join(' ')
}

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return ['text', 'tel', 'search', 'email', 'number', 'password', ''].includes(type)
}

/** 日付入力欄（ペットの接種日など、type="date" の欄） */
function isDateInput(el: Element | null): el is HTMLInputElement {
  return !!el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'date'
}

/** 'YYYY-MM-DD' を読み上げ用に（日本語なら 2025年4月10日） */
function dateForSpeech(iso: string, lang: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  if (lang === 'ja' || lang === 'zh') return `${Number(y)}年${Number(mo)}月${Number(d)}日`
  if (lang === 'ko') return `${Number(y)}년 ${Number(mo)}월 ${Number(d)}일`
  return `${y}-${mo}-${d}`
}

/** 言われた日付（「2025年4月10日」「2025/4/10」「10 April 2025」「April 10, 2025」など）を 'YYYY-MM-DD' に。分からなければ null */
function parseDateToIso(text: string, lang: string): string | null {
  const t = text.normalize('NFKC').trim()
  const thisYear = new Date().getFullYear()
  const ok = (y: number, m: number, d: number) =>
    y >= 1990 && y <= thisYear + 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31
      ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      : null
  // 2025-04-10 / 2025/4/10 / 2025.4.10 / 2025年4月10日
  let m = /(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/.exec(t)
  if (m) return ok(Number(m[1]), Number(m[2]), Number(m[3]))
  if (lang === 'ja') {
    const d = parseSpokenDate(t)
    if (d.year && d.month && d.day) return ok(Number(d.year), Number(d.month), Number(d.day))
    return null
  }
  const MONTHS: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
    januari: 1, februari: 2, maret: 3, mei: 5, juni: 6, juli: 7, agustus: 8, oktober: 10, desember: 12,
  }
  const low = t.toLowerCase()
  const monthWord = Object.keys(MONTHS).find((k) => new RegExp(`\\b${k}\\b`).test(low))
  const year = /\b(19\d{2}|20\d{2})\b/.exec(low)
  const nums = low.replace(/\b(19\d{2}|20\d{2})\b/, ' ').match(/\b(\d{1,2})\b/)
  if (monthWord && year && nums) return ok(Number(year[1]), MONTHS[monthWord], Number(nums[1]))
  // 10/4/2025（日/月/年）・4/10/2025（月/日/年）は曖昧なので、年が最後の形は月/日/年として読む
  m = /(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})/.exec(t)
  if (m) return ok(Number(m[3]), Number(m[1]), Number(m[2]))
  return null
}

function isSecret(el: Element | null): boolean {
  return !!el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password'
}

/** 郵便番号・電話番号など、数字を1けたずつ読む欄か */
function isDigitField(el: HTMLElement): boolean {
  if (el.tagName !== 'INPUT') return false
  const input = el as HTMLInputElement
  if (input.type === 'tel' || input.autocomplete === 'postal-code') return true
  return /電話|郵便|番号|連絡先|phone|postal|zip|chip/i.test(fieldLabel(input))
}

function isNumberField(el: HTMLElement): boolean {
  if (el.tagName !== 'INPUT') return false
  const input = el as HTMLInputElement
  return input.inputMode === 'numeric' || input.type === 'tel' || input.autocomplete === 'postal-code'
}

/** 生年月日の「年・月・日」の3つの欄（生年月日の枠の中にある数字欄）。その欄でなければ null */
function dateGroup(el: HTMLElement): HTMLInputElement[] | null {
  if (el.tagName !== 'INPUT') return null
  const box = el.closest('[data-voice-date]')
  if (!box) return null
  const inputs = Array.from(box.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'))
  return inputs.length === 3 && inputs[0].maxLength === 4 && inputs.includes(el as HTMLInputElement) ? inputs : null
}

/** 生年月日の元号（西暦・昭和など）を選ぶ欄。日本語のときだけある */
function dateEraSelect(el: HTMLElement): HTMLSelectElement | null {
  return el.closest('[data-voice-date]')?.querySelector('select') ?? null
}

/** ペットの情報を登録するかのスイッチ（ペットのページにだけある） */
function petToggleOf(root: HTMLElement): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>('label input[type="checkbox"].sr-only')
}

/** 声で順番に案内する欄（空かどうかに関係なく、画面に見えているもの）。元号の欄は年と一緒に扱うので入れない */
function voiceFields(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea')).filter((el) => {
    if (!el.offsetParent || (el as HTMLInputElement).disabled) return false
    if (el.tagName === 'SELECT' && el.closest('[data-voice-date]')) return false
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type
      if (['file', 'checkbox', 'radio', 'hidden', 'password', 'submit', 'button'].includes(type)) return false
    }
    return true
  })
}

function isFuriganaField(el: HTMLElement): boolean {
  return /フリガナ|ふりがな|phonetic|furigana/i.test(fieldLabel(el))
}

/** React が管理する入力欄に値を入れる（React の onChange が動くように） */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT'
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}

/** 声で入れられる欄（画面に見えていて、まだ空のもの）を順番に並べる */
function fillableFields(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea')).filter((el) => {
    if (!el.offsetParent || (el as HTMLInputElement).disabled) return false
    if (el.tagName === 'SELECT' && el.closest('[data-voice-date]')) return false
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type
      if (['file', 'checkbox', 'radio', 'hidden', 'password', 'submit', 'button'].includes(type)) return false
    }
    return !(el as HTMLInputElement).value
  })
}

/** 声の文字の続きをつなぐ（端末によって「全文」で返ったり「続きだけ」で返ったりするため） */
function mergeHeard(acc: string, next: string): string {
  const a = acc.trim()
  const b = next.trim()
  if (!a) return b
  if (!b) return a
  if (b.startsWith(a)) return b
  if (a.endsWith(b)) return a
  return `${a} ${b}`
}

export function VoiceGuide({
  containerRef,
  stepKey,
  error,
  onNext,
  onBack,
}: {
  containerRef: RefObject<HTMLElement | null>
  stepKey: number
  error: string | null
  onNext: () => void
  onBack: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || 'ja').split('-')[0]
  const speechLang = SPEECH_LANG[lang] ?? 'en-US'
  const synthOk = hasSynthesis()
  // 読み上げの区切り（日中は「。」、その他の言語は「. 」）
  const SEP = lang === 'ja' || lang === 'zh' ? '。' : '. '
  const RecognitionCtor = getRecognitionCtor()

  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return synthOk && localStorage.getItem(STORAGE_KEY) === 'on'
    } catch {
      return false
    }
  })
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const lastSpokenRef = useRef('')
  /** いま案内している項目 */
  const targetRef = useRef<HTMLElement | null>(null)
  /** その項目を本人がタップして選んだか（自動で案内しただけか） */
  const tappedRef = useRef(false)
  /** 「もう1匹登録しますか」などを聞いている最中の「追加」ボタン（null なら聞いていない） */
  const addAskRef = useRef<HTMLButtonElement | null>(null)
  /** 選択ボタンのページで、いま聞いているグループ（アレルギー→持病の順）。null ならグループは終わっている */
  const tagGroupRef = useRef<HTMLElement | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  /** 聞き取りの回ごとの番号。読み上げで打ち切った回の結果は使わない */
  const sessionRef = useRef(0)
  const listeningRef = useRef(false)
  /** 読み終わったら自動でマイクを開くか（ボタンを押さずに答えられる） */
  const autoRef = useRef(true)
  /** 自動の聞き取りで、何も聞こえなかった回数（続くとボタンを押してもらう） */
  const emptyCountRef = useRef(0)
  /** いま読んでいる文。これの読み終わりだけで、次の聞き取りを始める */
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)
  const startListeningRef = useRef<(auto: boolean) => void>(() => {})
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  /** 「声でご案内」を押した直後は、あいさつと一緒にページを読むので、ページ読みの自動実行を1回飛ばす */
  const skipReadRef = useRef(false)
  /** 次のページを読むときに先に付ける文（「ペットは登録しません」など） */
  const prefixRef = useRef('')

  const say = useCallback((text: string) => itemReading(text, lang), [lang])

  /**
   * 読み上げる。読んでいる間はマイクを閉じ（自分の声を拾わないため）、読み終わったら自動でマイクを開く。
   * listen: false のときは、読み終わってもマイクを開かない（案内を終えるときなど）
   */
  const speak = useCallback(
    (text: string, opts: { listen?: boolean } = {}) => {
      if (!synthOk || !text) return
      // 聞き取り中なら打ち切る（この回の結果は使わない）
      sessionRef.current++
      try {
        recRef.current?.abort()
      } catch {
        /* noop */
      }
      recRef.current = null
      listeningRef.current = false
      setListening(false)
      const synth = window.speechSynthesis
      synth.cancel()
      const spoken = toSpeechText(text, lang)
      const u = new SpeechSynthesisUtterance(spoken)
      u.lang = speechLang
      const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').startsWith(speechLang.slice(0, 2)))
      if (voice) u.voice = voice
      u.rate = lang === 'ja' ? SPEECH_RATE_JA : 1
      // 読み上げ用の言い換え前と後の両方を覚えておく（聞き取りに混ざった自分の声を取り除くため）
      lastSpokenRef.current = `${text}\n${spoken}`
      utterRef.current = u
      let ended = false
      const startedAt = Date.now()
      const onDone = () => {
        if (ended) return
        ended = true
        window.clearInterval(poll)
        // 途中で別の読み上げに替わった・案内をやめた・自動の聞き取りを止めている、ときは開かない
        if (utterRef.current !== u || !enabledRef.current || opts.listen === false || !autoRef.current) return
        window.setTimeout(() => {
          if (utterRef.current === u && enabledRef.current && autoRef.current) startListeningRef.current(true)
        }, AFTER_SPEECH_MS)
      }
      u.onend = onDone
      u.onerror = (e) => {
        // 別の読み上げで打ち切られたとき（interrupted/canceled）は何もしない
        if (e && (e as { error?: string }).error && /interrupt|cancel/.test(String((e as { error?: string }).error))) {
          ended = true
          window.clearInterval(poll)
          return
        }
        onDone()
      }
      // onend が来ない機種のための保険: 読み終わったはずの長さを過ぎて、話していなければ終わりとみなす
      const minMs = 600 + spoken.length * (lang === 'ja' ? 130 : 60)
      const poll = window.setInterval(() => {
        if (ended) {
          window.clearInterval(poll)
          return
        }
        if (Date.now() - startedAt >= minMs && !synth.speaking && !synth.pending) onDone()
      }, 400)
      synth.speak(u)
    },
    [synthOk, speechLang, lang],
  )

  /** 項目1つ分の読み上げ文 */
  const describe = useCallback(
    (el: HTMLElement): string => {
      const rawLabel = fieldLabel(el)
      // 必須でない項目は「（任意）」を付けて読む（ラベルに書いてあればそのまま）
      const optional = t('register.optional')
      const required = el.getAttribute('aria-required') === 'true' || (el as HTMLInputElement).required || !!dateGroup(el)
      // 必須でない項目は、そのまま答えれば入り、「スキップ」で飛ばせることを案内する
      const optCore = optional.replace(/[()（）\s]/g, '')
      const label = rawLabel.replace(optCore, '').replace(/[（(]\s*[)）]/, '').trim()
      // 「任意です…」は、例や中身のあとに最後に付ける（例の前に付くと順番が分かりにくい）
      const optHow = !required && !isSecret(el) ? t('voice.optionalHow') : ''
      if (el.tagName === 'SELECT') {
        const sel = el as HTMLSelectElement
        const opts = Array.from(sel.options).filter((o) => o.value !== '')
        const now = sel.value ? sel.options[sel.selectedIndex]?.text : ''
        const list =
          opts.length <= 10
            ? t('voice.options', { list: opts.map((o) => say(o.text)).join('、') })
            : t('voice.manyOptions')
        return [label, now ? t('voice.selectedNow', { text: say(now) }) : list, optHow].filter(Boolean).join(SEP)
      }
      if (isTextField(el)) {
        if (isSecret(el)) return [label, t('voice.passwordTap')].join(SEP)
        const digits = isDigitField(el)
        const v = clean((el as HTMLInputElement).value)
        const ph = clean((el as HTMLInputElement).placeholder).replace(/^(例|e\.g\.|ex\.?)\s*[:：）)]?\s*/i, '')
        // 生年月日は、まとめて言えること・「がつ」「にち」を付けて言うことを案内する（短い一音は聞き取られにくいため）
        const group = lang === 'ja' ? dateGroup(el) : null
        const dateHint = group
          ? t(['voice.dateHint', 'voice.monthHint', 'voice.dayHint'][group.indexOf(el as HTMLInputElement)])
          : ''
        // フリガナは、区切って言うと かなで聞き取られやすいので、その言い方を案内する
        const furiganaHow =
          lang === 'ja' && isFuriganaField(el as HTMLInputElement)
            ? t(clean((el as HTMLInputElement).placeholder) === clean(t('register.placeholderEmergencyFurigana')) ? 'voice.furiganaHow2' : 'voice.furiganaHow')
            : ''
        // 自由記入の大きな欄は、いくつでも続けて言えて「以上」で終える（「スキップ」の案内もこの中に入っているので optHow は付けない）
        const multiHow = el.tagName === 'TEXTAREA' ? [optHow ? t('voice.optionalShort') : '', t('voice.multiHow')].filter(Boolean).join(SEP) : ''
        const tail = v
          ? t('voice.filledNow', { text: digits ? spellDigits(v) : v })
          : dateHint
            ? dateHint
            : furiganaHow
              ? furiganaHow
              : ph
                ? `${t('voice.example')} ${digits ? spellDigits(ph) : ph}`
                : ''
        return [label, tail, multiHow || optHow].filter(Boolean).join(SEP)
      }
      if (isDateInput(el)) {
        const v = el.value
        return [label, v ? t('voice.filledNow', { text: dateForSpeech(v, lang) }) : t('voice.dateHow'), optHow].filter(Boolean).join(SEP)
      }
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
        const on = (el as HTMLInputElement).checked
        const text = clean(el.closest('label')?.textContent) || label
        return `${text}${SEP}${on ? t('voice.checked') : t('voice.unchecked')}`
      }
      return [label, optHow].filter(Boolean).join(SEP)
    },
    [t, SEP, say, lang],
  )

  /** 次に案内する項目を決めて、画面をそこまで動かす */
  /** 選択ボタンのグループ（アレルギー・持病）を上から順に */
  const tagGroups = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="group"]')).filter((g) => g.querySelector('button[aria-pressed]'))
  /** グループの「その他」の自由記入欄（同じ枠の中のテキスト欄） */
  const groupOther = (g: HTMLElement) => g.parentElement?.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type="text"]') ?? null
  const askGroup = (g: HTMLElement) => t('voice.tagAsk', { label: clean(g.getAttribute('aria-label')) })
  /** グループのあとに続く入力欄（グループの「その他」欄は除く） */
  const fieldsAfterGroups = (root: HTMLElement) => {
    const others = new Set(tagGroups(root).map(groupOther).filter(Boolean))
    return fillableFields(root).filter((el) => !others.has(el as HTMLTextAreaElement))
  }

  const pointTo = useCallback((el: HTMLElement | null) => {
    targetRef.current = el
    tappedRef.current = false
    if (el) {
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {
        /* noop */
      }
    }
  }, [])

  /** いまのステップの見出しと説明を読み、最初に入れる項目を案内する */
  const readStep = useCallback((prefix = '') => {
    const root = containerRef.current
    if (!root) return
    const h2 = clean(root.querySelector('h2')?.textContent)
    const firstP = clean(root.querySelector('h2 + p')?.textContent)
    const label = t('voice.stepN', { n: Math.min(stepKey + 1, 6) })
    const parts = [prefix, label, h2]
    const petToggle = petToggleOf(root)
    tagGroupRef.current = null
    addAskRef.current = null
    if (root.querySelector('button[aria-pressed]')) {
      // 選択ボタンのページ: 選択肢は読み上げず、グループ（アレルギー→持病）ごとに「あれば言ってください」と聞く
      const g = tagGroups(root)[0] ?? null
      tagGroupRef.current = g
      pointTo(g)
      parts.push(g ? askGroup(g) : t('voice.tagHint'))
    } else if (petToggle && !petToggle.checked) {
      // ペットのページ: 登録するかどうかを「はい」「いいえ」で聞く
      parts.push(firstP, t('voice.petAsk'))
      pointTo(petToggle)
    } else {
      // お薬のページ（「カメラで撮る」ボタンがあるページ）だけ、写真の入れ方を短く言ってから最初の欄へ（説明文は重なるので読まない）
      // ペットのページにも写真の欄はあるが、ボタンの名前が違うのでお薬の案内は読まない
      if (root.querySelector('input[type="file"][capture]')) parts.push(t('voice.medIntro'))
      else if (petToggle && petToggle.checked) parts.push(firstP, t('voice.petIntro'))
      else parts.push(firstP)
      const first = fillableFields(root)[0] ?? null
      pointTo(first)
      if (first) parts.push(`${t('voice.firstIs')}${describe(first)}`)
    }
    speak(parts.filter(Boolean).join(SEP))
  }, [containerRef, speak, stepKey, t, SEP, describe, pointTo, say])

  // ステップが変わったら読む
  useEffect(() => {
    if (!enabled) return
    if (skipReadRef.current) {
      // 「声でご案内」を押したときは、あいさつと一緒にもう読んでいる
      skipReadRef.current = false
      return
    }
    targetRef.current = null
    const prefix = prefixRef.current
    prefixRef.current = ''
    const id = window.setTimeout(() => readStep(prefix), 450)
    return () => window.clearTimeout(id)
  }, [enabled, stepKey, readStep])

  // エラーが出たら読み、まだ入っていない項目を案内する
  useEffect(() => {
    if (!enabled || !error) return
    const root = containerRef.current
    // 案内するのは「必須で空いている項目」だけ（飛ばした任意の項目に戻さない）
    const isRequired = (el: HTMLElement) => el.getAttribute('aria-required') === 'true' || (el as HTMLInputElement).required
    const first = root && !root.querySelector('button[aria-pressed]') ? (fillableFields(root).find(isRequired) ?? null) : null
    const emptyPassword = root?.querySelector<HTMLInputElement>('input[type="password"]:not([disabled])')
    if (first) {
      pointTo(first)
      speak(`${error}${SEP}${describe(first)}`)
    } else if (emptyPassword && !emptyPassword.value && emptyPassword.offsetParent) {
      pointTo(emptyPassword)
      speak(`${error}${SEP}${t('voice.passwordTap')}`)
    } else speak(error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, error])

  // 項目をタップ（フォーカス）したら読む・選択ボタンやスイッチを押したら、切り替わった後の状態を読む
  useEffect(() => {
    const root = containerRef.current
    if (!enabled || !root) return
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (!(isTextField(el) || el.tagName === 'SELECT')) return
      targetRef.current = el
      tappedRef.current = true
      speak(describe(el))
    }
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('button[aria-pressed]') as HTMLButtonElement | null
      if (!btn || !root.contains(btn)) return
      targetRef.current = null
      // クリック後に状態が切り替わるので、少し待ってから読む
      window.setTimeout(() => {
        const on = btn.getAttribute('aria-pressed') === 'true'
        speak(t(on ? 'voice.tagOn' : 'voice.tagOff', { text: say(clean(btn.textContent)) }))
      }, 120)
    }
    const onChange = (e: Event) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'SELECT' && e.isTrusted) {
        const sel = el as HTMLSelectElement
        if (sel.value) speak(t('voice.selected', { text: say(sel.options[sel.selectedIndex]?.text ?? '') }))
      }
      // スイッチ（ペットの情報も登録する など）は、切り替わった後の状態を読む
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
        window.setTimeout(() => speak(describe(el)), 50)
      }
    }
    root.addEventListener('focusin', onFocus)
    root.addEventListener('click', onClick)
    root.addEventListener('change', onChange)
    return () => {
      root.removeEventListener('focusin', onFocus)
      root.removeEventListener('click', onClick)
      root.removeEventListener('change', onChange)
    }
  }, [enabled, containerRef, speak, describe, t, say])

  // 画面下の操作パネルに「次へ」ボタンが隠れないよう、案内中はページ下に余白を足す
  useEffect(() => {
    if (!enabled) return
    const prev = document.body.style.paddingBottom
    const prevBg = document.body.style.backgroundColor
    document.body.style.paddingBottom = '220px'
    document.body.style.backgroundColor = '#f5f5f4' // 登録画面の背景色（stone-100）に合わせる
    return () => {
      document.body.style.paddingBottom = prev
      document.body.style.backgroundColor = prevBg
    }
  }, [enabled])

  // 案内をやめたら・画面を離れたら読み上げと聞き取りを止める
  useEffect(() => {
    if (enabled) return
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* noop */
    }
    recRef.current?.abort()
  }, [enabled])
  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* noop */
      }
      recRef.current?.abort()
    },
    [],
  )

  const commandWords = (key: string) =>
    t(key)
      .split('|')
      .map((w) => norm(w))
      .filter(Boolean)

  /** 画面の文字と、その言い換え（日本語のみ）を比べる用に並べる */
  const matchKeys = (text: string): string[] => {
    const keys = [text]
    if (lang === 'ja') {
      keys.push(itemReading(text, 'ja'), ...(ALIASES_JA[text] ?? []))
    }
    return keys.map(norm).filter(Boolean)
  }

  /** 選択ボタン（アレルギー・持病など）から、言われたものを探す */
  const findTagButtons = (root: HTMLElement, n: string): HTMLButtonElement[] => {
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'))
    const hits = buttons.filter((b) => matchKeys(clean(b.textContent)).some((k) => n.includes(k)))
    // 同じ名前のボタンが複数のグループにある場合（「なし」など）は、まだ何も選んでいないグループの方だけ
    const seen = new Set<string>()
    return hits.filter((b) => {
      const name = clean(b.textContent)
      const same = hits.filter((h) => clean(h.textContent) === name)
      if (same.length === 1) return true
      if (seen.has(name)) return false
      const pick =
        same.find((h) => !h.parentElement?.querySelector('button[aria-pressed="true"]')) ?? same[0]
      if (pick === b) {
        seen.add(name)
        return true
      }
      return false
    })
  }

  /** 「＋ もう1匹追加」「＋ お薬を追加」のボタン（あれば） */
  const addButtonOf = (root: HTMLElement): HTMLButtonElement | null => {
    const names = [t('register.buttonAddPet'), t('register.buttonAddMedicine')].map((x) => clean(x))
    return (
      Array.from(root.querySelectorAll<HTMLButtonElement>('button[type="button"]')).find(
        (b) => b.offsetParent && names.includes(clean(b.textContent)),
      ) ?? null
    )
  }
  const addAskText = (btn: HTMLButtonElement) =>
    t(clean(btn.textContent) === clean(t('register.buttonAddPet')) ? 'voice.addMorePet' : 'voice.addMoreMed')

  /** ページの最後まで来たとき: 追加ボタンがあれば「もう1匹登録しますか」と聞き、なければ「ここまで」 */
  const pageEnd = (doneMsg: string) => {
    const root = containerRef.current
    const btn = root ? addButtonOf(root) : null
    if (btn) {
      addAskRef.current = btn
      speak([doneMsg, addAskText(btn)].filter(Boolean).join(SEP))
      return
    }
    speak([doneMsg, t('voice.pageDone')].filter(Boolean).join(SEP))
  }

  /** 入れ終わったら、次の空いている項目を案内する */
  const afterFill = (doneMsg: string, from: HTMLElement) => {
    const root = containerRef.current
    const all = root ? fillableFields(root) : []
    // 後ろの空いている項目だけ。前には戻らない（飛ばした項目に戻されないように。空欄のままでも進める）
    const next = all.find((el) => from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null
    pointTo(next)
    if (next) speak(`${doneMsg}${SEP}${t('voice.nextIs')}${describe(next)}`)
    else pageEnd(doneMsg)
  }

  /** 「戻る」: 1つ前の項目に戻って、いま入っている内容を読む（言い直せば上書きできる） */
  const goPrevField = () => {
    const root = containerRef.current
    const cur = targetRef.current && targetRef.current.isConnected ? targetRef.current : null
    const all = root ? voiceFields(root) : []
    const before = cur ? all.filter((el) => el.compareDocumentPosition(cur) & Node.DOCUMENT_POSITION_FOLLOWING) : []
    const prev = before[before.length - 1] ?? null
    if (!prev) {
      speak(t('voice.noPrev'))
      return
    }
    pointTo(prev)
    tappedRef.current = true
    speak(`${t('voice.backTo')}${SEP}${describe(prev)}`)
  }

  /** 選択ボタンのページで、次のグループへ。グループが終わったら、そのあとの入力欄へ */
  const nextTagGroup = (done: string) => {
    const root = containerRef.current
    const group = tagGroupRef.current
    if (!root || !group) return
    const gs = tagGroups(root)
    const g2 = gs[gs.indexOf(group) + 1] ?? null
    tagGroupRef.current = g2
    if (g2) {
      pointTo(g2)
      speak([done, askGroup(g2)].filter(Boolean).join(SEP))
      return
    }
    const first = fieldsAfterGroups(root)[0] ?? null
    pointTo(first)
    speak([done, first ? `${t('voice.nextIs')}${describe(first)}` : t('voice.pageDone')].filter(Boolean).join(SEP))
  }

  /** 「飛ばす」: この項目は空けたまま、次の項目へ */
  const skipField = () => {
    const root = containerRef.current
    if (tagGroupRef.current && tagGroupRef.current.isConnected && !tappedRef.current) {
      nextTagGroup(t('voice.skipped'))
      return
    }
    const cur = targetRef.current && targetRef.current.isConnected ? targetRef.current : null
    if (!root || !cur) {
      speak(`${t('voice.skipped')}${SEP}${t('voice.pageDone')}`)
      return
    }
    const later = voiceFields(root).filter((el) => cur.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    const next = later.find((el) => !(el as HTMLInputElement).value) ?? null
    pointTo(next)
    if (next) speak(`${t('voice.skipped')}${SEP}${t('voice.nextIs')}${describe(next)}`)
    else pageEnd(t('voice.skipped'))
  }

  /** 聞き取った言葉を画面に反映する */
  const handleHeard = (raw: string, kanaRaw = '', alts: string[] = []) => {
    const text = clean(raw).replace(/[。.]$/, '')
    setHeard(text)
    const n = norm(text)
    if (!n) {
      speak(t('voice.notUnderstood'))
      return
    }
    // 合図の言葉は、1番目の候補だけでなく、かなの候補・ほかの候補でも比べる（「飛ばす」が「都バス」と聞き取られる など）
    const cands = [n, norm(clean(kanaRaw)), ...alts.map((a) => norm(clean(a)))].filter((c, i, a) => c && a.indexOf(c) === i)
    const isCmd = (key: string, loose = false) =>
      commandWords(key).some((w) => cands.some((c) => c === w || (loose && c.startsWith(w))))
    // 1) 合図の言葉
    if (isCmd('voice.cmdStop')) {
      turnOff()
      window.setTimeout(() => speak(t('voice.stopped'), { listen: false }), 150)
      return
    }
    if (isCmd('voice.cmdNext', true)) {
      onNext()
      return
    }
    if (isCmd('voice.cmdPrevPage', true)) {
      onBack()
      return
    }
    if (isCmd('voice.cmdBack', true)) {
      goPrevField()
      return
    }
    // 「分からない」などは「飛ばす」の合図でもあるが、いまのプルダウンにその言葉どおりの選択肢があれば、選択肢として扱う
    // （例: ペットの不妊・去勢手術「分からない」、性別「不明」）
    const curSel = targetRef.current && targetRef.current.isConnected && targetRef.current.tagName === 'SELECT'
      ? (targetRef.current as HTMLSelectElement)
      : null
    const answersOption =
      !!curSel &&
      Array.from(curSel.options).some((o) => o.value && matchKeys(o.text).some((k) => cands.includes(k)))
    if (isCmd('voice.cmdSkip', true) && !answersOption) {
      skipField()
      return
    }
    if (commandWords('voice.cmdRepeat').some((w) => cands.some((c) => c.includes(w)))) {
      const el = targetRef.current
      if (el && el.isConnected) speak(describe(el))
      else readStep()
      return
    }

    const root = containerRef.current
    let el = targetRef.current && targetRef.current.isConnected ? targetRef.current : null

    // 1.4) 「もう1匹登録しますか」「ほかのお薬も登録しますか」への答え
    const addBtn = addAskRef.current && addAskRef.current.isConnected ? addAskRef.current : null
    if (root && addBtn && !tappedRef.current) {
      if (isCmd('voice.cmdYes', true)) {
        addAskRef.current = null
        const before = new Set(fillableFields(root))
        addBtn.click()
        // 欄が増えてから、新しい欄の最初を案内する
        window.setTimeout(() => {
          const first = fillableFields(root).find((f) => !before.has(f)) ?? null
          pointTo(first)
          speak(first ? `${t('voice.added')}${SEP}${t('voice.firstIs')}${describe(first)}` : t('voice.added'))
        }, 350)
        return
      }
      if (isCmd('voice.cmdNo', true)) {
        addAskRef.current = null
        // 追加しない: 同じページにパスワード欄があればその案内、なければ「ここまで」
        const pw = root.querySelector<HTMLInputElement>('input[type="password"]')
        if (pw && pw.offsetParent && !pw.value) {
          pointTo(pw)
          speak(`${t('voice.nextIs')}${describe(pw)}`)
        } else speak(t('voice.pageDone'))
        return
      }
      speak(`${t('voice.heardAs', { text })}${SEP}${addAskText(addBtn)}`)
      return
    }

    // 1.5) ペットを登録するかの質問: 「はい」で登録、「いいえ」で次のページへ
    const petBox = root ? petToggleOf(root) : null
    if (petBox && !petBox.checked) {
      const box = petBox
      if (isCmd('voice.cmdNo', true)) {
        // 登録しない: 同じページの次の欄へ（編集用パスワードは声では入れられないので、その案内を読む）
        const pw = root?.querySelector<HTMLInputElement>('input[type="password"]') ?? null
        if (pw && pw.offsetParent) {
          pointTo(pw)
          speak(`${t('voice.petSkip')}${SEP}${t('voice.nextIs')}${describe(pw)}`)
        } else afterFill(t('voice.petSkip'), box)
        return
      }
      if (isCmd('voice.cmdYes', true)) {
        if (!box.checked) box.click()
        // 切り替わって欄が出てから、最初の欄を案内する
        window.setTimeout(() => {
          const first = root ? fillableFields(root)[0] ?? null : null
          pointTo(first)
          speak(first ? `${t('voice.petOn')}${SEP}${t('voice.petIntro')}${SEP}${t('voice.firstIs')}${describe(first)}` : `${t('voice.petOn')}${SEP}${t('voice.petIntro')}`)
        }, 350)
        return
      }
      speak(`${t('voice.heardAs', { text })}${SEP}${t('voice.petAsk')}`)
      return
    }

    // 2) 選択ボタン（アレルギー・持病など）: 本人がタップした入力欄がなければ、まずボタンを探す
    const group = tagGroupRef.current && tagGroupRef.current.isConnected && (!el || !tappedRef.current) ? tagGroupRef.current : null
    if (root && group) {
      if (isCmd('voice.cmdNone', true)) {
        // 「なし」: そのグループに「なし」のボタンがあれば押して、次のグループへ
        const noneBtn = Array.from(group.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')).find((b) =>
          commandWords('voice.cmdNone').includes(norm(clean(b.textContent))),
        )
        // すでに何か選んでいれば「もうない」の意味なので、「なし」は押さない
        const press = !!noneBtn && !group.querySelector('button[aria-pressed="true"]')
        if (press) noneBtn.click()
        window.setTimeout(() => nextTagGroup(press ? t('voice.tagOn', { text: say(clean(noneBtn.textContent)) }) : ''), press ? 250 : 0)
        return
      }
      const hits = findTagButtons(root, n)
      if (hits.length === 0) {
        // 項目にない言葉: そのグループの「その他」欄に書く
        const other = groupOther(group)
        if (other) {
          setNativeValue(other, [other.value, text].filter(Boolean).join('、'))
          // 漢字を含む言葉は読み返さない（iPhoneが一文字ずつ訓読みするため）
          speak(`${t(hasKanji(text) ? 'voice.tagOtherNoEcho' : 'voice.tagOther', { text })}${SEP}${t('voice.tagMore')}`)
          return
        }
      }
    }
    if (root && (!el || !tappedRef.current || el.tagName === 'TEXTAREA')) {
      const hits = findTagButtons(root, n)
      if (hits.length > 0) {
        const already = hits.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => say(clean(b.textContent)))
        const toPress = hits.filter((b) => b.getAttribute('aria-pressed') !== 'true')
        const turnedOn = toPress.map((b) => say(clean(b.textContent)))
        // 1つずつ、画面が切り替わるのを待ってから押す（同時に押すと前の選択が消えるため）
        toPress.forEach((b, i) => window.setTimeout(() => b.click(), i * 150))
        const msgs = [
          turnedOn.length ? t('voice.tagOn', { text: turnedOn.join('、') }) : '',
          already.length ? t('voice.alreadyOn', { text: already.join('、') }) : '',
          group ? t('voice.tagMore') : '',
        ].filter(Boolean)
        // ボタンのクリックの読み上げと重ならないよう、押し終わってからまとめて読む
        window.setTimeout(() => speak(msgs.join(SEP)), toPress.length * 150 + 200)
        return
      }
    }

    // 何も選ばれていなければ、まだ入っていない最初の項目に入れる
    if (!el && root) {
      el = fillableFields(root)[0] ?? null
    }

    // 2.5) 日付の欄（ペットの接種日など）: 年・月・日がそろって聞き取れたら入れる
    if (el && isDateInput(el)) {
      const input = el
      const cands = [text, ...alts.map(clean)].filter((c, i, a) => c && a.indexOf(c) === i)
      const iso = cands.map((c) => parseDateToIso(c, lang)).find((v): v is string => !!v) ?? null
      if (iso) {
        setNativeValue(input, iso)
        afterFill(t('voice.filled', { text: dateForSpeech(iso, lang) }), input)
      } else {
        speak(`${t('voice.heardAs', { text })}${SEP}${t('voice.dateHow')}`)
      }
      return
    }

    // 3) 入力欄に入れる
    if (el && isTextField(el)) {
      if (isSecret(el)) {
        speak(t('voice.passwordTap'))
        return
      }
      const input = el as HTMLInputElement
      // 自由記入の大きな欄: 言った分を足していき、「以上」「なし」で次へ（1つ言っただけでは進まない）
      if (el.tagName === 'TEXTAREA') {
        if (isCmd('voice.cmdNone', true)) {
          afterFill(t(input.value ? 'voice.multiDone' : 'voice.skipped'), input)
          return
        }
        setNativeValue(input, [input.value, text].filter(Boolean).join('\n'))
        speak(`${t('voice.filledCheck')}${SEP}${t('voice.multiMore')}`)
        return
      }
      let value = text
      // 聞き取りの候補（1番目＋ほかの候補）。一音だけだと1番目が数字にならないことがあるため
      const candidates = [text, ...alts.map(clean)].filter((c, i, a) => c && a.indexOf(c) === i)
      // 生年月日: 「しょうわ47ねん2がつ5にち」のようにまとめて言われたら、年・月・日に分けて入れる
      const group = lang === 'ja' ? dateGroup(input) : null
      const eraSel = group ? dateEraSelect(input) : null
      if (group) {
        const date = candidates.map(parseSpokenDate).find((d) => d.year || d.month || d.day)
        if (date) {
          const fills = (
            [
              // 西暦の年を入れるので、元号の欄は「西暦」に戻しておく
              [eraSel, date.year && eraSel && eraSel.value !== 'seireki' ? 'seireki' : undefined],
              [group[0], date.year],
              [group[1], date.month],
              [group[2], date.day],
            ] as [HTMLInputElement | HTMLSelectElement | null, string | undefined][]
          ).filter((f): f is [HTMLInputElement | HTMLSelectElement, string] => !!f[0] && !!f[1])
          // 1つずつ、画面が切り替わるのを待ってから入れる（同時に入れると前の値が消えるため）
          fills.forEach(([f, v], i) => window.setTimeout(() => setNativeValue(f, v), i * 150))
          const shown = `${date.year ? `${date.year}年` : ''}${date.month ? `${date.month}月` : ''}${date.day ? `${date.day}日` : ''}`
          const lastFilled = fills[fills.length - 1][0]
          window.setTimeout(() => afterFill(t('voice.filled', { text: shown }), lastFilled), fills.length * 150 + 50)
          return
        }
      }
      // 生年月日の年: 西暦（「1972」「しょうわ47ねん」）なら元号を西暦にして入れる。元号を選んであれば「47」だけでも入る
      if (group && group.indexOf(input) === 0) {
        const thisYear = new Date().getFullYear()
        const western = candidates
          .map(parseSpokenYear)
          .find((v) => !!v && Number(v) >= 1900 && Number(v) <= thisYear)
        if (western) {
          if (eraSel && eraSel.value !== 'seireki') setNativeValue(eraSel, 'seireki')
          window.setTimeout(() => {
            setNativeValue(input, western)
            afterFill(t('voice.filled', { text: `${western}年` }), input)
          }, 150)
          return
        }
        const eraYear =
          eraSel && eraSel.value !== 'seireki'
            ? candidates.map(parseSpokenNumber).find((v) => !!v && Number(v) >= 1 && Number(v) <= 64)
            : undefined
        if (eraYear) {
          setNativeValue(input, eraYear)
          const eraName = eraSel?.options[eraSel.selectedIndex]?.text ?? ''
          afterFill(t('voice.filled', { text: `${eraName}${eraYear}年` }), input)
          return
        }
        // ひと言で入らなかったときは、年→月→日に分けて聞き直す
        targetRef.current = input
        tappedRef.current = true
        speak(`${t('voice.heardAs', { text })}${SEP}${t('voice.dateSplit')}`)
        return
      }
      if (isNumberField(input)) {
        const isYear = input.maxLength === 4
        const pick = (c: string) => (isYear ? parseSpokenYear(c) : null) ?? parseSpokenNumber(c)
        const month = group ? group.indexOf(input) === 1 : false
        const day = group ? group.indexOf(input) === 2 : false
        const ok = (v: string | null) =>
          !!v && (!month || (Number(v) >= 1 && Number(v) <= 12)) && (!day || (Number(v) >= 1 && Number(v) <= 31))
        value = candidates.map(pick).find(ok) ?? ''
        if (!value) {
          if (month || day) {
            // 月・日は、聞こえた言葉と言い方の例をもう一度伝えて、同じ欄で待つ
            targetRef.current = input
            tappedRef.current = true
            speak(`${t('voice.heardAs', { text })}${SEP}${t(month ? 'voice.monthHint' : 'voice.dayHint')}`)
            return
          }
          speak(t('voice.notNumber', { text }))
          return
        }
        if (input.maxLength > 0) value = value.slice(0, input.maxLength)
      } else if (lang === 'ja' && isFuriganaField(input)) {
        // 聞き取りは漢字に変えて返すことが多いので、候補の中のかなを使う
        const kana = [toFurigana(text), toFurigana(clean(kanaRaw)), ...alts.map((a) => toFurigana(clean(a)))].find((k) => k && !hasKanji(k))
        if (!kana) {
          // 漢字でしか返らない機種（iPhoneなど）がある: 言い直しはさせず、入れずに次へ（空欄でも登録できる）
          afterFill(t('voice.furiganaKanji'), input)
          return
        }
        value = kana
      }
      setNativeValue(input, value)
      if (input.getAttribute('autocomplete') === 'postal-code' && root) {
        // 郵便番号: 住所の自動入力（通信）を待ってから、入った住所を読み、その次の空いている欄を案内する
        const prefSel = root.querySelector<HTMLSelectElement>(`select[aria-label="${t('register.labelPrefecture')}"]`)
        const citySel = root.querySelector<HTMLInputElement>(`input[aria-label="${t('register.labelCity')}"]`)
        const started = Date.now()
        const wait = () => {
          const pref = prefSel?.value ? prefSel.options[prefSel.selectedIndex]?.text ?? '' : ''
          if (pref || Date.now() - started > 3500) {
            const addr = [pref, citySel?.value ?? ''].filter(Boolean).join(' ')
            const msg = addr ? t('voice.postalFilled', { text: addr }) : t('voice.filled', { text: spellDigits(value) })
            afterFill(msg, citySel && addr ? citySel : input)
            return
          }
          window.setTimeout(wait, 200)
        }
        window.setTimeout(wait, 400)
        return
      }
      // 数字・かなはそのまま読み返す。漢字を含む自由記入は読み返さない（iPhoneが知らない言葉を一文字ずつ訓読みするため）
      const echo = isDigitField(input) ? spellDigits(value) : hasKanji(value) ? '' : value
      afterFill(echo ? t('voice.filled', { text: echo }) : t('voice.filledCheck'), input)
      return
    }

    // 4) プルダウンから選ぶ
    if (el && el.tagName === 'SELECT') {
      const sel = el as HTMLSelectElement
      const opts = Array.from(sel.options).filter((o) => o.value)
      // 1) ぴったり同じ言葉 → 2) 部分一致のうち、いちばん長く一致した選択肢
      //   （「手術は分からない」が「ない」で「していない」に吸われないように）
      const partial = (o: HTMLOptionElement) =>
        Math.max(0, ...matchKeys(o.text).map((k) => (n.includes(k) ? k.length : k.length > 1 && k.includes(n) ? n.length : 0)))
      const hit =
        opts.find((o) => matchKeys(o.text).some((k) => k === n)) ??
        opts.reduce<HTMLOptionElement | null>((best, o) => {
          const sc = partial(o)
          return sc > 0 && (!best || sc > partial(best)) ? o : best
        }, null)
      if (hit) {
        setNativeValue(sel, hit.value)
        afterFill(t('voice.selected', { text: say(hit.text) }), sel)
      } else {
        speak(t('voice.notInOptions', { text }))
      }
      return
    }

    speak(t('voice.noField'))
  }

  /**
   * マイクを開いて聞き取る。auto=true は読み終わりからの自動、false はボタンから。
   * 読み上げ中はマイクを開かない（読み上げを止めてから少し待って開く）
   */
  const startListening = (auto = false) => {
    if (!RecognitionCtor || listeningRef.current) return
    if (!auto) {
      // ボタンを押したら、自動の聞き取りをまた使う（聞こえなくて止めていたときのため）
      autoRef.current = true
      emptyCountRef.current = 0
    }
    const synth = window.speechSynthesis
    let wasSpeaking = false
    try {
      wasSpeaking = !!synth && (synth.speaking || synth.pending)
      utterRef.current = null // 読み上げの終わりで、さらにマイクを開かないように
      synth?.cancel()
    } catch {
      /* noop */
    }
    listeningRef.current = true
    setListening(true)
    const session = ++sessionRef.current
    const spokenBefore = lastSpokenRef.current
    const begin = () => {
      if (session !== sessionRef.current) return
      const rec = new RecognitionCtor()
      rec.lang = speechLang
      // 少し間があいても終わらないよう、続けて聞き、黙ってから3秒で区切る
      rec.continuous = true
      rec.interimResults = true
      // フリガナ用に、候補を5つまで受け取る（かなの候補を探すため）
      rec.maxAlternatives = 5
      let finalText = ''
      let interimText = ''
      let finalKana = ''
      let interimKana = ''
      // 2番目以降の候補も、それぞれつないでおく（月・日の数字を候補の中から探すため）
      let finalAlts: string[] = []
      let interimAlts: string[] = []
      const addAlts = (base: string[], r: RecognitionResultLike) => {
        const out = [...base]
        for (let k = 1; k < Math.min(r.length, 5); k++) out[k - 1] = mergeHeard(out[k - 1] ?? '', r[k]?.transcript ?? '')
        return out
      }
      let done = false
      let silenceTimer = 0
      const finish = () => {
        if (done) return
        done = true
        window.clearTimeout(silenceTimer)
        window.clearTimeout(maxTimer)
        try {
          rec.stop?.()
        } catch {
          /* noop */
        }
        // 読み上げで打ち切られた回（別の回が始まっている）は、結果を使わない
        if (session !== sessionRef.current) return
        if (recRef.current === rec) recRef.current = null
        listeningRef.current = false
        setListening(false)
        // 自分の読み上げの声が混ざっていたら取り除く
        const text = stripEcho(mergeHeard(finalText, interimText), spokenBefore)
        if (text) {
          emptyCountRef.current = 0
          handleHeard(
            text,
            stripEcho(mergeHeard(finalKana, interimKana), spokenBefore),
            finalAlts.map((a, k) => stripEcho(mergeHeard(a, interimAlts[k] ?? ''), spokenBefore)),
          )
          return
        }
        if (!auto) {
          speak(t('voice.notUnderstood'))
          return
        }
        // 自動の聞き取りで何も聞こえなかった: 1回目はうながし、2回目はいまの項目をもう一度、3回目でボタン待ちにする
        emptyCountRef.current++
        if (emptyCountRef.current >= AUTO_EMPTY_LIMIT) {
          autoRef.current = false
          speak(t('voice.pressToTalk'), { listen: false })
          return
        }
        const el = targetRef.current
        if (emptyCountRef.current === 2 && el && el.isConnected) speak(describe(el))
        else speak(t('voice.stillWaiting'))
      }
      const maxTimer = window.setTimeout(finish, MAX_LISTEN_MS)
      /** 区切って言う項目（番号・生年月日）は、言い終わる前に締め切らないよう長めに待つ */
      const silenceFor = (heardNow: string) => {
        const el = targetRef.current
        if (!el || !el.isConnected) return SILENCE_MS
        if (dateGroup(el) || isDateInput(el)) return SILENCE_LONG_MS
        if (isDigitField(el)) {
          const digits = (heardNow.normalize('NFKC').match(/\d/g) ?? []).length
          const need = (el as HTMLInputElement).autocomplete === 'postal-code' ? 7 : 10
          if (digits < need) return SILENCE_LONG_MS
        }
        return SILENCE_MS
      }
      rec.onresult = (e) => {
        if (session !== sessionRef.current) return
        interimText = ''
        interimKana = ''
        interimAlts = []
        for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
          const r = e.results[i]
          const tx = r?.[0]?.transcript ?? ''
          const kana = r ? pickKana(r) : ''
          if (r.isFinal === false) {
            interimText = mergeHeard(interimText, tx)
            interimKana = mergeHeard(interimKana, kana)
            interimAlts = addAlts(interimAlts, r)
          } else {
            finalText = mergeHeard(finalText, tx)
            finalKana = mergeHeard(finalKana, kana)
            finalAlts = addAlts(finalAlts, r)
          }
        }
        const heardNow = mergeHeard(finalText, interimText)
        setHeard(heardNow)
        window.clearTimeout(silenceTimer)
        silenceTimer = window.setTimeout(finish, silenceFor(heardNow))
      }
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          done = true
          window.clearTimeout(silenceTimer)
          window.clearTimeout(maxTimer)
          if (session !== sessionRef.current) return
          if (recRef.current === rec) recRef.current = null
          listeningRef.current = false
          setListening(false)
          if (auto) {
            // 自動では開けない機種: ボタンを押してもらう（押せば許可の確認が出る）
            autoRef.current = false
            speak(t('voice.pressToTalk'), { listen: false })
          } else speak(t('voice.micDenied'))
        }
        // 「何も聞こえなかった」等は onend → finish で案内する
      }
      rec.onend = () => finish()
      recRef.current = rec
      try {
        rec.start()
      } catch {
        if (session !== sessionRef.current) return
        if (recRef.current === rec) recRef.current = null
        listeningRef.current = false
        setListening(false)
        if (auto) {
          autoRef.current = false
          speak(t('voice.pressToTalk'), { listen: false })
        }
      }
    }
    // 読み上げの途中で押されたときは、スピーカーの声が消えてから開く
    if (wasSpeaking) window.setTimeout(begin, AFTER_SPEECH_MS)
    else begin()
  }
  startListeningRef.current = startListening

  const turnOn = () => {
    setEnabled(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'on')
    } catch {
      /* noop */
    }
    autoRef.current = true
    emptyCountRef.current = 0
    // iPhone は「押した瞬間」に話し始めないと読み上げが許可されないため、ここであいさつと最初のページを続けて読む
    skipReadRef.current = true
    targetRef.current = null
    readStep(RecognitionCtor ? t('voice.greeting') : t('voice.greetingNoMic'))
  }

  const turnOff = () => {
    setEnabled(false)
    setHeard('')
    sessionRef.current++
    utterRef.current = null
    listeningRef.current = false
    setListening(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'off')
    } catch {
      /* noop */
    }
  }

  if (!synthOk) return null

  if (!enabled) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={turnOn}
          aria-describedby="voice-guide-sr-note"
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-[#1F618D] bg-[#EBF5FB] px-4 py-3.5 text-left shadow-sm"
        >
          <span className="text-3xl leading-none" aria-hidden="true">🔊</span>
          <span className="flex-1">
            <span className="block text-base font-bold text-[#1F618D]">{t('voice.toggleOn')}</span>
            <span className="block text-xs text-stone-600">{t('voice.toggleOnSub')}</span>
          </span>
        </button>
        {/* iPhoneのVoiceOverなどを使っている方は、sitteの声と重ならないよう、このボタンを押さずに進んでもらう */}
        <p id="voice-guide-sr-note" className="mt-2 px-1 text-xs leading-relaxed text-stone-600">
          {t('voice.screenReaderNote')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-2 rounded-2xl border-2 border-[#1F618D] bg-[#EBF5FB] px-4 py-2.5">
        <span className="text-xl" aria-hidden="true">🔊</span>
        <span className="flex-1 text-sm font-bold text-[#1F618D]">{t('voice.activeNow')}</span>
      </div>
      <div
        role="region"
        aria-label={t('voice.toggleOn')}
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#1F618D] bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur"
      >
        <div className="mx-auto max-w-lg">
          {heard && (
            <p className="mb-2 truncate text-xs text-stone-600">
              {t('voice.heard')}：「{heard}」
            </p>
          )}
          {!RecognitionCtor && <p className="mb-2 text-xs text-stone-600">{t('voice.noMic')}</p>}
          {RecognitionCtor && (
            <button
              type="button"
              onClick={() => startListening(false)}
              disabled={listening}
              // 共通スタイル（button の文字色＝黒）に負けないよう、白を直接指定する
              style={{ color: '#ffffff' }}
              className={`mb-2 flex min-h-[4.5rem] w-full items-center justify-center gap-3 rounded-2xl px-3 py-4 text-center text-xl font-bold leading-tight text-white shadow-md ${
                listening ? 'animate-pulse bg-red-600' : 'bg-[#1F618D]'
              }`}
            >
              <span aria-hidden="true" className="text-3xl leading-none">🎤</span>
              {listening ? t('voice.listening') : t('voice.mic')}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const el = targetRef.current
                if (el && el.isConnected) speak(describe(el))
                else readStep()
              }}
              className="flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border-2 border-[#1F618D] bg-white px-1 py-3 text-sm font-bold text-[#1F618D]"
            >
              {t('voice.repeat')}
            </button>
            <button
              type="button"
              onClick={turnOff}
              className="flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-stone-300 bg-white px-1 py-3 text-xs font-bold text-stone-600"
            >
              {t('voice.stop')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

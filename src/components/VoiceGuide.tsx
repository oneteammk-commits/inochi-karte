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
const SILENCE_MS = 3000
/** 1回の聞き取りの上限 */
const MAX_LISTEN_MS = 30000

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

/** 生年月日の「年・月・日」の3つの欄（同じ枠の中にある数字欄）。その欄でなければ null */
function dateGroup(el: HTMLElement): HTMLInputElement[] | null {
  if (el.tagName !== 'INPUT') return null
  const box = el.closest('label')
  if (!box) return null
  const inputs = Array.from(box.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'))
  return inputs.length === 3 && inputs[0].maxLength === 4 && inputs.includes(el as HTMLInputElement) ? inputs : null
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
  /** フリガナを言い直してもらった項目（2回目も漢字なら次へ進む） */
  const furiganaRetryRef = useRef<HTMLElement | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  const say = useCallback((text: string) => itemReading(text, lang), [lang])

  const speak = useCallback(
    (text: string) => {
      if (!synthOk || !text) return
      const synth = window.speechSynthesis
      synth.cancel()
      const spoken = toSpeechText(text, lang)
      const u = new SpeechSynthesisUtterance(spoken)
      u.lang = speechLang
      const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').startsWith(speechLang.slice(0, 2)))
      if (voice) u.voice = voice
      u.rate = lang === 'ja' ? 0.95 : 1
      lastSpokenRef.current = spoken
      synth.speak(u)
    },
    [synthOk, speechLang, lang],
  )

  /** 項目1つ分の読み上げ文 */
  const describe = useCallback(
    (el: HTMLElement): string => {
      const label = fieldLabel(el)
      if (el.tagName === 'SELECT') {
        const sel = el as HTMLSelectElement
        const opts = Array.from(sel.options).filter((o) => o.value !== '')
        const now = sel.value ? sel.options[sel.selectedIndex]?.text : ''
        const list =
          opts.length <= 10
            ? t('voice.options', { list: opts.map((o) => say(o.text)).join('、') })
            : t('voice.manyOptions')
        return [label, now ? t('voice.selectedNow', { text: say(now) }) : list].filter(Boolean).join(SEP)
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
        const tail = v
          ? t('voice.filledNow', { text: digits ? spellDigits(v) : v })
          : dateHint
            ? dateHint
            : ph
              ? `${t('voice.example')} ${digits ? spellDigits(ph) : ph}`
              : ''
        return [label, tail].filter(Boolean).join(SEP)
      }
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
        const on = (el as HTMLInputElement).checked
        const text = clean(el.closest('label')?.textContent) || label
        return `${text}${SEP}${on ? t('voice.checked') : t('voice.unchecked')}`
      }
      return label
    },
    [t, SEP, say, lang],
  )

  /** 次に案内する項目を決めて、画面をそこまで動かす */
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
  const readStep = useCallback(() => {
    const root = containerRef.current
    if (!root) return
    const h2 = clean(root.querySelector('h2')?.textContent)
    const firstP = clean(root.querySelector('h2 + p')?.textContent)
    const label = t('voice.stepN', { n: Math.min(stepKey + 1, 6) })
    const parts = [label, h2, firstP]
    if (root.querySelector('button[aria-pressed]')) {
      parts.push(t('voice.tagHint'))
      pointTo(null)
    } else {
      const first = fillableFields(root)[0] ?? null
      pointTo(first)
      if (first) parts.push(`${t('voice.firstIs')}${describe(first)}`)
    }
    speak(parts.filter(Boolean).join(SEP))
  }, [containerRef, speak, stepKey, t, SEP, describe, pointTo])

  // ステップが変わったら読む
  useEffect(() => {
    if (!enabled) return
    targetRef.current = null
    const id = window.setTimeout(readStep, 450)
    return () => window.clearTimeout(id)
  }, [enabled, stepKey, readStep])

  // エラーが出たら読み、まだ入っていない項目を案内する
  useEffect(() => {
    if (!enabled || !error) return
    const root = containerRef.current
    const first = root && !root.querySelector('button[aria-pressed]') ? (fillableFields(root)[0] ?? null) : null
    if (first) {
      pointTo(first)
      speak(`${error}${SEP}${describe(first)}`)
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
    document.body.style.paddingBottom = '150px'
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

  /** 入れ終わったら、次の空いている項目を案内する */
  const afterFill = (doneMsg: string, from: HTMLElement) => {
    const root = containerRef.current
    const all = root ? fillableFields(root) : []
    // 後ろの空いている項目 → なければ前に戻って空いている項目
    const next =
      all.find((el) => from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ??
      all.find((el) => el !== from) ??
      null
    pointTo(next)
    if (next) speak(`${doneMsg}${SEP}${t('voice.nextIs')}${describe(next)}`)
    else speak([doneMsg, t('voice.pageDone')].join(SEP))
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
    // 1) 合図の言葉
    if (commandWords('voice.cmdNext').some((w) => n === w || n.startsWith(w))) {
      onNext()
      return
    }
    if (commandWords('voice.cmdBack').some((w) => n === w || n.startsWith(w))) {
      onBack()
      return
    }
    if (commandWords('voice.cmdRepeat').some((w) => n.includes(w))) {
      const el = targetRef.current
      if (el && el.isConnected) speak(describe(el))
      else readStep()
      return
    }

    const root = containerRef.current
    let el = targetRef.current && targetRef.current.isConnected ? targetRef.current : null

    // 2) 選択ボタン（アレルギー・持病など）: 本人がタップした入力欄がなければ、まずボタンを探す
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

    // 3) 入力欄に入れる
    if (el && isTextField(el)) {
      if (isSecret(el)) {
        speak(t('voice.passwordTap'))
        return
      }
      const input = el as HTMLInputElement
      let value = text
      // 聞き取りの候補（1番目＋ほかの候補）。一音だけだと1番目が数字にならないことがあるため
      const candidates = [text, ...alts.map(clean)].filter((c, i, a) => c && a.indexOf(c) === i)
      // 生年月日: 「しょうわ47ねん2がつ5にち」のようにまとめて言われたら、年・月・日に分けて入れる
      const group = lang === 'ja' ? dateGroup(input) : null
      if (group) {
        const date = candidates.map(parseSpokenDate).find((d) => d.year || d.month || d.day)
        if (date) {
          const fills = (
            [
              [group[0], date.year],
              [group[1], date.month],
              [group[2], date.day],
            ] as [HTMLInputElement, string | undefined][]
          ).filter((f): f is [HTMLInputElement, string] => !!f[1])
          // 1つずつ、画面が切り替わるのを待ってから入れる（同時に入れると前の値が消えるため）
          fills.forEach(([f, v], i) => window.setTimeout(() => setNativeValue(f, v), i * 150))
          const shown = `${date.year ? `${date.year}年` : ''}${date.month ? `${date.month}月` : ''}${date.day ? `${date.day}日` : ''}`
          const lastFilled = fills[fills.length - 1][0]
          window.setTimeout(() => afterFill(t('voice.filled', { text: shown }), lastFilled), fills.length * 150 + 50)
          return
        }
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
          speak(t('voice.notNumber', { text }))
          return
        }
        if (input.maxLength > 0) value = value.slice(0, input.maxLength)
      } else if (lang === 'ja' && isFuriganaField(input)) {
        // 聞き取りは漢字に変えて返すことが多いので、候補の中のかなを使う
        const kana = [toFurigana(text), toFurigana(clean(kanaRaw))].find((k) => k && !hasKanji(k))
        if (!kana) {
          if (furiganaRetryRef.current !== input) {
            // 1回目: 区切って言い直してもらう（区切るとかなで返りやすい）
            furiganaRetryRef.current = input
            targetRef.current = input
            speak(t('voice.furiganaRetry'))
            return
          }
          // 2回目も漢字: 入れずに次へ（空欄でも登録できる）
          furiganaRetryRef.current = null
          afterFill(t('voice.furiganaKanji'), input)
          return
        }
        furiganaRetryRef.current = null
        value = kana
      }
      setNativeValue(input, value)
      afterFill(t('voice.filled', { text: isDigitField(input) ? spellDigits(value) : value }), input)
      return
    }

    // 4) プルダウンから選ぶ
    if (el && el.tagName === 'SELECT') {
      const sel = el as HTMLSelectElement
      const opts = Array.from(sel.options).filter((o) => o.value)
      const hit =
        opts.find((o) => matchKeys(o.text).some((k) => k === n)) ??
        opts.find((o) => matchKeys(o.text).some((k) => n.includes(k) || (k.length > 1 && k.includes(n))))
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

  const startListening = () => {
    if (!RecognitionCtor || listening) return
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* noop */
    }
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
      setListening(false)
      const text = mergeHeard(finalText, interimText)
      if (text)
        handleHeard(
          text,
          mergeHeard(finalKana, interimKana),
          finalAlts.map((a, k) => mergeHeard(a, interimAlts[k] ?? '')),
        )
      else speak(t('voice.notUnderstood'))
    }
    const maxTimer = window.setTimeout(finish, MAX_LISTEN_MS)
    rec.onresult = (e) => {
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
      window.clearTimeout(silenceTimer)
      silenceTimer = window.setTimeout(finish, SILENCE_MS)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        done = true
        window.clearTimeout(silenceTimer)
        window.clearTimeout(maxTimer)
        setListening(false)
        speak(t('voice.micDenied'))
      }
      // 「何も聞こえなかった」等は onend → finish で案内する
    }
    rec.onend = () => finish()
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }

  const turnOn = () => {
    setEnabled(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'on')
    } catch {
      /* noop */
    }
    // iPhone は「押した瞬間」に話し始めないと読み上げが許可されないため、ここで最初の案内を読む
    speak(RecognitionCtor ? t('voice.greeting') : `${t('voice.greetingNoMic')}`)
  }

  const turnOff = () => {
    setEnabled(false)
    setHeard('')
    try {
      localStorage.setItem(STORAGE_KEY, 'off')
    } catch {
      /* noop */
    }
  }

  if (!synthOk) return null

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={turnOn}
        className="mb-6 flex w-full items-center gap-3 rounded-2xl border-2 border-[#1F618D] bg-[#EBF5FB] px-4 py-3.5 text-left shadow-sm"
      >
        <span className="text-3xl leading-none" aria-hidden="true">🔊</span>
        <span className="flex-1">
          <span className="block text-base font-bold text-[#1F618D]">{t('voice.toggleOn')}</span>
          <span className="block text-xs text-stone-600">{t('voice.toggleOnSub')}</span>
        </span>
      </button>
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
          <div className="flex gap-2">
            {RecognitionCtor && (
              <button
                type="button"
                onClick={startListening}
                disabled={listening}
                // 共通スタイル（button の文字色＝黒）に負けないよう、白を直接指定する
                style={{ color: '#ffffff' }}
                className={`flex flex-[1.6] items-center justify-center gap-2 rounded-xl px-2 py-3.5 text-center text-base font-bold leading-tight text-white shadow ${
                  listening ? 'animate-pulse bg-red-600' : 'bg-[#1F618D]'
                }`}
              >
                <span aria-hidden="true">🎤</span>
                {listening ? t('voice.listening') : t('voice.mic')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const el = targetRef.current
                if (el && el.isConnected) speak(describe(el))
                else readStep()
              }}
              className="flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border-2 border-[#1F618D] bg-white px-1 py-3.5 text-sm font-bold text-[#1F618D]"
            >
              {t('voice.repeat')}
            </button>
            <button
              type="button"
              onClick={turnOff}
              className="flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-stone-300 bg-white px-1 py-3.5 text-xs font-bold text-stone-600"
            >
              {t('voice.stop')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

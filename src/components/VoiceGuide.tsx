import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * 音声ガイド（第1段階）
 * - 「声でご案内」を押した人にだけ有効。押さない人には何も起きない（画面も今までと同じ）。
 * - 読み上げ: ステップが変わったとき・項目をタップしたとき・選択ボタンを押したとき・エラーのとき。
 * - 声で答える: 🎤ボタン → いま選んでいる入力欄に入れる／選択肢・ボタンを声で選ぶ／「つぎへ」「もどる」。
 * - 声が通らない端末でも、読み上げ＋画面のボタンで最後まで進める（声は補助）。
 * - 編集用パスワードは声に出さない（読み上げない・声で入れない）。
 */

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
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

/** 比較用に正規化（空白・句読点・全角半角の差をなくす） */
function norm(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s、。,.・()（）「」!?！？:：]/g, '')
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

/** 「昭和47年」「平成元年」などを西暦に。数字だけならそのまま */
function toYear(text: string): string | null {
  const t = text.normalize('NFKC')
  const eras: [string, number][] = [
    ['令和', 2018],
    ['平成', 1988],
    ['昭和', 1925],
    ['大正', 1911],
    ['明治', 1867],
  ]
  for (const [name, base] of eras) {
    const m = t.match(new RegExp(`${name}\\s*(元|\\d{1,2})`))
    if (m) return String(base + (m[1] === '元' ? 1 : Number(m[1])))
  }
  const d = t.match(/\d{4}/)
  return d ? d[0] : null
}

function digitsOnly(text: string): string {
  return text.normalize('NFKC').replace(/[^\d]/g, '')
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
  const targetRef = useRef<HTMLElement | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  const speak = useCallback(
    (text: string) => {
      if (!synthOk || !text) return
      const synth = window.speechSynthesis
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = speechLang
      const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').startsWith(speechLang.slice(0, 2)))
      if (voice) u.voice = voice
      u.rate = lang === 'ja' ? 0.95 : 1
      lastSpokenRef.current = text
      synth.speak(u)
    },
    [synthOk, speechLang, lang],
  )

  /** いまのステップの見出しと説明を読む */
  const readStep = useCallback(() => {
    const root = containerRef.current
    if (!root) return
    const h2 = clean(root.querySelector('h2')?.textContent)
    const firstP = clean(root.querySelector('h2 + p')?.textContent)
    const label = t('voice.stepN', { n: Math.min(stepKey + 1, 6) })
    speak([label, h2, firstP].filter(Boolean).join(SEP))
  }, [containerRef, speak, stepKey, t, SEP])

  /** 項目1つ分の読み上げ文 */
  const describe = useCallback(
    (el: HTMLElement): string => {
      const label = fieldLabel(el)
      if (el.tagName === 'SELECT') {
        const sel = el as HTMLSelectElement
        const opts = Array.from(sel.options).filter((o) => o.value !== '')
        const now = sel.value ? sel.options[sel.selectedIndex]?.text : ''
        const list =
          opts.length <= 10 ? t('voice.options', { list: opts.map((o) => o.text).join('、') }) : t('voice.manyOptions')
        return [label, now ? t('voice.selectedNow', { text: now }) : list].filter(Boolean).join(SEP)
      }
      if (isTextField(el)) {
        if (isSecret(el)) return [label, t('voice.passwordTap')].join(SEP)
        const v = clean((el as HTMLInputElement).value)
        const ph = clean((el as HTMLInputElement).placeholder).replace(/^(例|e\.g\.|ex\.?)\s*[:：]?\s*/i, '')
        const tail = v ? t('voice.filledNow', { text: v }) : ph ? `${t('voice.example')} ${ph}` : ''
        return [label, tail].filter(Boolean).join(SEP)
      }
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
        const on = (el as HTMLInputElement).checked
        const text = clean(el.closest('label')?.textContent) || label
        return `${text}${SEP}${on ? t('voice.checked') : t('voice.unchecked')}`
      }
      return label
    },
    [t, SEP],
  )

  // ステップが変わったら読む
  useEffect(() => {
    if (!enabled) return
    targetRef.current = null
    const id = window.setTimeout(readStep, 450)
    return () => window.clearTimeout(id)
  }, [enabled, stepKey, readStep])

  // エラーが出たら読む
  useEffect(() => {
    if (enabled && error) speak(error)
  }, [enabled, error, speak])

  // 項目をタップ（フォーカス）したら読む・選択ボタンを押したら状態を読む
  useEffect(() => {
    const root = containerRef.current
    if (!enabled || !root) return
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (!(isTextField(el) || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox'))) return
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'file') return
      targetRef.current = el
      speak(describe(el))
    }
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('button[aria-pressed]') as HTMLButtonElement | null
      if (!btn || !root.contains(btn)) return
      targetRef.current = null
      // クリック後に状態が切り替わるので、少し待ってから読む
      window.setTimeout(() => {
        const on = btn.getAttribute('aria-pressed') === 'true'
        speak(t(on ? 'voice.tagOn' : 'voice.tagOff', { text: clean(btn.textContent) }))
      }, 120)
    }
    const onChange = (e: Event) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'SELECT' && e.isTrusted) {
        const sel = el as HTMLSelectElement
        if (sel.value) speak(t('voice.selected', { text: sel.options[sel.selectedIndex]?.text ?? '' }))
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
  }, [enabled, containerRef, speak, describe, t])

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

  /** 聞き取った言葉を画面に反映する */
  const handleHeard = (raw: string) => {
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
    const el = targetRef.current && targetRef.current.isConnected ? targetRef.current : null

    // 2) 選んでいる入力欄に入れる
    if (el && isTextField(el)) {
      if (isSecret(el)) {
        speak(t('voice.passwordTap'))
        return
      }
      const input = el as HTMLInputElement
      let value = text
      const label = fieldLabel(input)
      if (input.inputMode === 'numeric' || input.type === 'tel' || input.autocomplete === 'postal-code') {
        const isYear = input.maxLength === 4 || /年|year|年份|년|année|tahun/i.test(label)
        value = (isYear ? toYear(text) : null) ?? digitsOnly(text)
        if (!value) {
          speak(t('voice.notUnderstood'))
          return
        }
        if (input.maxLength > 0) value = value.slice(0, input.maxLength)
      }
      setNativeValue(input, value)
      speak(t('voice.filled', { text: value }))
      return
    }

    // 3) 選んでいるプルダウンから選ぶ
    if (el && el.tagName === 'SELECT') {
      const sel = el as HTMLSelectElement
      const hit = Array.from(sel.options).find((o) => {
        if (!o.value) return false
        const on = norm(o.text)
        return on && (n.includes(on) || on.includes(n))
      })
      if (hit) {
        setNativeValue(sel, hit.value)
        speak(t('voice.selected', { text: hit.text }))
      } else {
        speak(t('voice.notInOptions', { text }))
      }
      return
    }

    // 4) 画面の選択ボタン（アレルギー・持病など）から選ぶ
    if (root) {
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'))
      const hits = buttons.filter((b) => {
        const bn = norm(clean(b.textContent))
        return bn && n.includes(bn)
      })
      if (hits.length > 0) {
        const already = hits.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => clean(b.textContent))
        const toPress = hits.filter((b) => b.getAttribute('aria-pressed') !== 'true')
        const turnedOn = toPress.map((b) => clean(b.textContent))
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

    speak(el ? t('voice.notUnderstood') : t('voice.noField'))
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
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.continuous = false
    rec.onresult = (e) => {
      const first = e.results[0]?.[0]?.transcript ?? ''
      handleHeard(first)
    }
    rec.onerror = (e) => {
      setListening(false)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') speak(t('voice.micDenied'))
      else if (e.error === 'no-speech') speak(t('voice.notUnderstood'))
    }
    rec.onend = () => setListening(false)
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

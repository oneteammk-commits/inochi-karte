import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImeAwareInput } from './ImeAwareField'

/**
 * 生年月日の入力欄（年・月・日）
 * - 画面読み上げ（iPhoneのVoiceOverなど）で「生年月日の年」「生年月日の月」「生年月日の日」と読まれるよう、欄ごとに名前を付ける
 * - 日本語のときは元号（昭和・平成など）を選んで、和暦の数字のまま入れられる。すぐ横に西暦を表示・読み上げる
 * - 保存する形はこれまでと同じ「1972年2月5日」（西暦）
 */

type Era = { key: string; label: string; base: number }

/** 元号と「元年の前の年」（昭和1年＝1926年 → 1925） */
const ERAS: Era[] = [
  { key: 'seireki', label: '西暦', base: 0 },
  { key: 'reiwa', label: '令和', base: 2018 },
  { key: 'heisei', label: '平成', base: 1988 },
  { key: 'showa', label: '昭和', base: 1925 },
  { key: 'taisho', label: '大正', base: 1911 },
]

const toHalf = (s: string) => s.normalize('NFKC')
const digits = (s: string) => toHalf(s).replace(/[^\d]/g, '')

/** 保存されている文字（「1972年2月5日」や古い「1972-02-05」）を年・月・日に分ける */
export function splitBirthDate(value: string): { y: string; m: string; d: string } {
  const v = toHalf(value || '')
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return { y: iso[1], m: String(Number(iso[2])), d: String(Number(iso[3])) }
  const y = v.includes('年') ? v.split('年')[0] : v
  const afterY = v.includes('年') ? v.split('年')[1] ?? '' : ''
  const m = afterY.includes('月') ? afterY.split('月')[0] : afterY.replace('月日', '')
  const d = afterY.includes('月') ? (afterY.split('月')[1] ?? '').replace('日', '') : ''
  return { y, m, d }
}

/** 年・月・日がそろった正しい日付か（古い「1972-02-05」も可） */
export function isCompleteBirthDate(value: string): boolean {
  const { y, m, d } = splitBirthDate(value)
  const yy = Number(y)
  const mm = Number(m)
  const dd = Number(d)
  if (!/^\d{4}$/.test(y) || !Number.isInteger(mm) || !Number.isInteger(dd)) return false
  if (yy < 1900 || yy > new Date().getFullYear()) return false
  if (mm < 1 || mm > 12) return false
  const last = new Date(yy, mm, 0).getDate()
  return dd >= 1 && dd <= last
}

function join(y: string, m: string, d: string) {
  return `${y}年${m}月${d}日`
}

export function BirthDateField({
  value,
  onChange,
  t,
}: {
  value: string
  onChange: (birthDate: string) => void
  t: (key: string) => string
}) {
  const { i18n } = useTranslation()
  const lang = (i18n.language || 'ja').split('-')[0]
  const id = useId()
  const parts = splitBirthDate(value)
  const showEra = lang === 'ja'

  // 年の欄に打っている文字と、選んでいる元号（西暦なら base=0）
  const [era, setEra] = useState<Era>(ERAS[0])
  const [yearText, setYearText] = useState(parts.y)

  /** いまの元号と数字から西暦を出す（出せなければ空） */
  const westernOf = (e: Era, text: string): string => {
    const raw = toHalf(text).trim()
    if (e.base === 0) {
      // 西暦の欄に「昭和47」のように元号ごと入れられた場合も西暦に直す
      const named = ERAS.find((x) => x.base !== 0 && raw.includes(x.label))
      if (named) return westernOf(named, raw.replace(named.label, '').replace('年', ''))
      return digits(raw)
    }
    const n = raw === '元' ? 1 : Number(digits(raw))
    return n >= 1 && n <= 99 ? String(e.base + n) : ''
  }

  // 外から値が変わったとき（下書きの復元・声で入れたとき・編集画面の読み込み）は、西暦で表示し直す
  useEffect(() => {
    if (westernOf(era, yearText) !== parts.y) {
      setEra(ERAS[0])
      setYearText(parts.y)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts.y])

  const setYear = (text: string, e: Era = era) => {
    setYearText(text)
    onChange(join(westernOf(e, text), parts.m, parts.d))
  }

  const western = westernOf(era, yearText)
  const hintId = `${id}-hint`
  const resultId = `${id}-result`
  const inputClass =
    'w-full rounded-xl border border-stone-300 px-3 py-3 text-stone-900 outline-none ring-brand/30 transition focus:border-brand focus:ring-2'

  return (
    <fieldset data-voice-date="birth" className="block">
      <legend className="mb-1.5 block text-sm font-medium text-stone-700">
        {t('register.labelBirthDate')}
        <span className="sr-only">{t('register.a11yRequired')}</span>
      </legend>
      <div className={`grid gap-3 ${showEra ? 'grid-cols-[1.1fr_1fr_0.8fr_0.8fr]' : 'grid-cols-3'}`}>
        {showEra && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-500" aria-hidden="true">
              元号
            </span>
            <select
              aria-label="生年月日の年の数え方。西暦、または昭和・平成などの元号"
              value={era.key}
              onChange={(e) => {
                const next = ERAS.find((x) => x.key === e.target.value) ?? ERAS[0]
                setEra(next)
                setYear(yearText, next)
              }}
              className={`${inputClass} bg-white px-2`}
            >
              {ERAS.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500" aria-hidden="true">
            {t('register.unitYear')}
          </span>
          <ImeAwareInput
            inputMode="numeric"
            maxLength={4}
            aria-label={t('register.a11yBirthYear')}
            aria-required="true"
            aria-describedby={showEra ? `${hintId} ${resultId}` : undefined}
            placeholder={era.base === 0 ? t('register.placeholderYear') : '47'}
            value={yearText}
            onValueChange={(y) => setYear(y)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500" aria-hidden="true">
            {t('register.unitMonth')}
          </span>
          <ImeAwareInput
            inputMode="numeric"
            maxLength={2}
            aria-label={t('register.a11yBirthMonth')}
            aria-required="true"
            placeholder={t('register.placeholderMonth')}
            value={parts.m}
            onValueChange={(m) => onChange(join(western, digits(m), parts.d))}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500" aria-hidden="true">
            {t('register.unitDay')}
          </span>
          <ImeAwareInput
            inputMode="numeric"
            maxLength={2}
            aria-label={t('register.a11yBirthDay')}
            aria-required="true"
            placeholder={t('register.placeholderDay')}
            value={parts.d}
            onValueChange={(d) => onChange(join(western, parts.m, digits(d)))}
            className={inputClass}
          />
        </label>
      </div>
      {showEra && (
        <>
          <p id={hintId} className="mt-1.5 text-xs text-stone-500">
            年は西暦4けた（例：1972）か、元号を選んで数字（例：昭和を選んで47）で入れられます。
          </p>
          <p id={resultId} aria-live="polite" className="mt-1 text-sm font-semibold text-brand">
            {era.base !== 0 && western ? `＝西暦${western}年` : ''}
          </p>
        </>
      )}
    </fieldset>
  )
}

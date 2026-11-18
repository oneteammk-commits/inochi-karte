import { createContext, useContext, useState, type ReactNode } from 'react'
import type { WhyMode } from './WhyHint'

/**
 * 見比べ用の切り替え（「仮」の画面だけ）。
 *
 * 11/16 の持田様・愛犬家の方々との打合せで、次の4つは「何パターンか用意して見てもらう」ことになった。
 * 近藤さんがスマホで A/B/C を切り替えて見比べ、決まったらその形を標準にする（勝手に決めない）。
 *   ・重要ラベル（imp）
 *   ・「？」の説明の出し方（why … WhyHint.tsx 側で切り替え）
 *   ・文字と色の見やすさ（ud）
 *   ・画面の長さ・折りたたみ（fold）
 *
 * 切り替えの表示（画面の左下の「見比べる」）は本番のアドレスでは出さない。
 * URL の ?imp=b&ud=c&fold=b のように付けても切り替えられる（スマホで人に見せるとき用）。
 */

export type Variant = 'a' | 'b' | 'c'
export type CompareKey = 'imp' | 'ud' | 'fold'

/** ふだん使う形（近藤さんが決めたら、ここを変える） */
export const DEFAULT_VARIANTS: Record<CompareKey, Variant> = { imp: 'a', ud: 'a', fold: 'a' }

/** 本番のアドレス（ここでは見比べの切り替えを出さない） */
const PRODUCTION_HOSTS = ['inochi-karte.vercel.app']

const storeKey = (k: CompareKey) => `sitte_cmp_${k}`

function isVariant(v: unknown): v is Variant {
  return v === 'a' || v === 'b' || v === 'c'
}

export function readVariant(key: CompareKey): Variant {
  try {
    const q = new URLSearchParams(window.location.search).get(key)?.toLowerCase()
    if (isVariant(q)) {
      sessionStorage.setItem(storeKey(key), q)
      return q
    }
    const s = sessionStorage.getItem(storeKey(key))
    if (isVariant(s)) return s
  } catch {
    /* 保存できない環境でも標準の形で動く */
  }
  return DEFAULT_VARIANTS[key]
}

export function saveVariant(key: CompareKey, v: Variant) {
  try {
    sessionStorage.setItem(storeKey(key), v)
  } catch {
    /* 保存できなくても画面は切り替わる */
  }
}

export function showCompareSwitcher(): boolean {
  try {
    return !PRODUCTION_HOSTS.includes(window.location.hostname)
  } catch {
    return false
  }
}

export type CompareState = Record<CompareKey, Variant>
export const CompareContext = createContext<CompareState>(DEFAULT_VARIANTS)

export function useCompare(): CompareState {
  return useContext(CompareContext)
}

/**
 * 項目のまとまりを、画面の長さ（fold）の形に合わせて折りたたむ。
 *   a：折りたたまない（全部表示）
 *   b：任意の項目（optional）だけ、見出しだけにする
 *   c：基本の情報以外はすべて見出しだけにする（重要な項目は見出しに「重要」を出す）
 * すでに入力がある項目は、最初から開いておく。
 */
export function FoldSection({
  title,
  optional,
  important,
  importantText,
  filled,
  className,
  children,
}: {
  title: string
  optional: boolean
  important?: boolean
  importantText?: string
  filled?: boolean
  className?: string
  children: ReactNode
}) {
  const { fold } = useCompare()
  const folds = fold === 'c' || (fold === 'b' && optional)
  if (!folds) return <>{children}</>
  return (
    <details
      data-fold-section
      open={filled || undefined}
      className={`fold-section rounded-lg border-2 border-stone-300 bg-white ${className ?? ''}`}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-bold text-stone-900">
        <span aria-hidden="true" className="fold-arrow inline-block text-stone-600">
          ▶
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        {important && importantText && (
          <span
            data-important
            className="inline-block shrink-0 whitespace-nowrap rounded border border-red-800 bg-red-50 px-1.5 py-px text-[11px] font-bold leading-tight text-red-900"
          >
            {importantText}
          </span>
        )}
      </summary>
      <div className="border-t border-stone-200 p-3">{children}</div>
    </details>
  )
}

const ROWS: { key: CompareKey | 'why'; title: string; options: Record<Variant, string> }[] = [
  {
    key: 'imp',
    title: '① 重要ラベル',
    options: { a: '小さな「重要」の札', b: '札＋枠の左に赤い帯', c: '赤地に白文字の大きな札' },
  },
  {
    key: 'why',
    title: '② 「？」の出し方',
    options: { a: '押すと出る', b: '選ぶと少しして自動で出る', c: '最初から出ている' },
  },
  {
    key: 'ud',
    title: '④ 文字と色',
    options: { a: '今の濃さ・大きさ', b: '説明の文字を大きく太く', c: 'さらに大きく・枠線も太く' },
  },
  {
    key: 'fold',
    title: '⑦ 画面の長さ',
    options: { a: '全部表示', b: '任意の項目をたたむ', c: '見出しだけにして開いて入力' },
  },
]

/** 画面の左下の「見比べる」ボタンと、A/B/C の切り替え（「仮」の画面だけ。日本語のみ） */
export function CompareSwitcher({
  state,
  whyMode,
  onChange,
  onWhyChange,
}: {
  state: CompareState
  whyMode: WhyMode
  onChange: (key: CompareKey, v: Variant) => void
  onWhyChange: (v: WhyMode) => void
}) {
  const [open, setOpen] = useState(false)
  if (!showCompareSwitcher()) return null
  const current = (key: CompareKey | 'why'): Variant => (key === 'why' ? whyMode : state[key])
  return (
    <div className="fixed bottom-3 left-3 z-50" data-compare-switcher>
      {open ? (
        <div className="w-[min(92vw,22rem)] rounded-2xl border-2 border-stone-800 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-stone-900">見比べる（仮の画面だけ）</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-stone-400 px-2 py-1 text-xs font-bold text-stone-800"
            >
              閉じる
            </button>
          </div>
          <div className="space-y-3">
            {ROWS.map((row) => (
              <div key={row.key}>
                <p className="mb-1 text-xs font-bold text-stone-800">{row.title}</p>
                <div className="grid grid-cols-3 gap-1">
                  {(['a', 'b', 'c'] as Variant[]).map((v) => {
                    const on = current(row.key) === v
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        data-compare={`${row.key}-${v}`}
                        onClick={() => (row.key === 'why' ? onWhyChange(v) : onChange(row.key, v))}
                        style={on ? { color: '#ffffff' } : undefined}
                        className={`rounded-lg border-2 px-1 py-1.5 text-left text-[11px] font-bold leading-snug ${
                          on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-800'
                        }`}
                      >
                        {v.toUpperCase()}：{row.options[v]}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-compare-open
          style={{ color: '#ffffff' }}
          className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg"
        >
          見比べる
        </button>
      )}
    </div>
  )
}

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

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
 * 11/19 に形が決まったので、画面の「見比べる」ボタンは外した。
 * URL に ?imp=a&ud=c&fold=a のように付けると、そのタブだけ別の形で見られる（愛犬家の方々に見比べてもらうとき用）。
 */

export type Variant = 'a' | 'b' | 'c'
export type CompareKey = 'imp' | 'ud' | 'fold'

/**
 * ふだん使う形（11/19 近藤さんが見比べて決定）
 *   重要ラベル B（札＋枠の左に赤い帯）／文字と色 A（今のまま）／画面の長さ B（任意の項目だけたたむ）
 *   「？」の出し方は B（WhyHint.tsx の DEFAULT_WHY_MODE）
 */
export const DEFAULT_VARIANTS: Record<CompareKey, Variant> = { imp: 'b', ud: 'a', fold: 'b' }

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
  const ref = useRef<HTMLDetailsElement>(null)
  // 入力があれば開く（編集画面で後からデータが届いた場合も）。入力を消しても勝手には閉じない
  useEffect(() => {
    if (folds && filled && ref.current && !ref.current.open) ref.current.open = true
  }, [folds, filled])
  if (!folds) return <>{children}</>
  return (
    <details
      ref={ref}
      data-fold-section
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

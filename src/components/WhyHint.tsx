import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 「なぜこの項目が要るの？」の説明の出し方（愛犬家の方々のご意見で3パターンを比べる）
 *   a: 短い表示＋「なぜ必要？」をタップすると開く（これまでの形）
 *   b: その項目を選んだ・入力を始めたときに、少し待ってから自動で開く
 *   c: 最初から全部ひらいておく
 * 比べるときは、登録画面のアドレスの最後に ?why=a / ?why=b / ?why=c を付けて開く。
 * 一度開いたパターンは、その画面を閉じるまで覚えておく。
 */
export type WhyMode = 'a' | 'b' | 'c'

const WHY_KEY = 'sitte_why_mode'
/** ふだん使う出し方（近藤さんが3パターンを見比べて決めたら、ここを変える） */
export const DEFAULT_WHY_MODE: WhyMode = 'a'
/** b のとき、選んでから説明が開くまでの時間 */
export const WHY_AUTO_OPEN_MS = 700

function isWhyMode(v: unknown): v is WhyMode {
  return v === 'a' || v === 'b' || v === 'c'
}

export function readWhyMode(): WhyMode {
  try {
    const q = new URLSearchParams(window.location.search).get('why')
    if (q && isWhyMode(q.toLowerCase())) {
      sessionStorage.setItem(WHY_KEY, q.toLowerCase())
      return q.toLowerCase() as WhyMode
    }
    const s = sessionStorage.getItem(WHY_KEY)
    if (isWhyMode(s)) return s
  } catch {
    // 保存できない環境でも、ふだんの出し方で動く
  }
  return DEFAULT_WHY_MODE
}

export function saveWhyMode(mode: WhyMode) {
  try {
    sessionStorage.setItem(WHY_KEY, mode)
  } catch {
    // noop
  }
}

export const WhyModeContext = createContext<WhyMode>(DEFAULT_WHY_MODE)

/** b のときに「この項目を選んだ」ことを説明に伝える入れ物 */
const GroupTouchContext = createContext<number>(0)

/**
 * 項目のまとまり（見出し＋入力欄）を囲む。
 * 中の入力欄を選んだり書き始めたりすると、b のときだけ説明を自動で開く合図を出す。
 */
export function WhyGroup({
  children,
  className,
  important,
}: {
  children: ReactNode
  className?: string
  /** 「重要」の項目のまとまり（重要ラベルの見比べで、枠の色などを変えるため） */
  important?: boolean
}) {
  const mode = useContext(WhyModeContext)
  const [touched, setTouched] = useState(0)
  const handle = () => {
    if (mode === 'b') setTouched((n) => (n === 0 ? 1 : n))
  }
  return (
    <GroupTouchContext.Provider value={touched}>
      <div
        className={className}
        data-important-block={important ? '' : undefined}
        onFocusCapture={handle}
        onChangeCapture={handle}
      >
        {children}
      </div>
    </GroupTouchContext.Provider>
  )
}

/** 「重要」の文字ラベル（色だけに頼らず、文字で重要と分かるようにする） */
export function ImportantBadge({ text }: { text: string }) {
  return (
    <span
      data-important
      className="ml-1.5 inline-block rounded border border-red-800 bg-red-50 px-1.5 py-px align-middle text-[11px] font-bold leading-tight text-red-900"
    >
      {text}
    </span>
  )
}

/**
 * 「なぜ必要？」の説明。
 * 文字は少し濃く・太くして、高齢の方にも読みやすくしている。
 */
export function WhyHint({
  text,
  label,
  buttonText,
}: {
  /** 説明の本文（獣医師の持田様の文） */
  text: string
  /** 読み上げ用の名前（なぜこの項目が要るの？） */
  label: string
  /** ボタンに見せる短い言葉（なぜ必要？） */
  buttonText: string
}) {
  const mode = useContext(WhyModeContext)
  const touched = useContext(GroupTouchContext)
  const [open, setOpen] = useState(mode === 'c')
  const closedByUserRef = useRef(false)

  // 出し方を切り替えたときは、それに合わせる
  useEffect(() => {
    closedByUserRef.current = false
    setOpen(mode === 'c')
  }, [mode])

  // b: 項目を選んだら、少し待ってから開く（自分で閉じた後は勝手に開かない）
  useEffect(() => {
    if (mode !== 'b' || !touched || closedByUserRef.current) return
    const id = window.setTimeout(() => setOpen(true), WHY_AUTO_OPEN_MS)
    return () => window.clearTimeout(id)
  }, [mode, touched])

  return (
    <span className="inline">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (v) closedByUserRef.current = true
            return !v
          })
        }}
        aria-expanded={open}
        aria-label={label}
        className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500 bg-white px-2 py-0.5 align-middle text-[11px] font-bold text-amber-900"
      >
        <span aria-hidden="true">?</span>
        <span aria-hidden="true">{buttonText}</span>
      </button>
      {open && (
        <span
          data-why-text
          className="mt-1.5 block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-medium leading-relaxed text-stone-900"
        >
          {text}
        </span>
      )}
    </span>
  )
}

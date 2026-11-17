import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { recognizeImage, type OcrKind } from '../lib/ocr'

/**
 * 「写真から文字を読み取る」ボタン。
 * 写真を撮る（または選ぶ）→ スマホの中で文字を読み取る → 結果を本人が確かめて直す → 入力欄に入れる。
 * 読み間違いがあるので、そのまま自動で入れずに、必ず確認の画面をはさむ。
 */
export function OcrButton({
  kind,
  onApply,
  onPhoto,
  label,
  className,
}: {
  kind: OcrKind
  /** 確かめた文字を入力欄に入れる */
  onApply: (text: string) => void
  /** 読み取りに使った写真を、写真欄にも残したいときに渡す */
  onPhoto?: (file: File) => void
  /** ボタンの文字（省略時は「写真から文字を読み取る」） */
  label?: string
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'reading' | 'done' | 'error'>('idle')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const runRef = useRef(0)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const start = async (file: File) => {
    const run = ++runRef.current
    setOpen(true)
    setText('')
    setStatus('loading')
    setPreview(URL.createObjectURL(file))
    onPhoto?.(file)
    try {
      const result = await recognizeImage(file, kind, (s) => {
        if (runRef.current === run) setStatus(s)
      })
      if (runRef.current !== run) return
      setText(result)
      setStatus('done')
    } catch {
      if (runRef.current !== run) return
      setStatus('error')
    }
  }

  const close = () => {
    runRef.current++
    setOpen(false)
    setStatus('idle')
  }

  return (
    <>
      <label
        className={
          className ??
          'mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-sky-700 bg-white px-3 py-2 text-sm font-bold text-sky-900'
        }
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          data-ocr-input
          onChange={(e) => {
            const f = e.target.files && e.target.files[0]
            e.currentTarget.value = ''
            if (f) void start(f)
          }}
        />
        <span aria-hidden="true">📷</span>
        <span>{label ?? t('ocr.button')}</span>
      </label>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ocr-title"
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="ocr-title" className="mb-3 text-lg font-bold text-black">
              {t('ocr.title')}
            </h3>
            {preview && (
              <img src={preview} alt="" className="mb-3 max-h-40 w-full rounded-lg border border-stone-300 object-contain" />
            )}

            {(status === 'loading' || status === 'reading') && (
              <p role="status" className="mb-3 rounded-lg bg-sky-50 p-3 text-sm font-semibold text-sky-900">
                {status === 'loading' ? t('ocr.loading') : t('ocr.reading')}
              </p>
            )}

            {status === 'error' && (
              <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">
                {t('ocr.error')}
              </p>
            )}

            {status === 'done' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-stone-900">{t('ocr.resultLabel')}</span>
                  <textarea
                    data-ocr-result
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={kind === 'digits' ? 2 : 4}
                    className="w-full rounded-lg border-2 border-stone-400 px-3 py-2 text-base text-stone-900"
                  />
                </label>
                {!text.trim() && (
                  <p className="mt-1 text-sm font-semibold text-amber-900">{t('ocr.empty')}</p>
                )}
              </>
            )}

            {/* 読み間違いへの注意書き（いつも見せる） */}
            <div className="mt-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-[13px] font-medium leading-relaxed text-stone-900">
              <p className="mb-1 font-bold">⚠️ {t('ocr.cautionTitle')}</p>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>{t('ocr.caution1')}</li>
                <li>{t('ocr.caution2')}</li>
                <li>{t('ocr.caution3')}</li>
              </ul>
            </div>

            <div className="mt-4 space-y-2">
              {status === 'done' && (
                <button
                  type="button"
                  style={{ color: '#ffffff' }}
                  disabled={!text.trim()}
                  onClick={() => {
                    onApply(text.trim())
                    close()
                  }}
                  className="block w-full rounded-xl bg-sky-800 py-3 text-base font-bold text-white disabled:opacity-50"
                >
                  {t('ocr.apply')}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="block w-full rounded-xl border-2 border-stone-400 bg-white py-3 text-base font-bold text-black"
              >
                {status === 'done' ? t('ocr.cancel') : t('ocr.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

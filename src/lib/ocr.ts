/**
 * 写真から文字を読み取る（OCR）。
 *
 * 費用をかけないため、スマホの中だけで読み取る方式（Tesseract.js）を使う。
 * 写真は外の会社に送らない。読み取りの仕組みと日本語・英語の辞書（約5MB）は、
 * 「写真から文字を読み取る」を初めて押したときに1回だけ読み込む（2回目からは速い）。
 *
 * 小さい文字・光の反射・手書き・斜めの写真は読み間違えやすいので、
 * 読み取った結果は必ず本人が画面で確かめて直してから入れる作りにしている。
 */

const TESSERACT_VERSION = '5.1.1'
const TESSERACT_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`
const WORKER_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`
const CORE_URL = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}`

/** 読み取る写真の長い辺の最大（大きすぎるとスマホで時間がかかるため縮める） */
const MAX_SIDE = 1800

export type OcrKind =
  /** 薬の名前・ワクチンの名前など（日本語と英数字） */
  | 'text'
  /** マイクロチップ番号など、数字だけ */
  | 'digits'

type TesseractWorker = {
  setParameters: (p: Record<string, string>) => Promise<unknown>
  recognize: (img: HTMLCanvasElement | Blob) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}
type TesseractGlobal = {
  createWorker: (
    langs: string | string[],
    oem?: number,
    options?: Record<string, unknown>,
  ) => Promise<TesseractWorker>
}

let scriptPromise: Promise<TesseractGlobal> | null = null

function loadTesseract(): Promise<TesseractGlobal> {
  const w = window as unknown as { Tesseract?: TesseractGlobal }
  if (w.Tesseract) return Promise.resolve(w.Tesseract)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<TesseractGlobal>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = TESSERACT_URL
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => {
      if (w.Tesseract) resolve(w.Tesseract)
      else reject(new Error('ocr-load'))
    }
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('ocr-load'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** 写真を読み込んで、大きすぎれば縮めた画像（canvas）にする */
async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('ocr-image'))
      el.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ocr-image')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 読み取った文字の、余分な空白・空行を整える */
export function tidyOcrText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) =>
      line
        // 日本語の文字のあいだ・日本語と数字のあいだに入る余分な空白を消す
        // （例:「プ レ ド ニ ン」→「プレドニン」、「1 日 2 回」→「1日2回」）
        .replace(/([　-鿿＀-￯])\s+(?=[　-鿿＀-￯0-9])/g, '$1')
        .replace(/([0-9])\s+(?=[　-鿿＀-￯])/g, '$1')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * 数字だけの読み取り結果から、番号らしい並びを取り出す。
 * マイクロチップは15桁。15桁の並びがあればそれを、なければ一番長い数字の並びを返す。
 */
export function pickNumber(raw: string): string {
  const runs = raw.replace(/[ \t]/g, '').match(/\d+/g) ?? []
  const fifteen = runs.find((r) => r.length === 15)
  if (fifteen) return fifteen
  return runs.sort((a, b) => b.length - a.length)[0] ?? ''
}

/**
 * 写真の文字を読み取る。
 * onStatus には「準備中」「読み取り中」を知らせる（画面に出すため）。
 */
export async function recognizeImage(
  file: Blob,
  kind: OcrKind,
  onStatus?: (s: 'loading' | 'reading') => void,
): Promise<string> {
  onStatus?.('loading')
  const T = await loadTesseract()
  const canvas = await fileToCanvas(file)
  const worker = await T.createWorker(kind === 'digits' ? ['eng'] : ['jpn', 'eng'], 1, {
    workerPath: WORKER_URL,
    corePath: CORE_URL,
  })
  try {
    if (kind === 'digits') {
      await worker.setParameters({ tessedit_char_whitelist: '0123456789' })
    }
    onStatus?.('reading')
    const { data } = await worker.recognize(canvas)
    const text = tidyOcrText(data.text || '')
    return kind === 'digits' ? pickNumber(text) : text
  } finally {
    void worker.terminate()
  }
}

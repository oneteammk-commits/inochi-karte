/**
 * ペット用（首輪・キャリーケース用）の二次元コードを、首輪に付けられる小さい大きさで
 * 「画像で保存」または「A4に並べて印刷」する。
 *
 * 大きさは 2cm（おすすめ）と 1.5cm（小さめ）から選ぶ（近藤さんの判断 11/17）。
 * 2cmより小さいと、汚れや首輪の丸みで読み取りにくくなるため、これ以上は小さくしない。
 * 印刷の方法（家のプリンタ・コンビニ・迷子札屋さん）は飼い主さんによって違うので、どれでも使える形にする。
 *   - 画像：印刷の倍率を100%にしたとき、二次元コードがちょうど選んだ大きさになる情報（解像度）を画像に入れる
 *   - 印刷：A4に同じ二次元コードを並べて、切り取って使えるようにする（大きさはミリ単位で指定）
 * 人の病気などの情報は、この二次元コードからは見られない（ペットの情報と「飼い主に電話」だけ）。
 */

export type PetQrSize = 20 | 15

/** 何cmか（表示・ファイル名用） */
export function sizeLabel(size: PetQrSize): string {
  return size === 20 ? '2cm' : '1.5cm'
}

// ── PNG に「1cmあたり何ドットか」（pHYs）を書き込む ─────────────────

let crcTable: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** PNG の先頭の IHDR のすぐ後ろに pHYs（1メートルあたりのドット数）を入れる */
export function withPngResolution(png: Uint8Array, pixelsPerMeter: number): Uint8Array {
  const ppm = Math.max(1, Math.round(pixelsPerMeter))
  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  view.setUint32(8, ppm)
  view.setUint32(12, ppm)
  chunk[16] = 1 // 単位はメートル
  view.setUint32(17, crc32(chunk.subarray(4, 17)))
  // 8バイトの署名 + IHDR（長さ4 + 種類4 + 中身13 + CRC4 = 25）の後ろに入れる
  const at = 8 + 25
  const out = new Uint8Array(png.length + chunk.length)
  out.set(png.subarray(0, at), 0)
  out.set(chunk, at)
  out.set(png.subarray(at), at + chunk.length)
  return out
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * 首輪用の画像を作る。二次元コードのまわりに少し白い余白（読み取りに必要）をとり、下にペットの名前を小さく入れる。
 * src は画面の隠しキャンバス（余白なし・黒）に描いた二次元コード。
 */
export async function makePetQrPng(
  src: HTMLCanvasElement,
  opts: { petName: string; size: PetQrSize },
): Promise<Blob | null> {
  const QR = 600 // 二次元コード部分の幅（ドット）
  const quiet = Math.round(QR * 0.1) // まわりの白い余白（読み取りに必要）
  const nameH = opts.petName ? Math.round(QR * 0.2) : 0
  const W = QR + quiet * 2
  const H = QR + quiet * 2 + nameH
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, quiet, quiet, QR, QR)
  if (opts.petName) {
    ctx.fillStyle = '#111111'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.round(QR * 0.12)}px sans-serif`
    ctx.fillText(opts.petName, W / 2, QR + quiet + nameH / 2, W - quiet)
  }
  const blob: Blob | null = await new Promise((resolve) => c.toBlob(resolve, 'image/png'))
  if (!blob) return null
  // 二次元コードの幅 QR ドットが、選んだ大きさ（cm）になるように解像度を入れる
  const pixelsPerMeter = (QR / (opts.size / 10)) * 100
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return new Blob([withPngResolution(bytes, pixelsPerMeter) as BlobPart], { type: 'image/png' })
}

export async function downloadPetQr(
  src: HTMLCanvasElement,
  opts: { petName: string; size: PetQrSize; fileName: string },
): Promise<void> {
  const blob = await makePetQrPng(src, opts)
  if (blob) saveBlob(blob, opts.fileName)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch)
}

/** 印刷ページの中身（テストでも確かめられるよう、文字列で作る） */
export function buildPetQrPrintHtml(opts: {
  svg: string
  petName: string
  size: PetQrSize
  title: string
  hint: string
  lang: string
  count?: number
}): string {
  const mm = opts.size // 20 or 15（mm）
  const count = opts.count ?? 12
  const name = escapeHtml(opts.petName)
  const cell = `<div class="tag"><div class="qr">${opts.svg}</div>${name ? `<div class="name">${name}</div>` : ''}</div>`
  return `<!doctype html>
<html lang="${escapeHtml(opts.lang)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: sans-serif; color: #111; background: #fff; }
.hint { margin: 12px; padding: 10px 12px; border: 2px solid #b45309; border-radius: 8px; background: #fffbeb; font-size: 15px; font-weight: bold; line-height: 1.6; }
.sheet { display: flex; flex-wrap: wrap; gap: 6mm; padding: 6mm; }
.tag { width: ${mm + 6}mm; padding: 3mm; border: 0.3mm dashed #999; text-align: center; }
.qr { width: ${mm}mm; height: ${mm}mm; }
.qr svg { width: ${mm}mm; height: ${mm}mm; display: block; }
.name { margin-top: 1mm; font-size: 2.6mm; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media print { .hint { display: none; } }
</style></head>
<body>
<p class="hint">${escapeHtml(opts.hint)}</p>
<div class="sheet" data-size="${mm}">${Array.from({ length: count }, () => cell).join('')}</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>
</body></html>`
}

/** A4に並べた印刷用ページを新しい画面で開いて、印刷の画面を出す */
export function printPetQrSheet(opts: {
  svg: string
  petName: string
  size: PetQrSize
  title: string
  hint: string
  lang: string
}): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(buildPetQrPrintHtml(opts))
  w.document.close()
  return true
}

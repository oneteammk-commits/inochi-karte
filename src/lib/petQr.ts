/**
 * ペット用（首輪・キャリーケース用）の二次元コードを画像にして保存する。
 * 画面の隠しキャンバスに描いた二次元コードの上下に、短い案内とペットの名前を入れる。
 * 人の病気などの情報は、この二次元コードからは見られない（ペットの情報と「飼い主に電話」だけ）。
 */
export async function downloadPetQr(
  src: HTMLCanvasElement,
  opts: { title: string; petName: string; fileName: string },
): Promise<void> {
  const W = 600
  const PAD = 40
  const qrSize = W - PAD * 2
  const H = qrSize + 200
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#7c2d12'
  ctx.textAlign = 'center'
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText(opts.title, W / 2, 62, W - PAD)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, PAD, 100, qrSize, qrSize)
  if (opts.petName) {
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 34px sans-serif'
    ctx.fillText(opts.petName, W / 2, 100 + qrSize + 60, W - PAD)
  }
  const blob: Blob | null = await new Promise((resolve) => c.toBlob(resolve, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

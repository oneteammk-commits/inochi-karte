import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { downloadPetQr, printPetQrSheet, sizeLabel, type PetQrSize } from '../lib/petQr'

/**
 * ペット1匹分の二次元コード（首輪・キャリーケース用）。
 * 読み取るとペットの情報と「飼い主に電話する」ボタンだけが出る画面（/pet/…）を開く。
 * 飼い主の病気・お薬・住所は表示されない。
 * 首輪に付けられるよう、2cm（おすすめ）と1.5cm（小さめ）を選んで、画像で保存か、A4に並べて印刷ができる。
 */
export function PetQrBlock({ petId, petName }: { petId: string; petName: string | null }) {
  const { t, i18n } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [size, setSize] = useState<PetQrSize>(20)
  const url = `${window.location.origin}/pet/${petId}`
  const canvasId = `pet-qr-src-${petId}`
  const svgWrapId = `pet-qr-svg-${petId}`
  const name = (petName ?? '').trim()

  const save = async () => {
    const src = document.getElementById(canvasId) as HTMLCanvasElement | null
    if (!src) return
    setSaving(true)
    try {
      await downloadPetQr(src, {
        petName: name,
        size,
        fileName: `sitte-pet-${name || 'qr'}-${sizeLabel(size)}.png`,
      })
    } finally {
      setSaving(false)
    }
  }

  const print = () => {
    const svg = document.getElementById(svgWrapId)?.innerHTML ?? ''
    if (!svg) return
    printPetQrSheet({
      svg,
      petName: name,
      size,
      title: t('petCard.qrPrintTitle'),
      hint: t('petCard.qrSizeNote'),
      lang: i18n.language,
    })
  }

  const sizeBtn = (s: PetQrSize, label: string) => (
    <button
      type="button"
      onClick={() => setSize(s)}
      aria-pressed={size === s}
      data-qr-size={s}
      className={`flex-1 rounded-xl border-2 px-2 py-2.5 text-sm font-bold ${
        size === s ? 'border-amber-800 bg-amber-800 text-white' : 'border-amber-400 bg-white text-amber-900'
      }`}
      style={size === s ? { color: '#ffffff' } : undefined}
    >
      {label}
    </button>
  )

  return (
    <div className="rounded-2xl border-2 border-amber-500 bg-white p-4" data-pet-qr={petId}>
      <h3 className="mb-1 text-center text-base font-bold text-amber-900">
        🐾 {t('petCard.qrTitle')}
        {name ? `（${name}）` : ''}
      </h3>
      <p className="mb-3 text-center text-sm font-medium leading-relaxed text-stone-800">{t('petCard.qrNote')}</p>
      <div className="mb-3 flex justify-center rounded-xl bg-stone-50 p-3">
        <QRCodeSVG value={url} size={150} level="M" includeMargin fgColor="#7C2D12" bgColor="#ffffff" />
      </div>
      <p className="mb-1.5 text-sm font-bold text-stone-900">{t('petCard.qrSizeLabel')}</p>
      <div className="mb-3 flex gap-2" role="group" aria-label={t('petCard.qrSizeLabel')}>
        {sizeBtn(20, t('petCard.qrSize20'))}
        {sizeBtn(15, t('petCard.qrSize15'))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          data-qr-save
          style={{ color: '#ffffff' }}
          className="block w-full rounded-xl bg-amber-800 py-3 text-sm font-bold text-white shadow disabled:opacity-60"
        >
          {t('petCard.qrSave')}
        </button>
        <button
          type="button"
          onClick={print}
          data-qr-print
          className="block w-full rounded-xl border-2 border-amber-800 bg-white py-3 text-sm font-bold text-amber-900 shadow"
        >
          {t('petCard.qrPrint')}
        </button>
      </div>
      <p className="mt-2 text-xs font-medium leading-relaxed text-stone-700">{t('petCard.qrSizeNote')}</p>
      <div aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <QRCodeCanvas id={canvasId} value={url} size={600} level="M" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
        <div id={svgWrapId}>
          <QRCodeSVG value={url} size={200} level="M" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
        </div>
      </div>
    </div>
  )
}

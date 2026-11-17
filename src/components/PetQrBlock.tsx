import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { downloadPetQr } from '../lib/petQr'

/**
 * ペット1匹分の二次元コード（首輪・キャリーケース用）。
 * 読み取るとペットの情報と「飼い主に電話する」ボタンだけが出る画面（/pet/…）を開く。
 * 飼い主の病気・お薬・住所は表示されない。
 */
export function PetQrBlock({ petId, petName }: { petId: string; petName: string | null }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const url = `${window.location.origin}/pet/${petId}`
  const canvasId = `pet-qr-src-${petId}`
  const name = (petName ?? '').trim()

  const save = async () => {
    const src = document.getElementById(canvasId) as HTMLCanvasElement | null
    if (!src) return
    setSaving(true)
    try {
      await downloadPetQr(src, {
        title: t('petCard.qrImageTitle'),
        petName: name,
        fileName: `sitte-pet-${name || 'qr'}.png`,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-amber-500 bg-white p-4" data-pet-qr={petId}>
      <h3 className="mb-1 text-center text-base font-bold text-amber-900">
        🐾 {t('petCard.qrTitle')}
        {name ? `（${name}）` : ''}
      </h3>
      <p className="mb-3 text-center text-sm font-medium leading-relaxed text-stone-800">{t('petCard.qrNote')}</p>
      <div className="mb-3 flex justify-center rounded-xl bg-stone-50 p-3">
        <QRCodeSVG value={url} size={170} level="M" includeMargin fgColor="#7C2D12" bgColor="#ffffff" />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{ color: '#ffffff' }}
        className="block w-full rounded-xl bg-amber-800 py-3 text-sm font-bold text-white shadow disabled:opacity-60"
      >
        {t('petCard.qrSave')}
      </button>
      <div aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <QRCodeCanvas id={canvasId} value={url} size={296} level="M" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
      </div>
    </div>
  )
}

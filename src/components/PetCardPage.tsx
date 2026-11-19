import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchPetCard, type PetCardBundle } from '../lib/cardApi'
import { PetViewSection } from './PetViewSection'

const LANGS: { code: string; label: string }[] = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'my', label: 'မြန်မာ' },
  { code: 'fr', label: 'Français' },
]

/**
 * ペット用の二次元コード（首輪・キャリーケースに付けるもの）で開く画面。
 * 迷子のペットを見つけた人・保護した人が見る。
 * 出すのはペットの情報・飼い主のお名前・「飼い主に電話する」ボタンだけ。
 * 飼い主の病気・お薬・アレルギー・住所・生年月日は出さない（データも受け取らない）。
 * 電話番号も画面には出さず、ボタンにする。
 */
export function PetCardPage({ petId }: { petId: string }) {
  const { t, i18n } = useTranslation()
  const [bundle, setBundle] = useState<PetCardBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void fetchPetCard(petId).then((b) => {
      if (!alive) return
      setBundle(b)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [petId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg font-bold">{t('view.loading')}</p>
      </div>
    )
  }
  if (!bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-lg font-bold text-red-700">{t('view.notFound')}</p>
      </div>
    )
  }

  const phone = (bundle.ownerPhone ?? '').trim()
  const petName = (bundle.pet.pet_name ?? '').trim()
  // 飼い主のお名前は出す（近藤さんの判断 11/17）。病気・お薬・住所・電話番号は出さない
  const ownerName = (bundle.ownerName ?? '').trim()

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="fixed right-2 top-2 z-50">
        <button
          onClick={() => setLangOpen(!langOpen)}
          className="rounded-xl border-2 border-amber-800 bg-white px-3 py-2 text-sm font-bold text-amber-900 shadow-md"
        >
          🌍 {t('language')}
        </button>
        {langOpen && (
          <div className="mt-2 overflow-hidden rounded-xl border-2 border-stone-300 bg-white shadow-lg">
            {LANGS.map((l, i) => (
              <button
                key={l.code}
                onClick={() => {
                  void i18n.changeLanguage(l.code)
                  setLangOpen(false)
                }}
                className={`block w-full px-4 py-3 text-left font-bold text-black hover:bg-stone-100 ${
                  i < LANGS.length - 1 ? 'border-b border-stone-200' : ''
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="rounded-t-3xl bg-amber-800 py-5 text-center text-white shadow-md">
          <h1 className="text-2xl font-bold">🐾 {t('petCard.title')}</h1>
          <p className="text-sm">{t('petCard.subtitle')}</p>
        </div>

        <div className="mb-3 rounded-b-2xl border-2 border-amber-800 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-bold text-stone-900">{t('petCard.finderTitle')}</h2>
          <p className="mb-4 text-base font-medium leading-relaxed text-stone-900">
            {petName ? t('petCard.finderNoteNamed').replace('{{name}}', petName) : t('petCard.finderNote')}
          </p>
          {ownerName && (
            <p className="mb-3 text-base text-stone-900" data-owner-name>
              {t('petCard.ownerLabel')}：<span className="font-bold">{ownerName}</span>
            </p>
          )}
          {phone ? (
            <a
              href={`tel:${phone}`}
              data-call-owner
              style={{ color: '#ffffff' }}
              className="block w-full rounded-2xl bg-red-700 py-5 text-center text-xl font-bold text-white no-underline shadow-md"
            >
              📞 {t('petCard.callOwner')}
            </a>
          ) : (
            <p className="rounded-xl bg-stone-100 p-3 text-sm font-semibold text-stone-800">{t('petCard.noPhone')}</p>
          )}
        </div>

        <PetViewSection pets={[bundle.pet]} t={t} lang={i18n.language} />

        <p className="mb-6 mt-2 text-center text-xs font-medium text-stone-600">{t('petCard.privacyNote')}</p>

        <a
          href="/"
          className="mb-6 block w-full rounded-2xl border-2 border-stone-300 bg-white py-4 text-center text-base font-bold text-black"
        >
          {t('petCard.aboutSitte')}
        </a>
      </div>
    </div>
  )
}

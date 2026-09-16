import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMyCards, updateMyCardNames, removeMyCard, type MyCard } from '../lib/storage'
import { deleteRegistration } from '../lib/deleteRegistration'
import { fetchCardsSummary } from '../lib/cardApi'

export function HomePage() {
  const { t, i18n } = useTranslation()
  const [myCards, setMyCards] = useState<MyCard[]>([])
  const [emergencyPhone, setEmergencyPhone] = useState<string | null>(null)
  const [langOpen, setLangOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MyCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletePassword, setDeletePassword] = useState('')

  const openDeleteDialog = (card: MyCard) => {
    setDeleteError(null)
    setDeletePassword('')
    setDeleteTarget(card)
  }

  const closeDeleteDialog = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
    setDeletePassword('')
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!/^\d{4}$/.test(deletePassword)) {
      setDeleteError(
        t('home.deletePasswordFormat', '登録時に決めた数字4桁を入力してください。'),
      )
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      // 編集用パスワードが合っているときだけ削除される
      await deleteRegistration(deleteTarget.id, deletePassword)
      removeMyCard(deleteTarget.id)
      setMyCards(getMyCards())
      setDeleteTarget(null)
      setDeletePassword('')
    } catch (e) {
      console.error('delete failed:', e)
      setDeleteError(e instanceof Error ? e.message : t('home.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const cards = getMyCards()
    setMyCards(cards)
    if (cards.length > 0) {
      const ids = cards.map((c) => c.id)
      // 自分の端末に保存したIDの分だけを問い合わせる
      void fetchCardsSummary(ids).then((rows) => {
        if (rows.length === 0) return
        const names = rows
          .filter((row) => row && row.id && row.name)
          .map((row) => ({ id: row.id, name: row.name }))
        if (names.length > 0) {
          updateMyCardNames(names)
          setMyCards(getMyCards())
        }
        const first = rows.find((row) => row.id === cards[0].id)
        if (first && first.emergency_contact_phone) {
          setEmergencyPhone(first.emergency_contact_phone)
        }
      })
    }
  }, [])

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    setLangOpen(false)
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="fixed top-2 right-2 z-50">
        <button onClick={() => setLangOpen(!langOpen)} className="bg-white border-2 border-red-700 text-red-700 font-bold px-3 py-2 rounded-xl shadow-md text-sm">🌍 {t('language')}</button>
        {langOpen && (
          <div className="mt-2 bg-white border-2 border-stone-300 rounded-xl shadow-lg overflow-hidden">
            <button onClick={() => changeLanguage('ja')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">日本語</button>
            <button onClick={() => changeLanguage('en')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">English</button>
            <button onClick={() => changeLanguage('id')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">Bahasa Indonesia</button>
            <button onClick={() => changeLanguage('zh')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">中文</button>
            <button onClick={() => changeLanguage('ko')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">한국어</button>
            <button onClick={() => changeLanguage('my')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">မြန်မာ</button>
          <button onClick={() => changeLanguage('fr')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 text-black font-bold">Français</button>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto">
        <header className="mb-6 text-center mt-12">
          <div className="mb-4 flex justify-center"><img src="/icon-192x192.png" alt="命のカルテ" className="w-24 h-24 rounded-2xl shadow-md" /></div>
          <h1 className="text-3xl font-bold tracking-tight text-black">{t('home.title')}</h1>
          <p className="mt-3 text-base text-black leading-relaxed">{t('home.subtitle')}</p>
        </header>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <a href="tel:110" className="block bg-blue-700 hover:bg-blue-800 text-white text-center py-4 rounded-2xl shadow-md">
            <div style={{fontSize: '60px', lineHeight: '1'}}>🚓</div>
            <div className="text-sm font-bold mt-2">{t('home.call110')}</div>
            <div className="text-xs">{t('home.call110Sub')}</div>
          </a>
          <a href="tel:119" className="block bg-red-700 hover:bg-red-800 text-white text-center py-4 rounded-2xl shadow-md">
            <div style={{fontSize: '60px', lineHeight: '1'}}>🚑</div>
            <div className="text-sm font-bold mt-2">{t('home.call119')}</div>
            <div className="text-xs">{t('home.call119Sub')}</div>
          </a>
          <a href={emergencyPhone ? "tel:" + emergencyPhone : "#"} className={"block text-center py-4 rounded-2xl shadow-md " + (emergencyPhone ? "bg-green-700 hover:bg-green-800 text-white" : "bg-green-700 text-white opacity-60")}>
            <div style={{fontSize: '60px', lineHeight: '1'}}>📞</div>
            <div className="text-sm font-bold mt-2">{t('home.callContact')}</div>
            <div className="text-xs">{emergencyPhone ? t('home.callContactSub') : t('home.callContactNotSet')}</div>
          </a>
        </div>

        <div className="space-y-4">
          <a href="/register" className="block w-full bg-red-700 hover:bg-red-800 text-white text-center py-5 rounded-2xl text-lg font-bold shadow-md">
            {myCards.length > 0 ? t('home.buttonRegisterFamily') : t('home.buttonRegister')}
          </a>

          {myCards.length > 0 && (
            <div className="pt-2">
              <h2 className="mb-3 text-center text-lg font-bold text-black">{t('home.familyTitle')}</h2>
              <div className="space-y-3">
                {myCards.map((card) => (
                  <div key={card.id} className="rounded-2xl border-2 border-stone-300 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-center text-lg font-bold text-black">
                      {card.name ? card.name : t('home.familyNoName')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <a href={"/card/" + card.id} className="block bg-white border-2 border-stone-400 hover:bg-stone-50 text-black text-center py-3 rounded-xl text-base font-bold shadow-sm">{t('home.familyView')}</a>
                      <a href={"/edit/" + card.id} className="block bg-white border-2 border-stone-400 hover:bg-stone-50 text-black text-center py-3 rounded-xl text-base font-bold shadow-sm">{t('home.familyEdit')}</a>
                    </div>
                    <div className="mt-3 text-center">
                      <button onClick={() => openDeleteDialog(card)} className="text-sm font-bold text-red-700 underline underline-offset-2">{t('home.familyDelete')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {myCards.length === 0 && (
            <div className="text-center text-base text-black mt-6 font-medium">
              <p>{t('home.notRegistered1')}</p>
              <p>{t('home.notRegistered2')}</p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center text-base text-black font-medium">
          <p>{t('home.qrInfo')}</p>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeDeleteDialog}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-center text-xl font-bold text-black">{t('home.deleteTitle')}</h3>
            <p className="mb-5 text-base leading-relaxed text-black">
              {t('home.deleteConfirm', { name: deleteTarget.name || t('home.familyNoName') })}
            </p>
            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-black">
                {t('home.deletePasswordLabel', '編集用パスワード（数字4桁）')}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={deletePassword}
                onChange={(e) =>
                  setDeletePassword(
                    e.target.value
                      .replace(/[\uFF10-\uFF19]/g, (c) =>
                        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
                      )
                      .replace(/[^0-9]/g, ''),
                  )
                }
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-2xl tracking-widest text-stone-900 focus:border-red-700 focus:outline-none"
                placeholder="----"
              />
              <span className="mt-2 block text-xs leading-relaxed text-stone-600">
                {t('home.deletePasswordHint', '登録するときに決めた4桁の数字です。ご本人以外が削除できないようにするための確認です。')}
              </span>
            </label>
            {deleteError && (
              <p className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">{deleteError}</p>
            )}
            <div className="space-y-3">
              <button onClick={handleDelete} disabled={deleting} className="block w-full rounded-xl bg-red-700 py-4 text-center text-base font-bold text-white shadow-md hover:bg-red-800 disabled:opacity-60">
                {deleting ? t('home.deleting') : t('home.deleteYes')}
              </button>
              <button onClick={closeDeleteDialog} disabled={deleting} className="block w-full rounded-xl border-2 border-stone-400 bg-white py-4 text-center text-base font-bold text-black shadow-sm hover:bg-stone-50 disabled:opacity-60">
                {t('home.deleteNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

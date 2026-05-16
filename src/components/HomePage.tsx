import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMyCardId } from '../lib/storage'
import { supabase } from '../lib/supabase'

export function HomePage() {
  const { t, i18n } = useTranslation()
  const [myCardId, setMyCardId] = useState<string | null>(null)
  const [emergencyPhone, setEmergencyPhone] = useState<string | null>(null)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const id = getMyCardId()
    setMyCardId(id)
    if (id) {
      supabase
        .from('registrations')
        .select('emergency_contact_phone')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data && data.emergency_contact_phone) {
            setEmergencyPhone(data.emergency_contact_phone)
          }
        })
    }
  }, [])

  const viewUrl = myCardId ? "/card/" + myCardId : "#"
  const editUrl = myCardId ? "/edit/" + myCardId : "#"

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
            <button onClick={() => changeLanguage('zh')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">中文</button>
            <button onClick={() => changeLanguage('ko')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 border-b border-stone-200 text-black font-bold">한국어</button>
            <button onClick={() => changeLanguage('my')} className="block w-full text-left px-4 py-3 hover:bg-stone-100 text-black font-bold">မြန်မာ</button>
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
          <a href="/register" className="block w-full bg-red-700 hover:bg-red-800 text-white text-center py-5 rounded-2xl text-lg font-bold shadow-md">{t('home.buttonRegister')}</a>

          {myCardId && (
            <a href={viewUrl} className="block w-full bg-white border-2 border-stone-400 hover:bg-stone-50 text-black text-center py-5 rounded-2xl text-lg font-bold shadow-sm">{t('home.buttonViewCard')}</a>
          )}

          {myCardId && (
            <a href={editUrl} className="block w-full bg-white border-2 border-stone-400 hover:bg-stone-50 text-black text-center py-5 rounded-2xl text-lg font-bold shadow-sm">{t('home.buttonEdit')}</a>
          )}

          {!myCardId && (
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
    </div>
  )
}

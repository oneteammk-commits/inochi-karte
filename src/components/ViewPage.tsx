import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
export function ViewPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single()
      if (error) setError(t('view.notFound'))
      else setData(data)
      setLoading(false)
    }
    fetchData()
  }, [id, t])

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    setLangOpen(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-lg font-bold">{t('view.loading')}</p></div>
  if (error || !data) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-700 text-lg font-bold">{t('view.notFound')}</p></div>

  const rawMeds = Array.isArray(data.medications)
    ? data.medications
    : typeof data.medications === 'string'
    ? JSON.parse(data.medications)
    : []
  const medications = rawMeds.map((m: any) =>
    typeof m === 'string' ? JSON.parse(m) : m
  )

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

      <div className="max-w-2xl mx-auto">

        <div className="bg-red-700 text-white text-center py-5 rounded-t-3xl shadow-md">
          <div className="flex items-center justify-center gap-3">
            <img src="/icon-192x192.png" alt="命のカルテ" className="w-12 h-12 rounded-full bg-white p-1" />
            <div className="text-left">
              <h1 className="text-2xl font-bold">{t('view.headerTitle')}</h1>
              <p className="text-sm">{t('view.headerSubtitle')}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 shadow-sm p-5 mb-3 rounded-r-2xl">
          <h2 className="text-lg font-bold text-blue-800 border-b-2 border-blue-200 pb-2 mb-3">👤 {t('view.basicInfo')}</h2>
          <p className="text-3xl font-bold text-black">{data.name}</p>
          {data.furigana && <p className="text-base text-stone-700 mt-1">{data.furigana}</p>}
          <p className="text-base text-black mt-2">{t('view.birthDate')}: <span className="font-bold">{data.birth_date}</span></p>
        </div>

        <div className="bg-pink-50 border-l-4 border-pink-500 shadow-sm p-5 mb-3 rounded-r-2xl">
          <h2 className="text-lg font-bold text-pink-700 border-b-2 border-pink-200 pb-2 mb-3">🆘 {t('view.emergencyContact')}</h2>
          <p className="text-xl font-bold text-black">{data.emergency_contact_name}</p>
          {data.emergency_contact_furigana && <p className="text-base text-stone-700">{data.emergency_contact_furigana}</p>}
          <a href={"tel:" + data.emergency_contact_phone} className="mt-3 inline-block text-2xl font-bold text-blue-700 underline">📞 {data.emergency_contact_phone}</a>
        </div>

        {(data.allergies?.length > 0 || data.allergy_other) && (
          <div className="bg-orange-50 border-l-4 border-orange-500 shadow-sm p-5 mb-3 rounded-r-2xl">
            <h2 className="text-lg font-bold text-orange-700 border-b-2 border-orange-200 pb-2 mb-3">⚠️ {t('view.allergies')}</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {data.allergies?.map((a: string) => (
<span key={a} className="bg-orange-200 text-orange-900 px-3 py-1 rounded-full text-base font-bold">{t(`allergyTags.${a}`)}</span>              ))}
            </div>
            {data.allergy_other && <p className="text-base text-black mt-2">{t('view.other')}: {data.allergy_other}</p>}
          </div>
        )}

        {(data.diseases?.length > 0 || data.disease_other) && (
          <div className="bg-green-50 border-l-4 border-green-500 shadow-sm p-5 mb-3 rounded-r-2xl">
            <h2 className="text-lg font-bold text-green-700 border-b-2 border-green-200 pb-2 mb-3">🏥 {t('view.diseases')}</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {data.diseases?.map((d: string) => (
<span key={d} className="bg-green-200 text-green-900 px-3 py-1 rounded-full text-base font-bold">{t(`chronicTags.${d}`)}</span>              ))}
            </div>
            {data.disease_other && <p className="text-base text-black mt-2">{t('view.other')}: {data.disease_other}</p>}
          </div>
        )}

        <div className="bg-purple-50 border-l-4 border-purple-500 shadow-sm p-5 mb-3 rounded-r-2xl">
          <h2 className="text-lg font-bold text-purple-700 border-b-2 border-purple-200 pb-2 mb-3">💊 {t('view.medications')}</h2>
          {medications.length === 0 ? (
            <p className="text-stone-500 text-base">{t('view.noRegistration')}</p>
          ) : (
            medications.map((m: any, i: number) => (
              <div key={i} className="mb-4 border-b border-purple-100 pb-3 last:border-0">
                <p className="font-bold text-lg text-black">{m.name}</p>
{m.photo_urls && m.photo_urls.length > 0 ? (
<div className="mt-2 grid grid-cols-2 gap-2">{m.photo_urls.map((src: string, idx: number) => (<img key={idx} src={src} alt={m.name} className="w-full rounded-xl border-2 border-purple-200" />))}</div>                ) : (                  <p className="text-stone-500 text-sm">{t('view.noPhoto')}</p>
                )}
              </div>
            ))
          )}
        </div>

        {data.daily_notes && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 shadow-sm p-5 mb-3 rounded-r-2xl">
            <h2 className="text-lg font-bold text-yellow-700 border-b-2 border-yellow-200 pb-2 mb-3">📝 {t('view.dailyNotes')}</h2>
            <p className="text-base text-black whitespace-pre-wrap">{data.daily_notes}</p>
          </div>
        )}

        {(data.facility_name || data.facility_type || data.prefecture) && (
          <div className="bg-stone-50 border-l-4 border-stone-500 shadow-sm p-5 mb-3 rounded-r-2xl">
            <h2 className="text-lg font-bold text-stone-700 border-b-2 border-stone-200 pb-2 mb-3">🏨 {t('view.facility')}</h2>
            {data.facility_name && <p className="text-base font-bold text-black">{data.facility_name}</p>}
{data.facility_type && <p className="text-base text-stone-700">{t(`facilityTypes.${data.facility_type}`)}</p>}            {data.postal_code && <p className="text-sm text-stone-600 mt-1">〒{data.postal_code}</p>}
{(data.prefecture || data.city) && <p className="text-sm text-stone-600">{data.prefecture && t(`prefectures.${data.prefecture}`)} {data.city}</p>}          </div>
        )}

<div className="bg-white border-2 border-red-700 shadow-md p-5 mb-3 rounded-2xl">
          <h2 className="text-lg font-bold text-red-700 text-center pb-2 mb-3">📱 {t('view.qrCardTitle')}</h2>
          <div className="flex justify-center bg-stone-50 rounded-2xl p-4 mb-3">
            <QRCodeSVG
              value={`${window.location.origin}/card/${id}`}
              size={200}
              level="M"
              includeMargin
              fgColor="#C0392B"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-sm text-stone-600 text-center">{t('view.qrCardInstruction')}</p>
        </div>

        <div className="mt-6 mb-4">          <a href={"/edit/" + id} className="block w-full bg-stone-700 hover:bg-stone-800 text-white text-center py-5 rounded-2xl text-lg font-bold shadow">{t('view.buttonEdit')}</a>
        </div>

        <div className="mt-4 mb-4">
          <a href="/" className="block w-full bg-white border-2 border-stone-300 hover:bg-stone-50 text-black text-center py-4 rounded-2xl text-base font-bold">{t('view.buttonHome')}</a>
        </div>

      </div>
    </div>
  )
}

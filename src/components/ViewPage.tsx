import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Medication = { name: string; photo_url: string | null }

type Registration = {
  id: string
  name: string
  birth_date: string
  emergency_contact_name: string
  emergency_contact_phone: string
  prefecture: string
  city: string
  facility_name: string | null
  facility_type: string | null
  allergies: string[]
  allergy_other: string | null
  diseases: string[]
  disease_other: string | null
  daily_notes: string | null
  medications: Medication[]
}

export function ViewPage({ id }: { id: string }) {
  const [data, setData] = useState<Registration | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single()
      if (error) setError('データが見つかりませんでした')
      else setData(data)
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-lg text-gray-600">読み込み中...</p></div>
  if (error || !data) return <div className="min-h-screen flex items-center justify-center"><p className="text-lg text-red-600">データが見つかりませんでした</p></div>

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">

        <div className="bg-red-600 text-white text-center py-4 rounded-t-xl">
          <h1 className="text-2xl font-bold">🚨 救急情報カード</h1>
          <p className="text-sm">命のカルテ</p>
        </div>

        {/* 基本情報 */}
        <div className="bg-white shadow p-4 mb-2">
          <h2 className="text-lg font-bold border-b pb-1 mb-2">基本情報</h2>
          <p className="text-2xl font-bold">{data.name}</p>
          <p className="text-gray-600">生年月日：{data.birth_date}</p>
        </div>

        {/* 緊急連絡先 */}
        <div className="bg-white shadow p-4 mb-2">
          <h2 className="text-lg font-bold text-red-600 border-b pb-1 mb-2">🆘 緊急連絡先</h2>
          <p className="text-xl font-bold">{data.emergency_contact_name}</p>
          <a href={`tel:${data.emergency_contact_phone}`} className="text-2xl font-bold text-blue-600 underline">
            📞 {data.emergency_contact_phone}
          </a>
        </div>

        {/* アレルギー */}
        {(data.allergies?.length > 0 || data.allergy_other) && (
          <div className="bg-yellow-50 shadow p-4 mb-2 border-l-4 border-yellow-500">
            <h2 className="text-lg font-bold text-yellow-700 border-b pb-1 mb-2">⚠️ アレルギー</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {data.allergies?.map((a) => (
                <span key={a} className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-sm">{a}</span>
              ))}
            </div>
            {data.allergy_other && <p>その他：{data.allergy_other}</p>}
          </div>
        )}

        {/* 既往症 */}
        {(data.diseases?.length > 0 || data.disease_other) && (
          <div className="bg-orange-50 shadow p-4 mb-2 border-l-4 border-orange-500">
            <h2 className="text-lg font-bold text-orange-700 border-b pb-1 mb-2">🏥 既往症・慢性疾患</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {data.diseases?.map((d) => (
                <span key={d} className="bg-orange-200 text-orange-800 px-2 py-1 rounded text-sm">{d}</span>
              ))}
            </div>
            {data.disease_other && <p>その他：{data.disease_other}</p>}
          </div>
        )}

        {/* お薬 */}
        {data.medications?.length > 0 && (
          <div className="bg-white shadow p-4 mb-2">
            <h2 className="text-lg font-bold border-b pb-1 mb-2">💊 服用中のお薬</h2>
            {data.medications.map((m, i) => (
              <div key={i} className="mb-3">
                <p className="font-medium text-gray-800">{m.name}</p>
                {m.photo_url && (
                  <img src={m.photo_url} alt={m.name} className="mt-1 max-w-xs rounded border" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* 特記事項 */}
        {data.daily_notes && (
          <div className="bg-white shadow p-4 mb-2">
            <h2 className="text-lg font-bold border-b pb-1 mb-2">📝 特記事項</h2>
            <p className="whitespace-pre-wrap">{data.daily_notes}</p>
          </div>
        )}

        {/* かかりつけ医 */}
        {(data.facility_name || data.facility_type || data.prefecture) && (
          <div className="bg-white shadow p-4 mb-2">
            <h2 className="text-lg font-bold border-b pb-1 mb-2">🏨 かかりつけ医・施設</h2>
            {data.facility_name && <p className="font-medium">{data.facility_name}</p>}
            {data.facility_type && <p className="text-gray-600">{data.facility_type}</p>}
            {(data.prefecture || data.city) && (
              <p className="text-gray-500 text-sm">{data.prefecture} {data.city}</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

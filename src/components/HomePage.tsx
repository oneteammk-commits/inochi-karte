import { useEffect, useState } from 'react'
import { getMyCardId } from '../lib/storage'
import { supabase } from '../lib/supabase'

export function HomePage() {
  const [myCardId, setMyCardId] = useState<string | null>(null)
  const [emergencyPhone, setEmergencyPhone] = useState<string | null>(null)

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

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="max-w-lg mx-auto">
        <header className="mb-6 text-center mt-12">
          <div className="text-6xl mb-4">🐕</div>
          <h1 className="text-3xl font-bold tracking-tight text-black">命のカルテ</h1>
          <p className="mt-3 text-base text-black leading-relaxed">あなたの命を守る大切な情報を、必要な時に医療従事者へ伝えるアプリです。</p>
        </header>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <a href="tel:110" className="block bg-blue-700 hover:bg-blue-800 text-white text-center py-4 rounded-2xl shadow-md">
            <div className="text-2xl">🚓</div>
            <div className="text-lg font-bold mt-1">110番</div>
            <div className="text-xs">警察</div>
          </a>
          <a href="tel:119" className="block bg-red-700 hover:bg-red-800 text-white text-center py-4 rounded-2xl shadow-md">
            <div className="text-2xl">🚑</div>
            <div className="text-lg font-bold mt-1">119番</div>
            <div className="text-xs">救急</div>
          </a>
          {emergencyPhone ? (
            <a href={"tel:" + emergencyPhone} className="block bg-green-700 hover:bg-green-800 text-white text-center py-4 rounded-2xl shadow-md">
              <div className="text-2xl">📞</div>
              <div className="text-lg font-bold mt-1">家族</div>
              <div className="text-xs">緊急連絡先</div>
            </a>
          ) : (
            <div className="block bg-stone-300 text-stone-600 text-center py-4 rounded-2xl">
              <div className="text-2xl">📞</div>
              <div className="text-lg font-bold mt-1">未設定</div>
              <div className="text-xs">緊急連絡先</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <a href="/register" className="block w-full bg-red-700 hover:bg-red-800 text-white text-center py-5 rounded-2xl text-lg font-bold shadow-md">📝 新規登録する</a>

          {myCardId && (
            <a href={viewUrl} className="block w-full bg-white border-2 border-stone-400 hover:bg-stone-50 text-black text-center py-5 rounded-2xl text-lg font-bold shadow-sm">📋 自分のカルテを見る</a>
          )}

          {myCardId && (
            <a href={editUrl} className="block w-full bg-white border-2 border-stone-400 hover:bg-stone-50 text-black text-center py-5 rounded-2xl text-lg font-bold shadow-sm">✏️ 内容を変更する</a>
          )}

          {!myCardId && (
            <div className="text-center text-base text-black mt-6 font-medium">
              <p>まだ登録されていません。</p>
              <p>上のボタンから新規登録してください。</p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center text-base text-black font-medium">
          <p>緊急時には登録情報をQRコードで医療従事者に共有できます</p>
        </div>
      </div>
    </div>
  )
}

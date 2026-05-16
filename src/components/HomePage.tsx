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
          <a href="tel:110" className="block bg-blue-700 hover:bg-blue-800 text-white text-center py-3 rounded-2xl shadow-md">
            <div className="text-5xl">🚓</div

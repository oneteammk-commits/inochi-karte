import type { PetRegistrationRow } from '../types/petRegistration'

/**
 * カルテの中身を「文字のデータ（CSV）」にして保存する。
 * 行政の方が写真を見ながら手で打ち直さなくて済むように、
 * 1行に「区分・項目・内容」を並べる（Excel でそのまま開ける形）。
 * 写真から読み取った文字は、本人が確かめて入力欄に入れたものがそのまま入る。
 */

type Row = [string, string, string]

function cell(v: string): string {
  const s = v.replace(/\r/g, '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function add(rows: Row[], group: string, label: string, value: unknown) {
  if (value === null || value === undefined) return
  const s = Array.isArray(value) ? value.filter(Boolean).join('、') : String(value)
  if (!s.trim()) return
  rows.push([group, label, s.trim()])
}

const RABIES: Record<string, string> = { done: '接種済み', not: '未接種', exempt: '猶予中' }
const PARASITE: Record<string, string> = { done: 'している', not: 'していない' }
const NEUTER: Record<string, string> = { done: '手術している', not: '手術していない', unknown: '分からない' }
const SEX: Record<string, string> = { male: 'オス', female: 'メス', unknown: '不明' }
const FITTED: Record<string, string> = { yes: '装着あり', no: '装着なし', unknown: '分からない' }
const REGISTRY: Record<string, string> = {
  moe: '環境省指定登録機関',
  aipo: 'AIPO',
  jkc: 'JKC',
  shop: 'ペットショップ独自（Fam等）',
  unknown: '分からない',
  other: 'その他',
}

function label(v: string | null | undefined, map: Record<string, string>): string {
  if (!v) return ''
  return map[v] ?? v
}

export function buildCardCsv(registration: any, pets: PetRegistrationRow[]): string {
  const rows: Row[] = [['区分', '項目', '内容']]
  const me = '本人'
  add(rows, me, 'お名前', registration.name)
  add(rows, me, 'ふりがな', registration.furigana)
  add(rows, me, '生年月日', registration.birth_date)
  add(rows, me, '緊急連絡先・続柄', registration.emergency_contact_relationship)
  add(rows, me, '緊急連絡先・お名前', registration.emergency_contact_name)
  add(rows, me, '緊急連絡先・電話', registration.emergency_contact_phone)
  add(rows, me, '郵便番号', registration.postal_code)
  add(rows, me, '都道府県', registration.prefecture)
  add(rows, me, '市区町村', registration.city)
  add(rows, me, '番地・建物', registration.address_detail)
  add(rows, me, '住まいの種類', registration.facility_type)
  add(rows, me, '施設名', registration.facility_name)
  add(rows, me, 'アレルギー', registration.allergies)
  add(rows, me, 'アレルギー（その他）', registration.allergy_other)
  add(rows, me, '持病', registration.diseases)
  add(rows, me, '持病（その他）', registration.disease_other)
  add(rows, me, 'かかりつけ病院', registration.hospital_name)
  add(rows, me, '日常のこと', registration.daily_notes)

  const rawMeds = Array.isArray(registration.medications) ? registration.medications : []
  rawMeds.forEach((m: unknown, i: number) => {
    let name = ''
    try {
      const parsed = typeof m === 'string' ? JSON.parse(m) : (m as { name?: string })
      name = parsed?.name ?? ''
    } catch {
      name = typeof m === 'string' ? m : ''
    }
    add(rows, me, `お薬・検査${i + 1}`, name)
  })

  pets.forEach((p, i) => {
    const g = `ペット${i + 1}`
    add(rows, g, '名前', p.pet_name)
    add(rows, g, '種類', p.species)
    add(rows, g, '犬種・猫種', p.breed)
    add(rows, g, '年齢', p.age)
    add(rows, g, '性別', label(p.sex, SEX))
    add(rows, g, '不妊・去勢手術', label(p.neuter_status, NEUTER))
    add(rows, g, '狂犬病予防注射', label(p.rabies_status, RABIES))
    add(rows, g, '狂犬病・最新の接種日', p.rabies_date)
    add(rows, g, '狂犬病・猶予の理由', p.rabies_exempt_reason)
    add(rows, g, '混合ワクチン', p.vaccine_info)
    add(rows, g, '混合ワクチン・最新の接種日', p.vaccine_date)
    add(rows, g, 'ノミ・ダニ・フィラリア予防', label(p.parasite_status, PARASITE))
    add(rows, g, 'ノミ・ダニ・最終実施日', p.parasite_date)
    add(rows, g, '持病・既往歴', p.medical_history)
    add(rows, g, 'お薬', p.medications)
    add(rows, g, 'アレルギー', p.allergies)
    add(rows, g, 'ごはん', p.food)
    add(rows, g, 'かかりつけ動物病院', p.vet_clinic)
    add(rows, g, 'かかりつけ動物病院・住所', p.vet_clinic_address)
    add(rows, g, '担当獣医師', p.vet_doctor)
    add(rows, g, 'マイクロチップ', label(p.microchip_fitted, FITTED))
    add(rows, g, 'マイクロチップ・登録先', label(p.microchip_registry, REGISTRY))
    add(rows, g, 'マイクロチップ・登録先（その他）', p.microchip_registry_other)
    add(rows, g, 'マイクロチップ番号', p.microchip)
    add(rows, g, '鑑札番号', p.license_number)
    add(rows, g, '特徴', p.features)
  })

  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** CSVをファイルとして保存する（Excel で文字化けしないよう先頭に BOM を付ける） */
export function downloadCardCsv(registration: any, pets: PetRegistrationRow[]) {
  const csv = '﻿' + buildCardCsv(registration, pets)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const a = document.createElement('a')
  a.href = url
  a.download = `inochi-karte_${(registration.name || 'card').toString().replace(/[\\/:*?"<>|\s]/g, '')}_${ymd}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

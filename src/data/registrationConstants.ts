export const PREFECTURES = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
] as const

export const ALLERGY_TAGS = [
  'なし',
  '卵',
  '牛乳',
  '小麦',
  'そば',
  '落花生',
  'エビ',
  'かに',
  'くるみ',
  'キウイ・バナナ',
  '薬剤',
  '金属（ニッケル等）',
] as const

export const CHRONIC_TAGS = [
  'なし',
  '高血圧',
  '糖尿病',
  '心疾患',
  '脳卒中既往',
  '喘息',
  'てんかん',
  '腎臓病',
  '認知症',
  '精神疾患',
] as const

export const EMERGENCY_RELATIONSHIP_KEYS = [
  'spouse_partner',
  'child',
  'parent',
  'sibling',
  'grandchild',
  'relative',
  'friend',
  'facility_staff',
] as const

export type EmergencyRelationshipPresetKey = (typeof EMERGENCY_RELATIONSHIP_KEYS)[number]

export const EMERGENCY_RELATIONSHIP_OTHER_KEY = 'other' as const

/** DB・カード表示用の日本語ラベル（言語設定に依存しない） */
export const EMERGENCY_RELATIONSHIP_JA_VALUES: Record<EmergencyRelationshipPresetKey, string> = {
  spouse_partner: '配偶者・パートナー',
  child: '子',
  parent: '親',
  sibling: '兄弟姉妹',
  grandchild: '孫',
  relative: '親戚',
  friend: '友人',
  facility_staff: '施設職員・ケアマネージャー',
}

export const FACILITY_TYPES = [
  '病院・診療所',
  '介護老人保健施設',
  '特別養護老人ホーム',
  'デイサービス・通所介護',
  'グループホーム',
  '学校・保育・こども園',
  'その他',
] as const

export const STEP_LABELS = [
  '基本情報',
  '地域・施設',
  'アレルギー・持病',
  '投薬',
  '編集用パスワード',
  '完了',
] as const

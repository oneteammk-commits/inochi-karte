import { useEffect, useState } from 'react'

export function HomePage() {
  const [myCardId, setMyCardId] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('myCardId')
    setMyCardId(id)
  }, [])

  const viewUrl = myCardId ? "/card/" + myCardId : "#"
  const editUrl = myCardId ? "/edit/" + myCardId : "#"

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="max-w-lg mx-auto">
        <header className="mb-8 text-center mt-12">
          <div className="text-6xl mb-4">🐕</div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">命のカルテ</h1>
          <p className="mt-3 text-sm text-stone-600 leading-relaxed">
            あなたの命を守る大切な情報を、<br />
            必要な時に医療従事者へ伝えるアプリです。
          </p>
        </header>

        <div className="space-y-4 mt-12">
          
            href="/register"
            className="block w-full bg-red-700 hover:bg-red-800 text-white text-center py-4 rounded-2xl font-bold shadow-md"
          >
            📝 新規登録する
          </a>

          {myCardId ? (
            <>
              
                href={viewUrl}
                className="block w-full bg-white border-2 border-stone-300 hover:bg-stone-50 text-stone-800 text-center py-4 rounded-2xl font-bold shadow-sm"
              >
                📋 自分のカルテを見る
              </a>
              
                href={editUrl}
                className="block w-full bg-white border-2 border-stone-300 hover:bg-stone-50 text-stone-800 text-center py-4 rounded-2xl font-bold shadow-sm"
              >
                ✏️ 内容を変更する
              </a>
            </>
          ) : (
            <div className="text-center text-sm text-stone-500 mt-6">
              <p>まだ登録されていません。</p>
              <p>上のボタンから新規登録してください。</p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center text-xs text-stone-400">
          <p>緊急時には登録情報をQRコードで医療従事者に共有できます</p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { verifyPassword } from '../lib/passwordHash'

export function EditPage({ id }: { id: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storedHash, setStoredHash] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [inputPassword, setInputPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('name, edit_password_hash')
        .eq('id', id)
        .single()
      if (error || !data) {
        setError('データが見つかりませんでした')
      } else {
        setStoredHash(data.edit_password_hash)
        setName(data.name)
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    if (!/^\d{4}$/.test(inputPassword)) {
      setAuthError('編集用パスワードは数字4桁です。')
      return
    }
    if (!storedHash) {
      setAuthError('このカルテにはパスワードが設定されていません。')
      return
    }
    setIsChecking(true)
    try {
      const ok = await verifyPassword(inputPassword, storedHash)
      if (ok) {
        setIsAuthenticated(true)
      } else {
        setAuthError('パスワードが正しくありません。')
      }
    } catch {
      setAuthError('照合中にエラーが発生しました。')
    } finally {
      setIsChecking(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (isAuthenticated) {
    const backUrl = "/card/" + id
    return (
      <div className="min-h-screen bg-stone-100 p-4">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6 mt-8">
          <h1 className="text-2xl font-bold text-green-700 mb-4">認証成功</h1>
          <p className="mb-4 text-stone-700">{name} さんのカルテを編集できます。</p>
          <p className="text-sm text-stone-500">編集フォームは次の段階で作ります</p>
          <a href={backUrl} className="mt-6 block w-full bg-stone-700 hover:bg-stone-800 text-white text-center py-3 rounded-xl font-semibold">カルテ表示に戻る</a>
        </div>
      </div>
    )
  }

  const cancelUrl = "/card/" + id

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="max-w-lg mx-auto">
        <header className="mb-8 text-center mt-6">
          <p className="text-sm font-medium text-red-700">登録内容の変更</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">命のカルテ</h1>
        </header>

        <form onSubmit={handleVerify} className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4">編集用パスワードを入力してください</h2>

          <p className="text-sm text-stone-600 mb-4">
            <span className="font-semibold">{name}</span> さんのカルテです。
          </p>

          {authError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{authError}</div>
          )}

          <label className="block mb-6">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">編集用パスワード(数字4桁)</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-2xl tracking-widest text-stone-900 focus:border-red-700 focus:outline-none"
              placeholder="----"
            />
          </label>

          <div className="flex gap-3">
            <a href={cancelUrl} className="flex-1 text-center rounded-xl border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">キャンセル</a>
            <button
              type="submit"
              disabled={isChecking}
              className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {isChecking ? '確認中...' : '認証する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

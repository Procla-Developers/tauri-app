import { useState, useEffect } from 'react'
import MainPage from './pages/MainPage'
import { initApiKey, saveApiKey } from './lib/store'
import { api } from './lib/api'

function App() {
  const [ready, setReady] = useState(false)
  const [needsKey, setNeedsKey] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [authTarget, setAuthTarget] = useState<'settings' | 'manage_book' | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    initApiKey().then(async (hasKey) => {
      if (hasKey) {
        const key = await api.getApiKey()
        if (key) {
          setReady(true)
        } else {
          setNeedsKey(true)
        }
      } else {
        setNeedsKey(true)
      }
    })
  }, [])

  const handleSave = async () => {
    if (!keyInput.trim()) {
      setError('APIキーを入力してください')
      return
    }
    await saveApiKey(keyInput.trim())
    setReady(true)
    setNeedsKey(false)
    setNeedsAuth(false)
  }

  const handleAuthRequest = (target: 'settings' | 'manage_book') => {
    setAuthTarget(target)
    setNeedsAuth(true)
    setPasswordInput('')
    setError('')
  }

  const handleAuthSubmit = async () => {
    if (!passwordInput) { setError('パスワードを入力してください'); return }
    setLoading(true)
    setError('')
    const valid = await api.verifyAdminPassword(passwordInput)
    setLoading(false)
    if (valid) {
      setNeedsAuth(false)
      if (authTarget === 'settings') {
        setNeedsKey(true)
        setReady(false)
      } else if (authTarget === 'manage_book') {
        setReady(true)
        // MainPage will handle manage_book with password already verified
      }
    } else {
      setError('パスワードが正しくありません')
    }
  }

  // パスワード認証画面（設定・本管理共通）
  if (needsAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-[rgb(236,236,236)]">
        <div className="w-96 bg-white rounded-2xl shadow-lg p-8 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">管理パスワードを入力</h2>
          <p className="text-sm text-gray-500">この操作には管理パスワードが必要です</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()}
            placeholder="管理パスワード"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleAuthSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '確認中...' : '確認'}
            </button>
            <button
              onClick={() => { setNeedsAuth(false); setAuthTarget(null) }}
              className="px-4 py-3 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  // APIキー設定画面
  if (needsKey) {
    const isInitial = !ready && !authTarget
    return (
      <div className="h-screen flex items-center justify-center bg-[rgb(236,236,236)]">
        <div className="w-96 bg-white rounded-2xl shadow-lg p-8 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">APIキー設定</h2>
          <p className="text-sm text-gray-500">この端末のAPIキーを入力してください</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="APIキー"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
            >
              保存
            </button>
            {!isInitial && (
              <button
                onClick={() => { setNeedsKey(false); setReady(true); setAuthTarget(null); setError('') }}
                className="px-4 py-3 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!ready) return null

  return (
    <MainPage
      onOpenSettings={() => handleAuthRequest('settings')}
      onOpenManageBook={() => handleAuthRequest('manage_book')}
      adminPassword={authTarget === 'manage_book' ? passwordInput : undefined}
    />
  )
}

export default App

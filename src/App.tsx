import { useState, useEffect } from 'react'
import MainPage from './pages/MainPage'
import { initApiKey, saveApiKey } from './lib/store'

function App() {
  const [ready, setReady] = useState(false)
  const [needsKey, setNeedsKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    initApiKey().then((hasKey) => {
      if (hasKey) {
        setReady(true)
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
  }

  if (needsKey) {
    return (
      <div className="h-screen flex items-center justify-center bg-[rgb(236,236,236)]">
        <div className="w-96 bg-white rounded-2xl shadow-lg p-8 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">初期設定</h2>
          <p className="text-sm text-gray-500">この端末のAPIキーを入力してください</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="APIキー"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleSave}
            className="w-full py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    )
  }

  if (!ready) return null

  return <MainPage />
}

export default App

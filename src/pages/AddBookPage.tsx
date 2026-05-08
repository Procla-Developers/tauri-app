import { useState, useEffect } from 'react'
import { api, type Genre } from '../lib/api'

interface Props {
  onBack: () => void
}

export default function AddBookPage({ onBack }: Props) {
  const [barcode, setBarcode] = useState('')
  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState('')
  const [genreId, setGenreId] = useState<number>(0)
  const [total, setTotal] = useState(1)
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null)

  useEffect(() => {
    api.getGenres().then(setGenres).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode || !title || !authors || !genreId) {
      setResult({ error: '必須項目を入力してください' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const book = await api.addBook(
        barcode,
        title,
        authors.split(',').map(a => a.trim()).filter(Boolean),
        genreId,
        total,
        thumbnailPath || undefined,
      )
      setResult({ success: `「${book.title}」を登録しました` })
      setBarcode('')
      setTitle('')
      setAuthors('')
      setTotal(1)
      setThumbnailPath('')
    } catch (e) {
      setResult({ error: String(e) })
    }
    setLoading(false)
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[rgb(236,236,236)]">
      <form onSubmit={handleSubmit} className="w-96 bg-white rounded-2xl shadow-lg p-8 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 mb-2">本を追加</h2>

        <div>
          <label className="text-xs text-gray-500">バーコード (ISBN) *</label>
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">タイトル *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">著者 (カンマ区切り) *</label>
          <input
            type="text"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">ジャンル *</label>
          <select
            value={genreId}
            onChange={(e) => setGenreId(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
          >
            <option value={0}>選択してください</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500">冊数</label>
          <input
            type="number"
            min={1}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">表紙画像パス</label>
          <input
            type="text"
            value={thumbnailPath}
            onChange={(e) => setThumbnailPath(e.target.value)}
            placeholder="/path/to/image.jpg"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500"
          />
        </div>

        {result && (
          <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-600'}`}>
            {result.success || result.error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '登録中...' : '登録'}
        </button>
      </form>

      <button onClick={onBack} className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-colors">
        ← ホームに戻る
      </button>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type Book, type Genre } from '../lib/api'
import { open } from '@tauri-apps/plugin-dialog'
import { convertFileSrc } from '@tauri-apps/api/core'
import CameraCapture from '../components/CameraCapture'

interface Props {
  onBack: () => void
  adminPassword: string
}

type Step = 'scan' | 'detail' | 'edit' | 'confirm' | 'result'

export default function ManageBookPage({ onBack, adminPassword }: Props) {
  const [step, setStep] = useState<Step>('scan')
  const [book, setBook] = useState<Book | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState('')
  const [genreId, setGenreId] = useState(0)
  const [total, setTotal] = useState(1)
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getGenres().then(setGenres).catch(() => {})
  }, [])

  const isManualInput = useCallback(() => {
    const active = document.activeElement
    if (!active || active === inputRef.current) return false
    return active.tagName === 'INPUT' || active.tagName === 'SELECT'
  }, [])

  const focusInput = useCallback(() => {
    setTimeout(() => {
      if (isManualInput()) return
      inputRef.current?.focus()
    }, 50)
  }, [isManualInput])

  useEffect(() => {
    if (step === 'scan') focusInput()
  }, [step, focusInput])

  const handleScan = async (value: string) => {
    const v = value.trim()
    if (!v) return
    setBarcode(v)
    setLoading(true)
    const found = await api.findBookByBarcode(v)
    if (found) {
      setBook(found)
      setTitle(found.title)
      setAuthors(found.authors.join(', '))
      setGenreId(found.genre.id)
      setTotal(found.stock.total)
      setIsNew(false)
      setStep('detail')
    } else {
      const info = await api.fetchBookInfoByIsbn(v)
      setTitle(info?.title ?? '')
      setAuthors(info?.authors.join(', ') ?? '')
      setGenreId(0)
      setTotal(1)
      setIsNew(true)
      setStep('edit')
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(inputRef.current?.value ?? '')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleManualScan = () => {
    const el = document.getElementById('manual-barcode') as HTMLInputElement
    if (el?.value) { handleScan(el.value); el.value = '' }
  }

  const handleSave = async () => {
    setLoading(true)
    setResult(null)
    try {
      if (book && !isNew) {
        await api.updateBook(book.id, adminPassword, { barcode, title, authors: authors.split(',').map(a => a.trim()).filter(Boolean), genreId, total, thumbnailPath: thumbnailPath || undefined })
        setResult({ success: `「${title}」を更新しました` })
      } else {
        if (!barcode || !title || !authors || !genreId || !thumbnailPath) { setResult({ error: '必須項目を入力してください（画像含む）' }); setLoading(false); return }
        await api.addBook(barcode, title, authors.split(',').map(a => a.trim()).filter(Boolean), genreId, total, adminPassword, thumbnailPath)
        setResult({ success: `「${title}」を登録しました` })
      }
      setStep('result')
    } catch (e) {
      setResult({ error: String(e) })
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!book) return
    setLoading(true)
    setResult(null)
    try {
      await api.deleteBook(book.id, adminPassword)
      setResult({ success: `「${book.title}」を削除しました` })
      setStep('result')
    } catch (e) {
      setResult({ error: String(e) })
    }
    setLoading(false)
  }

  const reset = () => {
    setStep('scan')
    setBook(null)
    setBarcode('')
    setThumbnailPath('')
    setResult(null)
    setIsNew(false)
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[rgb(236,236,236)]">
      {/* スキャン画面 */}
      {step === 'scan' && !loading && (
        <>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">本のバーコードをスキャンしてください</h1>
          <p className="text-sm text-gray-500 mb-8">登録済みの本は編集、未登録の本は新規登録できます</p>
          <form onSubmit={(e) => { e.preventDefault(); handleManualScan() }} className="flex gap-2 w-72">
            <input
              type="text"
              placeholder="バーコード手動入力"
              className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 bg-white"
              id="manual-barcode"
            />
            <button type="submit" className="px-4 py-3 bg-gray-800 text-white text-sm rounded-lg font-bold hover:bg-gray-700">OK</button>
          </form>
        </>
      )}

      {/* 詳細表示（登録済み） */}
      {step === 'detail' && book && !loading && (
        <div className="w-[480px] bg-white rounded-2xl shadow-lg p-8">
          <div className="flex gap-6">
            <div className="w-32 shrink-0">
              {book.thumbnailLink ? (
                <img src={book.thumbnailLink} alt={book.title} className="w-full rounded shadow-sm" />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-400">No Image</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <h2 className="text-xl font-bold text-gray-800">{book.title}</h2>
              <p className="text-sm text-gray-600">{book.authors.join(', ')}</p>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{book.genre.name}</span>
                <span>在庫: {book.stock.total}冊</span>
                <span>貸出中: {book.stock.loanedCount}冊</span>
              </div>
              <p className="text-xs text-gray-400">ISBN: {book.barcode}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('edit')} className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">
              編集
            </button>
            <button onClick={reset} className="px-6 py-3 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
              戻る
            </button>
          </div>
        </div>
      )}

      {/* 編集/新規登録フォーム */}
      {step === 'edit' && !loading && (
        <div className="w-[480px] bg-white rounded-2xl shadow-lg p-8">
          <div className="flex gap-6">
            {/* サムネプレビュー */}
            <div className="w-32 shrink-0">
              {thumbnailPath ? (
                <img src={convertFileSrc(thumbnailPath)} alt="preview" className="w-full rounded shadow-sm" />
              ) : book?.thumbnailLink ? (
                <img src={book.thumbnailLink} alt={title} className="w-full rounded shadow-sm" />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-400">No Image</span>
                </div>
              )}
              <button
                type="button"
                onClick={async () => {
                  const file = await open({ filters: [{ name: '画像', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] })
                  if (file) setThumbnailPath(file)
                }}
                className="w-full mt-2 px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                ファイル選択
              </button>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="w-full mt-1 px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                カメラで撮影
              </button>
            </div>

            {/* フォーム */}
            <div className="flex-1 space-y-3">
              <h3 className="text-sm font-bold text-gray-800 mb-1">{isNew ? '新規登録' : '編集'}</h3>
              <div>
                <label className="text-xs text-gray-500">タイトル *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">著者 (カンマ区切り) *</label>
                <input type="text" value={authors} onChange={(e) => setAuthors(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">ジャンル *</label>
                  <select value={genreId} onChange={(e) => setGenreId(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500">
                    <option value={0}>選択</option>
                    {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="w-20">
                  <label className="text-xs text-gray-500">冊数</label>
                  <input type="number" min={1} value={total} onChange={(e) => setTotal(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('confirm')} className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">
              確定
            </button>
            {!isNew && (
              <button onClick={handleDelete} disabled={loading} className="px-4 py-3 text-red-600 font-bold border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
                削除
              </button>
            )}
            <button onClick={() => book ? setStep('detail') : reset()} className="px-4 py-3 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
              戻る
            </button>
          </div>
        </div>
      )}

      {/* 確認画面 */}
      {step === 'confirm' && !loading && (
        <div className="w-[480px] bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">内容を確認</h3>
          <div className="flex gap-6">
            <div className="w-32 shrink-0">
              {thumbnailPath ? (
                <img src={convertFileSrc(thumbnailPath)} alt="preview" className="w-full rounded shadow-sm" />
              ) : book?.thumbnailLink ? (
                <img src={book.thumbnailLink} alt={title} className="w-full rounded shadow-sm" />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-400">No Image</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <p><span className="text-gray-500">タイトル:</span> {title}</p>
              <p><span className="text-gray-500">著者:</span> {authors}</p>
              <p><span className="text-gray-500">ジャンル:</span> {genres.find(g => g.id === genreId)?.name ?? '未設定'}</p>
              <p><span className="text-gray-500">冊数:</span> {total}</p>
              <p><span className="text-gray-500">ISBN:</span> {barcode}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSave} disabled={loading} className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {isNew ? '登録する' : '更新する'}
            </button>
            <button onClick={() => setStep('edit')} className="px-4 py-3 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
              戻る
            </button>
          </div>
          {result?.error && <p className="text-sm text-red-600 mt-3">{result.error}</p>}
        </div>
      )}

      {loading && (
        <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-gray-600 rounded-full" />
      )}

      {step === 'result' && result && (
        <>
          <h1 className={`text-3xl font-bold mb-4 ${result.success ? 'text-gray-800' : 'text-red-600'}`}>
            {result.success ? '完了' : 'エラー'}
          </h1>
          <p className="text-sm text-gray-700 mb-6">{result.success || result.error}</p>
          <button onClick={reset} className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            続ける
          </button>
        </>
      )}

      <button onClick={onBack} className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-colors">
        ← ホームに戻る
      </button>

      <input ref={inputRef} onKeyDown={handleKeyDown} onBlur={focusInput} className="opacity-0 absolute -z-10" autoFocus />

      {showCamera && (
        <CameraCapture
          onCapture={(path) => { setThumbnailPath(path); setShowCamera(false) }}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

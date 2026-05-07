import { useState, useRef, useEffect, useCallback } from 'react'
import { api, type Book, type Genre, type Loan, type UserInfo } from '../lib/api'

type Step = 'scan_user' | 'choose_action' | 'scan_book' | 'result'

export default function MainPage() {
  const [step, setStep] = useState<Step>('scan_user')
  const [qrId, setQrId] = useState('')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [mode, setMode] = useState<'borrow' | 'return'>('borrow')
  const [result, setResult] = useState<{ loan?: Loan; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const [books, setBooks] = useState<Book[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [selectedGenre, setSelectedGenre] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [booksLoading, setBooksLoading] = useState(true)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    Promise.all([api.getBooks(), api.getGenres()])
      .then(([b, g]) => { setBooks(b); setGenres(g) })
      .catch(() => {})
      .finally(() => setBooksLoading(false))
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
    if (step === 'scan_user' || step === 'scan_book') focusInput()
  }, [step, focusInput])

  useEffect(() => {
    if (step === 'result' && result?.loan) {
      timerRef.current = setTimeout(reset, 5000)
      return () => clearTimeout(timerRef.current)
    }
  }, [step, result])

  const reset = () => {
    setStep('scan_user')
    setQrId('')
    setUser(null)
    setResult(null)
    setLoading(false)
  }

  const handleScan = async (value: string) => {
    const v = value.trim()
    if (!v) return

    // 結果画面中にスキャンが来たら新規フロー開始
    if (step === 'result') {
      clearTimeout(timerRef.current)
      setResult(null)
      setLoading(true)
      try {
        const userInfo = await api.verifyUser(v)
        setQrId(v)
        setUser(userInfo)
        setStep('choose_action')
      } catch (e) {
        setResult({ error: String(e) })
        setStep('result')
      }
      setLoading(false)
      return
    }

    if (step === 'scan_user') {
      setLoading(true)
      try {
        const userInfo = await api.verifyUser(v)
        setQrId(v)
        setUser(userInfo)
        setStep('choose_action')
      } catch (e) {
        setResult({ error: String(e) })
        setStep('result')
      }
      setLoading(false)
    } else if (step === 'scan_book') {
      setLoading(true)
      try {
        const loan = mode === 'borrow'
          ? await api.borrowBook(qrId, v, 14)
          : await api.returnBook(qrId, v)
        setResult({ loan })
        api.getBooks().then(setBooks).catch(() => {})
      } catch (e) {
        setResult({ error: String(e) })
      }
      setLoading(false)
      setStep('result')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(inputRef.current?.value ?? '')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const chooseMode = (m: 'borrow' | 'return') => {
    setMode(m)
    setStep('scan_book')
  }

  const handleManual = (type: 'user' | 'book') => {
    const el = document.getElementById(type === 'user' ? 'manual-user' : 'manual-book') as HTMLInputElement
    if (el?.value) {
      handleScan(el.value)
      el.value = ''
    }
  }

  const continueScan = () => {
    setResult(null)
    setStep('scan_book')
  }

  const filtered = books.filter((b) => {
    if (selectedGenre && b.genre.id !== selectedGenre) return false
    if (search) {
      const q = search.toLowerCase()
      if (!b.title.toLowerCase().includes(q) && !b.authors.some(a => a.toLowerCase().includes(q))) return false
    }
    return true
  })

  return (
    <div className="h-screen flex overflow-hidden">
        {/* 左: 操作パネル */}
        <div className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col items-center justify-center p-8">
          {step === 'scan_user' && !loading && (
            <div className="text-center space-y-4 w-full">
              <h2 className="text-lg font-bold text-gray-800">IDカードをスキャン</h2>
              <p className="text-xs text-gray-500">バーコードリーダーにカードをかざしてください</p>
              <form onSubmit={(e) => { e.preventDefault(); handleManual('user') }} className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="QID手動入力"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                  id="manual-user"
                />
                <button type="submit" className="px-3 py-2 bg-green text-white text-sm rounded-md font-bold">OK</button>
              </form>
            </div>
          )}

          {step === 'choose_action' && user && (
            <div className="text-center space-y-6 w-full">
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <p className="text-xs text-gray-500">ユーザー</p>
                <p className="text-lg font-bold text-gray-800">{user.id}</p>
              </div>
              <p className="text-sm text-gray-600">操作を選択してください</p>
              <div className="space-y-3">
                <button
                  onClick={() => chooseMode('borrow')}
                  className="w-full py-3 rounded-lg font-bold text-white bg-green hover:bg-green-hover transition-colors"
                >
                  本を借りる
                </button>
                <button
                  onClick={() => chooseMode('return')}
                  className="w-full py-3 rounded-lg font-bold text-white bg-blue hover:opacity-90 transition-colors"
                >
                  本を返す
                </button>
              </div>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
                キャンセル
              </button>
            </div>
          )}

          {step === 'scan_book' && !loading && (
            <div className="text-center space-y-4 w-full">
              <h2 className="text-lg font-bold text-gray-800">本のバーコードをスキャン</h2>
              <p className="text-xs text-gray-500">
                {mode === 'borrow' ? '借りたい' : '返したい'}本のバーコードをかざしてください
              </p>
              <div className="text-xs text-green-600 bg-green-50 rounded-md px-3 py-2">
                {user?.id}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleManual('book') }} className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="バーコード手動入力"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                  id="manual-book"
                />
                <button type="submit" className="px-3 py-2 bg-green text-white text-sm rounded-md font-bold">OK</button>
              </form>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
                キャンセル
              </button>
            </div>
          )}

          {loading && (
            <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-600 rounded-full" />
          )}

          {step === 'result' && result && (
            <div className="text-center space-y-4 w-full">
              {result.loan ? (
                <>
                  <h2 className="text-lg font-bold text-gray-800">
                    {mode === 'borrow' ? '貸出完了' : '返却完了'}
                  </h2>
                  <div className="text-left space-y-1 bg-gray-50 rounded-lg p-3 text-sm">
                    <p><span className="text-gray-500">本:</span> {result.loan.book.title}</p>
                    <p><span className="text-gray-500">ID:</span> {result.loan.userId}</p>
                    {result.loan.dueAt && (
                      <p><span className="text-gray-500">期限:</span> {new Date(result.loan.dueAt).toLocaleDateString('ja-JP')}</p>
                    )}
                  </div>
                  <button onClick={continueScan} className="w-full py-2 text-sm text-green-700 border border-green-300 rounded-md hover:bg-green-50">
                    続けてスキャン
                  </button>
                  <p className="text-xs text-gray-400">5秒後にリセット</p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-red-600">エラー</h2>
                  <p className="text-sm text-gray-700">{result.error}</p>
                  <button onClick={reset} className="mt-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                    戻る
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 右: 図書一覧 */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[rgb(236,236,236)]">
          <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="タイトル・著者で検索"
              className="px-3 py-1.5 rounded-full text-xs bg-gray-50 text-gray-700 border border-gray-200 focus:outline-none focus:border-gray-400 flex-1"
            />
            <select
              value={selectedGenre ?? ''}
              onChange={(e) => setSelectedGenre(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 rounded-full text-xs bg-gray-50 text-gray-700 border border-gray-200 focus:outline-none"
            >
              <option value="">すべて</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {booksLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-gray-600 rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-12">本が見つかりません</p>
            ) : (
              <div className="flex flex-wrap gap-3 justify-center">
                {filtered.map((book) => (
                  <BookCover key={book.id} book={book} />
                ))}
              </div>
            )}
          </div>
        </div>
      {/* 隠しinput */}
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        onBlur={focusInput}
        className="opacity-0 absolute -z-10"
        autoFocus
      />
    </div>
  )
}

function BookCover({ book }: { book: Book }) {
  const available = book.stock.total - book.stock.loanedCount

  return (
    <div className="flex flex-col items-center">
      <div className="w-28 bg-gray-100 shadow-sm relative">
        {book.thumbnailLink ? (
          <img
            src={book.thumbnailLink}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className={`w-full h-auto ${available <= 0 ? 'grayscale opacity-50' : ''}`}
          />
        ) : (
          <div className="w-full aspect-[2/3] flex items-center justify-center">
            <span className="text-xs text-gray-400">No Image</span>
          </div>
        )}
        {available <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">貸出中</span>
          </div>
        )}
      </div>
      <div className="w-28 mt-1 text-center">
        <p className="text-[11px] font-medium text-gray-800 leading-tight line-clamp-2">{book.title}</p>
        <p className={`text-[10px] mt-0.5 font-medium ${available > 0 ? 'text-green-600' : 'text-red-500'}`}>
          {available > 0 ? `残り${available}冊` : '貸出中'}
        </p>
      </div>
    </div>
  )
}

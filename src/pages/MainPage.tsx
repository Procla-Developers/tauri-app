import { useState, useRef, useEffect, useCallback } from 'react'
import { api, type Loan, type UserInfo } from '../lib/api'
import AddBookPage from './AddBookPage'

type Page = 'home' | 'borrow' | 'return' | 'books' | 'add_book'
type Step = 'scan_user' | 'scan_book' | 'result'

export default function MainPage() {
  const [page, setPage] = useState<Page>('home')
  const [step, setStep] = useState<Step>('scan_user')
  const [qrId, setQrId] = useState('')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [result, setResult] = useState<{ loan?: Loan; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

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
    if ((page === 'borrow' || page === 'return') && (step === 'scan_user' || step === 'scan_book')) focusInput()
  }, [page, step, focusInput])

  useEffect(() => {
    if (step === 'result' && result?.loan) {
      timerRef.current = setTimeout(resetFlow, 5000)
      return () => clearTimeout(timerRef.current)
    }
  }, [step, result])

  const resetFlow = () => {
    setStep('scan_user')
    setQrId('')
    setUser(null)
    setResult(null)
    setLoading(false)
  }

  const goHome = () => {
    resetFlow()
    setPage('home')
  }

  const handleScan = async (value: string) => {
    const v = value.trim()
    if (!v) return

    if (step === 'result') {
      clearTimeout(timerRef.current)
      setResult(null)
      setStep('scan_book')
      setLoading(true)
      try {
        const loan = page === 'borrow'
          ? await api.borrowBook(qrId, v, 14)
          : await api.returnBook(qrId, v)
        setResult({ loan })
      } catch (e) {
        setResult({ error: String(e) })
      }
      setLoading(false)
      setStep('result')
      return
    }

    if (step === 'scan_user') {
      setLoading(true)
      try {
        const userInfo = await api.verifyUser(v)
        setQrId(v)
        setUser(userInfo)
        setStep('scan_book')
      } catch (e) {
        setResult({ error: String(e) })
        setStep('result')
      }
      setLoading(false)
    } else if (step === 'scan_book') {
      setLoading(true)
      try {
        const loan = page === 'borrow'
          ? await api.borrowBook(qrId, v, 14)
          : await api.returnBook(qrId, v)
        setResult({ loan })
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

  const handleManual = (type: 'user' | 'book') => {
    const el = document.getElementById(type === 'user' ? 'manual-user' : 'manual-book') as HTMLInputElement
    if (el?.value) {
      handleScan(el.value)
      el.value = ''
    }
  }

  // ホーム画面
  if (page === 'home') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[rgb(236,236,236)]">
        <div className="flex gap-6">
          <button
            onClick={() => setPage('borrow')}
            className="w-52 h-52 bg-green hover:bg-green-hover text-white rounded-2xl flex flex-col items-center justify-center gap-3 shadow-lg transition-colors"
          >
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-xl font-bold">借りる</span>
          </button>
          <button
            onClick={() => setPage('return')}
            className="w-52 h-52 bg-blue hover:bg-green-blue text-white rounded-2xl flex flex-col items-center justify-center gap-3 shadow-lg transition-colors"
          >
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4m0 0l4-4m-4 4h11a4 4 0 010 8h-1" /></svg>
            <span className="text-xl font-bold">返す</span>
          </button>
          <button
            onClick={() => setPage('books')}
            className="w-52 h-52 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-lg border border-gray-300 transition-colors"
          >
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span className="text-xl font-bold">本一覧</span>
          </button>
        </div>
        <button
          onClick={() => setPage('add_book')}
          className="fixed bottom-6 right-6 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          + 本を追加
        </button>
      </div>
    )
  }

  // 本を追加
  if (page === 'add_book') {
    return <AddBookPage onBack={goHome} />
  }

  // 本一覧画面 - Web版をそのまま表示
  if (page === 'books') {
    return (
      <div className="h-screen flex flex-col bg-[rgb(236,236,236)]">
        <iframe src="https://procla.dev/book?embed" className="flex-1 w-full border-none" />
        <button onClick={goHome} className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-colors">
          ← ホームに戻る
        </button>
      </div>
    )
  }

  // 貸出・返却フロー
  const modeLabel = page === 'borrow' ? '貸出' : '返却'

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[rgb(236,236,236)]">
      {step === 'scan_user' && !loading && (
        <>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">IDカードをスキャンしてください</h1>
          <p className="text-sm text-gray-500 mb-8">バーコードリーダーにカードをかざしてください</p>
          <form onSubmit={(e) => { e.preventDefault(); handleManual('user') }} className="flex gap-2 w-72">
            <input
              type="text"
              placeholder="QID手動入力"
              className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 bg-white"
              id="manual-user"
            />
            <button type="submit" className="px-4 py-3 bg-gray-800 text-white text-sm rounded-lg font-bold hover:bg-gray-700">OK</button>
          </form>
        </>
      )}

      {step === 'scan_book' && !loading && (
        <>
          <div className="text-sm text-gray-700 bg-white border border-gray-300 rounded-lg px-4 py-2 mb-6">
            {user?.id} としてログイン中
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            {page === 'borrow' ? '借りたい' : '返したい'}本をスキャンしてください
          </h1>
          <p className="text-sm text-gray-500 mb-8">本のバーコードをかざしてください</p>
          <form onSubmit={(e) => { e.preventDefault(); handleManual('book') }} className="flex gap-2 w-72">
            <input
              type="text"
              placeholder="バーコード手動入力"
              className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 bg-white"
              id="manual-book"
            />
            <button type="submit" className="px-4 py-3 bg-gray-800 text-white text-sm rounded-lg font-bold hover:bg-gray-700">OK</button>
          </form>
        </>
      )}

      {loading && (
        <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-gray-600 rounded-full" />
      )}

      {step === 'result' && result && (
        <>
          {result.loan ? (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-6">{modeLabel}完了</h1>
              <div className="bg-white rounded-xl border border-gray-300 px-6 py-4 space-y-2 mb-6 w-80">
                <p className="text-sm"><span className="text-gray-500">本:</span> {result.loan.book.title}</p>
                <p className="text-sm"><span className="text-gray-500">ID:</span> {result.loan.userId}</p>
                {result.loan.dueAt && (
                  <p className="text-sm"><span className="text-gray-500">返却期限:</span> {new Date(result.loan.dueAt).toLocaleDateString('ja-JP')}</p>
                )}
              </div>
              <button onClick={() => { setResult(null); setStep('scan_book') }} className="px-6 py-3 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                続けてスキャン
              </button>
              <p className="text-xs text-gray-400 mt-4">5秒後にリセット</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-red-600 mb-4">エラー</h1>
              <p className="text-sm text-gray-700 mb-6">{result.error}</p>
              <button onClick={resetFlow} className="px-6 py-3 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                戻る
              </button>
            </>
          )}
        </>
      )}

      <button onClick={goHome} className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-colors">
        ← ホームに戻る
      </button>

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

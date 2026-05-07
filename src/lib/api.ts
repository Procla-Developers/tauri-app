import { invoke } from '@tauri-apps/api/core'

export type Book = {
  id: number
  barcode: string
  title: string
  authors: string[]
  thumbnailLink: string
  genre: { id: number; name: string }
  stock: { total: number; loanedCount: number }
}

export type Genre = { id: number; name: string }

export type Loan = {
  id: number
  book: { id: number; title: string; barcode: string }
  userId: string
  borrowedAt: string
  dueAt: string | null
  returnedAt: string | null
}

export type UserInfo = { id: string }

export const api = {
  verifyUser: (qrId: string) => invoke<UserInfo>('verify_user', { qrId }),
  getBooks: (genreId?: number) => invoke<Book[]>('get_books', { genreId: genreId ?? null }),
  getGenres: () => invoke<Genre[]>('get_genres'),
  borrowBook: (qrId: string, barcode: string, loanPeriodDays?: number) =>
    invoke<Loan>('borrow_book', { qrId, barcode, loanPeriodDays: loanPeriodDays ?? null }),
  returnBook: (qrId: string, barcode: string) =>
    invoke<Loan>('return_book', { qrId, barcode }),
}

import { invoke } from '@tauri-apps/api/core'

export type Loan = {
  id: number
  book: { id: number; title: string; barcode: string }
  userId: string
  borrowedAt: string
  dueAt: string | null
  returnedAt: string | null
}

export type UserInfo = { id: string }
export type Genre = { id: number; name: string }
export type CreatedBook = { id: number; title: string; barcode: string }

export type Book = {
  id: number
  barcode: string
  title: string
  authors: string[]
  thumbnailLink: string
  genre: { id: number; name: string }
  stock: { total: number; loanedCount: number }
}

export type GoogleBookInfo = { title: string; authors: string[]; thumbnail: string | null }

export const api = {
  setApiKey: (key: string) => invoke('set_api_key', { key }),
  getApiKey: () => invoke<string>('get_api_key'),
  verifyAdminPassword: (adminPassword: string) => invoke<boolean>('verify_admin_password', { adminPassword }),
  verifyUser: (qrId: string) => invoke<UserInfo>('verify_user', { qrId }),
  borrowBook: (qrId: string, barcode: string, loanPeriodDays?: number) =>
    invoke<Loan>('borrow_book', { qrId, barcode, loanPeriodDays: loanPeriodDays ?? null }),
  returnBook: (qrId: string, barcode: string) =>
    invoke<Loan>('return_book', { qrId, barcode }),
  getGenres: () => invoke<Genre[]>('get_genres'),
  findBookByBarcode: (barcode: string) => invoke<Book | null>('find_book_by_barcode', { barcode }),
  fetchBookInfoByIsbn: (isbn: string) => invoke<GoogleBookInfo | null>('fetch_book_info_by_isbn', { isbn }),
  addBook: (barcode: string, title: string, authors: string[], genreId: number, total: number, adminPassword: string, thumbnailPath: string) =>
    invoke<CreatedBook>('add_book', { barcode, title, authors, genreId, total, adminPassword, thumbnailPath }),
  updateBook: (id: number, adminPassword: string, opts: { barcode?: string; title?: string; authors?: string[]; genreId?: number; total?: number; thumbnailPath?: string }) =>
    invoke<CreatedBook>('update_book', { id, adminPassword, ...opts, genreId: opts.genreId ?? null, total: opts.total ?? null, barcode: opts.barcode ?? null, title: opts.title ?? null, authors: opts.authors ?? null, thumbnailPath: opts.thumbnailPath ?? null }),
  deleteBook: (id: number, adminPassword: string) => invoke<void>('delete_book', { id, adminPassword }),
}

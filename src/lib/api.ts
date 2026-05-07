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

export const api = {
  verifyUser: (qrId: string) => invoke<UserInfo>('verify_user', { qrId }),
  borrowBook: (qrId: string, barcode: string, loanPeriodDays?: number) =>
    invoke<Loan>('borrow_book', { qrId, barcode, loanPeriodDays: loanPeriodDays ?? null }),
  returnBook: (qrId: string, barcode: string) =>
    invoke<Loan>('return_book', { qrId, barcode }),
}

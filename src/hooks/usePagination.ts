import { useState } from 'react'

export function usePagination(pageSize = 50) {
  const [page, setPage] = useState(0)
  const next = () => setPage(p => p + 1)
  const prev = () => setPage(p => Math.max(0, p - 1))
  const reset = () => setPage(0)
  return { page, pageSize, next, prev, reset, setPage }
}

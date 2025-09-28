import React, { useCallback, useEffect, useRef, useState } from 'react'
import { User, UserService } from '../services/userService'
import { UserFilters, Filters } from './UserFilters'
import { UserTable } from './UserTable'
import { UserActionsBar } from './UserActionsBar'
import { UserStats } from './UserStats'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import { downloadCsv } from '../utils/csv'

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ signups: {}, byIndustry: {}, byStatus: {} })
  const [selected, setSelected] = useState<string[]>([])
  const [selectionResetKey, setSelectionResetKey] = useState(0)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    industry: '',
    startDate: '',
    endDate: ''
  })

  const debouncedSearch = useDebounce(filters.search)
  const { page, pageSize, setPage } = usePagination(50)

  const requestIdRef = useRef(0)

  const loadUsers = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const res = await UserService.list({
      page,
      pageSize,
      search: debouncedSearch,
      status: filters.status,
      industry: filters.industry,
      startDate: filters.startDate,
      endDate: filters.endDate
    })

    if (requestId !== requestIdRef.current) {
      return
    }

    setUsers(res.users)
    setTotal(res.total)
    return res
  }, [
    page,
    pageSize,
    debouncedSearch,
    filters.status,
    filters.industry,
    filters.startDate,
    filters.endDate
  ])

  const loadStats = async () => {
    const data = await UserService.stats()
    setStats(data)
  }

  useEffect(() => {
    const refresh = async () => {
      const res = await loadUsers()
      if (res) {
        const maxPage = Math.max(0, Math.ceil(res.total / pageSize) - 1)
        if (page > maxPage) {
          setPage(maxPage)
        }
      }
    }

    refresh()
  }, [loadUsers, page, pageSize, setPage])

  useEffect(() => {
    loadStats()
  }, [])

  const handleAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    await UserService.bulk(selected, action)
    setSelected([])
    setSelectionResetKey(prev => prev + 1)
    const res = await loadUsers()
    if (res) {
      const maxPage = Math.max(0, Math.ceil(res.total / pageSize) - 1)
      if (page > maxPage) {
        setPage(maxPage)
      }
    }
    try {
      await loadStats()
    } catch (error) {
      console.error('Failed to refresh user stats', error)
    }
  }

  const handleExport = async () => {
    const blob = await UserService.export({
      search: filters.search,
      status: filters.status,
      industry: filters.industry,
      startDate: filters.startDate,
      endDate: filters.endDate
    })
    downloadCsv(blob, 'users.csv')
  }

  return (
    <div>
      <UserFilters filters={filters} onChange={f => { setFilters(prev => ({ ...prev, ...f })); setPage(0) }} />
      <UserActionsBar
        selected={selected}
        onActivate={() => handleAction('activate')}
        onDeactivate={() => handleAction('deactivate')}
        onDelete={() => handleAction('delete')}
        onExport={handleExport}
      />
      <UserTable
        data={users}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onSelect={setSelected}
        clearSelectionKey={selectionResetKey}
      />
      <UserStats stats={stats} />
    </div>
  )
}

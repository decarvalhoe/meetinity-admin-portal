import React, { useEffect, useState } from 'react'
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
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    industry: '',
    startDate: '',
    endDate: ''
  })

  const debouncedSearch = useDebounce(filters.search)
  const { page, pageSize, setPage } = usePagination(50)

  const loadUsers = async () => {
    const res = await UserService.list({
      page,
      pageSize,
      search: debouncedSearch,
      status: filters.status,
      industry: filters.industry,
      startDate: filters.startDate,
      endDate: filters.endDate
    })
    setUsers(res.users)
    setTotal(res.total)
  }

  const loadStats = async () => {
    const data = await UserService.stats()
    setStats(data)
  }

  useEffect(() => {
    loadUsers()
  }, [page, debouncedSearch, filters.status, filters.industry, filters.startDate, filters.endDate])

  useEffect(() => {
    loadStats()
  }, [])

  const handleAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    await UserService.bulk(selected, action)
    setSelected([])
    loadUsers()
  }

  const handleExport = async () => {
    const blob = await UserService.export({
      search: debouncedSearch,
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
      />
      <UserStats stats={stats} />
    </div>
  )
}

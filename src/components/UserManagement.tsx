import React, { useCallback, useEffect, useRef, useState } from 'react'
import { User, UserService } from '../services/userService'
import { UserFilters, Filters } from './UserFilters'
import { UserTable } from './UserTable'
import { UserActionsBar } from './UserActionsBar'
import { UserStats } from './UserStats'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import { exportExcel, type ExportColumn } from '../utils/export'
import { UserAnalyticsDashboard } from './users/UserAnalyticsDashboard'

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ signups: {}, byIndustry: {}, byStatus: {} })
  const [selected, setSelected] = useState<string[]>([])
  const [selectionResetKey, setSelectionResetKey] = useState(0)
  const [activeTab, setActiveTab] = useState<'summary' | 'analytics'>('summary')
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

  const userColumns: ExportColumn<User>[] = [
    { key: 'id', header: 'ID utilisateur' },
    { key: 'name', header: 'Nom' },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Statut' },
    { key: 'industry', header: 'Secteur', formatter: value => value ?? 'N/A' },
    {
      key: 'createdAt',
      header: 'Inscription',
      formatter: value => (value ? new Date(String(value)).toISOString() : 'Inconnue')
    }
  ]

  const handleExport = async () => {
    const exportPayload = await UserService.export({
      search: filters.search,
      status: filters.status,
      industry: filters.industry,
      startDate: filters.startDate,
      endDate: filters.endDate
    })

    const { users: exportUsers, stats: exportStats, metadata } = exportPayload
    const exportedAt = new Date()
    const exportedAtIso = exportedAt.toISOString()
    const fileDate = exportedAtIso.slice(0, 10)

    const signupsSheet = Object.entries(exportStats.signups || {}).map(([period, total]) => ({
      period,
      total
    }))
    const statusSheet = Object.entries(exportStats.byStatus || {}).map(([status, total]) => ({
      status,
      total
    }))
    const industrySheet = Object.entries(exportStats.byIndustry || {}).map(([industry, total]) => ({
      industry,
      total
    }))

    const filtersMetadata = {
      search: filters.search || undefined,
      status: filters.status || undefined,
      industry: filters.industry || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined
    }

    const sheets = [
      {
        name: 'Utilisateurs',
        data: exportUsers,
        columns: userColumns
      },
      signupsSheet.length
        ? {
            name: 'Inscriptions',
            data: signupsSheet,
            columns: [
              { key: 'period', header: 'Période' },
              { key: 'total', header: 'Total' }
            ]
          }
        : null,
      statusSheet.length
        ? {
            name: 'Par statut',
            data: statusSheet,
            columns: [
              { key: 'status', header: 'Statut' },
              { key: 'total', header: 'Total' }
            ]
          }
        : null,
      industrySheet.length
        ? {
            name: 'Par secteur',
            data: industrySheet,
            columns: [
              { key: 'industry', header: 'Secteur' },
              { key: 'total', header: 'Total' }
            ]
          }
        : null
    ].filter(Boolean) as {
      name: string
      data: Record<string, unknown>[]
      columns: ExportColumn<Record<string, unknown>>[]
    }[]

    await exportExcel({
      filename: `users-export-${fileDate}`,
      sheets,
      metadata: {
        ...metadata,
        filters: filtersMetadata,
        totalUsers: exportUsers.length,
        exportedAt: exportedAtIso
      }
    })
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
      <div className="user-management-tabs">
        <button
          type="button"
          className={activeTab === 'summary' ? 'active' : ''}
          onClick={() => setActiveTab('summary')}
          data-testid="user-tab-summary"
        >
          Statistiques globales
        </button>
        <button
          type="button"
          className={activeTab === 'analytics' ? 'active' : ''}
          onClick={() => setActiveTab('analytics')}
          data-testid="user-tab-analytics"
        >
          Analyse approfondie
        </button>
      </div>
      {activeTab === 'summary' ? <UserStats stats={stats} /> : <UserAnalyticsDashboard />}
    </div>
  )
}

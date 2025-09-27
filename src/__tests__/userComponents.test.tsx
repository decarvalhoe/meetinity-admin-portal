import { it, expect, vi, afterEach } from 'vitest'

vi.mock('../services/userService', () => ({
  UserService: {
    list: vi.fn().mockResolvedValue({ users: [], total: 0 }),
    stats: vi.fn().mockResolvedValue({ signups: {}, byIndustry: {}, byStatus: {} }),
    export: vi.fn().mockResolvedValue(new Blob()),
    bulk: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../utils/csv', () => ({
  downloadCsv: vi.fn()
}))

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { UserFilters, Filters } from '../components/UserFilters'
import { UserActionsBar } from '../components/UserActionsBar'
import { UserTable } from '../components/UserTable'
import { UserManagement } from '../components/UserManagement'
import type { User } from '../services/userService'
import { UserService } from '../services/userService'

afterEach(() => {
  vi.clearAllMocks()
})

it('updates search filter', () => {
  const filters: Filters = { search: '', status: '', industry: '', startDate: '', endDate: '' }
  const handle = vi.fn()
  render(<UserFilters filters={filters} onChange={handle} />)
  fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'john' } })
  expect(handle).toHaveBeenCalledWith({ search: 'john' })
})

it('disables actions when no selection', () => {
  const activate = vi.fn()
  render(
    <UserActionsBar selected={[]} onActivate={activate} onDeactivate={activate} onDelete={activate} onExport={() => {}} />
  )
  expect((screen.getByText('Activate') as HTMLButtonElement).disabled).toBe(true)
})

it('renders table rows', () => {
  const data: User[] = [
    { id: '1', name: 'A', email: 'a@a.com', status: 'active', industry: 'Tech', createdAt: '' }
  ]
  render(
    <UserTable
      data={data}
      total={1}
      page={0}
      pageSize={50}
      onPageChange={() => {}}
      onSelect={() => {}}
    />
  )
  expect(screen.getByText('a@a.com')).toBeTruthy()
})

it('uses the current search input when exporting users', async () => {
  render(<UserManagement />)

  await waitFor(() => expect(UserService.list).toHaveBeenCalled())

  const searchInput = screen.getByPlaceholderText('Search') as HTMLInputElement
  fireEvent.change(searchInput, { target: { value: 'urgent' } })

  await waitFor(() => expect(searchInput.value).toBe('urgent'))

  fireEvent.click(screen.getByText('Export CSV'))

  await waitFor(() => expect(UserService.export).toHaveBeenCalled())

  expect(UserService.export).toHaveBeenLastCalledWith({
    search: 'urgent',
    status: '',
    industry: '',
    startDate: '',
    endDate: ''
  })
})

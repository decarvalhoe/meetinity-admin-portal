import { it, expect, vi, afterEach, Mock } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vi.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Pie: () => null,
  Line: () => null
}))

const { mockExportExcel } = vi.hoisted(() => ({ mockExportExcel: vi.fn() }))

vi.mock('../services/userService', () => ({
  UserService: {
    list: vi.fn().mockResolvedValue({ users: [], total: 0 }),
    stats: vi.fn().mockResolvedValue({ signups: {}, byIndustry: {}, byStatus: {} }),
    export: vi.fn().mockResolvedValue({
      users: [],
      stats: { signups: {}, byIndustry: {}, byStatus: {} },
      metadata: { generatedAt: new Date().toISOString() }
    }),
    bulk: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../utils/export', () => ({
  exportCsv: vi.fn(),
  exportExcel: mockExportExcel,
  exportPdf: vi.fn(),
  exportAuditLogger: {
    log: vi.fn(),
    subscribe: vi.fn(() => () => undefined)
  }
}))

expect.extend(matchers)

import { render, screen, fireEvent, waitFor, act, within, cleanup } from '@testing-library/react'
import React from 'react'
import { UserFilters, Filters } from '../components/UserFilters'
import { UserActionsBar } from '../components/UserActionsBar'
import { UserTable } from '../components/UserTable'
import { UserManagement } from '../components/UserManagement'
import type { User } from '../services/userService'
import { UserService } from '../services/userService'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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

it('disables pagination when there are no users', () => {
  const onPageChange = vi.fn()
  render(
    <UserTable
      data={[]}
      total={0}
      page={0}
      pageSize={50}
      onPageChange={onPageChange}
      onSelect={() => {}}
    />
  )

  expect(screen.getByText('No pages available')).toBeInTheDocument()

  const prevButton = screen.getAllByRole('button', { name: 'Prev' })[0] as HTMLButtonElement
  const nextButton = screen.getAllByRole('button', { name: 'Next' })[0] as HTMLButtonElement

  expect(prevButton).toBeDisabled()
  expect(nextButton).toBeDisabled()

  fireEvent.click(prevButton)
  fireEvent.click(nextButton)

  expect(onPageChange).not.toHaveBeenCalled()
})

it('clears selection in table after bulk action', async () => {
  const users: User[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com', status: 'active', industry: 'Tech', createdAt: '' }
  ]
  ;(UserService.list as Mock).mockResolvedValue({ users, total: users.length })

  const { container } = render(<UserManagement />, { legacyRoot: true })

  const tables = container.querySelectorAll('.user-table')
  const targetTable = tables[tables.length - 1] as HTMLElement
  await waitFor(() => expect(within(targetTable).getByText('alice@example.com')).toBeInTheDocument())

  const getRowCheckbox = () => within(targetTable).getAllByRole('checkbox')[1] as HTMLInputElement
  fireEvent.click(getRowCheckbox())

  await waitFor(() => expect(getRowCheckbox()).toBeChecked())

  const actions = container.querySelectorAll('.user-actions')
  const targetActions = actions[actions.length - 1] as HTMLElement
  fireEvent.click(within(targetActions).getByRole('button', { name: 'Deactivate' }))

  await waitFor(() => expect(UserService.bulk).toHaveBeenCalledWith(['1'], 'deactivate'))

  await waitFor(() => expect(UserService.stats).toHaveBeenCalledTimes(2))

  await waitFor(() => expect(getRowCheckbox()).not.toBeChecked())
})

it('uses the current search input when exporting users', async () => {
  const { container } = render(<UserManagement />, { legacyRoot: true })

  await waitFor(() => expect(UserService.list).toHaveBeenCalled())

  const filters = container.querySelectorAll('.user-filters')
  const targetFilters = filters[filters.length - 1] as HTMLElement
  const searchInput = within(targetFilters).getByPlaceholderText('Search') as HTMLInputElement
  fireEvent.change(searchInput, { target: { value: 'urgent' } })

  await waitFor(() => expect(searchInput.value).toBe('urgent'))

  const actions = container.querySelectorAll('.user-actions')
  const targetActions = actions[actions.length - 1] as HTMLElement
  fireEvent.click(within(targetActions).getByText('Exporter'))

  await waitFor(() => expect(UserService.export).toHaveBeenCalled())

  expect(UserService.export).toHaveBeenLastCalledWith({
    search: 'urgent',
    status: '',
    industry: '',
    startDate: '',
    endDate: ''
  })

  expect(mockExportExcel).toHaveBeenCalled()
})

it('corrects the current page when total decreases after deletion', async () => {
  const listMock = UserService.list as Mock
  const responses = [
    {
      expectedPage: 0,
      users: [
        { id: 'u1', name: 'User 1', email: 'user1@example.com', status: 'active', industry: 'Tech', createdAt: '' }
      ],
      total: 120
    },
    {
      expectedPage: 1,
      users: [
        { id: 'u51', name: 'User 51', email: 'user51@example.com', status: 'active', industry: 'Tech', createdAt: '' }
      ],
      total: 120
    },
    {
      expectedPage: 2,
      users: [
        { id: 'u101', name: 'User 101', email: 'user101@example.com', status: 'active', industry: 'Tech', createdAt: '' }
      ],
      total: 120
    },
    {
      expectedPage: 2,
      users: [],
      total: 60
    },
    {
      expectedPage: 1,
      users: [
        { id: 'u51', name: 'User 51', email: 'user51@example.com', status: 'active', industry: 'Tech', createdAt: '' }
      ],
      total: 60
    }
  ]

  let callIndex = 0
  listMock.mockImplementation(async ({ page }) => {
    const response = responses[Math.min(callIndex, responses.length - 1)]
    callIndex += 1
    expect(page).toBe(response.expectedPage)
    return { users: response.users, total: response.total }
  })

  render(<UserManagement />)

  await waitFor(() => expect(screen.getByText('user1@example.com')).toBeInTheDocument())

  const nextButton = screen.getByText('Next')
  fireEvent.click(nextButton)
  await waitFor(() => expect(screen.getByText('user51@example.com')).toBeInTheDocument())

  fireEvent.click(nextButton)
  await waitFor(() => expect(screen.getByText('user101@example.com')).toBeInTheDocument())

  const rowCheckbox = screen.getAllByRole('checkbox')[1] as HTMLInputElement
  fireEvent.click(rowCheckbox)
  await waitFor(() => expect(rowCheckbox).toBeChecked())

  fireEvent.click(screen.getByText('Delete'))

  await waitFor(() => expect(UserService.bulk).toHaveBeenCalledWith(['u101'], 'delete'))

  await waitFor(() => expect(screen.getByText('user51@example.com')).toBeInTheDocument())
  expect(screen.queryByText('user101@example.com')).not.toBeInTheDocument()
  expect(screen.getByText('Page 2 / 2')).toBeInTheDocument()
})

it('only updates the user list from the most recent response', async () => {
  type ListResponse = { users: User[]; total: number }
  const requests: Array<{
    deferred: ReturnType<typeof createDeferred<ListResponse>>
    params: Parameters<typeof UserService.list>[0]
  }> = []

  ;(UserService.list as Mock).mockImplementation(params => {
    const deferred = createDeferred<ListResponse>()
    requests.push({ deferred, params })
    return deferred.promise
  })

  const { container } = render(<UserManagement />, { legacyRoot: true })

  await waitFor(() => expect(requests.length).toBeGreaterThan(0))

  const filters = container.querySelectorAll('.user-filters')
  const targetFilters = filters[filters.length - 1] as HTMLElement
  const statusSelect = within(targetFilters)
    .getAllByRole('combobox')
    .find((element): element is HTMLSelectElement =>
      Array.from((element as HTMLSelectElement).options).some(option => option.value === 'active')
    )

  if (!statusSelect) {
    throw new Error('Status select not found')
  }

  fireEvent.change(statusSelect, { target: { value: 'active' } })

  await waitFor(() => expect(requests.some(req => req.params.status === 'active')).toBe(true))

  const entriesWithIndex = requests.map((entry, index) => ({ ...entry, index }))
  const latestActiveEntry = entriesWithIndex.filter(entry => entry.params.status === 'active').pop() ?? entriesWithIndex[entriesWithIndex.length - 1]
  const staleEntries = entriesWithIndex.filter(entry => entry.index !== latestActiveEntry.index)

  const tables = container.querySelectorAll('.user-table')
  const targetTable = tables[tables.length - 1] as HTMLElement
  const tableWithin = within(targetTable)

  for (const entry of staleEntries) {
    await act(async () => {
      entry.deferred.resolve({
        users: [
          { id: '1', name: 'First', email: 'first@example.com', status: 'active', industry: 'Tech', createdAt: '' }
        ],
        total: 1
      })
      await Promise.resolve()
    })

    await waitFor(() => expect(tableWithin.queryByText('first@example.com')).not.toBeInTheDocument())
  }

  await act(async () => {
    latestActiveEntry.deferred.resolve({
      users: [
        { id: '2', name: 'Second', email: 'second@example.com', status: 'active', industry: 'Tech', createdAt: '' }
      ],
      total: 1
    })
    await Promise.resolve()
  })

  await waitFor(() => expect(tableWithin.getByText('second@example.com')).toBeInTheDocument())
})

import { it, expect, vi, afterEach, Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Pie: () => null,
  Line: () => null
}))

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

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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

  const prevButton = screen.getByText('Prev') as HTMLButtonElement
  const nextButton = screen.getByText('Next') as HTMLButtonElement

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

  render(<UserManagement />)

  await waitFor(() => expect(screen.getByText('alice@example.com')).toBeInTheDocument())

  const getRowCheckbox = () => screen.getAllByRole('checkbox')[1] as HTMLInputElement
  fireEvent.click(getRowCheckbox())

  await waitFor(() => expect(getRowCheckbox()).toBeChecked())

  fireEvent.click(screen.getByText('Deactivate'))

  await waitFor(() => expect(UserService.bulk).toHaveBeenCalledWith(['1'], 'deactivate'))

  await waitFor(() => expect(UserService.stats).toHaveBeenCalledTimes(2))

  await waitFor(() => expect(getRowCheckbox()).not.toBeChecked())
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

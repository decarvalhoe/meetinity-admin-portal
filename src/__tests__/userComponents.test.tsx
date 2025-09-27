import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { UserFilters, Filters } from '../components/UserFilters'
import { UserActionsBar } from '../components/UserActionsBar'
import { UserTable } from '../components/UserTable'
import { User } from '../services/userService'

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

it('passes selected user ids to onSelect', async () => {
  const data: User[] = [
    { id: 'user-1', name: 'A', email: 'a@a.com', status: 'active', industry: 'Tech', createdAt: '' }
  ]
  const onSelect = vi.fn()

  const view = render(
    <UserTable
      data={data}
      total={1}
      page={0}
      pageSize={50}
      onPageChange={() => {}}
      onSelect={onSelect}
    />
  )

  const [, rowCheckbox] = within(view.container).getAllByRole('checkbox')
  await userEvent.click(rowCheckbox)

  await waitFor(() => {
    expect(onSelect).toHaveBeenCalledWith(['user-1'])
  })
})

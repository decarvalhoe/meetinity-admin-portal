import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as matchers from '@testing-library/jest-dom/matchers'

vi.mock('../services/eventService', () => ({
  EventService: {
    list: vi.fn(),
    listCategories: vi.fn(),
    listTags: vi.fn(),
    bulk: vi.fn(),
    bulkTags: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getAnalyticsSummary: vi.fn(),
    getAttendanceAnalytics: vi.fn(),
    getConversionAnalytics: vi.fn(),
    getApprovalFunnel: vi.fn(),
    getEngagementHeatmap: vi.fn()
  }
}))

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    readyState: 3,
    connectionAttempts: 0,
    subscribe: () => () => {},
    send: vi.fn(),
    close: vi.fn()
  })
}))

expect.extend(matchers)

import { EventManagement } from '../components/events/EventManagement'
import { EventActionsBar } from '../components/events/EventActionsBar'
import { EventFilters, type EventFiltersState } from '../components/events/EventFilters'
import { EventTable } from '../components/events/EventTable'
import type { Event } from '../services/eventService'
import { EventService } from '../services/eventService'

const baseEvent: Event = {
  id: 'event-1',
  title: 'Salon Tech',
  status: 'pending',
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'Tech' },
  startDate: '2024-06-01T10:00',
  endDate: '2024-06-01T12:00',
  organizer: 'Meetinity',
  location: 'Paris',
  tags: ['innovation']
}

describe('events module', () => {
  beforeEach(() => {
    ;(import.meta as any).env = {
      VITE_API_BASE_URL: 'http://localhost:4000'
    }
    ;(EventService.list as Mock).mockResolvedValue({ events: [baseEvent], total: 1 })
    ;(EventService.listCategories as Mock).mockResolvedValue([{ id: 'cat-1', name: 'Tech' }])
    ;(EventService.listTags as Mock).mockResolvedValue(['innovation'])
    ;(EventService.bulk as Mock).mockResolvedValue(undefined)
    ;(EventService.bulkTags as Mock).mockResolvedValue(undefined)
    ;(EventService.create as Mock).mockResolvedValue(baseEvent)
    ;(EventService.update as Mock).mockResolvedValue(baseEvent)
    ;(EventService.createCategory as Mock).mockResolvedValue({ id: 'cat-2', name: 'Marketing' })
    ;(EventService.updateCategory as Mock).mockResolvedValue({ id: 'cat-1', name: 'Tech+' })
    ;(EventService.deleteCategory as Mock).mockResolvedValue(undefined)
    ;(EventService.getAnalyticsSummary as Mock).mockResolvedValue({
      totalEvents: 1,
      published: 0,
      pendingApproval: 1,
      rejected: 0,
      averageAttendanceRate: 0.5,
      conversionRate: 0.3
    })
    ;(EventService.getAttendanceAnalytics as Mock).mockResolvedValue([
      { eventId: 'event-1', eventName: 'Salon Tech', series: [] }
    ])
    ;(EventService.getConversionAnalytics as Mock).mockResolvedValue([
      { stage: 'Inscrits', value: 1 }
    ])
    ;(EventService.getApprovalFunnel as Mock).mockResolvedValue([
      { stage: 'Soumis', count: 1 }
    ])
    ;(EventService.getEngagementHeatmap as Mock).mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('updates filters and corrects pagination automatically', async () => {
    const responses = [
      {
        expectedPage: 0,
        expectedStatus: '',
        result: {
          events: [baseEvent],
          total: 80
        }
      },
      {
        expectedPage: 1,
        expectedStatus: '',
        result: {
          events: [
            {
              ...baseEvent,
              id: 'event-2',
              title: 'Conférence produit'
            }
          ],
          total: 80
        }
      },
      {
        expectedPage: 0,
        expectedStatus: 'pending',
        result: {
          events: [
            {
              ...baseEvent,
              id: 'event-3',
              title: 'Demande en cours'
            }
          ],
          total: 10
        }
      }
    ]

    let callIndex = 0
    ;(EventService.list as Mock).mockImplementation(async params => {
      const response = responses[Math.min(callIndex, responses.length - 1)]
      expect(params.page).toBe(response.expectedPage)
      expect(params.status).toBe(response.expectedStatus)
      callIndex += 1
      return response.result
    })

    render(<EventManagement />, { legacyRoot: true })

    await waitFor(() => expect(screen.getByText('Salon Tech')).toBeInTheDocument())

    const nextButton = screen.getByRole('button', { name: 'Suivant' })
    fireEvent.click(nextButton)

    await waitFor(() => expect(screen.getByText('Conférence produit')).toBeInTheDocument())

    const statusSelect = screen.getByLabelText('Statut')
    fireEvent.change(statusSelect, { target: { value: 'pending' } })

    await waitFor(() => expect(screen.getByText('Demande en cours')).toBeInTheDocument())
    expect(screen.getByText('Page 1 / 1')).toBeInTheDocument()
  })

  it('performs bulk actions and recalculates the current page', async () => {
    const responses = [
      { expectedPage: 0, events: [{ ...baseEvent, id: 'e-1', title: 'Jour 1' }], total: 60 },
      { expectedPage: 1, events: [{ ...baseEvent, id: 'e-2', title: 'Jour 2' }], total: 60 },
      { expectedPage: 2, events: [{ ...baseEvent, id: 'e-3', title: 'Jour 3' }], total: 60 },
      { expectedPage: 2, events: [], total: 20 },
      { expectedPage: 0, events: [{ ...baseEvent, id: 'e-1', title: 'Jour 1' }], total: 20 }
    ]

    let index = 0
    ;(EventService.list as Mock).mockImplementation(async params => {
      const response = responses[Math.min(index, responses.length - 1)]
      expect(params.page).toBe(response.expectedPage)
      index += 1
      return { events: response.events, total: response.total }
    })

    render(<EventManagement />, { legacyRoot: true })

    await waitFor(() => expect(screen.getByText('Jour 1')).toBeInTheDocument())

    const nextButton = screen.getByRole('button', { name: 'Suivant' })
    fireEvent.click(nextButton)
    await waitFor(() => expect(screen.getByText('Jour 2')).toBeInTheDocument())

    fireEvent.click(nextButton)
    await waitFor(() => expect(screen.getByText('Jour 3')).toBeInTheDocument())

    const checkboxes = screen.getAllByRole('checkbox')
    const rowCheckbox = checkboxes[1] as HTMLInputElement
    fireEvent.click(rowCheckbox)
    await waitFor(() => expect(rowCheckbox).toBeChecked())

    const archiveButton = screen.getByRole('button', { name: 'Archiver' })
    fireEvent.click(archiveButton)

    await waitFor(() => expect(EventService.bulk).toHaveBeenCalledWith(['e-3'], 'archive'))
    await waitFor(() => expect(screen.getByText('Jour 1')).toBeInTheDocument())
    expect(screen.getByText('Page 1 / 1')).toBeInTheDocument()
  })

  it('submits the event form and refreshes the list', async () => {
    render(<EventManagement />, { legacyRoot: true })

    await waitFor(() => expect(EventService.list).toHaveBeenCalled())

    const createButton = screen.getByRole('button', { name: 'Créer un événement' })
    fireEvent.click(createButton)

    const titleInput = screen.getByLabelText('Titre') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'Meetup produit' } })

    const startDateInputs = screen.getAllByLabelText('Date de début')
    const startDateInput = startDateInputs[startDateInputs.length - 1] as HTMLInputElement
    fireEvent.change(startDateInput, { target: { value: '2024-06-02T09:00' } })

    const categorySelects = screen.getAllByLabelText('Catégorie')
    const categorySelect = categorySelects[categorySelects.length - 1] as HTMLSelectElement
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } })

    const tagInputs = screen.getAllByLabelText('Tags')
    const tagsInput = tagInputs[tagInputs.length - 1] as HTMLInputElement
    fireEvent.change(tagsInput, { target: { value: 'nouveau, lancement' } })

    const saveButton = screen.getByRole('button', { name: 'Enregistrer' })
    fireEvent.click(saveButton)

    await waitFor(() =>
      expect(EventService.create).toHaveBeenCalledWith({
        title: 'Meetup produit',
        description: '',
        status: 'draft',
        categoryId: 'cat-1',
        startDate: '2024-06-02T09:00',
        endDate: undefined,
        organizer: undefined,
        location: undefined,
        tags: ['nouveau', 'lancement']
      })
    )

    await waitFor(() => expect(EventService.list).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Enregistrer')).not.toBeInTheDocument()
  })

  it('applies tags in bulk from the actions bar', async () => {
    const user = userEvent.setup()
    const eventRows: Event[] = [
      { ...baseEvent, id: 'bulk-1', title: 'Salon 1' },
      { ...baseEvent, id: 'bulk-2', title: 'Salon 2' }
    ]
    ;(EventService.list as Mock).mockResolvedValue({ events: eventRows, total: eventRows.length })

    render(<EventManagement />, { legacyRoot: true })

    await waitFor(() => expect(screen.getByText('Salon 1')).toBeInTheDocument())

    const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
    await user.click(selectAllCheckbox)

    await waitFor(() =>
      expect(
        screen
          .getAllByRole('checkbox')
          .slice(1)
          .every(checkbox => (checkbox as HTMLInputElement).checked)
      ).toBe(true)
    )

    const tagsField = screen.getAllByPlaceholderText('tag1, tag2')[0] as HTMLInputElement
    fireEvent.change(tagsField, { target: { value: 'urgent, priorité' } })

    const applyButton = screen.getByRole('button', { name: 'Appliquer les tags' })
    await waitFor(() => expect(applyButton).not.toBeDisabled())

    fireEvent.click(applyButton)

    await waitFor(() => expect(EventService.bulkTags).toHaveBeenCalledWith(['bulk-1', 'bulk-2'], ['urgent', 'priorité']))
    await waitFor(() => expect(EventService.list).toHaveBeenCalledTimes(2))
  })

  it('exposes standalone components behaviour', () => {
    const filtersState: EventFiltersState = {
      search: '',
      status: '',
      categoryId: '',
      startDate: '',
      endDate: ''
    }
    const handleFilters = vi.fn()

    render(<EventFilters filters={filtersState} onChange={handleFilters} categories={[]} />)
    fireEvent.change(screen.getByPlaceholderText('Rechercher un événement'), { target: { value: 'expo' } })
    expect(handleFilters).toHaveBeenCalledWith({ search: 'expo' })

    const actionsApprove = vi.fn()
    const actionsTags = vi.fn()
    render(
      <EventActionsBar
        selected={['a']}
        onApprove={actionsApprove}
        onReject={() => {}}
        onArchive={() => {}}
        onCreate={() => {}}
        onManageCategories={() => {}}
        onRefresh={() => {}}
        onApplyTags={actionsTags}
        availableTags={['innovation']}
      />
    )

    fireEvent.change(screen.getAllByPlaceholderText('tag1, tag2')[0], { target: { value: 'focus' } })
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer les tags' }))
    expect(actionsTags).toHaveBeenCalledWith(['focus'])

    render(
      <EventTable
        data={[baseEvent]}
        total={1}
        page={0}
        pageSize={20}
        onPageChange={() => {}}
        onSelect={() => {}}
        onEdit={() => {}}
      />
    )

    expect(screen.getByText('Salon Tech')).toBeInTheDocument()
  })
})

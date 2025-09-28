import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Event,
  EventCategory,
  EventInput,
  EventService
} from '../../services/eventService'
import { EventFilters, EventFiltersState } from './EventFilters'
import { EventTable } from './EventTable'
import { EventActionsBar } from './EventActionsBar'
import { EventForm } from './EventForm'
import { EventCategoriesManager } from './EventCategoriesManager'
import { useDebounce } from '../../hooks/useDebounce'
import { usePagination } from '../../hooks/usePagination'

interface EventManagementProps {
  initialFilters?: Partial<EventFiltersState>
  lockedStatus?: string
}

export function EventManagement({ initialFilters, lockedStatus }: EventManagementProps) {
  const initialState = useMemo<EventFiltersState>(
    () => ({
      search: initialFilters?.search ?? '',
      status: lockedStatus ?? initialFilters?.status ?? '',
      categoryId: initialFilters?.categoryId ?? '',
      startDate: initialFilters?.startDate ?? '',
      endDate: initialFilters?.endDate ?? ''
    }),
    [initialFilters, lockedStatus]
  )

  const [events, setEvents] = useState<Event[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<EventFiltersState>(initialState)
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [selectionResetKey, setSelectionResetKey] = useState(0)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)

  const debouncedSearch = useDebounce(filters.search)
  const { page, pageSize, setPage } = usePagination(20)

  const requestIdRef = useRef(0)

  useEffect(() => {
    if (lockedStatus && filters.status !== lockedStatus) {
      setFilters(prev => ({ ...prev, status: lockedStatus }))
    }
  }, [filters.status, lockedStatus])

  const loadEvents = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const res = await EventService.list({
      page,
      pageSize,
      search: debouncedSearch,
      status: lockedStatus ?? filters.status,
      categoryId: filters.categoryId,
      startDate: filters.startDate,
      endDate: filters.endDate
    })

    if (requestId !== requestIdRef.current) {
      return null
    }

    setEvents(res.events)
    setTotal(res.total)
    return res
  }, [
    page,
    pageSize,
    debouncedSearch,
    filters.status,
    filters.categoryId,
    filters.startDate,
    filters.endDate,
    lockedStatus
  ])

  const ensurePageWithinBounds = useCallback(
    (count: number) => {
      const maxPage = Math.max(0, Math.ceil(count / pageSize) - 1)
      if (page > maxPage) {
        setPage(maxPage)
      }
    },
    [page, pageSize, setPage]
  )

  const loadCategories = useCallback(async () => {
    const data = await EventService.listCategories()
    setCategories(data)
  }, [])

  const loadTags = useCallback(async () => {
    try {
      const data = await EventService.listTags()
      setAvailableTags(data)
    } catch (error) {
      console.error('Failed to load event tags', error)
    }
  }, [])

  useEffect(() => {
    loadCategories()
    loadTags()
  }, [loadCategories, loadTags])

  useEffect(() => {
    const refresh = async () => {
      const res = await loadEvents()
      if (res) {
        ensurePageWithinBounds(res.total)
      }
    }

    refresh()
  }, [loadEvents, ensurePageWithinBounds])

  const handleFilterChange = (partial: Partial<EventFiltersState>) => {
    setFilters(prev => {
      const next = { ...prev, ...partial }
      if (lockedStatus) {
        next.status = lockedStatus
      }
      return next
    })
    setPage(0)
  }

  const handleBulkAction = async (action: 'approve' | 'reject' | 'archive') => {
    if (selected.length === 0) {
      return
    }
    await EventService.bulk(selected, action)
    setSelected([])
    setSelectionResetKey(prev => prev + 1)
    const res = await loadEvents()
    if (res) {
      ensurePageWithinBounds(res.total)
    }
  }

  const handleApplyTags = async (tags: string[]) => {
    if (selected.length === 0 || tags.length === 0) {
      return
    }
    await EventService.bulkTags(selected, tags)
    setSelected([])
    setSelectionResetKey(prev => prev + 1)
    const res = await loadEvents()
    if (res) {
      ensurePageWithinBounds(res.total)
    }
    await loadTags()
  }

  const handleCreate = () => {
    setEditingEvent(null)
    setIsFormOpen(true)
  }

  const handleEdit = (event: Event) => {
    setEditingEvent(event)
    setIsFormOpen(true)
  }

  const handleSave = async (payload: EventInput) => {
    if (editingEvent) {
      await EventService.update(editingEvent.id, payload)
    } else {
      await EventService.create(payload)
    }
    setIsFormOpen(false)
    setEditingEvent(null)
    const res = await loadEvents()
    if (res) {
      ensurePageWithinBounds(res.total)
    }
    await loadTags()
  }

  const handleCancelForm = () => {
    setIsFormOpen(false)
    setEditingEvent(null)
  }

  const handleToggleCategories = () => {
    setIsCategoriesOpen(open => !open)
  }

  const handleRefresh = async () => {
    const res = await loadEvents()
    if (res) {
      ensurePageWithinBounds(res.total)
    }
  }

  return (
    <div className="event-management">
      <EventFilters
        filters={filters}
        onChange={handleFilterChange}
        categories={categories}
        disableStatus={Boolean(lockedStatus)}
      />
      <EventActionsBar
        selected={selected}
        onApprove={() => handleBulkAction('approve')}
        onReject={() => handleBulkAction('reject')}
        onArchive={() => handleBulkAction('archive')}
        onCreate={handleCreate}
        onManageCategories={handleToggleCategories}
        onRefresh={handleRefresh}
        onApplyTags={handleApplyTags}
        availableTags={availableTags}
      />
      {isFormOpen && (
        <EventForm
          event={editingEvent}
          categories={categories}
          availableTags={availableTags}
          onSave={handleSave}
          onCancel={handleCancelForm}
        />
      )}
      {isCategoriesOpen && (
        <EventCategoriesManager categories={categories} onCategoriesChange={loadCategories} />
      )}
      <EventTable
        data={events}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onSelect={setSelected}
        onEdit={handleEdit}
        clearSelectionKey={selectionResetKey}
      />
    </div>
  )
}

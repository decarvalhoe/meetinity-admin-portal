import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  Event,
  EventCategory,
  EventInput,
  EventService,
  EventAnalyticsSummary,
  EventAttendanceSeries,
  EventConversionStat,
  EventApprovalStage,
  EventEngagementCell
} from '../../services/eventService'
import { EventFilters, EventFiltersState } from './EventFilters'
import { EventTable } from './EventTable'
import { EventActionsBar } from './EventActionsBar'
import { EventForm } from './EventForm'
import { EventCategoriesManager } from './EventCategoriesManager'
import { useDebounce } from '../../hooks/useDebounce'
import { usePagination } from '../../hooks/usePagination'
import { useWebSocket } from '../../hooks/useWebSocket'
import { EventAnalyticsDashboard, AnalyticsRangeOption } from './EventAnalyticsDashboard'

export interface EventAnalyticsState {
  summary: EventAnalyticsSummary | null
  attendance: EventAttendanceSeries[]
  conversions: EventConversionStat[]
  funnel: EventApprovalStage[]
  heatmap: EventEngagementCell[]
  updatedAt?: string
}

const defaultSummary: EventAnalyticsSummary = {
  totalEvents: 0,
  published: 0,
  pendingApproval: 0,
  rejected: 0,
  averageAttendanceRate: 0,
  conversionRate: 0
}

const initialAnalyticsState: EventAnalyticsState = {
  summary: null,
  attendance: [],
  conversions: [],
  funnel: [],
  heatmap: [],
  updatedAt: undefined
}

type AnalyticsAction =
  | {
      type: 'SET_BASELINE'
      payload: {
        summary: EventAnalyticsSummary
        attendance: EventAttendanceSeries[]
        conversions: EventConversionStat[]
        funnel: EventApprovalStage[]
        heatmap: EventEngagementCell[]
        updatedAt?: string
      }
    }
  | { type: 'PATCH_SUMMARY'; payload: Partial<EventAnalyticsSummary> }
  | {
      type: 'UPSERT_ATTENDANCE_POINT'
      payload: {
        eventId: string
        eventName: string
        date: string
        registrations: number
        attendance: number
      }
    }
  | { type: 'UPSERT_CONVERSION'; payload: EventConversionStat }
  | { type: 'UPSERT_FUNNEL_STAGE'; payload: EventApprovalStage }
  | { type: 'UPSERT_HEATMAP_CELL'; payload: EventEngagementCell }

export function analyticsReducer(state: EventAnalyticsState, action: AnalyticsAction): EventAnalyticsState {
  switch (action.type) {
    case 'SET_BASELINE':
      return {
        summary: action.payload.summary,
        attendance: action.payload.attendance,
        conversions: action.payload.conversions,
        funnel: action.payload.funnel,
        heatmap: action.payload.heatmap,
        updatedAt: action.payload.updatedAt ?? new Date().toISOString()
      }
    case 'PATCH_SUMMARY': {
      const nextSummary = { ...(state.summary ?? defaultSummary), ...action.payload }
      return {
        ...state,
        summary: nextSummary,
        updatedAt: new Date().toISOString()
      }
    }
    case 'UPSERT_ATTENDANCE_POINT': {
      const { eventId, eventName, date, registrations, attendance } = action.payload
      const nextAttendance = state.attendance.map(series => ({ ...series, series: [...series.series] }))
      const existingSeriesIndex = nextAttendance.findIndex(series => series.eventId === eventId)

      if (existingSeriesIndex === -1) {
        nextAttendance.push({
          eventId,
          eventName,
          series: [{ date, registrations, attendance }]
        })
      } else {
        const existingSeries = nextAttendance[existingSeriesIndex]
        const points = [...existingSeries.series]
        const pointIndex = points.findIndex(point => point.date === date)
        const nextPoint = { date, registrations, attendance }

        if (pointIndex === -1) {
          points.push(nextPoint)
        } else {
          points[pointIndex] = nextPoint
        }

        points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        nextAttendance[existingSeriesIndex] = { ...existingSeries, eventName, series: points }
      }

      return {
        ...state,
        attendance: nextAttendance,
        updatedAt: new Date().toISOString()
      }
    }
    case 'UPSERT_CONVERSION': {
      const index = state.conversions.findIndex(item => item.stage === action.payload.stage)
      const nextConversions = [...state.conversions]
      if (index === -1) {
        nextConversions.push(action.payload)
      } else {
        nextConversions[index] = action.payload
      }
      return {
        ...state,
        conversions: nextConversions,
        updatedAt: new Date().toISOString()
      }
    }
    case 'UPSERT_FUNNEL_STAGE': {
      const index = state.funnel.findIndex(stage => stage.stage === action.payload.stage)
      const nextFunnel = [...state.funnel]
      if (index === -1) {
        nextFunnel.push(action.payload)
      } else {
        nextFunnel[index] = action.payload
      }
      return {
        ...state,
        funnel: nextFunnel,
        updatedAt: new Date().toISOString()
      }
    }
    case 'UPSERT_HEATMAP_CELL': {
      const index = state.heatmap.findIndex(
        cell => cell.day === action.payload.day && cell.hour === action.payload.hour
      )
      const nextHeatmap = [...state.heatmap]
      if (index === -1) {
        nextHeatmap.push(action.payload)
      } else {
        nextHeatmap[index] = action.payload
      }
      return {
        ...state,
        heatmap: nextHeatmap,
        updatedAt: new Date().toISOString()
      }
    }
    default:
      return state
  }
}

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
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRangeOption>('30d')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const [analyticsState, dispatchAnalytics] = useReducer(analyticsReducer, initialAnalyticsState)

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

  const loadAnalytics = useCallback(async (range: AnalyticsRangeOption) => {
    setAnalyticsLoading(true)
    try {
      const [summary, attendanceSeries, conversionSeries, funnelSeries, heatmapSeries] =
        await Promise.all([
          EventService.getAnalyticsSummary({ range }),
          EventService.getAttendanceAnalytics({ range }),
          EventService.getConversionAnalytics({ range }),
          EventService.getApprovalFunnel({ range }),
          EventService.getEngagementHeatmap({ range })
        ])

      dispatchAnalytics({
        type: 'SET_BASELINE',
        payload: {
          summary,
          attendance: attendanceSeries,
          conversions: conversionSeries,
          funnel: funnelSeries,
          heatmap: heatmapSeries,
          updatedAt: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('Failed to load event analytics', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics(analyticsRange)
  }, [analyticsRange, loadAnalytics])

  const analyticsSocketUrl = useMemo(() => {
    const wsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.replace(/\/$/, '')
    if (wsBase) {
      return `${wsBase}/events`
    }
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
    if (!apiBase) {
      return null
    }
    if (apiBase.startsWith('http')) {
      return `${apiBase.replace(/^http/, 'ws')}/ws/events`
    }
    return `ws://${apiBase}/ws/events`
  }, [])

  const { readyState: analyticsSocketState, subscribe: subscribeToAnalyticsStream } = useWebSocket(
    analyticsSocketUrl,
    {
      enabled: Boolean(analyticsSocketUrl),
      reconnectInterval: 4000,
      maxReconnectInterval: 30000
    }
  )

  useEffect(() => {
    if (!analyticsSocketUrl) {
      return undefined
    }
    return subscribeToAnalyticsStream(event => {
      try {
        const message = JSON.parse(event.data as string)
        if (!message || typeof message !== 'object') {
          return
        }
        switch (message.type) {
          case 'summary':
            dispatchAnalytics({ type: 'PATCH_SUMMARY', payload: message.data ?? {} })
            break
          case 'registration':
            if (!message.eventId || !message.date) {
              break
            }
            dispatchAnalytics({
              type: 'UPSERT_ATTENDANCE_POINT',
              payload: {
                eventId: message.eventId,
                eventName: message.eventName,
                date: message.date,
                registrations: message.registrations,
                attendance: message.attendance
              }
            })
            break
          case 'conversion':
            if (!message.stage) {
              break
            }
            dispatchAnalytics({
              type: 'UPSERT_CONVERSION',
              payload: { stage: message.stage, value: message.value }
            })
            break
          case 'approval':
            if (!message.stage) {
              break
            }
            dispatchAnalytics({
              type: 'UPSERT_FUNNEL_STAGE',
              payload: { stage: message.stage, count: message.count }
            })
            break
          case 'heatmap':
            if (!message.day || typeof message.hour !== 'number') {
              break
            }
            dispatchAnalytics({
              type: 'UPSERT_HEATMAP_CELL',
              payload: { day: message.day, hour: message.hour, value: message.value }
            })
            break
          default:
            console.warn('Unhandled analytics event', message)
        }
      } catch (error) {
        console.error('Failed to parse analytics update', error)
      }
    })
  }, [subscribeToAnalyticsStream])

  const handleAnalyticsRangeChange = (range: AnalyticsRangeOption) => {
    setAnalyticsRange(range)
  }

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
    await loadAnalytics(analyticsRange)
  }

  return (
    <div className="event-management">
      <EventAnalyticsDashboard
        summary={analyticsState.summary}
        attendance={analyticsState.attendance}
        conversions={analyticsState.conversions}
        funnel={analyticsState.funnel}
        heatmap={analyticsState.heatmap}
        loading={analyticsLoading}
        lastUpdated={analyticsState.updatedAt}
        connectionState={analyticsSocketState}
        onRangeChange={handleAnalyticsRangeChange}
        range={analyticsRange}
      />
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

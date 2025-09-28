/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { EventManagement, analyticsReducer, EventAnalyticsState } from '../components/events/EventManagement'
import type {
  EventApprovalStage,
  EventAttendanceSeries,
  EventConversionStat,
  EventEngagementCell,
  EventAnalyticsSummary
} from '../services/eventService'

const subscribers = new Set<(event: MessageEvent) => void>()
let emitWebSocketMessage: (payload: unknown) => void
let hasActiveSubscribers = false

emitWebSocketMessage = payload => {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
  subscribers.forEach(handler =>
    handler({
      data: message
    } as MessageEvent)
  )
}

var fixtures: {
  summary: EventAnalyticsSummary
  attendance: EventAttendanceSeries[]
  conversions: EventConversionStat[]
  funnel: EventApprovalStage[]
  heatmap: EventEngagementCell[]
}

vi.mock('../services/eventService', () => {
  fixtures = {
    summary: {
      totalEvents: 42,
      published: 30,
      pendingApproval: 6,
      rejected: 6,
      averageAttendanceRate: 0.72,
      conversionRate: 0.58
    },
    attendance: [
      {
        eventId: 'a',
        eventName: 'Forum Product',
        series: [
          { date: '2024-01-01', registrations: 120, attendance: 110 },
          { date: '2024-01-02', registrations: 140, attendance: 135 }
        ]
      }
    ],
    conversions: [
      { stage: 'Visiteurs', value: 420 },
      { stage: 'Inscrits', value: 190 },
      { stage: 'Présents', value: 140 }
    ],
    funnel: [
      { stage: 'Soumis', count: 40 },
      { stage: 'Vérification', count: 28 },
      { stage: 'Approuvés', count: 22 }
    ],
    heatmap: [
      { day: 'Lundi', hour: 9, value: 30 },
      { day: 'Lundi', hour: 10, value: 50 },
      { day: 'Mardi', hour: 14, value: 70 }
    ]
  }

  return {
    EventService: {
      list: vi.fn().mockResolvedValue({ events: [], total: 0 }),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
      archive: vi.fn(),
      bulk: vi.fn(),
      bulkTags: vi.fn(),
      updateTags: vi.fn(),
      listTags: vi.fn().mockResolvedValue([]),
      listCategories: vi.fn().mockResolvedValue([]),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      getAnalyticsSummary: vi.fn().mockResolvedValue(fixtures.summary),
      getAttendanceAnalytics: vi.fn().mockResolvedValue(fixtures.attendance),
      getConversionAnalytics: vi.fn().mockResolvedValue(fixtures.conversions),
      getApprovalFunnel: vi.fn().mockResolvedValue(fixtures.funnel),
      getEngagementHeatmap: vi.fn().mockResolvedValue(fixtures.heatmap)
    }
  }
})

vi.mock('../hooks/useWebSocket', () => {
  return {
    useWebSocket: () => ({
      readyState: 1,
      connectionAttempts: 0,
      subscribe: (handler: (event: MessageEvent) => void) => {
        subscribers.add(handler)
        hasActiveSubscribers = subscribers.size > 0
        return () => {
          subscribers.delete(handler)
          hasActiveSubscribers = subscribers.size > 0
        }
      },
      send: vi.fn(),
      close: vi.fn()
    })
  }
})

describe('Event analytics pipeline', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:4000')
    vi.stubEnv('VITE_WS_BASE_URL', 'ws://localhost:5000/ws')
  })

  afterEach(() => {
    vi.clearAllMocks()
    subscribers.clear()
    hasActiveSubscribers = false
    vi.unstubAllEnvs()
  })

  it('merges realtime WebSocket updates into analytics visuals', async () => {
    render(<EventManagement />)

    await waitFor(() =>
      expect(screen.getByTestId('analytics-total-events').textContent).toContain('42')
    )

    await waitFor(() => expect(hasActiveSubscribers).toBe(true))

    await act(async () => {
      emitWebSocketMessage({ type: 'summary', data: { totalEvents: 43 } })
    })

    await waitFor(() =>
      expect(screen.getByTestId('analytics-total-events').textContent).toContain('43')
    )

    await act(async () => {
      emitWebSocketMessage({ type: 'conversion', stage: 'Visiteurs', value: 520 })
    })

    await waitFor(() =>
      expect(screen.getByTestId('analytics-conversion-Visiteurs').textContent).toContain('520')
    )
  })

  it('captures reducer transformations snapshot', () => {
    const baseState: EventAnalyticsState = {
      summary: { ...fixtures.summary },
      attendance: [...fixtures.attendance],
      conversions: [...fixtures.conversions],
      funnel: [...fixtures.funnel],
      heatmap: [...fixtures.heatmap],
      updatedAt: '2024-01-01T00:00:00.000Z'
    }

    const actions: Parameters<typeof analyticsReducer>[1][] = [
      { type: 'PATCH_SUMMARY', payload: { totalEvents: 45, pendingApproval: 4 } },
      {
        type: 'UPSERT_ATTENDANCE_POINT',
        payload: {
          eventId: 'a',
          eventName: 'Forum Product',
          date: '2024-01-03',
          registrations: 155,
          attendance: 149
        }
      },
      { type: 'UPSERT_CONVERSION', payload: { stage: 'Présents', value: 150 } },
      { type: 'UPSERT_FUNNEL_STAGE', payload: { stage: 'Approuvés', count: 24 } },
      { type: 'UPSERT_HEATMAP_CELL', payload: { day: 'Mercredi', hour: 16, value: 90 } }
    ]

    const finalState = actions.reduce(analyticsReducer, baseState)
    const { updatedAt, ...stateWithoutTimestamp } = finalState

    expect(updatedAt).toEqual(expect.any(String))
    expect(stateWithoutTimestamp).toMatchSnapshot()
  })
})


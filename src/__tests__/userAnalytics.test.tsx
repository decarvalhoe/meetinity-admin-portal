/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { UserAnalyticsDashboard } from '../components/users/UserAnalyticsDashboard'
import type {
  EngagementMetrics,
  MatchSuccessRate,
  ActivityHeatmapCell,
  CohortRetention,
  GeoDistributionBucket
} from '../services/userService'

const subscribers = new Set<(event: MessageEvent) => void>()
let emitWebSocketMessage: (payload: unknown) => void

const fixtures = vi.hoisted(() => ({
  engagementFixture: {
    summary: {
      dailyActiveUsers: 1200,
      weeklyActiveUsers: 5400,
      monthlyActiveUsers: 18200,
      averageSessionDurationMinutes: 24,
      engagementScore: 4.2
    },
    series: [
      { timestamp: '2024-01-01T00:00:00.000Z', activeUsers: 1000, interactions: 5200, matches: 240 },
      { timestamp: '2024-01-02T00:00:00.000Z', activeUsers: 1200, interactions: 5800, matches: 265 }
    ]
  } as EngagementMetrics,
  matchFixture: {
    overallRate: 0.42,
    segments: [
      { segment: 'Premium', rate: 0.58 },
      { segment: 'Standard', rate: 0.37 }
    ],
    trend: [
      { date: '2024-01-01', rate: 0.41 },
      { date: '2024-01-02', rate: 0.42 }
    ]
  } as MatchSuccessRate,
  heatmapFixture: [
    { day: 'Lundi', hour: 9, value: 45 },
    { day: 'Lundi', hour: 10, value: 60 },
    { day: 'Mardi', hour: 14, value: 80 }
  ] as ActivityHeatmapCell[],
  cohortsFixture: [
    {
      cohort: 'Janvier 2024',
      values: [
        { period: 'Semaine 1', rate: 1 },
        { period: 'Semaine 2', rate: 0.72 },
        { period: 'Semaine 3', rate: 0.61 }
      ]
    },
    {
      cohort: 'Février 2024',
      values: [
        { period: 'Semaine 1', rate: 1 },
        { period: 'Semaine 2', rate: 0.69 }
      ]
    }
  ] as CohortRetention[],
  geoFixture: [
    { countryCode: 'FR', countryName: 'France', userCount: 4200 },
    { countryCode: 'US', countryName: 'États-Unis', userCount: 3100 },
    { countryCode: 'BR', countryName: 'Brésil', userCount: 900 }
  ] as GeoDistributionBucket[]
}))

const onlyDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '')
const digitsForTestId = (testId: string) => screen.getAllByTestId(testId).map(node => onlyDigits(node.textContent))
const lastElementByTestId = (testId: string) => {
  const elements = screen.getAllByTestId(testId)
  return elements[elements.length - 1]
}

emitWebSocketMessage = payload => {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
  subscribers.forEach(handler => handler({ data: message } as MessageEvent))
}

vi.mock('../services/userService', () => ({
  UserService: {
    getEngagementMetrics: vi.fn().mockResolvedValue(fixtures.engagementFixture),
    getMatchSuccessRate: vi.fn().mockResolvedValue(fixtures.matchFixture),
    getActivityHeatmap: vi.fn().mockResolvedValue(fixtures.heatmapFixture),
    getCohorts: vi.fn().mockResolvedValue(fixtures.cohortsFixture),
    getGeoDistribution: vi.fn().mockResolvedValue(fixtures.geoFixture)
  }
}))

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    readyState: 1,
    connectionAttempts: 0,
    subscribe: (handler: (event: MessageEvent) => void) => {
      subscribers.add(handler)
      return () => {
        subscribers.delete(handler)
      }
    },
    send: vi.fn(),
    close: vi.fn()
  })
}))

describe('User analytics dashboard', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:4000')
    vi.stubEnv('VITE_WS_BASE_URL', 'ws://localhost:5000/ws')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    subscribers.clear()
  })

  it('renders all analytics widgets with fetched data', async () => {
    render(<UserAnalyticsDashboard />)

    await waitFor(() => expect(digitsForTestId('engagement-dau')).toContain('1200'))

    expect(screen.getByTestId('match-overall').textContent).toMatch(/42[.,]0/)

    await waitFor(() => {
      const retentionSvg = lastElementByTestId('retention-chart') as SVGSVGElement
      expect(retentionSvg.querySelectorAll('path').length).toBeGreaterThan(0)
    })

    await waitFor(() => {
      const heatmapSvg = lastElementByTestId('heatmap-chart') as SVGSVGElement
      expect(heatmapSvg.querySelectorAll('rect').length).toBeGreaterThan(0)
    })

    await waitFor(() => {
      const geoSvg = lastElementByTestId('geo-chart') as SVGSVGElement
      expect(geoSvg.querySelectorAll('path').length).toBeGreaterThan(0)
    })
  })

  it('merges realtime engagement and heatmap updates', async () => {
    render(<UserAnalyticsDashboard />)

    await waitFor(() => expect(digitsForTestId('engagement-dau')).toContain('1200'))

    await act(async () => {
      emitWebSocketMessage({ type: 'engagement', summary: { dailyActiveUsers: 1500 } })
    })

    await waitFor(() => expect(digitsForTestId('engagement-dau')).toContain('1500'))

    await act(async () => {
      emitWebSocketMessage({ type: 'heatmap', day: 'Lundi', hour: 9, value: 99 })
    })

    await waitFor(() => {
      const titles = Array.from(lastElementByTestId('heatmap-chart').querySelectorAll('title')).map(
        node => node.textContent
      )
      expect(titles.some(title => title?.includes('99'))).toBe(true)
    })
  })
})

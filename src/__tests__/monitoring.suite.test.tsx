/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import type {
  MonitoringHistoryRange,
  MonitoringHistoryResponse,
  MonitoringMetricsResponse,
  MonitoringStatusResponse,
  MonitoringStreamsResponse
} from '../services/monitoringService'
import { SystemMonitoringDashboard } from '../components/monitoring/SystemMonitoringDashboard'
import { createMockWebSocket } from './utils/networkMocks'
import { MonitoringService } from '../services/monitoringService'
import { AuthProvider } from '../hooks/usePermissions'
import { AuthService } from '../services/authService'

const monitoringWebSocketRef = vi.hoisted(() => ({
  current: null as ReturnType<typeof createMockWebSocket>['controller'] | null
}))

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

let fixtures: {
  metrics: MonitoringMetricsResponse
  status: MonitoringStatusResponse
  history: Record<MonitoringHistoryRange, MonitoringHistoryResponse>
  streams: MonitoringStreamsResponse
}

vi.mock('../services/monitoringService', async () => {
  const actual = await vi.importActual<typeof import('../services/monitoringService')>(
    '../services/monitoringService'
  )

  return {
    ...actual,
    MonitoringService: {
      getMetrics: vi.fn(),
      getStatus: vi.fn(),
      getHistory: vi.fn(),
      getStreams: vi.fn()
    }
  }
})

vi.mock('../hooks/useWebSocket', async () => {
  const { createMockWebSocket: factory } = await vi.importActual<
    typeof import('./utils/networkMocks')
  >('./utils/networkMocks')
  const { module, controller } = factory()
  monitoringWebSocketRef.current = controller
  return module
})

vi.mock('../services/authService', async () => {
  const actual = await vi.importActual<typeof import('../services/authService')>(
    '../services/authService'
  )
  return {
    ...actual,
    AuthService: {
      getSession: vi.fn(),
      getPermissions: vi.fn()
    }
  }
})

const monitoringServiceMock = vi.mocked(MonitoringService)
const authServiceMock = vi.mocked(AuthService)

function getMonitoringSocket() {
  if (!monitoringWebSocketRef.current) {
    throw new Error('Monitoring WebSocket mock is not initialised')
  }
  return monitoringWebSocketRef.current
}

describe('Monitoring dashboard', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:4000')
    vi.stubEnv('VITE_WS_BASE_URL', 'ws://localhost:5000/ws')

    fixtures = {
      metrics: {
        generatedAt: '2024-01-01T10:00:00.000Z',
        services: [
          {
            id: 'auth-api',
            name: 'Auth API',
            description: "API d'authentification centralisée",
            environment: 'production',
            region: 'eu-west-1',
            status: 'operational',
            lastUpdatedAt: '2024-01-01T10:00:00.000Z',
            indicators: [
              {
                type: 'cpu',
                label: 'CPU',
                unit: '%',
                value: 45.2,
                trend: -5.4,
                thresholds: { warning: 70, critical: 90 },
                lastUpdatedAt: '2024-01-01T09:59:30.000Z'
              },
              {
                type: 'latency',
                label: 'Latence',
                unit: 'ms',
                value: 180.4,
                trend: 3.2,
                thresholds: { warning: 250, critical: 400 },
                lastUpdatedAt: '2024-01-01T09:59:30.000Z'
              }
            ]
          }
        ]
      },
      status: {
        services: [
          {
            id: 'auth-api',
            name: 'Auth API',
            status: 'operational',
            environment: 'production',
            region: 'eu-west-1',
            uptimePercentage: 99.95,
            lastCheckedAt: '2024-01-01T10:00:00.000Z',
            lastIncidentAt: '2023-12-31T05:12:00.000Z'
          }
        ],
        incidents: [],
        updatedAt: '2024-01-01T10:00:00.000Z'
      },
      history: {
        '24h': {
          range: '24h',
          generatedAt: '2024-01-01T10:00:00.000Z',
          series: [
            {
              serviceId: 'auth-api',
              serviceName: 'Auth API',
              indicator: 'latency',
              points: [
                { timestamp: '2024-01-01T08:00:00.000Z', value: 140 },
                { timestamp: '2024-01-01T09:00:00.000Z', value: 160 },
                { timestamp: '2024-01-01T10:00:00.000Z', value: 180 }
              ]
            }
          ]
        },
        '7d': {
          range: '7d',
          generatedAt: '2024-01-01T10:00:00.000Z',
          series: [
            {
              serviceId: 'auth-api',
              serviceName: 'Auth API',
              indicator: 'cpu',
              points: [
                { timestamp: '2023-12-27T10:00:00.000Z', value: 55.5 },
                { timestamp: '2023-12-30T10:00:00.000Z', value: 60.25 },
                { timestamp: '2024-01-01T10:00:00.000Z', value: 62.5 }
              ]
            }
          ]
        },
        '30d': {
          range: '30d',
          generatedAt: '2024-01-01T10:00:00.000Z',
          series: []
        }
      },
      streams: {
        socketPath: '/ws/monitoring',
        topics: [
          { topic: 'monitoring.metrics', indicator: 'cpu', description: 'Snapshots CPU temps réel' },
          { topic: 'monitoring.status', indicator: 'latency', description: 'États de santé' }
        ]
      }
    }

    monitoringServiceMock.getMetrics.mockImplementation(() => Promise.resolve(clone(fixtures.metrics)))
    monitoringServiceMock.getStatus.mockImplementation(() => Promise.resolve(clone(fixtures.status)))
    monitoringServiceMock.getHistory.mockImplementation(({ range }: { range: MonitoringHistoryRange }) =>
      Promise.resolve(clone(fixtures.history[range]))
    )
    monitoringServiceMock.getStreams.mockImplementation(() =>
      Promise.resolve(clone(fixtures.streams))
    )

    authServiceMock.getSession.mockResolvedValue({
      id: 'admin-1',
      email: 'ops@meetinity.test',
      name: 'Ops Admin',
      role: 'super-admin'
    })
    authServiceMock.getPermissions.mockResolvedValue({
      permissions: ['admin:access', 'monitoring:read', 'monitoring:manage'],
      roles: ['operations']
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    monitoringWebSocketRef.current?.reset()
    vi.unstubAllEnvs()
  })

  it('affiche les métriques initiales et les statuts de santé', async () => {
    render(
      <AuthProvider>
        <SystemMonitoringDashboard />
      </AuthProvider>
    )

    await waitFor(() => expect(monitoringServiceMock.getMetrics).toHaveBeenCalledTimes(1))

    const serviceCard = await screen.findByTestId('monitoring-service-auth-api')
    expect(serviceCard.getAttribute('data-status')).toBe('operational')

    expect(screen.getAllByTestId('monitoring-indicator-auth-api-cpu')[0].textContent).toContain('45.2')
    expect(screen.queryByText('Aucune alerte active')).not.toBeNull()
  })

  it('met à jour les indicateurs via le flux temps réel', async () => {
    render(
      <AuthProvider>
        <SystemMonitoringDashboard />
      </AuthProvider>
    )

    await waitFor(() => expect(getMonitoringSocket().subscriberCount()).toBeGreaterThan(0))

    await act(async () => {
      getMonitoringSocket().emit({
        type: 'metric',
        serviceId: 'auth-api',
        indicator: 'cpu',
        value: 95.1,
        timestamp: '2024-01-01T10:05:00.000Z'
      })
    })

    await waitFor(() => {
      const indicators = screen.getAllByTestId('monitoring-indicator-auth-api-cpu')
      expect(indicators.some(indicator => indicator.textContent?.includes('95.1'))).toBe(true)
      expect(indicators[indicators.length - 1].getAttribute('data-severity')).toBe('critical')
    })
  })

  it('rafraîchit l\'historique lors du changement de période', async () => {
    render(
      <AuthProvider>
        <SystemMonitoringDashboard />
      </AuthProvider>
    )

    await waitFor(() => expect(monitoringServiceMock.getHistory).toHaveBeenCalledWith({ range: '24h' }))

    await waitFor(() => expect(screen.queryAllByTestId('monitoring-range-7d').length).toBeGreaterThan(0))
    const sevenDayButton = screen.getAllByTestId('monitoring-range-7d')[0]

    await act(async () => {
      fireEvent.click(sevenDayButton)
    })

    await waitFor(() => expect(monitoringServiceMock.getHistory).toHaveBeenCalledWith({ range: '7d' }))

    await waitFor(() => {
      const historyEntries = screen.getAllByTestId('monitoring-history-auth-api-cpu')
      expect(historyEntries.some(entry => entry.textContent?.includes('62.50'))).toBe(true)
    })
  })
})

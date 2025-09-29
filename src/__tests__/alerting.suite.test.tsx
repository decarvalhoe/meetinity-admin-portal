/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import {
  type MonitoringHistoryRange,
  type MonitoringHistoryResponse,
  type MonitoringMetricsResponse,
  type MonitoringStatusResponse,
  type MonitoringStreamsResponse,
  MonitoringService
} from '../services/monitoringService'
import {
  AlertingService,
  type AlertRule,
  type EscalationPolicy,
  type NotificationChannel
} from '../services/alertingService'
import { SystemMonitoringDashboard } from '../components/monitoring/SystemMonitoringDashboard'
import { createMockWebSocket } from './utils/networkMocks'
import { AuthProvider } from '../hooks/usePermissions'
import { AuthService } from '../services/authService'

const monitoringWebSocketRef = vi.hoisted(() => ({
  current: null as ReturnType<typeof createMockWebSocket>['controller'] | null
}))

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

let monitoringFixtures: {
  metrics: MonitoringMetricsResponse
  status: MonitoringStatusResponse
  history: Record<MonitoringHistoryRange, MonitoringHistoryResponse>
  streams: MonitoringStreamsResponse
}

let alertFixtures: {
  rules: AlertRule[]
  channels: NotificationChannel[]
  escalations: EscalationPolicy[]
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

vi.mock('../services/alertingService', async () => {
  const actual = await vi.importActual<typeof import('../services/alertingService')>(
    '../services/alertingService'
  )

  return {
    ...actual,
    AlertingService: {
      listRules: vi.fn(),
      listChannels: vi.fn(),
      listEscalationPolicies: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn()
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

expect.extend(matchers)

const monitoringServiceMock = vi.mocked(MonitoringService)
const alertingServiceMock = vi.mocked(AlertingService)
const authServiceMock = vi.mocked(AuthService)

describe('Alerting management', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:4000')
    vi.stubEnv('VITE_WS_BASE_URL', 'ws://localhost:5000/ws')

    monitoringFixtures = {
      metrics: {
        generatedAt: '2024-01-01T10:00:00.000Z',
        services: [
          {
            id: 'auth-api',
            name: 'Auth API',
            description: "API d'authentification",
            environment: 'production',
            region: 'eu-west-1',
            status: 'operational',
            lastUpdatedAt: '2024-01-01T10:00:00.000Z',
            indicators: [
              {
                type: 'cpu',
                label: 'CPU',
                unit: '%',
                value: 42.5,
                thresholds: { warning: 70, critical: 90 }
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
            uptimePercentage: 99.9,
            lastCheckedAt: '2024-01-01T10:00:00.000Z'
          }
        ],
        incidents: [],
        updatedAt: '2024-01-01T10:00:00.000Z'
      },
      history: {
        '24h': {
          range: '24h',
          generatedAt: '2024-01-01T10:00:00.000Z',
          series: []
        },
        '7d': {
          range: '7d',
          generatedAt: '2024-01-01T10:00:00.000Z',
          series: []
        },
        '30d': {
          range: '30d',
          generatedAt: '2024-01-01T10:00:00.000Z',
          series: []
        }
      },
      streams: {
        socketPath: '/ws/monitoring',
        topics: []
      }
    }

    alertFixtures = {
      rules: [
        {
          id: 'rule-cpu-critical',
          name: 'CPU critique',
          description: 'Alerte critique sur la consommation CPU',
          severity: 'critical',
          enabled: true,
          conditions: [
            {
              metric: 'cpu',
              operator: 'gt',
              threshold: 85,
              window: { durationMinutes: 5, aggregation: 'avg' }
            }
          ],
          channelIds: ['channel-email'],
          escalation: {
            steps: [{ delayMinutes: 10, channelIds: ['channel-sms'] }],
            repeat: false
          },
          createdAt: '2024-01-01T08:00:00.000Z',
          updatedAt: '2024-01-01T09:00:00.000Z'
        }
      ],
      channels: [
        { id: 'channel-email', name: 'Astreinte', type: 'email', target: 'oncall@meetinity.test' },
        { id: 'channel-slack', name: 'On-call', type: 'slack', target: '#oncall-alerts' },
        { id: 'channel-sms', name: 'Escalade SMS', type: 'sms', target: '+33123456789' }
      ],
      escalations: [
        {
          id: 'policy-critical',
          name: 'Escalade critique',
          description: 'Prévenir le N2 puis le manager au bout de 30 minutes.',
          repeat: true,
          steps: [
            { delayMinutes: 0, channelIds: ['channel-email'] },
            { delayMinutes: 15, channelIds: ['channel-slack'] }
          ],
          createdAt: '2023-12-01T10:00:00.000Z',
          updatedAt: '2023-12-10T10:00:00.000Z'
        }
      ]
    }

    monitoringServiceMock.getMetrics.mockImplementation(() => Promise.resolve(clone(monitoringFixtures.metrics)))
    monitoringServiceMock.getStatus.mockImplementation(() => Promise.resolve(clone(monitoringFixtures.status)))
    monitoringServiceMock.getHistory.mockImplementation(({ range }: { range: MonitoringHistoryRange }) =>
      Promise.resolve(clone(monitoringFixtures.history[range]))
    )
    monitoringServiceMock.getStreams.mockImplementation(() => Promise.resolve(clone(monitoringFixtures.streams)))

    alertingServiceMock.listRules.mockImplementation(() => Promise.resolve(clone(alertFixtures.rules)))
    alertingServiceMock.listChannels.mockImplementation(() => Promise.resolve(clone(alertFixtures.channels)))
    alertingServiceMock.listEscalationPolicies.mockImplementation(() =>
      Promise.resolve(clone(alertFixtures.escalations))
    )
    alertingServiceMock.createRule.mockImplementation(async input => ({
      id: 'rule-created',
      name: input.name,
      description: input.description,
      severity: input.severity,
      enabled: input.enabled,
      conditions: input.conditions,
      channelIds: input.channelIds,
      escalation: input.escalation ?? null,
      createdAt: '2024-01-01T11:00:00.000Z',
      updatedAt: '2024-01-01T11:00:00.000Z'
    }))
    alertingServiceMock.updateRule.mockImplementation(async (ruleId, input) => ({
      id: ruleId,
      name: input.name,
      description: input.description,
      severity: input.severity,
      enabled: input.enabled,
      conditions: input.conditions,
      channelIds: input.channelIds,
      escalation: input.escalation ?? null,
      createdAt: '2024-01-01T08:00:00.000Z',
      updatedAt: '2024-01-01T12:00:00.000Z'
    }))

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
    cleanup()
    vi.clearAllMocks()
    monitoringWebSocketRef.current?.reset()
    vi.unstubAllEnvs()
  })

  it('crée une règle personnalisée avec escalade multi-canaux', async () => {
    alertFixtures.rules = []
    alertFixtures.escalations = []

    render(
      <AuthProvider>
        <SystemMonitoringDashboard />
      </AuthProvider>
    )

    await waitFor(() => expect(authServiceMock.getPermissions).toHaveBeenCalled())


    const [alertsTab] = screen.getAllByRole('tab', { name: 'Alertes' })
    fireEvent.click(alertsTab)

    await waitFor(() => expect(alertingServiceMock.listRules).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Nom de la règle'), { target: { value: 'CPU critique' } })
    const metricSelectCreate = await screen.findByLabelText('Métrique surveillée')
    await waitFor(() => expect(metricSelectCreate).not.toBeDisabled())
    fireEvent.change(metricSelectCreate, { target: { value: 'cpu' } })
    fireEvent.change(screen.getByLabelText(/Seuil/), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Fenêtre glissante (minutes)'), { target: { value: '5' } })

    const ruleChannels = screen.getByRole('group', { name: 'Canaux de notification' })
    fireEvent.click(within(ruleChannels).getByLabelText(/Email — Astreinte/))
    fireEvent.click(within(ruleChannels).getByLabelText(/Slack — On-call/))

    const firstStep = screen.getByTestId('escalation-step-0')
    fireEvent.change(within(firstStep).getByLabelText("Délai avant l'étape 1 (minutes)"), {
      target: { value: '10' }
    })
    const stepChannels = within(firstStep).getByRole('group', { name: 'Canaux pour cette étape' })
    fireEvent.click(within(stepChannels).getByLabelText(/Email — Astreinte/))
    fireEvent.click(within(stepChannels).getByLabelText(/Slack — On-call/))

    const saveButtonCreate = await screen.findByRole('button', { name: 'Sauvegarder la règle' })
    await waitFor(() => expect(saveButtonCreate).not.toBeDisabled())
    fireEvent.click(saveButtonCreate)

    await waitFor(() => expect(alertingServiceMock.createRule).toHaveBeenCalledTimes(1))

    const [payload] = alertingServiceMock.createRule.mock.calls[0]
    expect(payload.name).toBe('CPU critique')
    expect(payload.channelIds).toEqual(expect.arrayContaining(['channel-email', 'channel-slack']))
    expect(payload.escalation?.steps?.[0].delayMinutes).toBe(10)
    expect(payload.escalation?.steps?.[0].channelIds).toEqual(
      expect.arrayContaining(['channel-email', 'channel-slack'])
    )

    await screen.findByText('Règle « CPU critique » créée.')
    await screen.findByText('CPU critique')
  })

  it('met à jour une règle existante et applique un nouveau seuil', async () => {
    render(
      <AuthProvider>
        <SystemMonitoringDashboard />
      </AuthProvider>
    )

    await waitFor(() => expect(authServiceMock.getPermissions).toHaveBeenCalled())

    const [alertsTab] = screen.getAllByRole('tab', { name: 'Alertes' })
    fireEvent.click(alertsTab)

    await waitFor(() => expect(alertingServiceMock.listRules).toHaveBeenCalled())

    const ruleSelector = await screen.findByRole('button', { name: /CPU critique/ })
    fireEvent.click(ruleSelector)

    await screen.findByText('Modifier la règle « CPU critique »')

    const metricSelectUpdate = await screen.findByLabelText('Métrique surveillée')
    await waitFor(() => expect(metricSelectUpdate).not.toBeDisabled())

    const ruleChannelsGroup = screen.getByRole('group', { name: 'Canaux de notification' })
    const slackChannel = within(ruleChannelsGroup).getByLabelText(/Slack — On-call/) as HTMLInputElement
    await waitFor(() => expect(slackChannel).not.toBeDisabled())
    if (!slackChannel.checked) {
      fireEvent.click(slackChannel)
    }

    const thresholdInput = await screen.findByLabelText(/Seuil/)
    fireEvent.change(thresholdInput, { target: { value: '90' } })

    const saveButtonUpdate = await screen.findByRole('button', { name: 'Sauvegarder la règle' })
    await waitFor(() => expect(saveButtonUpdate).not.toBeDisabled())
    const updateForm = saveButtonUpdate.closest('form')
    expect(updateForm).not.toBeNull()
    fireEvent.submit(updateForm as HTMLFormElement)

    await waitFor(() => expect(alertingServiceMock.updateRule).toHaveBeenCalledTimes(1))

    const [ruleId, payload] = alertingServiceMock.updateRule.mock.calls[0]
    expect(ruleId).toBe('rule-cpu-critical')
    expect(payload.conditions[0].threshold).toBe(90)
    await screen.findByText('Règle « CPU critique » mise à jour.')
  })

  it('permet de sélectionner une politique d’escalade existante', async () => {
    alertFixtures.rules = []

    render(
      <AuthProvider>
        <SystemMonitoringDashboard />
      </AuthProvider>
    )

    await waitFor(() => expect(authServiceMock.getPermissions).toHaveBeenCalled())
    const [alertsTab] = screen.getAllByRole('tab', { name: 'Alertes' })
    fireEvent.click(alertsTab)

    await waitFor(() => expect(alertingServiceMock.listRules).toHaveBeenCalled())
    await waitFor(() => expect(alertingServiceMock.listEscalationPolicies).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Nom de la règle'), { target: { value: 'Latence élevée' } })
    const metricSelectPolicy = await screen.findByLabelText('Métrique surveillée')
    await waitFor(() => expect(metricSelectPolicy).not.toBeDisabled())
    fireEvent.change(metricSelectPolicy, { target: { value: 'cpu' } })
    fireEvent.change(screen.getByLabelText(/Seuil/), { target: { value: '75' } })
    fireEvent.change(screen.getByLabelText('Fenêtre glissante (minutes)'), { target: { value: '3' } })

    const ruleChannels = screen.getByRole('group', { name: 'Canaux de notification' })
    fireEvent.click(within(ruleChannels).getByLabelText(/SMS — Escalade SMS/))

    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder la règle' }))

    await waitFor(() => expect(alertingServiceMock.createRule).toHaveBeenCalledTimes(1))

    const [payload] = alertingServiceMock.createRule.mock.calls[0]
    expect(payload.escalation).toEqual({ policyId: 'policy-critical', repeat: true })
    await screen.findByText('Règle « Latence élevée » créée.')
  })
})


import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MONITORING_INDICATOR_LABELS,
  MONITORING_INDICATOR_UNITS,
  type MonitoredService,
  type MonitoringHistoryRange,
  type MonitoringHistoryResponse,
  type MonitoringHistorySeries,
  type MonitoringIndicatorType,
  type MonitoringMetricsResponse,
  type MonitoringStatusResponse,
  type MonitoringStreamsResponse,
  type MonitoringIncident,
  type ServiceIndicatorSnapshot,
  type ServiceStatusSummary,
  MonitoringService
} from '../../services/monitoringService'
import { useWebSocket } from '../../hooks/useWebSocket'
import { usePermissions } from '../../hooks/usePermissions'
import { ServiceHealthCard } from './ServiceHealthCard'
import { MetricsTimeline } from './MetricsTimeline'
import { StatusLegend } from './StatusLegend'
import {
  AlertingService,
  type AlertRule,
  type AlertRuleInput,
  type EscalationPolicy,
  type NotificationChannel
} from '../../services/alertingService'
import { AlertRuleBuilder, type AlertMetricOption } from './AlertRuleBuilder'

interface CombinedServiceEntry {
  service: MonitoredService
  status?: ServiceStatusSummary
  incidents: MonitoringIncident[]
}

interface MetricRealtimeMessage {
  type: 'metric'
  serviceId: string
  indicator: MonitoringIndicatorType
  value: number
  unit?: string
  status?: ServiceStatusSummary['status']
  trend?: number
  timestamp: string
}

interface StatusRealtimeMessage {
  type: 'status'
  serviceId: string
  status: ServiceStatusSummary['status']
  uptimePercentage?: number
  lastCheckedAt?: string
  lastIncidentAt?: string
  acknowledgement?: ServiceStatusSummary['acknowledgement']
}

interface IncidentRealtimeMessage {
  type: 'incident'
  incident: MonitoringIncident
}

type MonitoringRealtimePayload =
  | MetricRealtimeMessage
  | StatusRealtimeMessage
  | IncidentRealtimeMessage
  | Record<string, unknown>

type MonitoringDashboardTab = 'overview' | 'alerts'

const DEFAULT_STREAM_PATH = '/ws/monitoring'

function buildSocketUrl(streamConfig: MonitoringStreamsResponse | null) {
  if (!streamConfig) {
    return null
  }

  const basePath = streamConfig.socketPath || DEFAULT_STREAM_PATH
  const normalisedPath = basePath.startsWith('/') ? basePath : `/${basePath}`

  const wsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (wsBase) {
    return `${wsBase}${normalisedPath}`
  }

  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (!apiBase) {
    return null
  }

  if (apiBase.startsWith('http')) {
    return `${apiBase.replace(/^http/, 'ws')}${normalisedPath}`
  }

  return `ws://${apiBase}${normalisedPath}`
}

function upsertIndicator(
  service: MonitoredService,
  indicatorType: MonitoringIndicatorType,
  updater: (indicator: ServiceIndicatorSnapshot | null) => ServiceIndicatorSnapshot
): ServiceIndicatorSnapshot[] {
  const indicators = service.indicators || []
  const existingIndex = indicators.findIndex(indicator => indicator.type === indicatorType)

  if (existingIndex === -1) {
    const created = updater(null)
    return [...indicators, created]
  }

  const nextIndicators = [...indicators]
  nextIndicators[existingIndex] = updater(nextIndicators[existingIndex])
  return nextIndicators
}

export function SystemMonitoringDashboard() {
  const { hasPermissions } = usePermissions()
  const [activeTab, setActiveTab] = useState<MonitoringDashboardTab>('overview')
  const [snapshot, setSnapshot] = useState<MonitoringMetricsResponse | null>(null)
  const [statusSnapshot, setStatusSnapshot] = useState<MonitoringStatusResponse | null>(null)
  const [historyRange, setHistoryRange] = useState<MonitoringHistoryRange>('24h')
  const [history, setHistory] = useState<MonitoringHistoryResponse | null>(null)
  const [streamConfig, setStreamConfig] = useState<MonitoringStreamsResponse | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([])
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([])
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [alertsLoaded, setAlertsLoaded] = useState(false)
  const [isAlertsLoading, setIsAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [isSavingRule, setIsSavingRule] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const canManageAlerts = useMemo(() => hasPermissions(['monitoring:manage']), [hasPermissions])
  const selectedRule = useMemo(
    () => (selectedRuleId ? alertRules.find(rule => rule.id === selectedRuleId) ?? null : null),
    [alertRules, selectedRuleId]
  )
  const availableMetrics = useMemo<AlertMetricOption[]>(() => {
    const map = new Map<string, AlertMetricOption>()
    snapshot?.services.forEach(service => {
      service.indicators?.forEach(indicator => {
        if (!map.has(indicator.type)) {
          map.set(indicator.type, {
            id: indicator.type,
            label: `${indicator.label} (${indicator.unit ?? MONITORING_INDICATOR_UNITS[indicator.type] ?? ''})`,
            unit: indicator.unit ?? MONITORING_INDICATOR_UNITS[indicator.type]
          })
        }
      })
    })
    return Array.from(map.values())
  }, [snapshot])

  const loadSnapshot = useCallback(async () => {
    setIsSnapshotLoading(true)
    setSnapshotError(null)
    try {
      const [metrics, status] = await Promise.all([
        MonitoringService.getMetrics({ range: '24h' }),
        MonitoringService.getStatus()
      ])
      setSnapshot(metrics)
      setStatusSnapshot(status)
    } catch (error) {
      console.error('Failed to load monitoring snapshot', error)
      setSnapshotError("Impossible de récupérer les métriques. Réessayez plus tard.")
    } finally {
      setIsSnapshotLoading(false)
    }
  }, [])

  const loadHistory = useCallback(
    async (range: MonitoringHistoryRange) => {
      setIsHistoryLoading(true)
      setHistoryError(null)
      try {
        const data = await MonitoringService.getHistory({ range })
        setHistory(data)
      } catch (error) {
        console.error('Failed to load monitoring history', error)
        setHistoryError('La récupération de l\'historique a échoué.')
      } finally {
        setIsHistoryLoading(false)
      }
    },
    []
  )

  const loadAlertingResources = useCallback(async () => {
    setIsAlertsLoading(true)
    setAlertsError(null)
    try {
      const [rules, channels, policies] = await Promise.all([
        AlertingService.listRules(),
        AlertingService.listChannels(),
        AlertingService.listEscalationPolicies()
      ])
      setAlertRules(rules)
      setNotificationChannels(channels)
      setEscalationPolicies(policies)
      setAlertsLoaded(true)
      setSaveError(null)
      setSaveMessage(null)
      if (rules.length > 0) {
        setSelectedRuleId(previous => {
          if (previous && rules.some(rule => rule.id === previous)) {
            return previous
          }
          return rules[0].id
        })
      } else {
        setSelectedRuleId(null)
      }
    } catch (error) {
      console.error('Failed to load alerting resources', error)
      setAlertsError("Impossible de récupérer les règles d'alerte. Réessayez plus tard.")
    } finally {
      setIsAlertsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    MonitoringService.getStreams()
      .then(config => {
        if (isMounted) {
          setStreamConfig(config)
        }
      })
      .catch(error => {
        console.warn('Failed to load monitoring streams configuration', error)
        if (isMounted) {
          setStreamConfig({ socketPath: DEFAULT_STREAM_PATH, topics: [] })
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    loadSnapshot()
  }, [loadSnapshot])

  useEffect(() => {
    loadHistory(historyRange)
  }, [historyRange, loadHistory])

  useEffect(() => {
    if (activeTab === 'alerts' && !alertsLoaded && !isAlertsLoading) {
      loadAlertingResources()
    }
  }, [activeTab, alertsLoaded, isAlertsLoading, loadAlertingResources])

  const socketUrl = useMemo(() => buildSocketUrl(streamConfig), [streamConfig])

  const { readyState: socketState, subscribe: subscribeToStream } = useWebSocket(socketUrl, {
    enabled: Boolean(socketUrl),
    reconnectInterval: 4000,
    maxReconnectInterval: 30000
  })

  const handleRealtimeMessage = useCallback(
    (event: MessageEvent) => {
      let payload: MonitoringRealtimePayload
      try {
        payload = JSON.parse(event.data as string)
      } catch (error) {
        console.warn('Received invalid monitoring message', error)
        return
      }

      if (!payload || typeof payload !== 'object') {
        return
      }

      if (payload.type === 'metric' && 'serviceId' in payload && 'indicator' in payload) {
        const message = payload as MetricRealtimeMessage
        setSnapshot(prev => {
          if (!prev) {
            return prev
          }

          const serviceIndex = prev.services.findIndex(service => service.id === message.serviceId)
          const services = [...prev.services]
          let service: MonitoredService

          if (serviceIndex === -1) {
            service = {
              id: message.serviceId,
              name: message.serviceId,
              environment: 'production',
              status: message.status ?? 'operational',
              indicators: []
            }
            services.push(service)
          } else {
            service = { ...services[serviceIndex] }
            service.status = message.status ?? service.status
            services[serviceIndex] = service
          }

          service.indicators = upsertIndicator(service, message.indicator, indicator => {
            const base: ServiceIndicatorSnapshot =
              indicator ?? {
                type: message.indicator,
                label: MONITORING_INDICATOR_LABELS[message.indicator],
                unit: message.unit || MONITORING_INDICATOR_UNITS[message.indicator],
                value: 0,
                thresholds: {
                  warning: message.indicator === 'latency' ? 250 : 70,
                  critical: message.indicator === 'latency' ? 400 : 90
                }
              }

            return {
              ...base,
              unit: message.unit || base.unit,
              value: message.value,
              trend: message.trend ?? base.trend,
              lastUpdatedAt: message.timestamp
            }
          })

          return { ...prev, services }
        })

        setHistory(prev => {
          if (!prev) {
            return prev
          }

          const nextSeries: MonitoringHistorySeries[] = prev.series.map(series =>
            series.serviceId === message.serviceId && series.indicator === message.indicator
              ? {
                  ...series,
                  points: [...series.points, { timestamp: message.timestamp, value: message.value }]
                }
              : series
          )

          const exists = nextSeries.some(
            series => series.serviceId === message.serviceId && series.indicator === message.indicator
          )

          if (!exists) {
            nextSeries.push({
              serviceId: message.serviceId,
              serviceName: message.serviceId,
              indicator: message.indicator,
              points: [{ timestamp: message.timestamp, value: message.value }]
            })
          }

          return { ...prev, series: nextSeries }
        })
        return
      }

      if (payload.type === 'status' && 'serviceId' in payload) {
        const message = payload as StatusRealtimeMessage
        setStatusSnapshot(prev => {
          if (!prev) {
            return prev
          }

          const services = prev.services.some(service => service.id === message.serviceId)
            ? prev.services.map(service =>
                service.id === message.serviceId
                  ? {
                      ...service,
                      status: message.status,
                      uptimePercentage: message.uptimePercentage ?? service.uptimePercentage,
                      lastIncidentAt: message.lastIncidentAt ?? service.lastIncidentAt,
                      lastCheckedAt: message.lastCheckedAt ?? service.lastCheckedAt,
                      acknowledgement: message.acknowledgement ?? service.acknowledgement
                    }
                  : service
              )
            : [
                ...prev.services,
                {
                  id: message.serviceId,
                  name: message.serviceId,
                  status: message.status,
                  uptimePercentage: message.uptimePercentage ?? 100,
                  lastCheckedAt: message.lastCheckedAt ?? new Date().toISOString()
                }
              ]

          return { ...prev, services }
        })
        return
      }

      if (payload.type === 'incident' && 'incident' in payload) {
        const { incident } = payload as IncidentRealtimeMessage
        setStatusSnapshot(prev => {
          if (!prev) {
            return prev
          }

          const incidents = prev.incidents.filter(item => item.id !== incident.id)
          if (!incident.resolvedAt) {
            incidents.push(incident)
          }

          const services = prev.services.map(service =>
            service.id === incident.serviceId
              ? {
                  ...service,
                  ongoingIncident: incident.resolvedAt ? undefined : incident
                }
              : service
          )

          return { ...prev, incidents, services }
        })
      }
    },
    []
  )

  useEffect(() => {
    if (!socketUrl) {
      return undefined
    }
    return subscribeToStream(handleRealtimeMessage)
  }, [socketUrl, subscribeToStream, handleRealtimeMessage])

  const handleSelectRule = (ruleId: string) => {
    setSelectedRuleId(ruleId)
    setSaveError(null)
    setSaveMessage(null)
  }

  const handleCreateNewRule = () => {
    setSelectedRuleId(null)
    setSaveError(null)
    setSaveMessage(null)
  }

  const handleSaveRule = useCallback(
    async (input: AlertRuleInput) => {
      if (!canManageAlerts) {
        const message = "Vous n'avez pas la permission de gérer les alertes."
        setSaveError(message)
        setSaveMessage(null)
        throw new Error(message)
      }

      setIsSavingRule(true)
      setSaveError(null)
      setSaveMessage(null)

      try {
        if (selectedRuleId) {
          const updatedRule = await AlertingService.updateRule(selectedRuleId, input)
          setAlertRules(prev =>
            prev.map(rule => (rule.id === updatedRule.id ? updatedRule : rule))
          )
          setSelectedRuleId(updatedRule.id)
          setSaveMessage(`Règle « ${updatedRule.name} » mise à jour.`)
        } else {
          const createdRule = await AlertingService.createRule(input)
          setAlertRules(prev => [createdRule, ...prev])
          setSelectedRuleId(createdRule.id)
          setSaveMessage(`Règle « ${createdRule.name} » créée.`)
        }
      } catch (error) {
        console.error('Failed to save alert rule', error)
        const message =
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer la règle d'alerte."
        setSaveError(message)
        setSaveMessage(null)
        throw new Error(message)
      } finally {
        setIsSavingRule(false)
      }
    },
    [selectedRuleId, canManageAlerts]
  )

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    borderRadius: '999px',
    border: '1px solid',
    borderColor: isActive ? '#2563eb' : '#cbd5f5',
    backgroundColor: isActive ? '#2563eb' : '#fff',
    color: isActive ? '#fff' : '#1f2937',
    fontWeight: 600,
    cursor: 'pointer'
  })

  const combinedServices = useMemo<CombinedServiceEntry[]>(() => {
    const entries = new Map<string, CombinedServiceEntry>()

    snapshot?.services.forEach(service => {
      entries.set(service.id, {
        service,
        status: undefined,
        incidents: []
      })
    })

    statusSnapshot?.services.forEach(status => {
      const existing = entries.get(status.id)
      if (existing) {
        existing.status = status
        existing.service = {
          ...existing.service,
          status: status.status,
          environment: existing.service.environment || status.environment || 'production'
        }
      } else {
        entries.set(status.id, {
          service: {
            id: status.id,
            name: status.name,
            environment: status.environment || 'production',
            region: status.region,
            status: status.status,
            indicators: []
          },
          status,
          incidents: []
        })
      }
    })

    const incidentsByService = new Map<string, MonitoringIncident[]>()
    statusSnapshot?.incidents.forEach(incident => {
      const collection = incidentsByService.get(incident.serviceId) ?? []
      collection.push(incident)
      incidentsByService.set(incident.serviceId, collection)
    })

    incidentsByService.forEach((incidentList, serviceId) => {
      const existing = entries.get(serviceId)
      if (existing) {
        existing.incidents = incidentList
      } else {
        entries.set(serviceId, {
          service: {
            id: serviceId,
            name: serviceId,
            environment: 'production',
            status: 'degraded',
            indicators: []
          },
          incidents: incidentList,
          status: undefined
        })
      }
    })

    return Array.from(entries.values()).sort((a, b) => a.service.name.localeCompare(b.service.name))
  }, [snapshot, statusSnapshot])

  const isRealtimeConnected = socketState === 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Monitoring des systèmes</h1>
            <p style={{ margin: '6px 0 0', color: '#475569', maxWidth: '640px' }}>
              Surveillez en temps réel les services critiques, analysez les tendances sur 24h, 7j et 30j et
              anticipez les alertes avant qu'elles n'impactent vos utilisateurs.
            </p>
          </div>
          <div
            data-testid="monitoring-realtime-indicator"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.875rem',
              color: isRealtimeConnected ? '#0f172a' : '#ef4444'
            }}
          >
            <span
              aria-hidden
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                backgroundColor: isRealtimeConnected ? '#22c55e' : '#ef4444'
              }}
            />
            {isRealtimeConnected ? 'Flux temps réel actif' : 'Flux temps réel indisponible'}
          </div>
        </div>
      </header>

      <nav
        role="tablist"
        aria-label="Sections de surveillance"
        style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          style={tabButtonStyle(activeTab === 'overview')}
        >
          Santé & métriques
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'alerts'}
          onClick={() => {
            setActiveTab('alerts')
          }}
          style={tabButtonStyle(activeTab === 'alerts')}
        >
          Alertes
        </button>
      </nav>

      {activeTab === 'overview' && (
        <>
          <StatusLegend />
          {snapshotError && (
            <div
              role="alert"
              style={{
                background: 'rgba(248, 113, 113, 0.1)',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '12px'
              }}
            >
              {snapshotError}
            </div>
          )}

          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Santé des services</h2>
              <span style={{ fontSize: '0.875rem', color: '#475569' }}>
                Dernière mise à jour :{' '}
                {snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleString() : '—'}
              </span>
            </div>
            {isSnapshotLoading ? (
              <p style={{ margin: '16px 0', color: '#64748b' }}>Chargement des indicateurs...</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px'
                }}
              >
                {combinedServices.map(entry => (
                  <ServiceHealthCard
                    key={entry.service.id}
                    service={entry.service}
                    status={entry.status}
                    incidents={entry.incidents}
                  />
                ))}
              </div>
            )}
          </section>

          {historyError && (
            <div
              role="alert"
              style={{
                background: 'rgba(248, 113, 113, 0.1)',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '12px'
              }}
            >
              {historyError}
            </div>
          )}

          <MetricsTimeline
            range={historyRange}
            series={history?.series ?? []}
            isLoading={isHistoryLoading}
            onRangeChange={setHistoryRange}
          />
        </>
      )}

      {activeTab === 'alerts' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {alertsError && (
            <div
              role="alert"
              style={{
                background: 'rgba(248, 113, 113, 0.1)',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '12px'
              }}
            >
              {alertsError}
            </div>
          )}
          {isAlertsLoading ? (
            <p style={{ margin: '16px 0', color: '#64748b' }}>Chargement des règles d'alerte...</p>
          ) : (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <aside
                style={{
                  flex: '0 0 320px',
                  maxWidth: '320px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Règles configurées</h3>
                  <button
                    type="button"
                    onClick={handleCreateNewRule}
                    disabled={!canManageAlerts}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #2563eb',
                      backgroundColor: canManageAlerts ? '#2563eb' : '#cbd5f5',
                      color: '#fff',
                      cursor: canManageAlerts ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Nouvelle règle
                  </button>
                </div>
                {alertRules.length === 0 ? (
                  <p style={{ margin: '12px 0', color: '#64748b' }}>
                    Aucune règle d'alerte configurée pour le moment.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alertRules.map(ruleItem => {
                      const isSelected = selectedRuleId === ruleItem.id
                      return (
                        <li key={ruleItem.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectRule(ruleItem.id)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              border: '1px solid',
                              borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                              backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{ruleItem.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                              {ruleItem.severity === 'critical' ? 'Critique' : 'Avertissement'} ·{' '}
                              {ruleItem.conditions[0]?.metric ?? '—'}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </aside>
              <div style={{ flex: '1 1 420px', minWidth: '320px' }}>
                <AlertRuleBuilder
                  key={selectedRuleId ?? 'new-rule'}
                  rule={selectedRule}
                  metrics={availableMetrics}
                  channels={notificationChannels}
                  escalationPolicies={escalationPolicies}
                  onSave={handleSaveRule}
                  canManage={canManageAlerts}
                  isSaving={isSavingRule}
                  error={saveError}
                  successMessage={saveMessage}
                />
                {!canManageAlerts && (
                  <p style={{ marginTop: '12px', color: '#991b1b' }}>
                    Vous avez besoin de la permission « monitoring:manage » pour modifier les règles d'alerte.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

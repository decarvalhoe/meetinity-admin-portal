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
import { ServiceHealthCard } from './ServiceHealthCard'
import { MetricsTimeline } from './MetricsTimeline'
import { StatusLegend } from './StatusLegend'

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
  const [snapshot, setSnapshot] = useState<MonitoringMetricsResponse | null>(null)
  const [statusSnapshot, setStatusSnapshot] = useState<MonitoringStatusResponse | null>(null)
  const [historyRange, setHistoryRange] = useState<MonitoringHistoryRange>('24h')
  const [history, setHistory] = useState<MonitoringHistoryResponse | null>(null)
  const [streamConfig, setStreamConfig] = useState<MonitoringStreamsResponse | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

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
        <StatusLegend />
      </header>

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
            Dernière mise à jour : {snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleString() : '—'}
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
    </div>
  )
}

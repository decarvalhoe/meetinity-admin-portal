import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL

export type MonitoringIndicatorType = 'cpu' | 'memory' | 'latency' | 'errors'

export type MonitoringHealthStatus = 'operational' | 'degraded' | 'critical' | 'maintenance'

export const MONITORING_INDICATOR_LABELS: Record<MonitoringIndicatorType, string> = {
  cpu: 'CPU',
  memory: 'Mémoire',
  latency: 'Latence',
  errors: 'Erreurs'
}

export const MONITORING_INDICATOR_UNITS: Record<MonitoringIndicatorType, string> = {
  cpu: '%',
  memory: '%',
  latency: 'ms',
  errors: 'err/min'
}

export const MONITORING_STATUS_COLORS: Record<MonitoringHealthStatus, string> = {
  operational: '#15803d',
  degraded: '#f59e0b',
  critical: '#dc2626',
  maintenance: '#6b7280'
}

export const MONITORING_STATUS_LABELS: Record<MonitoringHealthStatus, string> = {
  operational: 'Opérationnel',
  degraded: 'Dégradé',
  critical: 'Critique',
  maintenance: 'Maintenance'
}

export interface IndicatorThreshold {
  warning: number
  critical: number
}

export interface ServiceIndicatorSnapshot {
  type: MonitoringIndicatorType
  label: string
  value: number
  unit: string
  trend?: number
  thresholds: IndicatorThreshold
  lastUpdatedAt?: string
}

export interface MonitoredService {
  id: string
  name: string
  description?: string
  environment: string
  region?: string
  ownerTeam?: string
  status: MonitoringHealthStatus
  lastUpdatedAt?: string
  indicators: ServiceIndicatorSnapshot[]
}

export interface MonitoringMetricsParams {
  range?: '15m' | '1h' | '24h'
  services?: string[]
  includeHistory?: boolean
}

export interface MonitoringMetricsResponse {
  generatedAt: string
  services: MonitoredService[]
}

export interface MonitoringIncident {
  id: string
  serviceId: string
  severity: 'warning' | 'critical'
  indicator: MonitoringIndicatorType
  message: string
  startedAt: string
  acknowledged?: boolean
  acknowledgedBy?: string
  resolvedAt?: string
}

export interface ServiceStatusAcknowledgement {
  acknowledgedBy: string
  acknowledgedAt: string
}

export interface ServiceStatusSummary {
  id: string
  name: string
  status: MonitoringHealthStatus
  environment?: string
  region?: string
  uptimePercentage: number
  lastCheckedAt: string
  lastIncidentAt?: string
  acknowledgement?: ServiceStatusAcknowledgement
  ongoingIncident?: MonitoringIncident
}

export interface MonitoringStatusResponse {
  services: ServiceStatusSummary[]
  incidents: MonitoringIncident[]
  updatedAt: string
}

export type MonitoringHistoryRange = '24h' | '7d' | '30d'

export interface MonitoringMetricPoint {
  timestamp: string
  value: number
}

export interface MonitoringHistorySeries {
  serviceId: string
  serviceName?: string
  indicator: MonitoringIndicatorType
  points: MonitoringMetricPoint[]
}

export interface MonitoringHistoryResponse {
  range: MonitoringHistoryRange
  series: MonitoringHistorySeries[]
  generatedAt: string
}

export interface MonitoringHistoryParams {
  range: MonitoringHistoryRange
  serviceId?: string
  indicator?: MonitoringIndicatorType
}

export interface MonitoringStreamTopic {
  topic: string
  indicator?: MonitoringIndicatorType
  description?: string
}

export interface MonitoringStreamsResponse {
  socketPath: string
  topics: MonitoringStreamTopic[]
  heartbeatInterval?: number
}

export const MonitoringService = {
  async getMetrics(params?: MonitoringMetricsParams) {
    const { data } = await axios.get(`${API}/api/monitoring/metrics`, { params })
    return data as MonitoringMetricsResponse
  },
  async getStatus() {
    const { data } = await axios.get(`${API}/api/monitoring/status`)
    return data as MonitoringStatusResponse
  },
  async getHistory(params: MonitoringHistoryParams) {
    const { data } = await axios.get(`${API}/api/monitoring/history`, { params })
    return data as MonitoringHistoryResponse
  },
  async getStreams() {
    const { data } = await axios.get(`${API}/api/monitoring/streams`)
    return data as MonitoringStreamsResponse
  }
}

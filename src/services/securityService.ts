import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical'

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  low: 'Faible',
  medium: 'Modérée',
  high: 'Élevée',
  critical: 'Critique'
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  resourceId?: string
  resourceType?: string
  ipAddress?: string
  location?: string
  severity: AuditSeverity
  metadata?: Record<string, unknown>
}

export interface AuditLogFilters {
  search?: string
  actor?: string
  resourceType?: string
  severity?: AuditSeverity
  dateFrom?: string
  dateTo?: string
}

export interface AuditLogQuery extends AuditLogFilters {
  page?: number
  pageSize?: number
  sort?: string
}

export type GdprRequestType =
  | 'data_access'
  | 'data_portability'
  | 'erasure'
  | 'rectification'
  | 'consent_withdrawal'

export type GdprRequestStatus =
  | 'received'
  | 'in_progress'
  | 'awaiting_confirmation'
  | 'completed'
  | 'rejected'

export const GDPR_STATUS_LABELS: Record<GdprRequestStatus, string> = {
  received: 'Reçue',
  in_progress: 'En cours',
  awaiting_confirmation: 'En attente de confirmation',
  completed: 'Terminée',
  rejected: 'Rejetée'
}

export interface GdprRequest {
  id: string
  userId: string
  userEmail: string
  type: GdprRequestType
  submittedAt: string
  dueAt?: string
  status: GdprRequestStatus
  assignedTo?: string
  notes?: string
  lastUpdatedAt?: string
}

export interface GdprRequestListResponse {
  requests: GdprRequest[]
  total: number
}

export interface UpdateGdprStatusPayload {
  status: GdprRequestStatus
  assigneeId?: string
  note?: string
}

export interface ConfirmGdprActionPayload {
  confirmationMessage?: string
  confirmedBy?: string
}

export interface IncidentStep {
  id: string
  title: string
  description?: string
  owner?: string
  expectedCompletionMinutes?: number
}

export interface IncidentActionLog {
  id: string
  stepId: string
  actor: string
  note?: string
  timestamp: string
  status?: 'pending' | 'completed' | 'skipped'
}

export interface IncidentPlaybook {
  id: string
  name: string
  description?: string
  severity: AuditSeverity
  category: 'availability' | 'privacy' | 'integrity' | 'other'
  steps: IncidentStep[]
  actionLog?: IncidentActionLog[]
}

export interface IncidentActionPayload {
  stepId: string
  note?: string
  status?: 'pending' | 'completed' | 'skipped'
}

export interface ComplianceReport {
  id: string
  name: string
  period: string
  framework: 'SOC2' | 'ISO27001' | 'GDPR' | 'Custom'
  generatedAt: string
  status: 'in_progress' | 'available' | 'archived'
  format: 'pdf' | 'csv' | 'json'
}

export interface AuditLogResponse {
  logs: AuditLogEntry[]
  total: number
}

export interface IncidentPlaybookResponse {
  playbooks: IncidentPlaybook[]
}

export interface ComplianceReportResponse {
  reports: ComplianceReport[]
}

export const SecurityService = {
  async listAuditLogs(params: AuditLogQuery) {
    const query = {
      ...params,
      search: params.search || undefined,
      actor: params.actor || undefined,
      resourceType: params.resourceType || undefined,
      severity: params.severity || undefined,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined
    }

    const { data } = await axios.get(`${API}/api/security/audit-logs`, { params: query })
    return data as AuditLogResponse
  },

  async exportAuditLogs(format: 'csv' | 'json', params: AuditLogQuery) {
    const query = {
      ...params,
      search: params.search || undefined,
      actor: params.actor || undefined,
      resourceType: params.resourceType || undefined,
      severity: params.severity || undefined,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
      format
    }

    const { data } = await axios.get(`${API}/api/security/audit-logs/export`, {
      params: query,
      responseType: 'blob'
    })
    return data as Blob
  },

  async listGdprRequests() {
    const { data } = await axios.get(`${API}/api/security/gdpr/requests`)
    return data as GdprRequestListResponse
  },

  async updateGdprRequestStatus(requestId: string, payload: UpdateGdprStatusPayload) {
    const { data } = await axios.post(
      `${API}/api/security/gdpr/requests/${requestId}/status`,
      payload
    )
    return data as GdprRequest
  },

  async confirmGdprAction(requestId: string, payload: ConfirmGdprActionPayload = {}) {
    const { data } = await axios.post(
      `${API}/api/security/gdpr/requests/${requestId}/confirm`,
      payload
    )
    return data as GdprRequest
  },

  async downloadGdprArchive(requestId: string) {
    const { data } = await axios.get(`${API}/api/security/gdpr/requests/${requestId}/archive`, {
      responseType: 'blob'
    })
    return data as Blob
  },

  async listIncidentPlaybooks() {
    const { data } = await axios.get(`${API}/api/security/incidents/playbooks`)
    return data as IncidentPlaybookResponse
  },

  async logIncidentAction(playbookId: string, payload: IncidentActionPayload) {
    const { data } = await axios.post(
      `${API}/api/security/incidents/playbooks/${playbookId}/actions`,
      payload
    )
    return data as IncidentActionLog
  },

  async listComplianceReports() {
    const { data } = await axios.get(`${API}/api/security/compliance/reports`)
    return data as ComplianceReportResponse
  },

  async downloadComplianceReport(reportId: string) {
    const { data } = await axios.get(
      `${API}/api/security/compliance/reports/${reportId}/download`,
      {
        responseType: 'blob'
      }
    )
    return data as Blob
  }
}

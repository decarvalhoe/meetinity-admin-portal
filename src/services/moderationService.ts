import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL

export type ModerationStatus =
  | 'pending'
  | 'under_review'
  | 'action_taken'
  | 'dismissed'
  | 'escalated'

export type ModerationSeverity = 'low' | 'medium' | 'high'

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: 'En attente',
  under_review: 'En cours',
  action_taken: 'Action effectuée',
  dismissed: 'Rejeté',
  escalated: 'Escaladé'
}

export interface ModerationFilters {
  search?: string
  status?: ModerationStatus | 'all'
  severity?: ModerationSeverity | 'all'
  contentType?: string
  ruleId?: string
}

export interface ReportedContent {
  id: string
  contentId: string
  contentType: string
  snippet: string
  reporterId: string
  reporterName?: string
  reason: string
  status: ModerationStatus
  severity: ModerationSeverity
  assignedTo?: string
  evidenceUrls?: string[]
  createdAt: string
  updatedAt?: string
  metadata?: Record<string, unknown>
}

export interface ReportListParams extends ModerationFilters {
  page?: number
  pageSize?: number
  sort?: string
  assignedTo?: string
}

export type ModerationDecisionAction =
  | 'dismiss'
  | 'remove'
  | 'restrict'
  | 'warn'
  | 'ban'
  | 'escalate'

export interface ModerationDecisionPayload {
  action: ModerationDecisionAction
  comment: string
  escalate?: boolean
  metadata?: Record<string, unknown>
}

export interface ModerationRule {
  id: string
  name: string
  description?: string
  enabled: boolean
  priority: number
  severity: ModerationSeverity
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  lastTriggeredAt?: string
}

export interface ModerationRuleInput {
  name: string
  description?: string
  severity: ModerationSeverity
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
}

export interface AuditTrailEntry extends Record<string, unknown> {
  id: string
  timestamp: string
  actor: string
  action: string
  targetId: string
  targetType: string
  details?: Record<string, unknown>
  status?: ModerationStatus
}

export interface ModerationAppeal {
  id: string
  reportId: string
  userId: string
  userName?: string
  submittedAt: string
  status: 'pending' | 'approved' | 'rejected'
  notes?: string
  decision?: string
  lastUpdatedAt?: string
}

export interface AuditTrailParams extends ModerationFilters {
  page?: number
  pageSize?: number
}

export interface AppealsParams extends ModerationFilters {
  page?: number
  pageSize?: number
  status?: ModerationAppeal['status'] | 'all'
}

export const ModerationService = {
  async listReports(params: ReportListParams) {
    const query = {
      ...params,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      severity: params.severity && params.severity !== 'all' ? params.severity : undefined,
      contentType: params.contentType && params.contentType !== 'all' ? params.contentType : undefined,
      ruleId: params.ruleId || undefined
    }

    const { data } = await axios.get(`${API}/api/moderation/reports`, { params: query })
    return data as { reports: ReportedContent[]; total: number }
  },

  async getReport(reportId: string) {
    const { data } = await axios.get(`${API}/api/moderation/reports/${reportId}`)
    return data as ReportedContent
  },

  async submitDecision(reportId: string, payload: ModerationDecisionPayload) {
    const { data } = await axios.post(`${API}/api/moderation/reports/${reportId}/decisions`, payload)
    return data as ReportedContent
  },

  async assignReport(reportId: string, assigneeId: string) {
    const { data } = await axios.post(`${API}/api/moderation/reports/${reportId}/assign`, { assigneeId })
    return data as ReportedContent
  },

  async getRules(params?: Partial<ModerationFilters>) {
    const query = params
      ? {
          ...params,
          status: params.status && params.status !== 'all' ? params.status : undefined,
          severity: params.severity && params.severity !== 'all' ? params.severity : undefined,
          contentType: params.contentType && params.contentType !== 'all' ? params.contentType : undefined,
          ruleId: params.ruleId || undefined
        }
      : undefined

    const { data } = await axios.get(`${API}/api/moderation/rules`, { params: query })
    return data as ModerationRule[]
  },

  async createRule(input: ModerationRuleInput) {
    const { data } = await axios.post(`${API}/api/moderation/rules`, input)
    return data as ModerationRule
  },

  async updateRule(ruleId: string, input: Partial<ModerationRuleInput>) {
    const { data } = await axios.put(`${API}/api/moderation/rules/${ruleId}`, input)
    return data as ModerationRule
  },

  async toggleRule(ruleId: string, enabled: boolean) {
    const { data } = await axios.post(`${API}/api/moderation/rules/${ruleId}/toggle`, { enabled })
    return data as ModerationRule
  },

  async reorderRules(order: string[]) {
    const { data } = await axios.post(`${API}/api/moderation/rules/reorder`, { order })
    return data as ModerationRule[]
  },

  async deleteRule(ruleId: string) {
    await axios.delete(`${API}/api/moderation/rules/${ruleId}`)
  },

  async getAuditTrail(params: AuditTrailParams) {
    const query = {
      ...params,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      severity: params.severity && params.severity !== 'all' ? params.severity : undefined,
      contentType: params.contentType && params.contentType !== 'all' ? params.contentType : undefined,
      ruleId: params.ruleId || undefined
    }

    const { data } = await axios.get(`${API}/api/moderation/audit`, { params: query })
    return data as { entries: AuditTrailEntry[]; total: number }
  },

  async exportAuditTrail(format: 'json' | 'csv', params: AuditTrailParams) {
    const query = {
      ...params,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      severity: params.severity && params.severity !== 'all' ? params.severity : undefined,
      contentType: params.contentType && params.contentType !== 'all' ? params.contentType : undefined,
      ruleId: params.ruleId || undefined
    }

    const response = await axios.get(`${API}/api/moderation/audit/export`, {
      params: { ...query, format },
      responseType: 'blob'
    })
    return response.data as Blob
  },

  async listAppeals(params: AppealsParams) {
    const query = {
      ...params,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      severity: params.severity && params.severity !== 'all' ? params.severity : undefined,
      contentType: params.contentType && params.contentType !== 'all' ? params.contentType : undefined,
      ruleId: params.ruleId || undefined
    }

    const { data } = await axios.get(`${API}/api/moderation/appeals`, { params: query })
    return data as { appeals: ModerationAppeal[]; total: number }
  },

  async updateAppeal(appealId: string, payload: { status: ModerationAppeal['status']; notes?: string }) {
    const { data } = await axios.post(`${API}/api/moderation/appeals/${appealId}`, payload)
    return data as ModerationAppeal
  }
}

import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL

export type NotificationChannelType = 'email' | 'slack' | 'webhook' | 'sms'

export const NOTIFICATION_CHANNEL_TYPE_LABELS: Record<NotificationChannelType, string> = {
  email: 'Email',
  slack: 'Slack',
  webhook: 'Webhook',
  sms: 'SMS'
}

export type AlertOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'

export type AlertWindowAggregation = 'avg' | 'max' | 'min' | 'sum'

export interface AlertConditionWindow {
  durationMinutes: number
  aggregation: AlertWindowAggregation
}

export interface AlertCondition {
  id?: string
  metric: string
  operator: AlertOperator
  threshold: number
  window: AlertConditionWindow
}

export interface NotificationChannel {
  id: string
  name: string
  type: NotificationChannelType
  target: string
  metadata?: Record<string, string>
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface EscalationStep {
  delayMinutes: number
  channelIds: string[]
}

export interface EscalationPolicy {
  id: string
  name: string
  description?: string
  steps: EscalationStep[]
  repeat?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface EscalationPolicyInput {
  name: string
  description?: string
  steps: EscalationStep[]
  repeat?: boolean
}

export interface RuleEscalationConfig {
  policyId?: string
  steps?: EscalationStep[]
  repeat?: boolean
}

export interface AlertRule {
  id: string
  name: string
  description?: string
  severity: 'warning' | 'critical'
  enabled: boolean
  conditions: AlertCondition[]
  channelIds: string[]
  escalation?: RuleEscalationConfig | null
  createdAt: string
  updatedAt: string
}

export interface AlertRuleInput {
  name: string
  description?: string
  severity: 'warning' | 'critical'
  enabled: boolean
  conditions: AlertCondition[]
  channelIds: string[]
  escalation?: RuleEscalationConfig | null
}

export const AlertingService = {
  async listRules() {
    const { data } = await axios.get(`${API}/api/alerting/rules`)
    return data as AlertRule[]
  },
  async createRule(input: AlertRuleInput) {
    const { data } = await axios.post(`${API}/api/alerting/rules`, input)
    return data as AlertRule
  },
  async updateRule(ruleId: string, input: AlertRuleInput) {
    const { data } = await axios.put(`${API}/api/alerting/rules/${ruleId}`, input)
    return data as AlertRule
  },
  async listChannels() {
    const { data } = await axios.get(`${API}/api/alerting/channels`)
    return data as NotificationChannel[]
  },
  async listEscalationPolicies() {
    const { data } = await axios.get(`${API}/api/alerting/escalations`)
    return data as EscalationPolicy[]
  },
  async createEscalationPolicy(input: EscalationPolicyInput) {
    const { data } = await axios.post(`${API}/api/alerting/escalations`, input)
    return data as EscalationPolicy
  },
  async updateEscalationPolicy(policyId: string, input: EscalationPolicyInput) {
    const { data } = await axios.put(`${API}/api/alerting/escalations/${policyId}`, input)
    return data as EscalationPolicy
  }
}


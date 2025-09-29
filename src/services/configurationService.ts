import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL

export interface PlatformParameter {
  key: string
  label: string
  value: string | number | boolean
  type: 'string' | 'number' | 'boolean'
  description?: string
}

export interface FeatureFlag {
  key: string
  label: string
  description?: string
  enabled: boolean
  rolloutPercentage?: number
}

export interface AbTestVariant {
  id: string
  label: string
  trafficPercentage: number
  goalMetric: string
}

export interface AbTest {
  id: string
  name: string
  hypothesis: string
  variants: AbTestVariant[]
  status: 'draft' | 'running' | 'paused' | 'completed'
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  plainTextContent: string
  lastUpdatedAt: string
  lastUpdatedBy: string
  version: string
}

export interface NotificationRule {
  id: string
  channel: 'email' | 'sms' | 'push'
  label: string
  description?: string
  enabled: boolean
  triggers: string[]
}

export interface RateLimitRule {
  id: string
  label: string
  description?: string
  limit: number
  windowSeconds: number
  burstLimit?: number
}

export interface ConfigurationVersion {
  version: string
  summary: string
  updatedAt: string
  updatedBy: string
}

export interface ConfigurationSnapshot {
  parameters: PlatformParameter[]
  featureFlags: FeatureFlag[]
  experiments: AbTest[]
  emailTemplates: EmailTemplate[]
  notificationRules: NotificationRule[]
  rateLimitRules: RateLimitRule[]
  currentVersion: ConfigurationVersion
}

export const ConfigurationService = {
  async getSnapshot() {
    const { data } = await axios.get(`${API}/api/configuration`)
    return data as ConfigurationSnapshot
  },

  async getVersionHistory() {
    const { data } = await axios.get(`${API}/api/configuration/versions`)
    return data as ConfigurationVersion[]
  },

  async updateParameters(parameters: PlatformParameter[]) {
    const { data } = await axios.put(`${API}/api/configuration/parameters`, { parameters })
    return data as ConfigurationSnapshot
  },

  async updateFeatureFlags(flags: FeatureFlag[]) {
    const { data } = await axios.put(`${API}/api/configuration/feature-flags`, { flags })
    return data as ConfigurationSnapshot
  },

  async updateExperiments(experiments: AbTest[]) {
    const { data } = await axios.put(`${API}/api/configuration/experiments`, { experiments })
    return data as ConfigurationSnapshot
  },

  async updateEmailTemplate(template: EmailTemplate) {
    const { data } = await axios.put(`${API}/api/configuration/email-templates/${template.id}`, template)
    return data as EmailTemplate
  },

  async previewEmailTemplate(template: Pick<EmailTemplate, 'htmlContent' | 'plainTextContent'>) {
    const { data } = await axios.post(`${API}/api/configuration/email-templates/preview`, template)
    return data as { renderedHtml: string; plainText: string }
  },

  async updateNotificationRules(rules: NotificationRule[]) {
    const { data } = await axios.put(`${API}/api/configuration/notifications`, { rules })
    return data as ConfigurationSnapshot
  },

  async updateRateLimits(rules: RateLimitRule[]) {
    const { data } = await axios.put(`${API}/api/configuration/rate-limits`, { rules })
    return data as ConfigurationSnapshot
  },

  async revertToVersion(version: string) {
    const { data } = await axios.post(`${API}/api/configuration/revert`, { version })
    return data as ConfigurationSnapshot
  }
}

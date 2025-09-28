import axios from 'axios'

export interface User {
  id: string
  name: string
  email: string
  status: string
  industry?: string
  createdAt?: string
}

const API = import.meta.env.VITE_API_BASE_URL

export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  industry?: string
  startDate?: string
  endDate?: string
}

export interface Stats {
  signups: Record<string, number>
  byIndustry: Record<string, number>
  byStatus: Record<string, number>
}

export interface EngagementMetricPoint {
  timestamp: string
  activeUsers: number
  interactions: number
  matches: number
}

export interface EngagementMetricsSummary {
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number
  averageSessionDurationMinutes: number
  engagementScore: number
}

export interface EngagementMetrics {
  summary: EngagementMetricsSummary
  series: EngagementMetricPoint[]
}

export interface MatchSuccessRateSegment {
  segment: string
  rate: number
}

export interface MatchSuccessRateTrendPoint {
  date: string
  rate: number
}

export interface MatchSuccessRate {
  overallRate: number
  segments: MatchSuccessRateSegment[]
  trend: MatchSuccessRateTrendPoint[]
}

export interface ActivityHeatmapCell {
  day: string
  hour: number
  value: number
}

export interface CohortRetentionPoint {
  period: string
  rate: number
}

export interface CohortRetention {
  cohort: string
  values: CohortRetentionPoint[]
}

export interface GeoDistributionBucket {
  countryCode: string
  countryName: string
  userCount: number
  latitude?: number
  longitude?: number
}

export const UserService = {
  async list(params: ListParams) {
    const { data } = await axios.get(`${API}/api/users`, { params })
    return data as { users: User[]; total: number }
  },
  async update(id: string, payload: Partial<User>) {
    const { data } = await axios.put(`${API}/api/users/${id}`, payload)
    return data as User
  },
  async remove(id: string) {
    await axios.delete(`${API}/api/users/${id}`)
  },
  async bulk(ids: string[], action: 'activate' | 'deactivate' | 'delete') {
    await axios.post(`${API}/api/users/bulk`, { ids, action })
  },
  async stats() {
    const { data } = await axios.get(`${API}/api/users/stats`)
    return data as Stats
  },
  async getEngagementMetrics() {
    const { data } = await axios.get(`${API}/api/users/engagement`)
    return data as EngagementMetrics
  },
  async getMatchSuccessRate() {
    const { data } = await axios.get(`${API}/api/users/match-success`)
    return data as MatchSuccessRate
  },
  async getActivityHeatmap() {
    const { data } = await axios.get(`${API}/api/users/activity-heatmap`)
    return data as ActivityHeatmapCell[]
  },
  async getCohorts() {
    const { data } = await axios.get(`${API}/api/users/cohorts`)
    return data as CohortRetention[]
  },
  async getGeoDistribution() {
    const { data } = await axios.get(`${API}/api/users/geo-distribution`)
    return data as GeoDistributionBucket[]
  },
  async export(params: ListParams) {
    const res = await axios.get(`${API}/api/users/export`, {
      params,
      responseType: 'blob'
    })
    return res.data as Blob
  }
}

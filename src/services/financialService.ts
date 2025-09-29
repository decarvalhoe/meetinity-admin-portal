import axios from 'axios'

export type TimeGranularity = 'day' | 'week' | 'month'
export type PlanCode = string
export type PlanFilter = PlanCode | 'all'
export type ExportFormat = 'csv' | 'excel' | 'pdf'

export interface FinancialFilters {
  granularity: TimeGranularity
  plan: PlanFilter
  startDate?: string
  endDate?: string
  priceVariation?: number
}

export interface RevenueTrendPoint {
  period: string
  revenue: number
  arpu: number
  payingUsers: number
  benefit: number
}

export interface SubscriptionMetric {
  plan: PlanCode
  activeSubscribers: number
  newSubscriptions: number
  churnedSubscriptions: number
  arpu: number
}

export interface CostCategory {
  category: string
  amount: number
}

export interface CostComparisonPoint {
  period: string
  cost: number
  revenue: number
}

export interface CostMetrics {
  categories: CostCategory[]
  comparison: CostComparisonPoint[]
}

export interface CohortPoint {
  cohort: string
  period: string
  retention: number
  plan: PlanCode
}

export interface BusinessKpi {
  label: string
  value: number
  delta: number
  format: 'currency' | 'percentage' | 'number'
}

export interface SubscriptionMetricsResponse {
  metrics: SubscriptionMetric[]
  planOptions: PlanCode[]
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const FINANCE_API_BASE = `${API_BASE_URL}/api/finance`

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  excel: 'application/vnd.ms-excel',
  pdf: 'application/pdf'
}

const unwrapData = (payload: unknown): unknown => {
  let current = payload
  while (current && typeof current === 'object' && 'data' in (current as Record<string, unknown>)) {
    current = (current as Record<string, unknown>).data
  }
  return current
}

const extractArray = (payload: unknown, keys: string[]): unknown[] => {
  const unwrapped = unwrapData(payload)
  if (Array.isArray(unwrapped)) {
    return unwrapped
  }

  if (!unwrapped || typeof unwrapped !== 'object') {
    return []
  }

  for (const key of keys) {
    const value = (unwrapped as Record<string, unknown>)[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  return 0
}

const toInteger = (value: unknown): number => {
  const result = Math.round(toNumber(value))
  return Number.isFinite(result) ? result : 0
}

const ensureString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (value == null) {
    return ''
  }

  return String(value)
}

const ensurePlanOptions = (payload: unknown): PlanCode[] => {
  const values = extractArray(payload, ['plans', 'planOptions', 'availablePlans'])
  const plans = values
    .map((value) => ensureString(value))
    .filter((plan) => plan.length > 0)

  return Array.from(new Set(plans))
}

const mapRevenueTrend = (payload: unknown): RevenueTrendPoint[] => {
  const rows = extractArray(payload, ['trend', 'items', 'points', 'rows'])

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }

      const entry = row as Record<string, unknown>
      const period = ensureString(entry.period ?? entry.date ?? entry.window)
      if (!period) {
        return null
      }

      return {
        period,
        revenue: Number(toNumber(entry.revenue ?? entry.amount ?? entry.totalRevenue).toFixed(2)),
        arpu: Number(toNumber(entry.arpu ?? entry.averageRevenuePerUser ?? entry.avgRevenue).toFixed(2)),
        payingUsers: toInteger(entry.payingUsers ?? entry.users ?? entry.subscribers),
        benefit: Number(toNumber(entry.benefit ?? entry.margin ?? entry.grossProfit).toFixed(2))
      }
    })
    .filter((row): row is RevenueTrendPoint => row !== null)
}

const mapSubscriptionMetrics = (payload: unknown): SubscriptionMetricsResponse => {
  const metricsPayload = unwrapData(payload)
  const metricsRows = extractArray(metricsPayload, ['metrics', 'items', 'subscriptions'])

  const metrics = metricsRows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }

      const entry = row as Record<string, unknown>
      const plan = ensureString(entry.plan ?? entry.segment ?? entry.code)
      if (!plan) {
        return null
      }

      return {
        plan,
        activeSubscribers: toInteger(entry.activeSubscribers ?? entry.active ?? entry.payingUsers),
        newSubscriptions: toInteger(entry.newSubscriptions ?? entry.new ?? entry.acquired),
        churnedSubscriptions: toInteger(entry.churnedSubscriptions ?? entry.churn ?? entry.lost),
        arpu: Number(toNumber(entry.arpu ?? entry.averageRevenue ?? entry.revenuePerUser).toFixed(2))
      }
    })
    .filter((metric): metric is SubscriptionMetric => metric !== null)

  const planOptions = ensurePlanOptions(metricsPayload)

  return {
    metrics,
    planOptions
  }
}

const mapCostMetrics = (payload: unknown): CostMetrics => {
  const unwrapped = unwrapData(payload)
  const categoriesRaw = extractArray(unwrapped, ['categories', 'breakdown', 'costs'])
  const comparisonRaw = extractArray(unwrapped, ['comparison', 'timeline', 'series'])

  const categories = categoriesRaw
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }

      const entry = row as Record<string, unknown>
      const category = ensureString(entry.category ?? entry.label ?? entry.name)
      if (!category) {
        return null
      }

      return {
        category,
        amount: Number(toNumber(entry.amount ?? entry.value ?? entry.total).toFixed(2))
      }
    })
    .filter((category): category is CostCategory => category !== null)

  const comparison = comparisonRaw
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }

      const entry = row as Record<string, unknown>
      const period = ensureString(entry.period ?? entry.date ?? entry.window)
      if (!period) {
        return null
      }

      return {
        period,
        cost: Number(toNumber(entry.cost ?? entry.amount ?? entry.totalCost).toFixed(2)),
        revenue: Number(toNumber(entry.revenue ?? entry.totalRevenue ?? entry.turnover).toFixed(2))
      }
    })
    .filter((row): row is CostComparisonPoint => row !== null)

  return {
    categories,
    comparison
  }
}

const mapCohorts = (payload: unknown): CohortPoint[] => {
  const rows = extractArray(payload, ['cohorts', 'items', 'retention'])

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }

      const entry = row as Record<string, unknown>
      const cohort = ensureString(entry.cohort ?? entry.batch)
      const period = ensureString(entry.period ?? entry.step ?? entry.label)
      const plan = ensureString(entry.plan ?? entry.segment ?? entry.code)

      if (!cohort || !period || !plan) {
        return null
      }

      return {
        cohort,
        period,
        plan,
        retention: Number(toNumber(entry.retention ?? entry.rate ?? entry.value).toFixed(4))
      }
    })
    .filter((row): row is CohortPoint => row !== null)
}

const mapBusinessKpis = (payload: unknown): BusinessKpi[] => {
  const rows = extractArray(payload, ['kpis', 'items', 'indicators'])

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }

      const entry = row as Record<string, unknown>
      const label = ensureString(entry.label ?? entry.name)
      const format = ensureString(entry.format ?? entry.type) as BusinessKpi['format']

      if (!label || !format) {
        return null
      }

      return {
        label,
        format: format === 'currency' || format === 'percentage' || format === 'number' ? format : 'number',
        value: Number(toNumber(entry.value ?? entry.amount ?? entry.current).toFixed(2)),
        delta: Number(toNumber(entry.delta ?? entry.diff ?? entry.variation).toFixed(2))
      }
    })
    .filter((row): row is BusinessKpi => row !== null)
}

const withTextFallback = (blob: Blob, origin?: string): Blob => {
  const candidate = blob as Blob & { text?: () => Promise<string> }

  if (typeof candidate.text !== 'function' && typeof origin === 'string') {
    Object.defineProperty(candidate, 'text', {
      value: async () => origin,
      configurable: true
    })
  }

  return candidate
}

const ensureBlob = (value: unknown, format: ExportFormat): Blob => {
  if (value instanceof Blob) {
    return withTextFallback(value)
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    if (record.content instanceof Blob) {
      return withTextFallback(record.content)
    }

    if (typeof record.content === 'string') {
      const type = ensureString(record.mimeType ?? record.type) || MIME_TYPES[format]
      return withTextFallback(new Blob([record.content], { type }), record.content)
    }

    if (record.buffer instanceof ArrayBuffer) {
      const type = ensureString(record.mimeType ?? record.type) || MIME_TYPES[format]
      return withTextFallback(new Blob([record.buffer], { type }))
    }
  }

  if (typeof value === 'string') {
    return withTextFallback(new Blob([value], { type: MIME_TYPES[format] }), value)
  }

  const fallback = JSON.stringify(value ?? {})
  return withTextFallback(new Blob([fallback], { type: 'application/json' }), fallback)
}

const buildQueryParams = (filters: FinancialFilters) => {
  const params: Record<string, string | number> = {
    granularity: filters.granularity,
    plan: filters.plan
  }

  if (filters.startDate) {
    params.startDate = filters.startDate
  }

  if (filters.endDate) {
    params.endDate = filters.endDate
  }

  if (typeof filters.priceVariation === 'number') {
    params.priceVariation = filters.priceVariation
  }

  return params
}

export const FinancialService = {
  async getRevenueTrend(filters: FinancialFilters): Promise<RevenueTrendPoint[]> {
    const { data } = await axios.get(`${FINANCE_API_BASE}/revenue-trend`, {
      params: buildQueryParams(filters)
    })

    return mapRevenueTrend(data)
  },

  async getSubscriptionMetrics(filters: FinancialFilters): Promise<SubscriptionMetricsResponse> {
    const { data } = await axios.get(`${FINANCE_API_BASE}/subscriptions`, {
      params: buildQueryParams(filters)
    })

    return mapSubscriptionMetrics(data)
  },

  async getCostMetrics(filters: FinancialFilters): Promise<CostMetrics> {
    const { data } = await axios.get(`${FINANCE_API_BASE}/costs`, {
      params: buildQueryParams(filters)
    })

    return mapCostMetrics(data)
  },

  async getBusinessKpis(filters: FinancialFilters): Promise<BusinessKpi[]> {
    const { data } = await axios.get(`${FINANCE_API_BASE}/kpis`, {
      params: buildQueryParams(filters)
    })

    return mapBusinessKpis(data)
  },

  async getCohortRetention(filters: FinancialFilters): Promise<CohortPoint[]> {
    const { data } = await axios.get(`${FINANCE_API_BASE}/cohorts`, {
      params: buildQueryParams(filters)
    })

    return mapCohorts(data)
  },

  async exportFinancialData(format: ExportFormat, filters: FinancialFilters): Promise<Blob> {
    const { data } = await axios.get(`${FINANCE_API_BASE}/export`, {
      params: { ...buildQueryParams(filters), format },
      responseType: 'blob'
    })

    return ensureBlob(data, format)
  }
}


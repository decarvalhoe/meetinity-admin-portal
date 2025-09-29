import { format, parseISO } from 'date-fns'

export type TimeGranularity = 'day' | 'week' | 'month'
export type PlanCode = 'basic' | 'pro' | 'enterprise'
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

interface FinancialRecord {
  date: string
  plan: PlanCode
  revenue: number
  payingUsers: number
  arpu: number
  newSubscriptions: number
  churnedSubscriptions: number
  marketingSpend: number
  operationsCost: number
  infrastructureCost: number
  supportCost: number
}

const financialRecords: FinancialRecord[] = [
  {
    date: '2024-07-01',
    plan: 'basic',
    revenue: 12000,
    payingUsers: 400,
    arpu: 30,
    newSubscriptions: 80,
    churnedSubscriptions: 20,
    marketingSpend: 3000,
    operationsCost: 1500,
    infrastructureCost: 1200,
    supportCost: 800
  },
  {
    date: '2024-07-01',
    plan: 'pro',
    revenue: 22400,
    payingUsers: 280,
    arpu: 80,
    newSubscriptions: 60,
    churnedSubscriptions: 15,
    marketingSpend: 2600,
    operationsCost: 1400,
    infrastructureCost: 1100,
    supportCost: 900
  },
  {
    date: '2024-07-01',
    plan: 'enterprise',
    revenue: 30000,
    payingUsers: 150,
    arpu: 200,
    newSubscriptions: 20,
    churnedSubscriptions: 5,
    marketingSpend: 4200,
    operationsCost: 2100,
    infrastructureCost: 1600,
    supportCost: 1200
  },
  {
    date: '2024-08-01',
    plan: 'basic',
    revenue: 12600,
    payingUsers: 420,
    arpu: 30,
    newSubscriptions: 85,
    churnedSubscriptions: 18,
    marketingSpend: 3050,
    operationsCost: 1520,
    infrastructureCost: 1200,
    supportCost: 820
  },
  {
    date: '2024-08-01',
    plan: 'pro',
    revenue: 23200,
    payingUsers: 290,
    arpu: 80,
    newSubscriptions: 65,
    churnedSubscriptions: 14,
    marketingSpend: 2550,
    operationsCost: 1350,
    infrastructureCost: 1100,
    supportCost: 910
  },
  {
    date: '2024-08-01',
    plan: 'enterprise',
    revenue: 31200,
    payingUsers: 156,
    arpu: 200,
    newSubscriptions: 22,
    churnedSubscriptions: 4,
    marketingSpend: 4150,
    operationsCost: 2050,
    infrastructureCost: 1650,
    supportCost: 1180
  },
  {
    date: '2024-09-01',
    plan: 'basic',
    revenue: 13500,
    payingUsers: 450,
    arpu: 30,
    newSubscriptions: 90,
    churnedSubscriptions: 17,
    marketingSpend: 3100,
    operationsCost: 1580,
    infrastructureCost: 1250,
    supportCost: 830
  },
  {
    date: '2024-09-01',
    plan: 'pro',
    revenue: 24000,
    payingUsers: 300,
    arpu: 80,
    newSubscriptions: 70,
    churnedSubscriptions: 13,
    marketingSpend: 2500,
    operationsCost: 1380,
    infrastructureCost: 1120,
    supportCost: 920
  },
  {
    date: '2024-09-01',
    plan: 'enterprise',
    revenue: 32400,
    payingUsers: 162,
    arpu: 200,
    newSubscriptions: 25,
    churnedSubscriptions: 4,
    marketingSpend: 4100,
    operationsCost: 2100,
    infrastructureCost: 1700,
    supportCost: 1200
  }
]

const cohortRetention: CohortPoint[] = [
  { cohort: '2024-07', period: 'Month 1', retention: 1, plan: 'basic' },
  { cohort: '2024-07', period: 'Month 2', retention: 0.82, plan: 'basic' },
  { cohort: '2024-07', period: 'Month 3', retention: 0.74, plan: 'basic' },
  { cohort: '2024-07', period: 'Month 1', retention: 1, plan: 'pro' },
  { cohort: '2024-07', period: 'Month 2', retention: 0.87, plan: 'pro' },
  { cohort: '2024-07', period: 'Month 3', retention: 0.8, plan: 'pro' },
  { cohort: '2024-07', period: 'Month 1', retention: 1, plan: 'enterprise' },
  { cohort: '2024-07', period: 'Month 2', retention: 0.91, plan: 'enterprise' },
  { cohort: '2024-07', period: 'Month 3', retention: 0.85, plan: 'enterprise' },
  { cohort: '2024-08', period: 'Month 1', retention: 1, plan: 'basic' },
  { cohort: '2024-08', period: 'Month 2', retention: 0.83, plan: 'basic' },
  { cohort: '2024-08', period: 'Month 3', retention: 0.76, plan: 'basic' },
  { cohort: '2024-08', period: 'Month 1', retention: 1, plan: 'pro' },
  { cohort: '2024-08', period: 'Month 2', retention: 0.88, plan: 'pro' },
  { cohort: '2024-08', period: 'Month 3', retention: 0.81, plan: 'pro' },
  { cohort: '2024-08', period: 'Month 1', retention: 1, plan: 'enterprise' },
  { cohort: '2024-08', period: 'Month 2', retention: 0.92, plan: 'enterprise' },
  { cohort: '2024-08', period: 'Month 3', retention: 0.86, plan: 'enterprise' },
  { cohort: '2024-09', period: 'Month 1', retention: 1, plan: 'basic' },
  { cohort: '2024-09', period: 'Month 2', retention: 0.84, plan: 'basic' },
  { cohort: '2024-09', period: 'Month 3', retention: 0.77, plan: 'basic' },
  { cohort: '2024-09', period: 'Month 1', retention: 1, plan: 'pro' },
  { cohort: '2024-09', period: 'Month 2', retention: 0.89, plan: 'pro' },
  { cohort: '2024-09', period: 'Month 3', retention: 0.82, plan: 'pro' },
  { cohort: '2024-09', period: 'Month 1', retention: 1, plan: 'enterprise' },
  { cohort: '2024-09', period: 'Month 2', retention: 0.93, plan: 'enterprise' },
  { cohort: '2024-09', period: 'Month 3', retention: 0.87, plan: 'enterprise' }
]

const planOptions: PlanCode[] = ['basic', 'pro', 'enterprise']

const getMultiplier = (variation?: number) => 1 + (variation ?? 0) / 100

const getPeriodKey = (date: string, granularity: TimeGranularity) => {
  const parsed = parseISO(date)
  if (granularity === 'week') {
    return format(parsed, 'yyyy-ww')
  }

  if (granularity === 'month') {
    return format(parsed, 'yyyy-MM')
  }

  return format(parsed, 'yyyy-MM-dd')
}

const sortPeriods = (points: RevenueTrendPoint[]) =>
  [...points].sort((a, b) => (a.period > b.period ? 1 : -1))

const filterRecords = ({ plan, startDate, endDate }: FinancialFilters) => {
  return financialRecords.filter((record) => {
    if (plan !== 'all' && record.plan !== plan) {
      return false
    }

    if (startDate && record.date < startDate) {
      return false
    }

    if (endDate && record.date > endDate) {
      return false
    }

    return true
  })
}

const computeCost = (record: FinancialRecord) =>
  record.marketingSpend +
  record.operationsCost +
  record.infrastructureCost +
  record.supportCost

const formatNumber = (value: number, format: BusinessKpi['format']) => {
  if (format === 'currency') {
    return Number(value.toFixed(2))
  }

  if (format === 'percentage') {
    return Number((value * 100).toFixed(2))
  }

  return Number(value.toFixed(2))
}

const createCsv = (dataset: {
  revenueTrend: RevenueTrendPoint[]
  subscriptionMetrics: SubscriptionMetric[]
  costMetrics: CostMetrics
  kpis: BusinessKpi[]
}) => {
  const revenueRows = ['period,revenue,arpu,payingUsers,benefit']
  revenueRows.push(
    ...dataset.revenueTrend.map((point) =>
      [point.period, point.revenue.toFixed(2), point.arpu.toFixed(2), point.payingUsers, point.benefit.toFixed(2)].join(',')
    )
  )

  const subscriptionHeader = '\nplan,activeSubscribers,newSubscriptions,churnedSubscriptions,arpu'
  const subscriptionRows = dataset.subscriptionMetrics
    .map((metric) =>
      [
        metric.plan,
        metric.activeSubscribers.toFixed(0),
        metric.newSubscriptions.toFixed(0),
        metric.churnedSubscriptions.toFixed(0),
        metric.arpu.toFixed(2)
      ].join(',')
    )
    .join('\n')

  const costHeader = '\ncategory,amount'
  const costRows = dataset.costMetrics.categories
    .map((category) => `${category.category},${category.amount.toFixed(2)}`)
    .join('\n')

  const kpiHeader = '\nlabel,value,delta,format'
  const kpiRows = dataset.kpis
    .map((kpi) => `${kpi.label},${kpi.value.toFixed(2)},${kpi.delta.toFixed(2)},${kpi.format}`)
    .join('\n')

  return `${revenueRows.join('\n')}${subscriptionHeader}${subscriptionRows}${costHeader}${costRows}${kpiHeader}${kpiRows}`
}

const createExcel = (dataset: {
  revenueTrend: RevenueTrendPoint[]
  subscriptionMetrics: SubscriptionMetric[]
  costMetrics: CostMetrics
  kpis: BusinessKpi[]
}) => {
  const sections = ['Financial Report']
  sections.push('Revenue Trend')
  sections.push('Period\tRevenue\tARPU\tPaying Users\tBenefit')
  sections.push(
    ...dataset.revenueTrend.map(
      (point) =>
        `${point.period}\t${point.revenue.toFixed(2)}\t${point.arpu.toFixed(2)}\t${point.payingUsers}\t${point.benefit.toFixed(2)}`
    )
  )

  sections.push('\nSubscription Metrics')
  sections.push('Plan\tActive Subscribers\tNew\tChurned\tARPU')
  sections.push(
    ...dataset.subscriptionMetrics.map(
      (metric) =>
        `${metric.plan}\t${metric.activeSubscribers.toFixed(0)}\t${metric.newSubscriptions.toFixed(0)}\t${metric.churnedSubscriptions.toFixed(0)}\t${metric.arpu.toFixed(2)}`
    )
  )

  sections.push('\nCost Breakdown')
  sections.push('Category\tAmount')
  sections.push(
    ...dataset.costMetrics.categories.map((category) => `${category.category}\t${category.amount.toFixed(2)}`)
  )

  sections.push('\nKey KPIs')
  sections.push('Label\tValue\tDelta\tFormat')
  sections.push(
    ...dataset.kpis.map((kpi) => `${kpi.label}\t${kpi.value.toFixed(2)}\t${kpi.delta.toFixed(2)}\t${kpi.format}`)
  )

  return sections.join('\n')
}

const createPdf = (dataset: {
  revenueTrend: RevenueTrendPoint[]
  subscriptionMetrics: SubscriptionMetric[]
  costMetrics: CostMetrics
  kpis: BusinessKpi[]
}) => {
  const lines = ['Financial Report']
  lines.push('Revenue Trend:')
  lines.push(
    ...dataset.revenueTrend.map(
      (point) =>
        `${point.period} -> Revenue: ${point.revenue.toFixed(2)}, ARPU: ${point.arpu.toFixed(2)}, Paying Users: ${point.payingUsers}`
    )
  )
  lines.push('\nSubscription Metrics:')
  lines.push(
    ...dataset.subscriptionMetrics.map(
      (metric) =>
        `${metric.plan} Plan - Active: ${metric.activeSubscribers.toFixed(0)}, New: ${metric.newSubscriptions.toFixed(0)}, Churned: ${metric.churnedSubscriptions.toFixed(0)}, ARPU: ${metric.arpu.toFixed(2)}`
    )
  )

  lines.push('\nCost Breakdown:')
  lines.push(...dataset.costMetrics.categories.map((category) => `${category.category}: ${category.amount.toFixed(2)}`))

  lines.push('\nKPIs:')
  lines.push(...dataset.kpis.map((kpi) => `${kpi.label}: ${kpi.value.toFixed(2)} (${kpi.delta.toFixed(2)})`))

  return lines.join('\n')
}

const createBlobWithFallback = (content: string, type: string): Blob => {
  const blob = new Blob([content], { type })
  const candidate = blob as Blob & { text?: () => Promise<string> }
  if (typeof candidate.text !== 'function') {
    Object.defineProperty(candidate, 'text', {
      value: async () => content,
      configurable: true
    })
  }

  return blob
}

const aggregateRevenue = (filters: FinancialFilters): RevenueTrendPoint[] => {
  const multiplier = getMultiplier(filters.priceVariation)
  const records = filterRecords(filters)
  const buckets = new Map<
    string,
    {
      revenue: number
      payingUsers: number
      arpuWeighted: number
      cost: number
    }
  >()

  records.forEach((record) => {
    const key = getPeriodKey(record.date, filters.granularity)
    const bucket = buckets.get(key) ?? {
      revenue: 0,
      payingUsers: 0,
      arpuWeighted: 0,
      cost: 0
    }

    const adjustedRevenue = record.revenue * multiplier
    const adjustedArpu = record.arpu * multiplier

    bucket.revenue += adjustedRevenue
    bucket.payingUsers += record.payingUsers
    bucket.arpuWeighted += adjustedArpu * record.payingUsers
    bucket.cost += computeCost(record)

    buckets.set(key, bucket)
  })

  const points = Array.from(buckets.entries()).map(([period, value]) => ({
    period,
    revenue: Number(value.revenue.toFixed(2)),
    arpu: value.payingUsers ? Number((value.arpuWeighted / value.payingUsers).toFixed(2)) : 0,
    payingUsers: value.payingUsers,
    benefit: Number((value.revenue - value.cost).toFixed(2))
  }))

  return sortPeriods(points)
}

const aggregateSubscriptions = (filters: FinancialFilters): SubscriptionMetric[] => {
  const multiplier = getMultiplier(filters.priceVariation)
  const records = filterRecords({ ...filters, plan: 'all' })
  const buckets = new Map<PlanCode, {
    payingUsers: number
    entries: number
    newSubscriptions: number
    churnedSubscriptions: number
    arpuWeighted: number
  }>()

  records.forEach((record) => {
    if (filters.plan !== 'all' && record.plan !== filters.plan) {
      return
    }

    const bucket = buckets.get(record.plan) ?? {
      payingUsers: 0,
      entries: 0,
      newSubscriptions: 0,
      churnedSubscriptions: 0,
      arpuWeighted: 0
    }

    bucket.payingUsers += record.payingUsers
    bucket.entries += 1
    bucket.newSubscriptions += record.newSubscriptions
    bucket.churnedSubscriptions += record.churnedSubscriptions
    bucket.arpuWeighted += record.arpu * multiplier * record.payingUsers

    buckets.set(record.plan, bucket)
  })

  return planOptions
    .filter((plan) => buckets.has(plan))
    .map((plan) => {
      const bucket = buckets.get(plan)!
      const active = bucket.payingUsers / bucket.entries
      const arpu = bucket.payingUsers
        ? Number((bucket.arpuWeighted / bucket.payingUsers).toFixed(2))
        : 0

      return {
        plan,
        activeSubscribers: Number(active.toFixed(0)),
        newSubscriptions: Number(bucket.newSubscriptions.toFixed(0)),
        churnedSubscriptions: Number(bucket.churnedSubscriptions.toFixed(0)),
        arpu
      }
    })
}

const aggregateCosts = (filters: FinancialFilters): CostMetrics => {
  const multiplier = getMultiplier(filters.priceVariation)
  const records = filterRecords(filters)
  const categoryTotals: Record<string, number> = {
    Marketing: 0,
    Operations: 0,
    Infrastructure: 0,
    Support: 0
  }
  const comparisonMap = new Map<string, { cost: number; revenue: number }>()

  records.forEach((record) => {
    const key = getPeriodKey(record.date, filters.granularity)
    const cost = computeCost(record)
    const adjustedRevenue = record.revenue * multiplier

    categoryTotals.Marketing += record.marketingSpend
    categoryTotals.Operations += record.operationsCost
    categoryTotals.Infrastructure += record.infrastructureCost
    categoryTotals.Support += record.supportCost

    const comparison = comparisonMap.get(key) ?? { cost: 0, revenue: 0 }
    comparison.cost += cost
    comparison.revenue += adjustedRevenue
    comparisonMap.set(key, comparison)
  })

  return {
    categories: Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2))
    })),
    comparison: sortPeriods(
      Array.from(comparisonMap.entries()).map(([period, values]) => ({
        period,
        cost: Number(values.cost.toFixed(2)),
        revenue: Number(values.revenue.toFixed(2))
      }))
    )
  }
}

const aggregateKpis = (filters: FinancialFilters): BusinessKpi[] => {
  const revenueTrend = aggregateRevenue(filters)
  const costMetrics = aggregateCosts(filters)
  const subscriptions = aggregateSubscriptions(filters)

  const totalRevenue = revenueTrend.reduce((sum, point) => sum + point.revenue, 0)
  const totalCost = costMetrics.comparison.reduce((sum, point) => sum + point.cost, 0)
  const totalPayingUsers = revenueTrend.reduce((sum, point) => sum + point.payingUsers, 0)
  const totalNewSubscriptions = subscriptions.reduce((sum, metric) => sum + metric.newSubscriptions, 0)
  const totalChurned = subscriptions.reduce((sum, metric) => sum + metric.churnedSubscriptions, 0)

  const lastPeriod = revenueTrend[revenueTrend.length - 1]
  const previousPeriod = revenueTrend[revenueTrend.length - 2]

  const mrr = lastPeriod ? lastPeriod.revenue : 0
  const arr = mrr * 12

  const averageArpu = totalPayingUsers
    ? Number((totalRevenue / totalPayingUsers).toFixed(2))
    : 0

  const churnRate = totalPayingUsers
    ? Number((totalChurned / (totalChurned + totalPayingUsers)).toFixed(4))
    : 0

  const grossMargin = totalRevenue
    ? Number(((totalRevenue - totalCost) / totalRevenue).toFixed(4))
    : 0

  const ltv = churnRate > 0 ? Number(((averageArpu * grossMargin) / churnRate).toFixed(2)) : 0

  const cac = totalNewSubscriptions > 0 ? Number((totalCost / totalNewSubscriptions).toFixed(2)) : 0

  const costPerUser = totalPayingUsers > 0 ? totalCost / totalPayingUsers : 0
  const netContribution = averageArpu - costPerUser
  const paybackPeriod = netContribution > 0 && cac > 0 ? Number((cac / netContribution).toFixed(2)) : 0

  const revenueDelta = previousPeriod ? Number((lastPeriod.revenue - previousPeriod.revenue).toFixed(2)) : 0

  return [
    { label: 'MRR', value: formatNumber(mrr, 'currency'), delta: revenueDelta, format: 'currency' },
    { label: 'ARR', value: formatNumber(arr, 'currency'), delta: revenueDelta * 12, format: 'currency' },
    { label: 'ARPU', value: formatNumber(averageArpu, 'currency'), delta: 0, format: 'currency' },
    { label: 'Churn Rate', value: formatNumber(churnRate, 'percentage'), delta: 0, format: 'percentage' },
    { label: 'LTV', value: formatNumber(ltv, 'currency'), delta: 0, format: 'currency' },
    { label: 'CAC', value: formatNumber(cac, 'currency'), delta: 0, format: 'currency' },
    { label: 'Payback Period (months)', value: formatNumber(paybackPeriod, 'number'), delta: 0, format: 'number' },
    { label: 'Gross Margin', value: formatNumber(grossMargin, 'percentage'), delta: 0, format: 'percentage' }
  ]
}

const filterCohorts = (filters: FinancialFilters): CohortPoint[] => {
  return cohortRetention.filter((point) => {
    if (filters.plan !== 'all' && point.plan !== filters.plan) {
      return false
    }

    if (filters.startDate && `${point.cohort}-01` < filters.startDate) {
      return false
    }

    if (filters.endDate && `${point.cohort}-01` > filters.endDate) {
      return false
    }

    return true
  })
}

const getExportPayload = async (filters: FinancialFilters) => {
  const [revenueTrend, subscriptionMetrics, costMetrics, kpis] = await Promise.all([
    FinancialService.getRevenueTrend(filters),
    FinancialService.getSubscriptionMetrics(filters),
    FinancialService.getCostMetrics(filters),
    FinancialService.getBusinessKpis(filters)
  ])

  return { revenueTrend, subscriptionMetrics, costMetrics, kpis }
}

export const FinancialService = {
  getPlanOptions(): PlanCode[] {
    return [...planOptions]
  },
  async getRevenueTrend(filters: FinancialFilters): Promise<RevenueTrendPoint[]> {
    return aggregateRevenue(filters)
  },
  async getSubscriptionMetrics(filters: FinancialFilters): Promise<SubscriptionMetric[]> {
    return aggregateSubscriptions(filters)
  },
  async getCostMetrics(filters: FinancialFilters): Promise<CostMetrics> {
    return aggregateCosts(filters)
  },
  async getBusinessKpis(filters: FinancialFilters): Promise<BusinessKpi[]> {
    return aggregateKpis(filters)
  },
  async getCohortRetention(filters: FinancialFilters): Promise<CohortPoint[]> {
    return filterCohorts(filters)
  },
  async exportFinancialData(format: ExportFormat, filters: FinancialFilters): Promise<Blob> {
    const payload = await getExportPayload(filters)

    if (format === 'csv') {
      const csv = createCsv(payload)
      return createBlobWithFallback(csv, 'text/csv')
    }

    if (format === 'excel') {
      const excel = createExcel(payload)
      return createBlobWithFallback(excel, 'application/vnd.ms-excel')
    }

    const pdf = createPdf(payload)
    return createBlobWithFallback(pdf, 'application/pdf')
  }
}

export type { FinancialRecord }

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAxios, type AxiosMockController } from './utils/networkMocks'

import type {
  FinancialFilters,
  SubscriptionMetric,
  CostCategory,
  CostComparisonPoint,
  BusinessKpi,
  CohortPoint,
  RevenueTrendPoint
} from '../services/financialService'

declare global {
  // eslint-disable-next-line no-var
  var __axiosMockController: AxiosMockController | undefined
}

vi.mock('axios', () => {
  const { module, controller } = createMockAxios()
  globalThis.__axiosMockController = controller
  return module
})

let FinancialService: typeof import('../services/financialService').FinancialService

const getAxiosMock = () => {
  const axiosMock = globalThis.__axiosMockController
  if (!axiosMock) {
    throw new Error('Axios mock not initialised')
  }
  return axiosMock
}

describe('FinancialService HTTP integration', () => {
  const baseFilters: FinancialFilters = {
    granularity: 'month',
    plan: 'all',
    priceVariation: 0,
    startDate: '2024-07-01',
    endDate: '2024-09-30'
  }

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5000')
    const module = await import('../services/financialService')
    FinancialService = module.FinancialService
  })

  afterEach(() => {
    getAxiosMock().reset()
    vi.unstubAllEnvs()
  })

  it('normalizes revenue trend responses coming from the finance API', async () => {
    const axiosMock = getAxiosMock()

    const apiResponse = [
      {
        period: '2024-07',
        revenue: '64400.42',
        arpu: '85.35',
        payingUsers: '755',
        benefit: '42000.11'
      },
      {
        date: '2024-08',
        totalRevenue: 69900,
        averageRevenuePerUser: 90.12,
        subscribers: 780,
        margin: 45120.55
      }
    ]

    axiosMock.get.mockResolvedValueOnce({
      data: {
        data: {
          trend: apiResponse
        }
      }
    })

    const trend = await FinancialService.getRevenueTrend(baseFilters)

    expect(axiosMock.get).toHaveBeenCalledWith('http://localhost:5000/api/finance/revenue-trend', {
      params: {
        granularity: 'month',
        plan: 'all',
        startDate: '2024-07-01',
        endDate: '2024-09-30',
        priceVariation: 0
      }
    })

    expect(trend).toHaveLength(2)
    expect(trend[0]).toMatchObject({
      period: '2024-07',
      revenue: 64400.42,
      arpu: 85.35,
      payingUsers: 755,
      benefit: 42000.11
    } satisfies Partial<RevenueTrendPoint>)
    expect(trend[1]).toMatchObject({
      period: '2024-08',
      revenue: 69900,
      arpu: 90.12,
      payingUsers: 780,
      benefit: 45120.55
    })
  })

  it('extracts subscription metrics and unique plan options', async () => {
    const axiosMock = getAxiosMock()

    axiosMock.get.mockResolvedValueOnce({
      data: {
        data: {
          metrics: [
            {
              plan: 'basic',
              active: '420',
              new: '120',
              churn: 24,
              averageRevenue: '30.15'
            },
            {
              segment: 'pro',
              payingUsers: 290,
              acquired: 65,
              lost: 12,
              revenuePerUser: '82.90'
            }
          ],
          planOptions: ['basic', 'pro', 'basic']
        }
      }
    })

    const response = await FinancialService.getSubscriptionMetrics({ ...baseFilters, plan: 'basic' })

    expect(axiosMock.get).toHaveBeenCalledWith('http://localhost:5000/api/finance/subscriptions', {
      params: {
        granularity: 'month',
        plan: 'basic',
        startDate: '2024-07-01',
        endDate: '2024-09-30',
        priceVariation: 0
      }
    })

    expect(response.planOptions).toEqual(['basic', 'pro'])
    expect(response.metrics).toEqual<SubscriptionMetric[]>([
      {
        plan: 'basic',
        activeSubscribers: 420,
        newSubscriptions: 120,
        churnedSubscriptions: 24,
        arpu: 30.15
      },
      {
        plan: 'pro',
        activeSubscribers: 290,
        newSubscriptions: 65,
        churnedSubscriptions: 12,
        arpu: 82.9
      }
    ])
  })

  it('maps cost metrics with currency conversion', async () => {
    const axiosMock = getAxiosMock()

    axiosMock.get.mockResolvedValueOnce({
      data: {
        data: {
          breakdown: [
            { label: 'Marketing', value: '12500.50' },
            { label: 'Infrastructure', value: 8200 }
          ],
          timeline: [
            { period: '2024-07', cost: '18200', revenue: '54000.45' },
            { period: '2024-08', totalCost: 19400, totalRevenue: 59900 }
          ]
        }
      }
    })

    const costs = await FinancialService.getCostMetrics(baseFilters)

    expect(axiosMock.get).toHaveBeenCalledWith('http://localhost:5000/api/finance/costs', {
      params: {
        granularity: 'month',
        plan: 'all',
        startDate: '2024-07-01',
        endDate: '2024-09-30',
        priceVariation: 0
      }
    })

    expect(costs.categories).toEqual<CostCategory[]>([
      { category: 'Marketing', amount: 12500.5 },
      { category: 'Infrastructure', amount: 8200 }
    ])

    expect(costs.comparison).toEqual<CostComparisonPoint[]>([
      { period: '2024-07', cost: 18200, revenue: 54000.45 },
      { period: '2024-08', cost: 19400, revenue: 59900 }
    ])
  })

  it('parses KPI payloads with decimals', async () => {
    const axiosMock = getAxiosMock()

    axiosMock.get.mockResolvedValueOnce({
      data: {
        data: {
          indicators: [
            { label: 'MRR', format: 'currency', value: '69900.15', delta: '250.20' },
            { label: 'Churn Rate', type: 'percentage', value: 3.25, variation: '-0.15' }
          ]
        }
      }
    })

    const kpis = await FinancialService.getBusinessKpis(baseFilters)

    expect(axiosMock.get).toHaveBeenCalledWith('http://localhost:5000/api/finance/kpis', {
      params: {
        granularity: 'month',
        plan: 'all',
        startDate: '2024-07-01',
        endDate: '2024-09-30',
        priceVariation: 0
      }
    })

    expect(kpis).toEqual<BusinessKpi[]>([
      { label: 'MRR', format: 'currency', value: 69900.15, delta: 250.2 },
      { label: 'Churn Rate', format: 'percentage', value: 3.25, delta: -0.15 }
    ])
  })

  it('returns cohort retention points', async () => {
    const axiosMock = getAxiosMock()

    axiosMock.get.mockResolvedValueOnce({
      data: {
        data: {
          cohorts: [
            { cohort: '2024-07', period: 'Month 1', plan: 'basic', retention: '1.0' },
            { batch: '2024-07', step: 'Month 2', code: 'basic', rate: '0.82' }
          ]
        }
      }
    })

    const cohorts = await FinancialService.getCohortRetention(baseFilters)

    expect(axiosMock.get).toHaveBeenCalledWith('http://localhost:5000/api/finance/cohorts', {
      params: {
        granularity: 'month',
        plan: 'all',
        startDate: '2024-07-01',
        endDate: '2024-09-30',
        priceVariation: 0
      }
    })

    expect(cohorts).toEqual<CohortPoint[]>([
      { cohort: '2024-07', period: 'Month 1', plan: 'basic', retention: 1 },
      { cohort: '2024-07', period: 'Month 2', plan: 'basic', retention: 0.82 }
    ])
  })

  it('requests export blobs with the selected format', async () => {
    const axiosMock = getAxiosMock()
    const blob = new Blob(['period,revenue'], { type: 'text/csv' })

    axiosMock.get.mockResolvedValueOnce({ data: blob })

    const result = await FinancialService.exportFinancialData('csv', baseFilters)

    expect(axiosMock.get).toHaveBeenCalledWith('http://localhost:5000/api/finance/export', {
      params: {
        granularity: 'month',
        plan: 'all',
        startDate: '2024-07-01',
        endDate: '2024-09-30',
        priceVariation: 0,
        format: 'csv'
      },
      responseType: 'blob'
    })

    expect(result).toBe(blob)
  })
})

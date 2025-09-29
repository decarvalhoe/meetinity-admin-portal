import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
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

vi.mock('d3', () => {
  const createSelection = () => {
    const selection: any = {}
    selection.attr = () => selection
    selection.selectAll = () => selection
    selection.remove = () => selection
    selection.append = () => selection
    selection.datum = () => selection
    selection.call = () => selection
    selection.text = () => selection
    selection.data = () => ({
      enter: () => selection
    })
    selection.enter = () => selection
    selection.range = () => selection
    selection.domain = () => selection
    selection.padding = () => selection
    selection.nice = () => selection
    selection.curve = () => selection
    selection.y0 = () => selection
    selection.y1 = () => selection
    selection.x = () => selection
    selection.y = () => selection
    return selection
  }

  const createScale = () => {
    const scale: any = () => 0
    scale.domain = () => scale
    scale.range = () => scale
    scale.padding = () => scale
    scale.nice = () => scale
    return scale
  }

  const createLine = () => {
    const line: any = () => ''
    line.x = () => line
    line.y = () => line
    line.curve = () => line
    return line
  }

  const createArea = () => {
    const area: any = () => ''
    area.x = () => area
    area.y0 = () => area
    area.y1 = () => area
    area.curve = () => area
    return area
  }

  return {
    select: () => createSelection(),
    scalePoint: () => createScale(),
    scaleLinear: () => createScale(),
    line: () => createLine(),
    area: () => createArea(),
    max: () => 0,
    axisBottom: () => () => undefined,
    axisLeft: () => () => undefined,
    curveMonotoneX: 'curveMonotoneX'
  }
}, { virtual: true })

let FinancialService: typeof import('../services/financialService').FinancialService
let FinancialDashboard: typeof import('../components/finance/FinancialDashboard').FinancialDashboard

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

describe('FinancialDashboard export interactions', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5000')

    const serviceModule = await import('../services/financialService')
    FinancialService = serviceModule.FinancialService

    vi.spyOn(FinancialService, 'getRevenueTrend').mockResolvedValue([])
    vi.spyOn(FinancialService, 'getSubscriptionMetrics').mockResolvedValue({
      metrics: [],
      planOptions: []
    })
    vi.spyOn(FinancialService, 'getCostMetrics').mockResolvedValue({
      categories: [],
      comparison: []
    })
    vi.spyOn(FinancialService, 'getCohortRetention').mockResolvedValue([])
    vi.spyOn(FinancialService, 'getBusinessKpis').mockResolvedValue([])
    vi.spyOn(FinancialService, 'exportFinancialData').mockResolvedValue(
      new Blob(['dummy-excel'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    )

    const componentModule = await import('../components/finance/FinancialDashboard')
    FinancialDashboard = componentModule.FinancialDashboard
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('uses the .xlsx extension when exporting Excel data and revokes object URLs', async () => {
    const appendedAnchors: HTMLAnchorElement[] = []
    const originalAppendChild = document.body.appendChild.bind(document.body)
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(((node: Node) => {
        if (node instanceof HTMLAnchorElement) {
          appendedAnchors.push(node)
        }
        return originalAppendChild(node)
      }) as typeof document.body.appendChild)

    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const createObjectURLMock = vi.fn(() => 'blob:mock-excel')
    const revokeObjectURLMock = vi.fn()
    const anchorClickMock = vi.fn()
    const originalAnchorClick = HTMLAnchorElement.prototype.click

    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      writable: true,
      value: anchorClickMock
    })

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock
    })

    try {
      render(<FinancialDashboard />)

      await waitFor(() => expect(FinancialService.getRevenueTrend).toHaveBeenCalled())

      fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }))

      await waitFor(() =>
        expect(FinancialService.exportFinancialData).toHaveBeenCalledWith(
          'excel',
          expect.objectContaining({ granularity: 'month', plan: 'all' })
        )
      )

      expect(appendedAnchors).toHaveLength(1)
      expect(appendedAnchors[0].download).toBe('financial-report.xlsx')
      expect(createObjectURLMock).toHaveBeenCalled()

      await waitFor(() => expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-excel'))
      expect(anchorClickMock).toHaveBeenCalled()
    } finally {
      appendChildSpy.mockRestore()

      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', {
          configurable: true,
          writable: true,
          value: originalCreateObjectURL
        })
      } else {
        delete (URL as { createObjectURL?: unknown }).createObjectURL
      }

      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', {
          configurable: true,
          writable: true,
          value: originalRevokeObjectURL
        })
      } else {
        delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
      }

      Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
        configurable: true,
        writable: true,
        value: originalAnchorClick
      })
    }
  })
})

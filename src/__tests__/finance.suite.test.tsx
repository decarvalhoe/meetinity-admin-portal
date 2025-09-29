import { describe, expect, it } from 'vitest'
import { FinancialService, type FinancialFilters } from '../services/financialService'

describe('Financial dashboard aggregations', () => {
  const baseFilters: FinancialFilters = {
    granularity: 'month',
    plan: 'all',
    priceVariation: 0,
    startDate: '2024-07-01',
    endDate: '2024-09-30'
  }

  it('applies price variation to revenue trend', async () => {
    const data = await FinancialService.getRevenueTrend({ ...baseFilters, priceVariation: 10 })
    expect(data).toHaveLength(3)
    expect(data[0].period).toBe('2024-07')
    expect(data[0].revenue).toBeCloseTo(70840, 2)
    expect(data[0].arpu).toBeCloseTo(85.35, 2)
  })

  it('aggregates subscription metrics per plan', async () => {
    const metrics = await FinancialService.getSubscriptionMetrics({ ...baseFilters, plan: 'basic' })
    expect(metrics).toHaveLength(1)
    const [basic] = metrics
    expect(basic.activeSubscribers).toBe(423)
    expect(basic.newSubscriptions).toBe(255)
    expect(basic.churnedSubscriptions).toBe(55)
    expect(basic.arpu).toBeCloseTo(30, 2)
  })

  it('aggregates cost metrics with revenue comparison', async () => {
    const costMetrics = await FinancialService.getCostMetrics(baseFilters)
    const marketing = costMetrics.categories.find((category) => category.category === 'Marketing')
    expect(marketing?.amount).toBeCloseTo(29250, 2)
    expect(costMetrics.comparison[0]).toMatchObject({ period: '2024-07', cost: 21600, revenue: 64400 })
    expect(costMetrics.comparison[2]).toMatchObject({ period: '2024-09', cost: 21780, revenue: 69900 })
  })

  it('calculates business KPIs across periods', async () => {
    const kpis = await FinancialService.getBusinessKpis(baseFilters)
    const mrr = kpis.find((kpi) => kpi.label === 'MRR')
    const grossMargin = kpis.find((kpi) => kpi.label === 'Gross Margin')
    expect(mrr?.value).toBeCloseTo(69900, 2)
    expect(mrr?.delta).toBeCloseTo(2900, 2)
    expect(grossMargin?.value).toBeGreaterThan(60)
    expect(grossMargin?.value).toBeLessThan(80)
  })

  it('exports aggregated data to multiple formats', async () => {
    const csvBlob = await FinancialService.exportFinancialData('csv', baseFilters)
    const csvContent = await csvBlob.text()
    expect(csvContent).toContain('period,revenue,arpu,payingUsers,benefit')
    expect(csvContent).toContain('2024-07')

    const excelBlob = await FinancialService.exportFinancialData('excel', baseFilters)
    const excelContent = await excelBlob.text()
    expect(excelContent).toContain('Financial Report')
    expect(excelContent).toContain('Revenue Trend')

    const pdfBlob = await FinancialService.exportFinancialData('pdf', baseFilters)
    const pdfContent = await pdfBlob.text()
    expect(pdfContent).toContain('Financial Report')
    expect(pdfContent).toContain('Revenue:')
  })
})

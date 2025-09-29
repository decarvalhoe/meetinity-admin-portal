import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import {
  BusinessKpi,
  CostMetrics,
  ExportFormat,
  FinancialService,
  PlanFilter,
  RevenueTrendPoint,
  SubscriptionMetric,
  TimeGranularity,
  CohortPoint
} from '../../services/financialService'
import { SubscriptionManager } from './SubscriptionManager'
import { CostInsights } from './CostInsights'
import { BusinessKpiCards } from './BusinessKpiCards'

interface DashboardState {
  revenueTrend: RevenueTrendPoint[]
  subscriptionMetrics: SubscriptionMetric[]
  costMetrics: CostMetrics
  cohortData: CohortPoint[]
  kpis: BusinessKpi[]
}

const defaultState: DashboardState = {
  revenueTrend: [],
  subscriptionMetrics: [],
  costMetrics: { categories: [], comparison: [] },
  cohortData: [],
  kpis: []
}

export const FinancialDashboard: React.FC = () => {
  const [granularity, setGranularity] = useState<TimeGranularity>('month')
  const [plan, setPlan] = useState<PlanFilter>('all')
  const [priceVariation, setPriceVariation] = useState(0)
  const [startDate, setStartDate] = useState('2024-07-01')
  const [endDate, setEndDate] = useState('2024-09-30')
  const [state, setState] = useState<DashboardState>(defaultState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planOptions, setPlanOptions] = useState<PlanFilter[]>(['all'])

  const revenueChartRef = useRef<SVGSVGElement | null>(null)

  const filters = useMemo(
    () => ({ granularity, plan, priceVariation, startDate, endDate }),
    [granularity, plan, priceVariation, startDate, endDate]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [revenueTrend, subscriptionResponse, costMetrics, cohortData, kpis] = await Promise.all([
        FinancialService.getRevenueTrend(filters),
        FinancialService.getSubscriptionMetrics(filters),
        FinancialService.getCostMetrics(filters),
        FinancialService.getCohortRetention(filters),
        FinancialService.getBusinessKpis(filters)
      ])

      const normalizedPlans = subscriptionResponse.planOptions.length
        ? subscriptionResponse.planOptions
        : subscriptionResponse.metrics.map((metric) => metric.plan)
      const uniquePlans = Array.from(
        new Set(normalizedPlans.filter((option) => option && option !== 'all'))
      )

      setPlanOptions(['all', ...uniquePlans])

      if (filters.plan !== 'all' && !uniquePlans.includes(filters.plan)) {
        setPlan('all')
      }

      setState({
        revenueTrend,
        subscriptionMetrics: subscriptionResponse.metrics,
        costMetrics,
        cohortData,
        kpis
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors du chargement des données financières."
      )
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!revenueChartRef.current) {
      return
    }

    const svg = d3.select(revenueChartRef.current)
    const width = 720
    const height = 320
    const margin = { top: 30, right: 24, bottom: 48, left: 72 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    svg.selectAll('*').remove()

    if (state.revenueTrend.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text('Aucune donnée disponible pour les filtres sélectionnés.')
      return
    }

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom
    const container = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const xScale = d3
      .scalePoint<string>()
      .domain(state.revenueTrend.map((point) => point.period))
      .range([0, chartWidth])
      .padding(0.5)

    const yMax = d3.max(state.revenueTrend, (d) => d.revenue) ?? 0
    const yScale = d3.scaleLinear().domain([0, yMax * 1.1]).range([chartHeight, 0]).nice()

    const lineGenerator = d3
      .line<RevenueTrendPoint>()
      .x((d) => xScale(d.period) ?? 0)
      .y((d) => yScale(d.revenue))
      .curve(d3.curveMonotoneX)

    const areaGenerator = d3
      .area<RevenueTrendPoint>()
      .x((d) => xScale(d.period) ?? 0)
      .y0(chartHeight)
      .y1((d) => yScale(d.revenue))
      .curve(d3.curveMonotoneX)

    container
      .append('path')
      .datum(state.revenueTrend)
      .attr('fill', 'rgba(37, 99, 235, 0.15)')
      .attr('d', areaGenerator)

    container
      .append('path')
      .datum(state.revenueTrend)
      .attr('fill', 'none')
      .attr('stroke', '#2563eb')
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator)

    container
      .selectAll('circle')
      .data(state.revenueTrend)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.period) ?? 0)
      .attr('cy', (d) => yScale(d.revenue))
      .attr('r', 5)
      .attr('fill', '#1d4ed8')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)

    container
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))

    container.append('g').call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${Number(d) / 1000}k`))

    container
      .append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4b5563')
      .text('Période')

    container
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -chartHeight / 2)
      .attr('y', -48)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4b5563')
      .text('Revenus (EUR)')
  }, [state.revenueTrend])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      try {
        const blob = await FinancialService.exportFinancialData(format, filters)
        const url = URL.createObjectURL(blob)
        const extensionByFormat: Record<ExportFormat, string> = {
          csv: 'csv',
          excel: 'xlsx',
          pdf: 'pdf'
        }
        const extension = extensionByFormat[format] ?? format
        const link = document.createElement('a')
        link.href = url
        link.download = `financial-report.${extension}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (err) {
        setError("Erreur lors de l'export des données financières.")
      }
    },
    [filters]
  )

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Tableau de bord financier</h1>
            <p className="text-sm text-slate-500">
              Analysez les revenus, abonnements et coûts par période et par segment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-500">
              Prix (%):
              <input
                type="range"
                min={-30}
                max={50}
                value={priceVariation}
                onChange={(event) => setPriceVariation(Number(event.target.value))}
                className="ml-2 align-middle"
              />
              <span className="ml-2 font-medium text-slate-700">{priceVariation}%</span>
            </label>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Granularité</label>
            <select
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as TimeGranularity)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Segment</label>
            <select
              value={plan}
              onChange={(event) => setPlan(event.target.value as PlanFilter)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {planOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'Tous les plans' : option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>
      </header>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Revenus</h2>
            <p className="text-sm text-slate-500">
              Courbe d'évolution des revenus agrégés avec variation de prix instantanée.
            </p>
          </div>
          {loading && <span className="text-sm text-slate-400">Chargement...</span>}
        </div>
        <svg ref={revenueChartRef} className="mt-4 w-full" role="img" aria-label="Évolution des revenus" />
      </section>

      <BusinessKpiCards kpis={state.kpis} loading={loading} />

      <section className="grid gap-6 lg:grid-cols-2">
        <SubscriptionManager
          metrics={state.subscriptionMetrics}
          cohorts={state.cohortData}
          granularity={granularity}
          loading={loading}
        />
        <CostInsights data={state.costMetrics} loading={loading} />
      </section>
    </div>
  )
}

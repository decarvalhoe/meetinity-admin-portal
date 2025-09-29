import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { CohortPoint, SubscriptionMetric, TimeGranularity } from '../../services/financialService'

interface SubscriptionManagerProps {
  metrics: SubscriptionMetric[]
  cohorts: CohortPoint[]
  granularity: TimeGranularity
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ metrics, cohorts, granularity }) => {
  const histogramRef = useRef<SVGSVGElement | null>(null)
  const heatmapRef = useRef<SVGSVGElement | null>(null)

  const totals = useMemo(() => {
    const active = metrics.reduce((sum, metric) => sum + metric.activeSubscribers, 0)
    const newSubs = metrics.reduce((sum, metric) => sum + metric.newSubscriptions, 0)
    const churn = metrics.reduce((sum, metric) => sum + metric.churnedSubscriptions, 0)
    const arpuAverage = metrics.reduce((sum, metric) => sum + metric.arpu, 0) / (metrics.length || 1)
    return {
      active,
      newSubs,
      churn,
      arpu: Number(arpuAverage.toFixed(2))
    }
  }, [metrics])

  useEffect(() => {
    if (!histogramRef.current) {
      return
    }

    const svg = d3.select(histogramRef.current)
    const width = 380
    const height = 260
    const margin = { top: 24, right: 16, bottom: 36, left: 48 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    svg.selectAll('*').remove()

    if (metrics.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text("Aucune donnée d'abonnement.")
      return
    }

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const arpuValues = metrics.map((metric) => metric.arpu)
    const domainMin = d3.min(arpuValues) ?? 0
    const domainMax = d3.max(arpuValues) ?? 0

    const bins = d3
      .bin()
      .domain([domainMin, domainMax])
      .thresholds(5)(arpuValues)

    const xScale = d3.scaleLinear().domain([domainMin, domainMax]).range([0, chartWidth]).nice()

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (bin) => bin.length) ?? 1])
      .range([chartHeight, 0])
      .nice()

    const container = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    container
      .selectAll('rect')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.x0 ?? domainMin))
      .attr('y', (d) => yScale(d.length))
      .attr('width', (d) => Math.max(xScale(d.x1 ?? domainMax) - xScale(d.x0 ?? domainMin) - 4, 0))
      .attr('height', (d) => chartHeight - yScale(d.length))
      .attr('fill', '#059669')
      .attr('rx', 6)

    container
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))

    container.append('g').call(d3.axisLeft(yScale).ticks(5))

    container
      .append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4b5563')
      .text('ARPU par plan')
  }, [metrics])

  useEffect(() => {
    if (!heatmapRef.current) {
      return
    }

    const svg = d3.select(heatmapRef.current)
    const width = 380
    const height = 260
    const margin = { top: 24, right: 16, bottom: 40, left: 140 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    svg.selectAll('*').remove()

    if (cohorts.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text('Aucune donnée de cohorte disponible.')
      return
    }

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const periods = Array.from(new Set(cohorts.map((cohort) => cohort.period)))
    const cohortLabels = Array.from(new Set(cohorts.map((cohort) => `${cohort.cohort} · ${cohort.plan}`)))

    const xScale = d3.scaleBand().domain(periods).range([0, chartWidth]).padding(0.1)
    const yScale = d3.scaleBand().domain(cohortLabels).range([0, chartHeight]).padding(0.1)

    const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0.5, 1])

    const container = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    container
      .selectAll('rect')
      .data(cohorts)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.period) ?? 0)
      .attr('y', (d) => yScale(`${d.cohort} · ${d.plan}`) ?? 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => colorScale(d.retention))

    container
      .selectAll('text')
      .data(cohorts)
      .enter()
      .append('text')
      .attr('x', (d) => (xScale(d.period) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => (yScale(`${d.cohort} · ${d.plan}`) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#1f2937')
      .text((d) => `${Math.round(d.retention * 100)}%`)

    container
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))

    container.append('g').call(d3.axisLeft(yScale))
  }, [cohorts])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Abonnements</h2>
          <p className="text-sm text-slate-500">
            Distribution ARPU et fidélité par cohorte pour la granularité {granularity}.
          </p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <div>
            <span className="font-semibold text-slate-900">{totals.active.toLocaleString('fr-FR')}</span> actifs
          </div>
          <div>
            <span className="font-semibold text-emerald-600">+{totals.newSubs.toLocaleString('fr-FR')}</span> nouveaux
          </div>
          <div>
            <span className="font-semibold text-rose-600">-{totals.churn.toLocaleString('fr-FR')}</span> churn
          </div>
          <div>ARPU moyen: €{totals.arpu.toLocaleString('fr-FR')}</div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-slate-700">Histogramme ARPU</h3>
          <svg ref={histogramRef} className="mt-2 w-full" role="img" aria-label="Histogramme ARPU" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-700">Rétention par cohorte</h3>
          <svg ref={heatmapRef} className="mt-2 w-full" role="img" aria-label="Heatmap cohortes" />
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import {
  EventAnalyticsSummary,
  EventAttendanceSeries,
  EventConversionStat,
  EventApprovalStage,
  EventEngagementCell
} from '../../services/eventService'

export type AnalyticsRangeOption = '7d' | '14d' | '30d' | '90d'

interface EventAnalyticsDashboardProps {
  summary: EventAnalyticsSummary | null
  attendance: EventAttendanceSeries[]
  conversions: EventConversionStat[]
  funnel: EventApprovalStage[]
  heatmap: EventEngagementCell[]
  loading?: boolean
  lastUpdated?: string
  connectionState?: number
  onRangeChange?: (range: AnalyticsRangeOption) => void
  range?: AnalyticsRangeOption
}

const rangeLabels: Record<AnalyticsRangeOption, string> = {
  '7d': '7 derniers jours',
  '14d': '14 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours'
}

function formatPercent(value: number) {
  if (Number.isNaN(value)) {
    return '0%'
  }
  return `${Math.round(value * 1000) / 10}%`
}

function resolveConnectionState(state?: number) {
  switch (state) {
    case 0:
      return { label: 'Connexion en cours', tone: 'pending' }
    case 1:
      return { label: 'Temps réel actif', tone: 'online' }
    case 2:
      return { label: 'Fermeture de la socket', tone: 'warning' }
    case 3:
    default:
      return { label: 'Hors ligne', tone: 'offline' }
  }
}

export function EventAnalyticsDashboard({
  summary,
  attendance,
  conversions,
  funnel,
  heatmap,
  loading,
  lastUpdated,
  connectionState,
  onRangeChange,
  range = '30d'
}: EventAnalyticsDashboardProps) {
  const attendanceRef = useRef<SVGSVGElement | null>(null)
  const conversionRef = useRef<SVGSVGElement | null>(null)
  const funnelRef = useRef<SVGSVGElement | null>(null)
  const heatmapRef = useRef<SVGSVGElement | null>(null)

  const aggregatedAttendance = useMemo(() => {
    const bucket = new Map<string, { registrations: number; attendance: number }>()

    attendance.forEach(series => {
      series.series.forEach(point => {
        if (!bucket.has(point.date)) {
          bucket.set(point.date, { registrations: 0, attendance: 0 })
        }
        const entry = bucket.get(point.date)
        if (entry) {
          entry.registrations += point.registrations
          entry.attendance += point.attendance
        }
      })
    })

    return Array.from(bucket.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [attendance])

  const topConversion = useMemo(() => {
    if (!conversions.length) {
      return null
    }
    return conversions.reduce((max, current) => (current.value > max.value ? current : max))
  }, [conversions])

  const connectionMeta = resolveConnectionState(connectionState)

  useEffect(() => {
    const svg = d3.select(attendanceRef.current)
    svg.selectAll('*').remove()

    if (!aggregatedAttendance.length) {
      return
    }

    const width = 640
    const height = 280
    const margin = { top: 20, right: 20, bottom: 30, left: 48 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const dates = aggregatedAttendance.map(point => new Date(point.date))
    const x = d3
      .scaleTime()
      .domain(d3.extent(dates) as [Date, Date])
      .range([margin.left, width - margin.right])

    const y = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(aggregatedAttendance, point => Math.max(point.registrations, point.attendance)) ?? 1
      ])
      .nice()
      .range([height - margin.bottom, margin.top])

    const lineRegistrations = d3
      .line<{ date: string; registrations: number; attendance: number }>()
      .x(point => x(new Date(point.date)))
      .y(point => y(point.registrations))

    const lineAttendance = d3
      .line<{ date: string; registrations: number; attendance: number }>()
      .x(point => x(new Date(point.date)))
      .y(point => y(point.attendance))

    svg
      .append('path')
      .datum(aggregatedAttendance)
      .attr('fill', 'none')
      .attr('stroke', '#4f46e5')
      .attr('stroke-width', 2)
      .attr('d', lineRegistrations)

    svg
      .append('path')
      .datum(aggregatedAttendance)
      .attr('fill', 'none')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2)
      .attr('d', lineAttendance)

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%d/%m') as (date: Date) => string))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
  }, [aggregatedAttendance])

  useEffect(() => {
    const svg = d3.select(conversionRef.current)
    svg.selectAll('*').remove()

    if (!conversions.length) {
      return
    }

    const width = 320
    const height = 240
    const margin = { top: 20, right: 20, bottom: 40, left: 48 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const x = d3
      .scaleBand()
      .domain(conversions.map(item => item.stage))
      .range([margin.left, width - margin.right])
      .padding(0.2)

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(conversions, item => item.value) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top])

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))

    svg
      .selectAll('rect')
      .data(conversions)
      .enter()
      .append('rect')
      .attr('x', item => (x(item.stage) ?? 0))
      .attr('y', item => y(item.value))
      .attr('width', x.bandwidth())
      .attr('height', item => y(0) - y(item.value))
      .attr('fill', '#6366f1')
  }, [conversions])

  useEffect(() => {
    const svg = d3.select(funnelRef.current)
    svg.selectAll('*').remove()

    if (!funnel.length) {
      return
    }

    const width = 320
    const height = 240
    const margin = { top: 20, right: 20, bottom: 40, left: 48 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const maxValue = d3.max(funnel, stage => stage.count) ?? 1
    const y = d3
      .scaleBand()
      .domain(funnel.map(stage => stage.stage))
      .range([margin.top, height - margin.bottom])
      .padding(0.3)

    const x = d3
      .scaleLinear()
      .domain([0, maxValue])
      .range([margin.left, width - margin.right])

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))

    svg
      .selectAll('rect')
      .data(funnel)
      .enter()
      .append('rect')
      .attr('x', () => x(0))
      .attr('y', stage => (y(stage.stage) ?? 0))
      .attr('height', y.bandwidth())
      .attr('width', stage => x(stage.count) - x(0))
      .attr('fill', '#f97316')
  }, [funnel])

  useEffect(() => {
    const svg = d3.select(heatmapRef.current)
    svg.selectAll('*').remove()

    if (!heatmap.length) {
      return
    }

    const width = 640
    const height = 240
    const margin = { top: 20, right: 20, bottom: 40, left: 60 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const days = Array.from(new Set(heatmap.map(cell => cell.day)))
    const hours = Array.from(new Set(heatmap.map(cell => cell.hour))).sort((a, b) => a - b)

    const x = d3
      .scaleBand<number>()
      .domain(hours)
      .range([margin.left, width - margin.right])
      .padding(0.05)

    const y = d3
      .scaleBand<string>()
      .domain(days)
      .range([margin.top, height - margin.bottom])
      .padding(0.05)

    const maxValue = d3.max(heatmap, cell => cell.value) ?? 1
    const color = d3.scaleSequential(d3.interpolateYlGnBu).domain([0, maxValue])

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(hour => `${hour}h`))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))

    svg
      .selectAll('rect')
      .data(heatmap)
      .enter()
      .append('rect')
      .attr('x', cell => (x(cell.hour) ?? 0))
      .attr('y', cell => (y(cell.day) ?? 0))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', cell => color(cell.value))
  }, [heatmap])

  return (
    <section className="event-analytics" aria-busy={loading}>
      <header className="event-analytics__header">
        <div>
          <h2>Analytique des événements</h2>
          <p className="event-analytics__subtitle">
            Synthèse des performances, entonnoir d'approbation et tendances de participation.
          </p>
        </div>
        <div className="event-analytics__controls">
          <label htmlFor="analytics-range">Période</label>
          <select
            id="analytics-range"
            onChange={event => onRangeChange?.(event.target.value as AnalyticsRangeOption)}
            value={range}
            aria-label="Changer la période analytique"
          >
            {Object.entries(rangeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className={`event-analytics__status event-analytics__status--${connectionMeta.tone}`}>
        {connectionMeta.label}
        {lastUpdated && (
          <span className="event-analytics__status-meta">
            Dernière mise à jour : {new Date(lastUpdated).toLocaleString()}
          </span>
        )}
      </div>

      <div className="event-analytics__cards">
        <div className="event-analytics__card" data-testid="analytics-total-events">
          <span className="event-analytics__card-label">Événements totaux</span>
          <strong>{summary?.totalEvents ?? 0}</strong>
        </div>
        <div className="event-analytics__card" data-testid="analytics-published-events">
          <span className="event-analytics__card-label">Publié</span>
          <strong>{summary?.published ?? 0}</strong>
        </div>
        <div className="event-analytics__card" data-testid="analytics-pending-events">
          <span className="event-analytics__card-label">En attente</span>
          <strong>{summary?.pendingApproval ?? 0}</strong>
        </div>
        <div className="event-analytics__card" data-testid="analytics-conversion-rate">
          <span className="event-analytics__card-label">Conversion</span>
          <strong>{formatPercent(summary?.conversionRate ?? 0)}</strong>
        </div>
        <div className="event-analytics__card" data-testid="analytics-attendance-rate">
          <span className="event-analytics__card-label">Taux de présence</span>
          <strong>{formatPercent(summary?.averageAttendanceRate ?? 0)}</strong>
        </div>
      </div>

      <div className="event-analytics__grid">
        <article className="event-analytics__panel">
          <header>
            <h3>Participation agrégée</h3>
            <p>Inscriptions vs présence réelle</p>
          </header>
          <svg ref={attendanceRef} role="img" aria-label="Tendance des participations" />
        </article>

        <article className="event-analytics__panel">
          <header>
            <h3>Taux de conversion</h3>
            {topConversion && (
              <p data-testid={`analytics-conversion-${topConversion.stage}`}>
                Étape la plus performante : {topConversion.stage} ({topConversion.value})
              </p>
            )}
          </header>
          <svg ref={conversionRef} role="img" aria-label="Histogramme des conversions" />
        </article>

        <article className="event-analytics__panel">
          <header>
            <h3>Entonnoir d'approbation</h3>
            <p>Suivi des validations par étape</p>
          </header>
          <svg ref={funnelRef} role="img" aria-label="Entonnoir d'approbation" />
        </article>

        <article className="event-analytics__panel event-analytics__panel--wide">
          <header>
            <h3>Heatmap d'engagement</h3>
            <p>Créneaux horaires les plus actifs</p>
          </header>
          <svg ref={heatmapRef} role="img" aria-label="Heatmap d'engagement" />
        </article>
      </div>
    </section>
  )
}


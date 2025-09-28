import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import {
  UserService,
  EngagementMetrics,
  MatchSuccessRate,
  ActivityHeatmapCell,
  CohortRetention,
  GeoDistributionBucket,
  EngagementMetricPoint
} from '../../services/userService'
import { useWebSocket } from '../../hooks/useWebSocket'
import {
  aggregateGeoDistribution,
  buildHeatmapMatrix,
  buildRetentionSeries,
  createHeatmapLookup,
  normaliseEngagement,
  upsertHeatmapCell,
  type HeatmapLookup,
  type RetentionSeries
} from '../../utils/analytics'

const RETENTION_CHART_SIZE = { width: 640, height: 320 }
const HEATMAP_CHART_SIZE = { width: 640, height: 360 }
const MAP_CHART_SIZE = { width: 640, height: 360 }

interface DashboardState {
  engagement: EngagementMetrics | null
  matchSuccess: MatchSuccessRate | null
  heatmap: ActivityHeatmapCell[]
  cohorts: CohortRetention[]
  geoDistribution: GeoDistributionBucket[]
  loading: boolean
  error: string | null
}

const INITIAL_STATE: DashboardState = {
  engagement: null,
  matchSuccess: null,
  heatmap: [],
  cohorts: [],
  geoDistribution: [],
  loading: true,
  error: null
}

type AnalyticsMessage =
  | { type: 'engagement'; summary?: Partial<EngagementMetrics['summary']>; point?: EngagementMetricPoint }
  | { type: 'heatmap'; day: string; hour: number; value: number }
  | { type: 'unknown'; [key: string]: unknown }

const SIMPLE_WORLD_FEATURES: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { region: 'North America' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-170, 10], [-50, 10], [-50, 75], [-170, 75], [-170, 10]]]
      }
    },
    {
      type: 'Feature',
      properties: { region: 'South America' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-90, -60], [-30, -60], [-30, 15], [-90, 15], [-90, -60]]]
      }
    },
    {
      type: 'Feature',
      properties: { region: 'Europe' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-25, 35], [40, 35], [40, 75], [-25, 75], [-25, 35]]]
      }
    },
    {
      type: 'Feature',
      properties: { region: 'Africa' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-20, -35], [55, -35], [55, 35], [-20, 35], [-20, -35]]]
      }
    },
    {
      type: 'Feature',
      properties: { region: 'Middle East' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[35, 10], [65, 10], [65, 35], [35, 35], [35, 10]]]
      }
    },
    {
      type: 'Feature',
      properties: { region: 'Asia' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[40, 5], [150, 5], [150, 75], [40, 75], [40, 5]]]
      }
    },
    {
      type: 'Feature',
      properties: { region: 'Oceania' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[110, -50], [180, -50], [180, 0], [110, 0], [110, -50]]]
      }
    }
  ]
}

const CHART_COLORS = d3.schemeTableau10

export function UserAnalyticsDashboard() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE)
  const heatmapLookupRef = useRef<HeatmapLookup>({})

  const retentionChartRef = useRef<SVGSVGElement | null>(null)
  const heatmapChartRef = useRef<SVGSVGElement | null>(null)
  const mapChartRef = useRef<SVGSVGElement | null>(null)

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const [engagement, matchSuccess, heatmap, cohorts, geoDistribution] = await Promise.all([
        UserService.getEngagementMetrics(),
        UserService.getMatchSuccessRate(),
        UserService.getActivityHeatmap(),
        UserService.getCohorts(),
        UserService.getGeoDistribution()
      ])

      heatmapLookupRef.current = createHeatmapLookup(heatmap)

      setState({
        engagement,
        matchSuccess,
        heatmap,
        cohorts,
        geoDistribution,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Failed to load user analytics dashboard data', error)
      setState(prev => ({ ...prev, loading: false, error: 'Impossible de charger le tableau de bord.' }))
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const analyticsSocketUrl = useMemo(() => {
    const wsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.replace(/\/$/, '')
    if (wsBase) {
      return `${wsBase}/users`
    }
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
    if (!apiBase) {
      return null
    }
    if (apiBase.startsWith('http')) {
      return `${apiBase.replace(/^http/, 'ws')}/ws/users`
    }
    return `ws://${apiBase}/ws/users`
  }, [])

  const { subscribe: subscribeToStream } = useWebSocket(analyticsSocketUrl, {
    enabled: Boolean(analyticsSocketUrl),
    reconnectInterval: 4000,
    maxReconnectInterval: 30000
  })

  useEffect(() => {
    if (!analyticsSocketUrl) {
      return undefined
    }

    return subscribeToStream(event => {
      try {
        const parsed = JSON.parse(event.data as string) as AnalyticsMessage
        if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
          return
        }
        switch (parsed.type) {
          case 'engagement':
            setState(prev => {
              if (!prev.engagement) {
                return prev
              }
              const nextSummary = parsed.summary
                ? { ...prev.engagement.summary, ...parsed.summary }
                : prev.engagement.summary
              let nextSeries = prev.engagement.series
              if (parsed.point) {
                const existingIndex = nextSeries.findIndex(point => point.timestamp === parsed.point?.timestamp)
                if (existingIndex >= 0) {
                  nextSeries = nextSeries.map(point =>
                    point.timestamp === parsed.point?.timestamp ? { ...point, ...parsed.point } : point
                  )
                } else {
                  nextSeries = [...nextSeries, parsed.point].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                }
              }
              return {
                ...prev,
                engagement: {
                  summary: nextSummary,
                  series: nextSeries
                }
              }
            })
            break
          case 'heatmap':
            setState(prev => {
              const update = { day: parsed.day, hour: parsed.hour, value: parsed.value }
              const nextCells = upsertHeatmapCell(heatmapLookupRef.current, update)
              heatmapLookupRef.current = createHeatmapLookup(nextCells)
              return {
                ...prev,
                heatmap: nextCells
              }
            })
            break
          default:
            break
        }
      } catch (error) {
        console.error('Failed to parse user analytics stream message', error)
      }
    })
  }, [analyticsSocketUrl, subscribeToStream])

  const retentionSeries = useMemo(() => buildRetentionSeries(state.cohorts), [state.cohorts])
  const heatmapMatrix = useMemo(() => buildHeatmapMatrix(state.heatmap), [state.heatmap])
  const geoRegions = useMemo(() => aggregateGeoDistribution(state.geoDistribution), [state.geoDistribution])
  const engagementNormalised = useMemo(() => normaliseEngagement(state.engagement?.series ?? []), [state.engagement])

  useEffect(() => {
    renderRetentionChart(retentionChartRef.current, retentionSeries)
  }, [retentionSeries])

  useEffect(() => {
    renderHeatmapChart(heatmapChartRef.current, heatmapMatrix)
  }, [heatmapMatrix])

  useEffect(() => {
    renderChoropleth(mapChartRef.current, geoRegions)
  }, [geoRegions])

  return (
    <section className="user-analytics-dashboard">
      <header className="user-analytics-dashboard__summary">
        <div>
          <h2>Engagement des utilisateurs</h2>
          {state.engagement ? (
            <div className="user-analytics-dashboard__kpis">
              <span data-testid="engagement-dau">DAU: {state.engagement.summary.dailyActiveUsers.toLocaleString()}</span>
              <span data-testid="engagement-wau">WAU: {state.engagement.summary.weeklyActiveUsers.toLocaleString()}</span>
              <span data-testid="engagement-mau">MAU: {state.engagement.summary.monthlyActiveUsers.toLocaleString()}</span>
              <span data-testid="engagement-score">
                Score: {state.engagement.summary.engagementScore.toFixed(1)}
              </span>
            </div>
          ) : (
            <p data-testid="engagement-loading">Chargement des métriques d'engagement…</p>
          )}
        </div>
        {state.matchSuccess && (
          <aside className="user-analytics-dashboard__match" data-testid="match-success">
            <h3>Taux de matching</h3>
            <p data-testid="match-overall">{(state.matchSuccess.overallRate * 100).toFixed(1)}%</p>
            <ul>
              {state.matchSuccess.segments.map(segment => (
                <li key={segment.segment} data-testid={`match-segment-${segment.segment}`}>
                  {segment.segment}: {(segment.rate * 100).toFixed(1)}%
                </li>
              ))}
            </ul>
          </aside>
        )}
      </header>

      {state.error && <div className="user-analytics-dashboard__error">{state.error}</div>}

      <div className="user-analytics-dashboard__grid">
        <article className="user-analytics-dashboard__card" data-testid="retention-card">
          <header>
            <h3>Rétention par cohorte</h3>
          </header>
          <svg ref={retentionChartRef} data-testid="retention-chart" role="img" aria-label="Graphique de rétention" />
        </article>
        <article className="user-analytics-dashboard__card" data-testid="heatmap-card">
          <header>
            <h3>Heatmap horaire</h3>
          </header>
          <svg ref={heatmapChartRef} data-testid="heatmap-chart" role="img" aria-label="Heatmap d'activité" />
        </article>
        <article className="user-analytics-dashboard__card" data-testid="geo-card">
          <header>
            <h3>Carte choroplèthe</h3>
          </header>
          <svg ref={mapChartRef} data-testid="geo-chart" role="img" aria-label="Carte choroplèthe des utilisateurs" />
        </article>
      </div>

      {state.matchSuccess && state.matchSuccess.trend.length > 0 && (
        <footer className="user-analytics-dashboard__footer">
          <h4>Tendance du taux de matching</h4>
          <div className="user-analytics-dashboard__trend" data-testid="match-trend">
            {state.matchSuccess.trend.map(point => (
              <span key={point.date}>{point.date}: {(point.rate * 100).toFixed(1)}%</span>
            ))}
          </div>
        </footer>
      )}

      {engagementNormalised.length > 0 && (
        <div className="user-analytics-dashboard__sparkline" data-testid="engagement-sparkline">
          {engagementNormalised.map((value, index) => (
            <span key={index} style={{ height: `${Math.round(value * 100)}%` }} />
          ))}
        </div>
      )}
    </section>
  )
}

function renderRetentionChart(svgElement: SVGSVGElement | null, series: RetentionSeries[]) {
  if (!svgElement) {
    return
  }
  const svg = d3.select(svgElement)
  svg.selectAll('*').remove()
  svg.attr('viewBox', `0 0 ${RETENTION_CHART_SIZE.width} ${RETENTION_CHART_SIZE.height}`)

  if (series.length === 0) {
    svg
      .append('text')
      .attr('x', RETENTION_CHART_SIZE.width / 2)
      .attr('y', RETENTION_CHART_SIZE.height / 2)
      .attr('text-anchor', 'middle')
      .text('Aucune donnée')
    return
  }

  const margin = { top: 32, right: 24, bottom: 40, left: 48 }
  const width = RETENTION_CHART_SIZE.width - margin.left - margin.right
  const height = RETENTION_CHART_SIZE.height - margin.top - margin.bottom
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const flatPoints = series.flatMap(s => s.points)
  const maxX = d3.max(flatPoints, point => point.periodIndex) ?? 1
  const x = d3.scaleLinear().domain([0, maxX]).range([0, width])
  const y = d3.scaleLinear().domain([0, 1]).range([height, 0])

  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(value => `${value}`)
  const yAxis = d3.axisLeft(y).ticks(5).tickFormat(value => `${Math.round(Number(value) * 100)}%`)

  g.append('g').attr('transform', `translate(0,${height})`).call(xAxis)
  g.append('g').call(yAxis)

  const line = d3
    .line<RetentionSeries['points'][number]>()
    .x(point => x(point.periodIndex))
    .y(point => y(point.rate))
    .curve(d3.curveMonotoneX)

  series.forEach((serie, index) => {
    g.append('path')
      .datum(serie.points)
      .attr('fill', 'none')
      .attr('stroke', CHART_COLORS[index % CHART_COLORS.length])
      .attr('stroke-width', 2)
      .attr('d', line)
  })

  const legend = g
    .append('g')
    .attr('transform', `translate(${width - 150},0)`)

  series.forEach((serie, index) => {
    const row = legend.append('g').attr('transform', `translate(0, ${index * 20})`)
    row
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', CHART_COLORS[index % CHART_COLORS.length])
    row
      .append('text')
      .attr('x', 18)
      .attr('y', 10)
      .text(serie.cohort)
  })
}

function renderHeatmapChart(svgElement: SVGSVGElement | null, matrix: ReturnType<typeof buildHeatmapMatrix>) {
  if (!svgElement) {
    return
  }

  const svg = d3.select(svgElement)
  svg.selectAll('*').remove()
  svg.attr('viewBox', `0 0 ${HEATMAP_CHART_SIZE.width} ${HEATMAP_CHART_SIZE.height}`)

  if (matrix.rows.length === 0 || matrix.columns.length === 0) {
    svg
      .append('text')
      .attr('x', HEATMAP_CHART_SIZE.width / 2)
      .attr('y', HEATMAP_CHART_SIZE.height / 2)
      .attr('text-anchor', 'middle')
      .text('Aucune donnée')
    return
  }

  const margin = { top: 40, right: 24, bottom: 60, left: 96 }
  const width = HEATMAP_CHART_SIZE.width - margin.left - margin.right
  const height = HEATMAP_CHART_SIZE.height - margin.top - margin.bottom
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleBand<number>().domain(matrix.columns).range([0, width]).padding(0.05)
  const y = d3.scaleBand<string>().domain(matrix.rows).range([0, height]).padding(0.05)
  const color = d3
    .scaleSequential(d3.interpolateYlOrRd)
    .domain([0, matrix.maxValue === 0 ? 1 : matrix.maxValue])

  matrix.rows.forEach((row, rowIndex) => {
    matrix.columns.forEach((column, columnIndex) => {
      const value = matrix.values[rowIndex]?.[columnIndex] ?? 0
      g.append('rect')
        .attr('x', x(column) ?? 0)
        .attr('y', y(row) ?? 0)
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('fill', color(value))
        .append('title')
        .text(`${row} ${column}h → ${value}`)
    })
  })

  const xAxis = d3.axisBottom(x)
  const yAxis = d3.axisLeft(y)

  g.append('g').attr('transform', `translate(0,${height})`).call(xAxis)
  g.append('g').call(yAxis)
}

function renderChoropleth(svgElement: SVGSVGElement | null, data: ReturnType<typeof aggregateGeoDistribution>) {
  if (!svgElement) {
    return
  }

  const svg = d3.select(svgElement)
  svg.selectAll('*').remove()
  svg.attr('viewBox', `0 0 ${MAP_CHART_SIZE.width} ${MAP_CHART_SIZE.height}`)

  const projection = d3
    .geoMercator()
    .fitSize([MAP_CHART_SIZE.width - 40, MAP_CHART_SIZE.height - 40], SIMPLE_WORLD_FEATURES)
  const path = d3.geoPath(projection)

  const maxValue = d3.max(data, d => d.value) ?? 0
  const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxValue === 0 ? 1 : maxValue])

  const g = svg.append('g').attr('transform', 'translate(20,20)')

  g.selectAll('path')
    .data(SIMPLE_WORLD_FEATURES.features)
    .enter()
    .append('path')
    .attr('d', path as any)
    .attr('stroke', '#1f2937')
    .attr('stroke-width', 0.5)
    .attr('fill', feature => {
      const region = feature.properties?.region as string
      const datum = data.find(entry => entry.id === region)
      return color(datum?.value ?? 0)
    })
    .append('title')
    .text(feature => {
      const region = feature.properties?.region as string
      const datum = data.find(entry => entry.id === region)
      return `${region}: ${datum?.value ?? 0}`
    })

  const legendWidth = 200
  const legendHeight = 12
  const legendMargin = { top: MAP_CHART_SIZE.height - 40, left: MAP_CHART_SIZE.width - legendWidth - 40 }

  const legend = svg.append('g').attr('transform', `translate(${legendMargin.left}, ${legendMargin.top})`)

  const gradientId = 'user-analytics-map-gradient'
  const defs = svg.append('defs')
  const gradient = defs.append('linearGradient').attr('id', gradientId)
  gradient.attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%')
  gradient
    .selectAll('stop')
    .data([0, 1])
    .enter()
    .append('stop')
    .attr('offset', d => `${d * 100}%`)
    .attr('stop-color', d => color(d * maxValue))

  legend
    .append('rect')
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('fill', `url(#${gradientId})`)

  const legendScale = d3.scaleLinear().domain([0, maxValue]).range([0, legendWidth])
  const legendAxis = d3.axisBottom(legendScale).ticks(4)

  legend.append('g').attr('transform', `translate(0, ${legendHeight})`).call(legendAxis)
}

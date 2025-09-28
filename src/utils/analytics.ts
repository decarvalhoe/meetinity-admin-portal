import type {
  ActivityHeatmapCell,
  CohortRetention,
  CohortRetentionPoint,
  EngagementMetricPoint,
  GeoDistributionBucket
} from '../services/userService'

/**
 * Normalised representation of a cohort retention curve that D3 can consume.
 */
export interface RetentionSeriesPoint {
  periodIndex: number
  periodLabel: string
  rate: number
}

export interface RetentionSeries {
  cohort: string
  points: RetentionSeriesPoint[]
}

/**
 * Computes cohort based retention series with a deterministic period order so that
 * D3 line charts can easily render retention curves across cohorts.
 */
export function buildRetentionSeries(cohorts: CohortRetention[]): RetentionSeries[] {
  return cohorts.map(cohort => {
    const indexedPoints = cohort.values
      .map((value, index) => ({ index, derivedIndex: derivePeriodIndex(value, index), value }))
      .sort((a, b) => a.derivedIndex - b.derivedIndex)
      .map(({ value, derivedIndex }) => ({
        periodIndex: derivedIndex,
        periodLabel: value.period,
        rate: clampRate(value.rate)
      }))

    return {
      cohort: cohort.cohort,
      points: indexedPoints
    }
  })
}

const PERIOD_MATCHER = /(\d+(?:[.,]\d+)?)/

function derivePeriodIndex(point: CohortRetentionPoint, fallbackIndex: number): number {
  const match = point.period.match(PERIOD_MATCHER)
  if (!match) {
    return fallbackIndex
  }
  const numeric = Number(match[1].replace(',', '.'))
  if (Number.isFinite(numeric)) {
    return numeric
  }
  return fallbackIndex
}

function clampRate(rate: number): number {
  if (Number.isNaN(rate)) {
    return 0
  }
  if (rate < 0) {
    return 0
  }
  if (rate > 1 && rate <= 100) {
    return rate / 100
  }
  if (rate > 1) {
    return 1
  }
  return rate
}

export interface HeatmapMatrix {
  rows: string[]
  columns: number[]
  values: number[][]
  maxValue: number
}

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche'
]

function resolveDayIndex(day: string, fallbackIndex: number): number {
  const idx = DAY_ORDER.indexOf(day.toLowerCase())
  return idx === -1 ? fallbackIndex : idx
}

/**
 * Builds a two-dimensional matrix describing activity intensity so we can paint
 * a D3 heatmap without recomputing lookups in render loops.
 */
export function buildHeatmapMatrix(cells: ActivityHeatmapCell[]): HeatmapMatrix {
  const rows: string[] = []
  const rowIndex = new Map<string, number>()
  const columnsSet = new Set<number>()
  let maxValue = 0

  const sortedCells = [...cells].sort((a, b) => {
    const dayDiff =
      resolveDayIndex(a.day, Number.MAX_SAFE_INTEGER) - resolveDayIndex(b.day, Number.MAX_SAFE_INTEGER)
    if (dayDiff !== 0) {
      return dayDiff
    }
    return a.hour - b.hour
  })

  sortedCells.forEach(cell => {
    if (!rowIndex.has(cell.day)) {
      rowIndex.set(cell.day, rows.length)
      rows.push(cell.day)
    }
    columnsSet.add(cell.hour)
  })

  const columns = Array.from(columnsSet).sort((a, b) => a - b)
  const columnIndex = new Map(columns.map((hour, index) => [hour, index]))
  const values = rows.map(() => columns.map(() => 0))

  sortedCells.forEach(cell => {
    const r = rowIndex.get(cell.day)
    const c = columnIndex.get(cell.hour)
    if (typeof r === 'number' && typeof c === 'number') {
      values[r][c] = cell.value
      if (cell.value > maxValue) {
        maxValue = cell.value
      }
    }
  })

  return {
    rows,
    columns,
    values,
    maxValue
  }
}

export interface ChoroplethRegionDatum {
  id: string
  label: string
  value: number
}

const COUNTRY_REGION_MAP: Record<string, string> = {
  US: 'North America',
  CA: 'North America',
  MX: 'North America',
  BR: 'South America',
  AR: 'South America',
  CL: 'South America',
  GB: 'Europe',
  FR: 'Europe',
  DE: 'Europe',
  ES: 'Europe',
  IT: 'Europe',
  PT: 'Europe',
  NL: 'Europe',
  BE: 'Europe',
  PL: 'Europe',
  SE: 'Europe',
  NO: 'Europe',
  DK: 'Europe',
  FI: 'Europe',
  IE: 'Europe',
  CH: 'Europe',
  AT: 'Europe',
  CN: 'Asia',
  JP: 'Asia',
  KR: 'Asia',
  SG: 'Asia',
  IN: 'Asia',
  ID: 'Asia',
  TH: 'Asia',
  PH: 'Asia',
  AE: 'Middle East',
  SA: 'Middle East',
  QA: 'Middle East',
  ZA: 'Africa',
  NG: 'Africa',
  EG: 'Africa',
  KE: 'Africa',
  MA: 'Africa',
  TN: 'Africa',
  AU: 'Oceania',
  NZ: 'Oceania'
}

const REGION_LABELS = [
  'North America',
  'South America',
  'Europe',
  'Africa',
  'Middle East',
  'Asia',
  'Oceania',
  'Other'
]

/**
 * Aggregates country level distribution into wider geographic buckets in order to
 * render a simplified choropleth representation without shipping a large GeoJSON dataset.
 */
export function aggregateGeoDistribution(buckets: GeoDistributionBucket[]): ChoroplethRegionDatum[] {
  const totals = new Map<string, number>()

  buckets.forEach(bucket => {
    const region = COUNTRY_REGION_MAP[bucket.countryCode.toUpperCase()] ?? 'Other'
    const previous = totals.get(region) ?? 0
    totals.set(region, previous + bucket.userCount)
  })

  return REGION_LABELS.map(region => ({
    id: region,
    label: region,
    value: totals.get(region) ?? 0
  }))
}

/**
 * Projects engagement activity into a single normalised range so that radial gauges or
 * summary visuals can be created without duplicating code in React components.
 */
export function normaliseEngagement(series: EngagementMetricPoint[]): number[] {
  const max = series.reduce((acc, point) => Math.max(acc, point.activeUsers), 0)
  if (max === 0) {
    return series.map(() => 0)
  }
  return series.map(point => point.activeUsers / max)
}

export type HeatmapLookup = Record<string, Record<number, ActivityHeatmapCell>>

/**
 * Creates an indexable structure for heatmap cells keyed by day/hour, used when
 * merging realtime WebSocket updates.
 */
export function createHeatmapLookup(cells: ActivityHeatmapCell[]): HeatmapLookup {
  return cells.reduce<HeatmapLookup>((acc, cell) => {
    if (!acc[cell.day]) {
      acc[cell.day] = {}
    }
    acc[cell.day][cell.hour] = cell
    return acc
  }, {})
}

/**
 * Applies a single cell update to an existing lookup, returning a brand new array
 * representation that can easily be fed back into D3 data joins.
 */
export function upsertHeatmapCell(lookup: HeatmapLookup, update: ActivityHeatmapCell): ActivityHeatmapCell[] {
  const next: HeatmapLookup = { ...lookup, [update.day]: { ...(lookup[update.day] ?? {}) } }
  next[update.day][update.hour] = update

  const rows = Object.entries(next)
    .sort((a, b) => resolveDayIndex(a[0], Number.MAX_SAFE_INTEGER) - resolveDayIndex(b[0], Number.MAX_SAFE_INTEGER))
    .map(([, hours]) => Object.values(hours))

  return rows.flat()
}

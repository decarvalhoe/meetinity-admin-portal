import React from 'react'
import {
  type MonitoringHistoryRange,
  type MonitoringHistorySeries,
  MONITORING_INDICATOR_LABELS
} from '../../services/monitoringService'

interface MetricsTimelineProps {
  range: MonitoringHistoryRange
  series: MonitoringHistorySeries[]
  isLoading?: boolean
  onRangeChange?: (range: MonitoringHistoryRange) => void
}

const RANGE_OPTIONS: { label: string; value: MonitoringHistoryRange }[] = [
  { label: '24 heures', value: '24h' },
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' }
]

export function MetricsTimeline({ range, series, isLoading = false, onRangeChange }: MetricsTimelineProps) {
  return (
    <section
      aria-labelledby="metrics-timeline-title"
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 id="metrics-timeline-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Historique des métriques
          </h2>
          <p style={{ margin: '4px 0 0', color: '#4b5563', fontSize: '0.875rem' }}>
            Analyse comparative des 24h, 7j et 30j pour détecter les dérives.
          </p>
        </div>
        <div role="group" aria-label="Sélection de la période" style={{ display: 'flex', gap: '8px' }}>
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              data-testid={`monitoring-range-${option.value}`}
              onClick={() => onRangeChange?.(option.value)}
              aria-pressed={range === option.value}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: range === option.value ? '1px solid #2563eb' : '1px solid rgba(148, 163, 184, 0.4)',
                background: range === option.value ? '#2563eb' : '#ffffff',
                color: range === option.value ? '#fff' : '#0f172a',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <p style={{ margin: 0, color: '#64748b' }}>Chargement de l'historique...</p>
      ) : series.length === 0 ? (
        <p data-testid="monitoring-history-empty" style={{ margin: 0, color: '#6b7280' }}>
          Aucun historique disponible pour cette période.
        </p>
      ) : (
        <div
          data-testid="monitoring-history-list"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}
        >
          {series.map(item => {
            const points = item.points.slice(-8)
            const lastPoint = points[points.length - 1]

            return (
              <article
                key={`${item.serviceId}-${item.indicator}`}
                data-testid={`monitoring-history-${item.serviceId}-${item.indicator}`}
                style={{
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: 'rgba(248, 250, 252, 0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <header>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{item.serviceName || item.serviceId}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#475569' }}>
                    {MONITORING_INDICATOR_LABELS[item.indicator]}
                  </p>
                </header>
                <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#0f172a' }}>
                  Dernière valeur :{' '}
                  <strong>{lastPoint ? lastPoint.value.toFixed(2) : '—'}</strong>
                </p>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  {points.map(point => (
                    <li key={point.timestamp} style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(point.timestamp).toLocaleString()} · {point.value.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

import React, { useMemo } from 'react'
import {
  type MonitoredService,
  type MonitoringIncident,
  type ServiceStatusSummary,
  MONITORING_STATUS_COLORS,
  MONITORING_STATUS_LABELS
} from '../../services/monitoringService'

interface ServiceHealthCardProps {
  service: MonitoredService
  status?: ServiceStatusSummary
  incidents?: MonitoringIncident[]
}

function computeIndicatorSeverity(value: number, warning: number, critical: number) {
  if (value >= critical) {
    return 'critical'
  }
  if (value >= warning) {
    return 'warning'
  }
  return 'normal'
}

const severityColors: Record<'normal' | 'warning' | 'critical', string> = {
  normal: '#15803d',
  warning: '#f59e0b',
  critical: '#dc2626'
}

export function ServiceHealthCard({ service, status, incidents = [] }: ServiceHealthCardProps) {
  const mergedStatus = status?.status ?? service.status
  const activeIncidents = useMemo(() => incidents.filter(incident => !incident.resolvedAt), [incidents])

  return (
    <article
      data-testid={`monitoring-service-${service.id}`}
      data-status={mergedStatus}
      style={{
        border: `1px solid rgba(15, 23, 42, 0.1)`,
        borderRadius: '12px',
        padding: '20px',
        background: '#ffffff',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', margin: 0 }}>{service.name}</h3>
          <p style={{ margin: '4px 0 0', color: '#4b5563' }}>
            {service.environment}
            {service.region ? ` · ${service.region}` : ''}
          </p>
        </div>
        <span
          aria-label={`Statut ${MONITORING_STATUS_LABELS[mergedStatus]}`}
          style={{
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#fff',
            backgroundColor: MONITORING_STATUS_COLORS[mergedStatus]
          }}
        >
          {MONITORING_STATUS_LABELS[mergedStatus]}
        </span>
      </header>

      {service.description && <p style={{ margin: 0, color: '#4b5563' }}>{service.description}</p>}

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          margin: 0
        }}
      >
        {service.indicators.map(indicator => {
          const severity = computeIndicatorSeverity(
            indicator.value,
            indicator.thresholds.warning,
            indicator.thresholds.critical
          )

          return (
            <div
              key={`${service.id}-${indicator.type}`}
              data-testid={`monitoring-indicator-${service.id}-${indicator.type}`}
              data-severity={severity}
              style={{
                borderRadius: '10px',
                padding: '12px',
                background:
                  severity === 'critical'
                    ? 'rgba(220, 38, 38, 0.08)'
                    : severity === 'warning'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(20, 83, 45, 0.08)'
              }}
            >
              <dt style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '6px' }}>{indicator.label}</dt>
              <dd style={{ margin: 0, fontWeight: 600, fontSize: '1.125rem', color: severityColors[severity] }}>
                {indicator.value.toFixed(1)} {indicator.unit}
              </dd>
              {typeof indicator.trend === 'number' && (
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Tendance :{' '}
                  {indicator.trend > 0 ? '▲' : indicator.trend < 0 ? '▼' : '→'}
                  {Math.abs(indicator.trend).toFixed(1)}%
                </p>
              )}
              {indicator.lastUpdatedAt && (
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Mis à jour {new Date(indicator.lastUpdatedAt).toLocaleTimeString()}
                </p>
              )}
              {severity === 'critical' && (
                <p
                  role="alert"
                  style={{
                    margin: '6px 0 0',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#991b1b'
                  }}
                >
                  Alerte critique détectée
                </p>
              )}
            </div>
          )
        })}
      </dl>

      <footer style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563' }}>
          Uptime 30j : {status?.uptimePercentage.toFixed(2) ?? '—'}%
        </p>
        {activeIncidents.length > 0 ? (
          <ul
            data-testid={`monitoring-incidents-${service.id}`}
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {activeIncidents.map(incident => (
              <li
                key={incident.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: incident.severity === 'critical' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: incident.severity === 'critical' ? '#7f1d1d' : '#78350f',
                  fontSize: '0.8125rem'
                }}
              >
                <strong style={{ display: 'block', marginBottom: '2px' }}>{incident.indicator.toUpperCase()}</strong>
                {incident.message}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#16a34a' }}>Aucune alerte active</p>
        )}
      </footer>
    </article>
  )
}

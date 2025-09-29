import React from 'react'
import {
  MONITORING_STATUS_COLORS,
  MONITORING_STATUS_LABELS,
  type MonitoringHealthStatus
} from '../../services/monitoringService'

interface StatusLegendProps {
  orientation?: 'horizontal' | 'vertical'
}

export function StatusLegend({ orientation = 'horizontal' }: StatusLegendProps) {
  return (
    <ul
      aria-label="Légende des statuts"
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        gap: '16px',
        listStyle: 'none',
        padding: 0,
        margin: 0,
        fontSize: '0.875rem'
      }}
    >
      {(Object.keys(MONITORING_STATUS_LABELS) as MonitoringHealthStatus[]).map(status => (
        <li key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            aria-hidden
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '999px',
              backgroundColor: MONITORING_STATUS_COLORS[status]
            }}
          />
          <span>{MONITORING_STATUS_LABELS[status]}</span>
        </li>
      ))}
    </ul>
  )
}

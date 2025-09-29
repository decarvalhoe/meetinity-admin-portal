import React from 'react'
import { BusinessKpi } from '../../services/financialService'

interface BusinessKpiCardsProps {
  kpis: BusinessKpi[]
}

const formatValue = (kpi: BusinessKpi) => {
  if (kpi.format === 'currency') {
    return `€${kpi.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (kpi.format === 'percentage') {
    return `${kpi.value.toFixed(2)}%`
  }

  return kpi.value.toFixed(2)
}

const formatDelta = (kpi: BusinessKpi) => {
  if (kpi.delta === 0) {
    return null
  }

  const prefix = kpi.delta > 0 ? '+' : ''

  if (kpi.format === 'currency') {
    return `${prefix}€${kpi.delta.toFixed(2)}`
  }

  return `${prefix}${kpi.delta.toFixed(2)}${kpi.format === 'percentage' ? '%' : ''}`
}

export const BusinessKpiCards: React.FC<BusinessKpiCardsProps> = ({ kpis }) => {
  if (!kpis.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        KPIs en cours de calcul...
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const deltaText = formatDelta(kpi)
        return (
          <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{formatValue(kpi)}</div>
            {deltaText && (
              <div className={`mt-1 text-sm ${kpi.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{deltaText}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AuditTrailEntry,
  AuditTrailParams,
  ModerationFilters,
  ModerationService,
  ModerationStatus,
  MODERATION_STATUS_LABELS,
  ReportedContent
} from '../../services/moderationService'
import { usePagination } from '../../hooks/usePagination'
import { useDebounce } from '../../hooks/useDebounce'
import { ReportedContentTable } from './ReportedContentTable'
import { UserModerationPanel } from './UserModerationPanel'
import { ModerationRulesEditor } from './ModerationRulesEditor'
import { AppealsQueue } from './AppealsQueue'
import { exportCsv, type ExportColumn } from '../../utils/export'

const STATUS_LABELS: Record<ModerationStatus | 'all', string> = {
  all: 'Tous les statuts',
  ...MODERATION_STATUS_LABELS
}

const severityOptions = [
  { value: 'all', label: 'Toutes les sévérités' },
  { value: 'low', label: 'Faible' },
  { value: 'medium', label: 'Modérée' },
  { value: 'high', label: 'Critique' }
]

const contentTypes = [
  { value: 'all', label: 'Tous les contenus' },
  { value: 'message', label: 'Messages' },
  { value: 'post', label: 'Publications' },
  { value: 'profile', label: 'Profils' }
]

interface DashboardFilters extends ModerationFilters {
  search: string
  status: ModerationStatus | 'all'
  severity: 'low' | 'medium' | 'high' | 'all'
  contentType: string
}

const defaultFilters: DashboardFilters = {
  search: '',
  status: 'pending',
  severity: 'all',
  contentType: 'all'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const auditColumns: ExportColumn<AuditTrailEntry>[] = [
  {
    key: 'timestamp',
    header: 'Horodatage',
    formatter: value => new Date(String(value)).toISOString()
  },
  { key: 'actor', header: 'Acteur' },
  { key: 'action', header: 'Action' },
  { key: 'targetType', header: 'Type de cible' },
  { key: 'targetId', header: 'ID cible' },
  {
    key: 'status',
    header: 'Statut',
    formatter: value => (value ? STATUS_LABELS[value as ModerationStatus] || value : 'N/A')
  }
]

export function ModerationDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters)
  const [selectedReport, setSelectedReport] = useState<ReportedContent | null>(null)
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [isAuditLoading, setIsAuditLoading] = useState(false)

  const { page, pageSize, setPage } = usePagination(20)
  const debouncedSearch = useDebounce(filters.search, 250)

  const normalizedFilters = useMemo<ModerationFilters>(
    () => ({
      ...filters,
      search: debouncedSearch
    }),
    [filters, debouncedSearch]
  )

  const loadAuditTrail = useCallback(async () => {
    setIsAuditLoading(true)
    setAuditError(null)

    try {
      const { entries, total } = await ModerationService.getAuditTrail({
        ...normalizedFilters,
        page,
        pageSize
      })
      setAuditTrail(entries)
      setAuditTotal(total)
    } catch (error) {
      console.error('Failed to load audit trail', error)
      setAuditError("Impossible de charger l'historique des décisions.")
    } finally {
      setIsAuditLoading(false)
    }
  }, [normalizedFilters, page, pageSize])

  useEffect(() => {
    loadAuditTrail()
  }, [loadAuditTrail])

  const handleFilterChange = (changes: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...changes }))
    setPage(0)
  }

  const handleReportSelection = (report: ReportedContent | null) => {
    setSelectedReport(report)
  }

  const handleDecisionComplete = (updated: ReportedContent) => {
    setSelectedReport(updated)
    loadAuditTrail()
  }

  const handleAuditExport = async (format: 'json' | 'csv') => {
    try {
      const query: AuditTrailParams = {
        ...normalizedFilters,
        page: 0,
        pageSize: Math.max(auditTotal, pageSize)
      }

      const { entries, total } = await ModerationService.getAuditTrail(query)

      if (format === 'csv') {
        await exportCsv({
          filename: 'audit-trail',
          data: entries,
          columns: auditColumns,
          metadata: {
            total,
            filters: {
              search: normalizedFilters.search || undefined,
              status: normalizedFilters.status || undefined,
              severity: normalizedFilters.severity || undefined,
              contentType: normalizedFilters.contentType || undefined
            }
          }
        })
      } else {
        const blob = new Blob([JSON.stringify({ entries, total }, null, 2)], {
          type: 'application/json'
        })
        downloadBlob(blob, 'audit-trail.json')
      }
    } catch (error) {
      console.error('Failed to export audit trail', error)
      setAuditError("L'export de l'historique a échoué. Réessayez ultérieurement.")
    }
  }

  return (
    <div className="moderation-dashboard">
      <header className="moderation-dashboard__header">
        <div>
          <h2>Centre de modération</h2>
          <p>Inspectez les signalements, appliquez des décisions et ajustez les règles automatiques.</p>
        </div>
        <div className="moderation-dashboard__export">
          <button type="button" onClick={() => handleAuditExport('json')} data-testid="audit-export-json">
            Export JSON
          </button>
          <button type="button" onClick={() => handleAuditExport('csv')} data-testid="audit-export-csv">
            Export CSV
          </button>
        </div>
      </header>

      <section className="moderation-dashboard__filters">
        <input
          type="search"
          placeholder="Rechercher un contenu, un utilisateur ou une règle"
          value={filters.search}
          onChange={event => handleFilterChange({ search: event.target.value })}
          aria-label="Recherche de signalements"
        />
        <select
          value={filters.status}
          onChange={event => handleFilterChange({ status: event.target.value as DashboardFilters['status'] })}
          aria-label="Filtrer par statut"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filters.severity}
          onChange={event => handleFilterChange({ severity: event.target.value as DashboardFilters['severity'] })}
          aria-label="Filtrer par sévérité"
        >
          {severityOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={filters.contentType}
          onChange={event => handleFilterChange({ contentType: event.target.value })}
          aria-label="Filtrer par type de contenu"
        >
          {contentTypes.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => handleFilterChange(defaultFilters)}>
          Réinitialiser
        </button>
      </section>

      <section className="moderation-dashboard__main">
        <div className="moderation-dashboard__reports">
          <ReportedContentTable
            filters={normalizedFilters}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onSelectReport={handleReportSelection}
            selectedReportId={selectedReport?.id}
          />
        </div>
        <aside className="moderation-dashboard__panel">
          <UserModerationPanel
            report={selectedReport}
            onDecisionComplete={handleDecisionComplete}
            filters={normalizedFilters}
          />
        </aside>
      </section>

      <section className="moderation-dashboard__secondary">
        <ModerationRulesEditor filters={normalizedFilters} onRulesUpdated={loadAuditTrail} />
        <AppealsQueue
          filters={normalizedFilters}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onDecision={loadAuditTrail}
        />
      </section>

      <section className="moderation-dashboard__audit" aria-live="polite">
        <header className="moderation-dashboard__audit-header">
          <h3>Historique des décisions</h3>
          <span>
            {auditTotal} entrée{auditTotal > 1 ? 's' : ''}
          </span>
        </header>
        {isAuditLoading && <p>Chargement de l'historique…</p>}
        {auditError && <p className="moderation-dashboard__error">{auditError}</p>}
        {!isAuditLoading && !auditError && auditTrail.length === 0 && (
          <p>Aucune action enregistrée pour les filtres actuels.</p>
        )}
        <ul className="moderation-dashboard__audit-list">
          {auditTrail.map(entry => (
            <li key={entry.id} className="moderation-dashboard__audit-item">
              <div>
                <strong>{entry.action}</strong>
                <div className="moderation-dashboard__audit-meta">
                  <span>Par {entry.actor}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div className="moderation-dashboard__audit-target">
                <span>Sur {entry.targetType}</span>
                <span>ID : {entry.targetId}</span>
                {entry.status && <span>Statut : {STATUS_LABELS[entry.status]}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

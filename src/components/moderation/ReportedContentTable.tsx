import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  MODERATION_STATUS_LABELS,
  ModerationFilters,
  ModerationService,
  ReportedContent
} from '../../services/moderationService'

interface ReportedContentTableProps {
  filters: ModerationFilters
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onSelectReport: (report: ReportedContent | null) => void
  selectedReportId?: string
}

export function ReportedContentTable({
  filters,
  page,
  pageSize,
  onPageChange,
  onSelectReport,
  selectedReportId
}: ReportedContentTableProps) {
  const [reports, setReports] = useState<ReportedContent[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const normalizedFilters = useMemo(() => ({
    ...filters,
    status: filters.status === 'all' ? undefined : filters.status,
    severity: filters.severity === 'all' ? undefined : filters.severity,
    contentType: filters.contentType === 'all' ? undefined : filters.contentType,
    ruleId: filters.ruleId || undefined
  }), [filters])

  useEffect(() => {
    let isMounted = true
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest

    const fetchReports = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { reports: data, total: totalCount } = await ModerationService.listReports({
          ...normalizedFilters,
          page,
          pageSize
        })

        if (!isMounted || currentRequest !== requestId.current) {
          return
        }

        setReports(data)
        setTotal(totalCount)

        if (data.length === 0 && page > 0) {
          onPageChange(Math.max(0, page - 1))
        }
      } catch (err) {
        console.error('Failed to load reported content', err)
        if (isMounted) {
          setError('Impossible de récupérer les signalements.')
        }
      } finally {
        if (isMounted && currentRequest === requestId.current) {
          setIsLoading(false)
        }
      }
    }

    fetchReports()

    return () => {
      isMounted = false
    }
  }, [normalizedFilters, onPageChange, page, pageSize])

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0

  return (
    <div className="moderation-reports">
      <header className="moderation-reports__header">
        <h3>Signalements</h3>
        <span>{total} résultat{total > 1 ? 's' : ''}</span>
      </header>
      {isLoading && <p>Chargement des signalements…</p>}
      {error && <p className="moderation-dashboard__error">{error}</p>}
      {!isLoading && !error && reports.length === 0 && <p>Aucun signalement pour ces filtres.</p>}
      {!isLoading && !error && reports.length > 0 && (
        <table className="moderation-reports__table" data-testid="reported-content-table">
          <thead>
            <tr>
              <th>Contenu</th>
              <th>Raison</th>
              <th>Gravité</th>
              <th>Statut</th>
              <th>Assigné à</th>
              <th>Signalé le</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(report => {
              const isSelected = report.id === selectedReportId
              return (
                <tr
                  key={report.id}
                  className={isSelected ? 'moderation-reports__row--selected' : undefined}
                  onClick={() => onSelectReport(report)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectReport(report)
                    }
                  }}
                  data-testid={`report-row-${report.id}`}
                >
                  <td>
                    <div className="moderation-reports__snippet">{report.snippet}</div>
                    <div className="moderation-reports__metadata">ID contenu : {report.contentId}</div>
                  </td>
                  <td>{report.reason}</td>
                  <td className={`moderation-reports__severity--${report.severity}`}>{report.severity}</td>
                  <td>{MODERATION_STATUS_LABELS[report.status]}</td>
                  <td>{report.assignedTo || 'Non assigné'}</td>
                  <td>{new Date(report.createdAt).toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <footer className="moderation-reports__pagination">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={isLoading || page === 0}
        >
          Précédent
        </button>
        <span>
          Page {totalPages === 0 ? 0 : page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLoading || totalPages === 0 || page + 1 >= totalPages}
        >
          Suivant
        </button>
      </footer>
    </div>
  )
}

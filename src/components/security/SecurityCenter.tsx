import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AUDIT_SEVERITY_LABELS,
  AuditLogEntry,
  AuditLogQuery,
  AuditSeverity,
  GDPR_STATUS_LABELS,
  GdprRequest,
  IncidentActionLog,
  IncidentPlaybook,
  SecurityService
} from '../../services/securityService'
import { usePagination } from '../../hooks/usePagination'
import { useDebounce } from '../../hooks/useDebounce'
import { downloadCsv } from '../../utils/csv'
import { usePermissions } from '../../hooks/usePermissions'

const tabs = [
  { id: 'audit', label: 'Audit Logs' },
  { id: 'gdpr', label: 'GDPR Requests' },
  { id: 'incidents', label: 'Incident Response' },
  { id: 'compliance', label: 'Compliance Reports' }
] as const

type TabId = (typeof tabs)[number]['id']

type AuditSeverityFilter = AuditSeverity | 'all'

interface AuditFiltersState {
  search: string
  actor: string
  resource: string
  severity: AuditSeverityFilter
}

const auditResourceOptions = [
  { value: 'all', label: 'All modules' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'users', label: 'Users' },
  { value: 'events', label: 'Events' },
  { value: 'security', label: 'Security' },
  { value: 'compliance', label: 'Compliance' }
]

const auditSeverityOptions: { value: AuditSeverityFilter; label: string }[] = [
  { value: 'all', label: 'All severities' },
  ...Object.entries(AUDIT_SEVERITY_LABELS).map(([value, label]) => ({
    value: value as AuditSeverity,
    label
  }))
]

type IncidentNoteState = Record<string, string>

type IncidentLogState = Record<string, IncidentActionLog[]>

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleString()
}

export function SecurityCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('audit')
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [isAuditLoading, setIsAuditLoading] = useState(false)
  const [auditFilters, setAuditFilters] = useState<AuditFiltersState>({
    search: '',
    actor: '',
    resource: 'all',
    severity: 'all'
  })

  const [gdprRequests, setGdprRequests] = useState<GdprRequest[]>([])
  const [isGdprLoading, setIsGdprLoading] = useState(false)
  const [gdprError, setGdprError] = useState<string | null>(null)

  const [incidentPlaybooks, setIncidentPlaybooks] = useState<IncidentPlaybook[]>([])
  const [incidentNotes, setIncidentNotes] = useState<IncidentNoteState>({})
  const [incidentLogs, setIncidentLogs] = useState<IncidentLogState>({})
  const [incidentError, setIncidentError] = useState<string | null>(null)

  const [complianceReports, setComplianceReports] = useState<
    { id: string; name: string; period: string; generatedAt: string; status: string; format: string }[]
  >([])
  const [complianceError, setComplianceError] = useState<string | null>(null)

  const { admin, hasPermissions } = usePermissions()
  const canManageSecurity = hasPermissions(['security:manage'])
  const canExportAudit = hasPermissions(['security:export']) || canManageSecurity

  const { page, pageSize, setPage } = usePagination(25)
  const debouncedSearch = useDebounce(auditFilters.search, 250)

  const normalizedAuditFilters = useMemo<AuditLogQuery>(
    () => ({
      search: debouncedSearch || undefined,
      actor: auditFilters.actor.trim() || undefined,
      resourceType: auditFilters.resource === 'all' ? undefined : auditFilters.resource,
      severity: auditFilters.severity === 'all' ? undefined : auditFilters.severity,
      page,
      pageSize,
      sort: '-timestamp'
    }),
    [auditFilters, debouncedSearch, page, pageSize]
  )

  const loadAuditLogs = useCallback(async () => {
    setIsAuditLoading(true)
    setAuditError(null)

    try {
      const { logs, total } = await SecurityService.listAuditLogs(normalizedAuditFilters)
      setAuditLogs(logs)
      setAuditTotal(total)
    } catch (error) {
      console.error('Failed to load audit logs', error)
      setAuditError('Unable to load audit logs. Please try again later.')
    } finally {
      setIsAuditLoading(false)
    }
  }, [normalizedAuditFilters])

  const loadGdprRequests = useCallback(async () => {
    setIsGdprLoading(true)
    setGdprError(null)

    try {
      const { requests } = await SecurityService.listGdprRequests()
      setGdprRequests(requests)
    } catch (error) {
      console.error('Failed to load GDPR requests', error)
      setGdprError('Unable to load GDPR requests at the moment.')
    } finally {
      setIsGdprLoading(false)
    }
  }, [])

  const loadPlaybooks = useCallback(async () => {
    setIncidentError(null)

    try {
      const { playbooks } = await SecurityService.listIncidentPlaybooks()
      setIncidentPlaybooks(playbooks)
      setIncidentLogs(
        playbooks.reduce<IncidentLogState>((acc, playbook) => {
          acc[playbook.id] = playbook.actionLog || []
          return acc
        }, {})
      )
    } catch (error) {
      console.error('Failed to load incident playbooks', error)
      setIncidentError('Unable to load incident response playbooks.')
    }
  }, [])

  const loadComplianceReports = useCallback(async () => {
    setComplianceError(null)

    try {
      const { reports } = await SecurityService.listComplianceReports()
      setComplianceReports(reports)
    } catch (error) {
      console.error('Failed to load compliance reports', error)
      setComplianceError('Unable to load compliance reports.')
    }
  }, [])

  useEffect(() => {
    loadAuditLogs()
  }, [loadAuditLogs])

  useEffect(() => {
    loadGdprRequests()
    loadPlaybooks()
    loadComplianceReports()
  }, [loadGdprRequests, loadPlaybooks, loadComplianceReports])

  const handleAuditFilterChange = (changes: Partial<AuditFiltersState>) => {
    setAuditFilters(prev => ({ ...prev, ...changes }))
    setPage(0)
  }

  const handleAuditExport = async (format: 'csv' | 'json') => {
    if (!canExportAudit) {
      return
    }

    try {
      const exportFilters: AuditLogQuery = {
        ...normalizedAuditFilters,
        search: auditFilters.search || undefined,
        actor: auditFilters.actor.trim() || undefined,
        resourceType: auditFilters.resource === 'all' ? undefined : auditFilters.resource,
        severity: auditFilters.severity === 'all' ? undefined : auditFilters.severity
      }

      const blob = await SecurityService.exportAuditLogs(format, exportFilters)
      if (format === 'csv') {
        downloadCsv(blob, `audit-logs.${format}`)
      } else {
        downloadBlob(blob, `audit-logs.${format}`)
      }
    } catch (error) {
      console.error('Failed to export audit logs', error)
      setAuditError('Export failed. Please retry later.')
    }
  }

  const updateGdprRequestLocally = (updated: GdprRequest) => {
    setGdprRequests(prev => prev.map(request => (request.id === updated.id ? updated : request)))
  }

  const handleGdprTransition = async (request: GdprRequest, status: GdprRequest['status']) => {
    if (!canManageSecurity) {
      return
    }

    try {
      const updated = await SecurityService.updateGdprRequestStatus(request.id, {
        status,
        assigneeId: admin?.id,
        note: `Status changed to ${status}`
      })
      updateGdprRequestLocally(updated)
    } catch (error) {
      console.error('Failed to update GDPR request', error)
      setGdprError('Unable to update the GDPR request status.')
    }
  }

  const handleGdprConfirm = async (request: GdprRequest) => {
    if (!canManageSecurity) {
      return
    }

    try {
      const updated = await SecurityService.confirmGdprAction(request.id, {
        confirmationMessage: 'GDPR request completed',
        confirmedBy: admin?.id
      })
      updateGdprRequestLocally(updated)
    } catch (error) {
      console.error('Failed to confirm GDPR action', error)
      setGdprError('Unable to confirm the GDPR request completion.')
    }
  }

  const handleGdprArchiveDownload = async (request: GdprRequest) => {
    if (!canManageSecurity && !hasPermissions(['security:read'])) {
      return
    }

    try {
      const blob = await SecurityService.downloadGdprArchive(request.id)
      downloadBlob(blob, `gdpr-request-${request.id}.zip`)
    } catch (error) {
      console.error('Failed to download GDPR archive', error)
      setGdprError('Unable to download the GDPR archive.')
    }
  }

  const handleIncidentNoteChange = (stepKey: string, note: string) => {
    setIncidentNotes(prev => ({ ...prev, [stepKey]: note }))
  }

  const handleLogIncidentAction = async (playbook: IncidentPlaybook, stepId: string) => {
    if (!canManageSecurity) {
      return
    }

    const stepKey = `${playbook.id}-${stepId}`

    try {
      const logEntry = await SecurityService.logIncidentAction(playbook.id, {
        stepId,
        note: incidentNotes[stepKey],
        status: 'completed'
      })

      setIncidentLogs(prev => ({
        ...prev,
        [playbook.id]: [...(prev[playbook.id] || []), logEntry]
      }))

      setIncidentNotes(prev => ({ ...prev, [stepKey]: '' }))
    } catch (error) {
      console.error('Failed to log incident action', error)
      setIncidentError('Unable to log the incident response step.')
    }
  }

  const handleComplianceDownload = async (reportId: string, format: string) => {
    try {
      const blob = await SecurityService.downloadComplianceReport(reportId)
      downloadBlob(blob, `compliance-report-${reportId}.${format}`)
    } catch (error) {
      console.error('Failed to download compliance report', error)
      setComplianceError('Unable to download the compliance report.')
    }
  }

  const renderAuditTab = () => (
    <section aria-labelledby="security-tab-audit">
      <header className="security-section-header">
        <div>
          <h2 id="security-tab-audit">Audit trail overview</h2>
          <p>Monitor admin activity across the platform with advanced filtering and exports.</p>
        </div>
        <div className="security-actions">
          <button
            type="button"
            onClick={() => handleAuditExport('json')}
            disabled={!canExportAudit}
            data-testid="audit-export-json"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => handleAuditExport('csv')}
            disabled={!canExportAudit}
            data-testid="audit-export-csv"
          >
            Export CSV
          </button>
        </div>
      </header>

      <div className="security-filters">
        <input
          type="search"
          placeholder="Full-text search (user, action, resource, IP...)"
          value={auditFilters.search}
          onChange={event => handleAuditFilterChange({ search: event.target.value })}
          data-testid="audit-search"
        />
        <input
          type="text"
          placeholder="Actor"
          value={auditFilters.actor}
          onChange={event => handleAuditFilterChange({ actor: event.target.value })}
          data-testid="audit-filter-actor"
        />
        <select
          value={auditFilters.resource}
          onChange={event => handleAuditFilterChange({ resource: event.target.value })}
          data-testid="audit-filter-resource"
        >
          {auditResourceOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={auditFilters.severity}
          onChange={event =>
            handleAuditFilterChange({ severity: event.target.value as AuditSeverityFilter })
          }
          data-testid="audit-filter-severity"
        >
          {auditSeverityOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {auditError && (
        <div role="alert" className="security-error">
          {auditError}
        </div>
      )}

      <div className="security-table" role="table">
        <div className="security-table__header" role="row">
          <div role="columnheader">Timestamp</div>
          <div role="columnheader">Actor</div>
          <div role="columnheader">Action</div>
          <div role="columnheader">Resource</div>
          <div role="columnheader">Severity</div>
          <div role="columnheader">IP address</div>
        </div>
        {isAuditLoading ? (
          <div className="security-table__empty" role="row">
            Loading audit logs...
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="security-table__empty" role="row">
            No audit activity for the selected filters.
          </div>
        ) : (
          auditLogs.map(log => (
            <div
              key={log.id}
              role="row"
              className="security-table__row"
              data-testid={`audit-row-${log.id}`}
            >
              <div role="cell">{formatDate(log.timestamp)}</div>
              <div role="cell">{log.actor}</div>
              <div role="cell">{log.action}</div>
              <div role="cell">{log.resourceType || 'N/A'}</div>
              <div role="cell">{AUDIT_SEVERITY_LABELS[log.severity]}</div>
              <div role="cell">{log.ipAddress || '—'}</div>
            </div>
          ))
        )}
      </div>
      <footer className="security-footer">
        <span>
          Showing {auditLogs.length} of {auditTotal} entries
        </span>
      </footer>
    </section>
  )

  const renderGdprTab = () => (
    <section aria-labelledby="security-tab-gdpr">
      <header className="security-section-header">
        <div>
          <h2 id="security-tab-gdpr">GDPR fulfillment workflow</h2>
          <p>Track incoming privacy requests, collect confirmations and store proof of delivery.</p>
        </div>
      </header>

      {gdprError && (
        <div role="alert" className="security-error">
          {gdprError}
        </div>
      )}

      {isGdprLoading ? (
        <p>Loading GDPR requests...</p>
      ) : gdprRequests.length === 0 ? (
        <p>No GDPR requests pending review.</p>
      ) : (
        <div className="security-list">
          {gdprRequests.map(request => (
            <article key={request.id} className="security-card" data-testid={`gdpr-card-${request.id}`}>
              <header>
                <h3>{request.userEmail}</h3>
                <p>
                  {request.type} • Submitted on {formatDate(request.submittedAt)}
                </p>
              </header>
              <dl className="security-card__meta">
                <div>
                  <dt>Status</dt>
                  <dd>{GDPR_STATUS_LABELS[request.status]}</dd>
                </div>
                {request.assignedTo && (
                  <div>
                    <dt>Assignee</dt>
                    <dd>{request.assignedTo}</dd>
                  </div>
                )}
                {request.dueAt && (
                  <div>
                    <dt>Due</dt>
                    <dd>{formatDate(request.dueAt)}</dd>
                  </div>
                )}
              </dl>
              <div className="security-card__actions">
                <button
                  type="button"
                  onClick={() => handleGdprTransition(request, 'in_progress')}
                  disabled={!canManageSecurity}
                  data-testid={`gdpr-action-start-${request.id}`}
                >
                  Start processing
                </button>
                <button
                  type="button"
                  onClick={() => handleGdprTransition(request, 'awaiting_confirmation')}
                  disabled={!canManageSecurity || request.status !== 'in_progress'}
                  data-testid={`gdpr-action-awaiting-${request.id}`}
                >
                  Await confirmation
                </button>
                <button
                  type="button"
                  onClick={() => handleGdprConfirm(request)}
                  disabled={!canManageSecurity || request.status !== 'awaiting_confirmation'}
                  data-testid={`gdpr-action-confirm-${request.id}`}
                >
                  Confirm closure
                </button>
                <button
                  type="button"
                  onClick={() => handleGdprArchiveDownload(request)}
                  data-testid={`gdpr-action-download-${request.id}`}
                  disabled={!canManageSecurity && !hasPermissions(['security:export'])}
                >
                  Download archive
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  const renderIncidentTab = () => (
    <section aria-labelledby="security-tab-incidents">
      <header className="security-section-header">
        <div>
          <h2 id="security-tab-incidents">Incident response playbooks</h2>
          <p>Follow predefined playbooks and keep a detailed log of mitigation steps.</p>
        </div>
      </header>

      {incidentError && (
        <div role="alert" className="security-error">
          {incidentError}
        </div>
      )}

      {incidentPlaybooks.length === 0 ? (
        <p>No incident playbooks configured.</p>
      ) : (
        <div className="security-list">
          {incidentPlaybooks.map(playbook => (
            <article key={playbook.id} className="security-card" data-testid={`incident-card-${playbook.id}`}>
              <header>
                <h3>{playbook.name}</h3>
                <p>
                  {playbook.category} • Severity {AUDIT_SEVERITY_LABELS[playbook.severity]}
                </p>
              </header>
              <ol className="security-steps">
                {playbook.steps.map(step => {
                  const stepKey = `${playbook.id}-${step.id}`
                  return (
                    <li key={step.id} className="security-steps__item">
                      <div>
                        <strong>{step.title}</strong>
                        {step.description && <p>{step.description}</p>}
                      </div>
                      <textarea
                        value={incidentNotes[stepKey] || ''}
                        onChange={event => handleIncidentNoteChange(stepKey, event.target.value)}
                        placeholder="Add response notes"
                        rows={2}
                        data-testid={`incident-note-${stepKey}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleLogIncidentAction(playbook, step.id)}
                        disabled={!canManageSecurity}
                        data-testid={`incident-log-${stepKey}`}
                      >
                        Log action
                      </button>
                    </li>
                  )
                })}
              </ol>
              <section className="security-log" aria-label="Action log">
                <h4>Action log</h4>
                {(incidentLogs[playbook.id] || []).length === 0 ? (
                  <p>No actions logged yet.</p>
                ) : (
                  <ul>
                    {(incidentLogs[playbook.id] || []).map(log => (
                      <li key={log.id}>
                        <span>{formatDate(log.timestamp)}</span> — <span>{log.actor}</span>
                        {log.note && <span>: {log.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  const renderComplianceTab = () => (
    <section aria-labelledby="security-tab-compliance">
      <header className="security-section-header">
        <div>
          <h2 id="security-tab-compliance">Compliance reporting</h2>
          <p>Centralize SOC2, ISO and GDPR evidence packages for audits.</p>
        </div>
      </header>

      {complianceError && (
        <div role="alert" className="security-error">
          {complianceError}
        </div>
      )}

      {complianceReports.length === 0 ? (
        <p>No compliance reports available.</p>
      ) : (
        <div className="security-list">
          {complianceReports.map(report => (
            <article key={report.id} className="security-card" data-testid={`compliance-card-${report.id}`}>
              <header>
                <h3>{report.name}</h3>
                <p>
                  {report.period} • Generated on {formatDate(report.generatedAt)}
                </p>
              </header>
              <p>Status: {report.status}</p>
              <button
                type="button"
                onClick={() => handleComplianceDownload(report.id, report.format)}
                data-testid={`compliance-download-${report.id}`}
              >
                Download {report.format.toUpperCase()}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div className="security-center" data-testid="security-center">
      <nav className="security-tabs" aria-label="Security modules">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'security-tabs__tab--active' : 'security-tabs__tab'}
            data-testid={`tab-${tab.id}`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="security-content">
        {activeTab === 'audit' && renderAuditTab()}
        {activeTab === 'gdpr' && renderGdprTab()}
        {activeTab === 'incidents' && renderIncidentTab()}
        {activeTab === 'compliance' && renderComplianceTab()}
      </div>
    </div>
  )
}

export default SecurityCenter

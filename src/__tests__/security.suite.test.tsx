import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import React, { ComponentType } from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SecurityService } from '../services/securityService'

const { mockExportCsv } = vi.hoisted(() => ({ mockExportCsv: vi.fn() }))

vi.mock('../utils/export', () => ({
  exportCsv: mockExportCsv,
  exportExcel: vi.fn(),
  exportPdf: vi.fn(),
  exportAuditLogger: {
    log: vi.fn(),
    subscribe: vi.fn(() => () => undefined)
  }
}))

const permissionsState = {
  admin: { id: 'admin-1', email: 'admin@example.com', name: 'Security Admin' },
  permissions: [] as string[],
  roles: [] as string[],
  isLoading: false,
  error: null as string | null,
  hasPermissions(required?: string[]) {
    if (!required || required.length === 0) {
      return true
    }
    return required.every(permission => permissionsState.permissions.includes(permission))
  }
}

vi.mock('../hooks/usePermissions', () => ({
  __esModule: true,
  usePermissions: () => permissionsState
}))

vi.mock('../services/securityService', () => {
  const service = {
    listAuditLogs: vi.fn(),
    exportAuditLogs: vi.fn(),
    listGdprRequests: vi.fn(),
    updateGdprRequestStatus: vi.fn(),
    confirmGdprAction: vi.fn(),
    downloadGdprArchive: vi.fn(),
    listIncidentPlaybooks: vi.fn(),
    logIncidentAction: vi.fn(),
    listComplianceReports: vi.fn(),
    downloadComplianceReport: vi.fn()
  }

  return {
    SecurityService: service,
    AUDIT_SEVERITY_LABELS: {
      low: 'Faible',
      medium: 'Modérée',
      high: 'Élevée',
      critical: 'Critique'
    },
    GDPR_STATUS_LABELS: {
      received: 'Reçue',
      in_progress: 'En cours',
      awaiting_confirmation: 'En attente de confirmation',
      completed: 'Terminée',
      rejected: 'Rejetée'
    }
  }
})

expect.extend(matchers)

describe('Security center module', () => {
  const mockedSecurityService = vi.mocked(SecurityService, true)

  const now = new Date().toISOString()
  const auditLog = {
    id: 'audit-1',
    timestamp: now,
    actor: 'admin@example.com',
    action: 'Updated configuration',
    resourceType: 'configuration',
    severity: 'high' as const,
    ipAddress: '192.168.1.10'
  }
  const gdprRequest = {
    id: 'gdpr-1',
    userId: 'user-1',
    userEmail: 'user@example.com',
    type: 'erasure' as const,
    submittedAt: now,
    status: 'received' as const,
    assignedTo: 'analyst-1',
    dueAt: now
  }
  const incidentPlaybook = {
    id: 'incident-1',
    name: 'Credential stuffing response',
    description: 'Steps to respond to automated credential stuffing.',
    severity: 'critical' as const,
    category: 'availability' as const,
    steps: [
      {
        id: 'step-1',
        title: 'Activate WAF rules',
        description: 'Enable rate limiting and IP blocking.'
      }
    ],
    actionLog: []
  }
  const complianceReport = {
    id: 'report-1',
    name: 'SOC2 Type II 2024',
    period: 'FY2024',
    generatedAt: now,
    status: 'available',
    format: 'pdf'
  }

  let SecurityCenterComponent: ComponentType
  let originalCreateObjectURL: typeof URL.createObjectURL | undefined
  let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined

  beforeAll(async () => {
    SecurityCenterComponent = (await import('../components/security/SecurityCenter')).SecurityCenter

    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL

    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  afterAll(() => {
    if (originalCreateObjectURL) {
      URL.createObjectURL = originalCreateObjectURL
    } else {
      delete (URL as unknown as { createObjectURL?: typeof URL.createObjectURL }).createObjectURL
    }

    if (originalRevokeObjectURL) {
      URL.revokeObjectURL = originalRevokeObjectURL
    } else {
      delete (URL as unknown as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()

    permissionsState.permissions = ['admin:access', 'security:read', 'security:manage', 'security:export']
    permissionsState.roles = ['super-admin']
    permissionsState.error = null

    mockedSecurityService.listAuditLogs.mockResolvedValue({ logs: [auditLog], total: 1 })
    mockedSecurityService.exportAuditLogs.mockResolvedValue(new Blob())
    mockedSecurityService.listGdprRequests.mockResolvedValue({ requests: [gdprRequest], total: 1 })
    mockedSecurityService.updateGdprRequestStatus.mockImplementation(async (_, payload) => ({
      ...gdprRequest,
      status: payload.status
    }))
    mockedSecurityService.confirmGdprAction.mockImplementation(async () => ({
      ...gdprRequest,
      status: 'completed' as const
    }))
    mockedSecurityService.downloadGdprArchive.mockResolvedValue(new Blob())
    mockedSecurityService.listIncidentPlaybooks.mockResolvedValue({ playbooks: [incidentPlaybook] })
    mockedSecurityService.logIncidentAction.mockResolvedValue({
      id: 'log-1',
      stepId: 'step-1',
      actor: 'admin@example.com',
      note: 'WAF enabled',
      timestamp: now,
      status: 'completed'
    })
    mockedSecurityService.listComplianceReports.mockResolvedValue({ reports: [complianceReport] })
    mockedSecurityService.downloadComplianceReport.mockResolvedValue(new Blob())
  })

  function renderSecurityCenter() {
    const Component = SecurityCenterComponent
    return render(<Component />)
  }

  it('enforces permission boundaries on GDPR workflows', async () => {
    permissionsState.permissions = ['admin:access', 'security:read']
    permissionsState.roles = ['security-analyst']

    renderSecurityCenter()

    await waitFor(() => expect(mockedSecurityService.listAuditLogs).toHaveBeenCalled())

    fireEvent.click(await screen.findByTestId('tab-gdpr'))

    const startButton = await screen.findByTestId('gdpr-action-start-gdpr-1')
    expect(startButton).toBeDisabled()

    const downloadButton = screen.getByTestId('gdpr-action-download-gdpr-1')
    expect(downloadButton).toBeDisabled()
  })

  it('exports audit logs with the active filters applied', async () => {
    permissionsState.permissions = ['admin:access', 'security:read', 'security:export']
    permissionsState.roles = ['auditor']

    renderSecurityCenter()

    await waitFor(() => expect(mockedSecurityService.listAuditLogs).toHaveBeenCalled())

    const searchInput = await screen.findByTestId('audit-search')
    fireEvent.change(searchInput, { target: { value: 'configuration' } })

    const exportCsvButton = screen.getByTestId('audit-export-csv')
    fireEvent.click(exportCsvButton)

    await waitFor(() =>
      expect(mockedSecurityService.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 0,
          pageSize: expect.any(Number),
          search: 'configuration'
        })
      )
    )

    expect(mockExportCsv).toHaveBeenCalled()
  })

  it('drives GDPR status transitions and confirmations', async () => {
    renderSecurityCenter()

    await waitFor(() => expect(mockedSecurityService.listAuditLogs).toHaveBeenCalled())

    fireEvent.click(await screen.findByTestId('tab-gdpr'))

    const startButton = await screen.findByTestId('gdpr-action-start-gdpr-1')
    fireEvent.click(startButton)

    await waitFor(() =>
      expect(mockedSecurityService.updateGdprRequestStatus).toHaveBeenCalledWith('gdpr-1', {
        status: 'in_progress',
        assigneeId: 'admin-1',
        note: expect.stringContaining('in_progress')
      })
    )

    await waitFor(() => expect(screen.getByText('En cours')).toBeInTheDocument())

    const awaitingButton = await screen.findByTestId('gdpr-action-awaiting-gdpr-1')
    fireEvent.click(awaitingButton)

    await waitFor(() =>
      expect(mockedSecurityService.updateGdprRequestStatus).toHaveBeenCalledWith('gdpr-1', {
        status: 'awaiting_confirmation',
        assigneeId: 'admin-1',
        note: expect.stringContaining('awaiting_confirmation')
      })
    )

    const confirmButton = await screen.findByTestId('gdpr-action-confirm-gdpr-1')
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(mockedSecurityService.confirmGdprAction).toHaveBeenCalledWith('gdpr-1', {
        confirmationMessage: 'GDPR request completed',
        confirmedBy: 'admin-1'
      })
    )

    await waitFor(() => expect(screen.getByText('Terminée')).toBeInTheDocument())

    const downloadButton = screen.getByTestId('gdpr-action-download-gdpr-1')
    fireEvent.click(downloadButton)

    await waitFor(() => expect(mockedSecurityService.downloadGdprArchive).toHaveBeenCalledWith('gdpr-1'))
  })
})

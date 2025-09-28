import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import React from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../app'
import { AuthService } from '../services/authService'
import { ModerationService } from '../services/moderationService'

vi.mock('../services/authService', () => ({
  AuthService: {
    getSession: vi.fn(),
    getPermissions: vi.fn()
  }
}))

vi.mock('../services/moderationService', () => {
  const service = {
    listReports: vi.fn(),
    getReport: vi.fn(),
    submitDecision: vi.fn(),
    assignReport: vi.fn(),
    getRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    toggleRule: vi.fn(),
    reorderRules: vi.fn(),
    deleteRule: vi.fn(),
    getAuditTrail: vi.fn(),
    exportAuditTrail: vi.fn(),
    listAppeals: vi.fn(),
    updateAppeal: vi.fn()
  }

  return {
    ModerationService: service,
    MODERATION_STATUS_LABELS: {
      pending: 'En attente',
      under_review: 'En cours',
      action_taken: 'Action effectuée',
      dismissed: 'Rejeté',
      escalated: 'Escaladé'
    }
  }
})

vi.mock('../utils/csv', () => ({
  downloadCsv: vi.fn()
}))

expect.extend(matchers)

const mockedAuthService = vi.mocked(AuthService, true)
const mockedModerationService = vi.mocked(ModerationService, true)

describe('Moderation dashboard', () => {
  const now = new Date().toISOString()
  const report = {
    id: 'rep-1',
    contentId: 'post-001',
    contentType: 'post',
    snippet: 'Contenu signalé à examiner',
    reporterId: 'usr-2',
    reporterName: 'Alice',
    reason: 'Discours haineux',
    status: 'pending',
    severity: 'high',
    assignedTo: 'moderator-1',
    evidenceUrls: ['https://example.com/evidence'],
    createdAt: now
  }
  const updatedReport = { ...report, status: 'action_taken' as const }
  const rules = [
    {
      id: 'rule-1',
      name: 'Filtrer les injures',
      description: 'Supprime automatiquement les contenus injurieux',
      enabled: true,
      priority: 1,
      severity: 'high' as const,
      conditions: {},
      actions: {},
      lastTriggeredAt: now
    }
  ]
  const appeals = [
    {
      id: 'appeal-1',
      reportId: report.id,
      userId: 'usr-3',
      userName: 'Bob',
      submittedAt: now,
      status: 'pending' as const,
      notes: 'Je n’ai rien fait de mal'
    }
  ]
  const auditEntries = [
    {
      id: 'audit-1',
      timestamp: now,
      actor: 'moderator-1',
      action: 'Consultation du rapport',
      targetId: report.id,
      targetType: 'report',
      status: 'pending' as const
    }
  ]

  let originalCreateObjectURL: typeof URL.createObjectURL | undefined
  let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined

  beforeAll(() => {
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
    window.history.pushState({}, '', '/admin/moderation')

    mockedAuthService.getSession.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'super-admin'
    })

    mockedAuthService.getPermissions.mockResolvedValue({
      permissions: ['admin:access', 'moderation:read', 'moderation:write'],
      roles: ['super-admin']
    })

    mockedModerationService.listReports.mockResolvedValue({ reports: [report], total: 1 })
    mockedModerationService.getAuditTrail.mockResolvedValue({ entries: auditEntries, total: 1 })
    mockedModerationService.getRules.mockResolvedValue(rules)
    mockedModerationService.toggleRule.mockImplementation(async (_, enabled) => ({
      ...rules[0],
      enabled
    }))
    mockedModerationService.reorderRules.mockResolvedValue(rules)
    mockedModerationService.listAppeals.mockResolvedValue({ appeals, total: 1 })
    mockedModerationService.updateAppeal.mockImplementation(async (id, payload) => ({
      ...appeals[0],
      id,
      status: payload.status
    }))
    mockedModerationService.submitDecision.mockResolvedValue(updatedReport)
    mockedModerationService.exportAuditTrail.mockResolvedValue(new Blob())
  })

  it('navigates to moderation module and loads reported content', async () => {
    render(<App />)

    await waitFor(() => expect(mockedModerationService.listReports).toHaveBeenCalled())

    expect(screen.getByText('Signalements')).toBeInTheDocument()
    expect(screen.getByText(report.snippet)).toBeInTheDocument()
    expect(screen.getByTestId('appeals-queue')).toBeInTheDocument()
  })

  it('requires a comment before submitting a decision and propagates actions', async () => {
    render(<App />)

    const table = await screen.findByTestId('reported-content-table')
    const firstRow = within(table).getByTestId(`report-row-${report.id}`)
    fireEvent.click(firstRow)

    const submitButton = await screen.findByTestId('moderation-submit')
    expect(submitButton).toBeDisabled()

    const commentArea = screen.getByTestId('moderation-comment') as HTMLTextAreaElement
    fireEvent.change(commentArea, { target: { value: 'Contenu supprimé après vérification.' } })
    expect(submitButton).not.toBeDisabled()

    fireEvent.click(submitButton)

    await waitFor(() => expect(mockedModerationService.submitDecision).toHaveBeenCalledWith(report.id, {
      action: 'remove',
      comment: 'Contenu supprimé après vérification.',
      escalate: false
    }))

    await waitFor(() => expect(mockedModerationService.getAuditTrail).toHaveBeenCalledTimes(2))

    const [toggle] = await screen.findAllByTestId(`rule-toggle-${rules[0].id}`)
    fireEvent.click(toggle)
    await waitFor(() => expect(mockedModerationService.toggleRule).toHaveBeenCalledWith(rules[0].id, false))

    const [approveButton] = await screen.findAllByTestId(`appeal-approve-${appeals[0].id}`)
    fireEvent.click(approveButton)
    await waitFor(() => expect(mockedModerationService.updateAppeal).toHaveBeenCalledWith(appeals[0].id, {
      status: 'approved'
    }))

    const [exportJsonButton] = await screen.findAllByTestId('audit-export-json')
    fireEvent.click(exportJsonButton)
    await waitFor(() => expect(mockedModerationService.exportAuditTrail).toHaveBeenCalledWith('json', expect.any(Object)))
  })
})

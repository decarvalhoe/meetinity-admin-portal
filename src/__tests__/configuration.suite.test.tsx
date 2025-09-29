/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformSettings } from '../components/configuration/PlatformSettings'
import { AuthService } from '../services/authService'
import { ConfigurationService } from '../services/configurationService'
import type { ConfigurationSnapshot, ConfigurationVersion } from '../services/configurationService'
import { AuthProvider, usePermissions } from '../hooks/usePermissions'
import { ADMIN_MODULES } from '../utils/adminNavigation'

vi.mock('../services/authService', () => ({
  AuthService: {
    getSession: vi.fn(),
    getPermissions: vi.fn()
  }
}))

vi.mock('../services/configurationService', () => ({
  ConfigurationService: {
    getSnapshot: vi.fn(),
    getVersionHistory: vi.fn(),
    updateParameters: vi.fn(),
    updateFeatureFlags: vi.fn(),
    updateExperiments: vi.fn(),
    updateEmailTemplate: vi.fn(),
    previewEmailTemplate: vi.fn(),
    updateNotificationRules: vi.fn(),
    updateRateLimits: vi.fn(),
    revertToVersion: vi.fn()
  }
}))

vi.mock('d3', () => {
  const noop = () => {}
  const chainable = () => ({
    append: () => chainable(),
    attr: () => chainable(),
    style: () => chainable(),
    text: () => chainable(),
    call: () => chainable(),
    selectAll: () => ({
      data: () => ({ join: () => chainable() }),
      remove: () => {}
    })
  })

  const scale = () => {
    const fn = () => 0
    ;(fn as unknown as { domain: () => typeof fn }).domain = () => fn
    ;(fn as unknown as { range: () => typeof fn }).range = () => fn
    return fn
  }

  const bandScale = () => {
    const fn = () => 0
    ;(fn as unknown as { domain: () => typeof fn }).domain = () => fn
    ;(fn as unknown as { range: () => typeof fn }).range = () => fn
    ;(fn as unknown as { padding: () => typeof fn }).padding = () => fn
    return fn
  }

  const ordinalScale = () => {
    const fn = () => '#000'
    ;(fn as unknown as { domain: () => typeof fn }).domain = () => fn
    ;(fn as unknown as { range: () => typeof fn }).range = () => fn
    return fn
  }

  return {
    select: () => chainable(),
    scaleLinear: scale,
    scaleTime: scale,
    scaleBand: bandScale,
    scaleOrdinal: ordinalScale,
    axisBottom: () => noop,
    axisLeft: () => noop,
    max: () => 0,
    min: () => 0,
    extent: () => [0, 0],
    line: () => noop,
    area: () => noop,
    curveMonotoneX: {},
    schemeTableau10: []
  }
})

const mockedAuthService = vi.mocked(AuthService, true)
const mockedConfigurationService = vi.mocked(ConfigurationService, true)

const buildSnapshot = (): ConfigurationSnapshot => ({
  parameters: [
    {
      key: 'platform.name',
      label: 'Nom de la plateforme',
      value: 'Meetinity',
      type: 'string',
      description: 'Nom affiché dans les communications.'
    }
  ],
  featureFlags: [
    {
      key: 'beta-matching',
      label: 'Algorithme de matching bêta',
      enabled: true,
      description: 'Active le nouveau moteur de recommandation.',
      rolloutPercentage: 50
    }
  ],
  experiments: [
    {
      id: 'exp-homepage',
      name: 'Page d\'accueil',
      hypothesis: 'La vidéo augmente les conversions.',
      status: 'running',
      variants: [
        { id: 'control', label: 'Contrôle', trafficPercentage: 50, goalMetric: 'conversion' },
        { id: 'variant-a', label: 'Vidéo', trafficPercentage: 50, goalMetric: 'conversion' }
      ]
    }
  ],
  emailTemplates: [
    {
      id: 'welcome',
      name: 'Bienvenue',
      subject: 'Bienvenue sur Meetinity',
      htmlContent: '<p>Bonjour {{name}}</p>',
      plainTextContent: 'Bonjour {{name}}',
      lastUpdatedAt: '2023-09-01T08:00:00.000Z',
      lastUpdatedBy: 'Alice',
      version: '1.0.0'
    }
  ],
  notificationRules: [
    {
      id: 'new-message',
      label: 'Nouveau message',
      channel: 'email',
      enabled: true,
      description: 'Prévenir les utilisateurs lorsqu\'ils reçoivent un message.',
      triggers: ['message:received']
    }
  ],
  rateLimitRules: [
    {
      id: 'api-auth',
      label: 'Authentification API',
      description: 'Limite les tentatives de connexion.',
      limit: 60,
      windowSeconds: 60,
      burstLimit: 80
    }
  ],
  currentVersion: {
    version: '1.0.5',
    updatedAt: '2023-10-10T10:00:00.000Z',
    updatedBy: 'Alice Dupont',
    summary: 'Mise à jour des notifications.'
  }
})

const buildVersions = (): ConfigurationVersion[] => [
  {
    version: '1.0.5',
    summary: 'Mise à jour des notifications.',
    updatedAt: '2023-10-10T10:00:00.000Z',
    updatedBy: 'Alice Dupont'
  },
  {
    version: '1.0.4',
    summary: 'Optimisation des tests A/B.',
    updatedAt: '2023-09-15T14:00:00.000Z',
    updatedBy: 'Bob Martin'
  }
]

function PermissionProbe({ required }: { required: string[] }) {
  const { isLoading, hasPermissions } = usePermissions()

  if (isLoading) {
    return <span>chargement</span>
  }

  return <span>{hasPermissions(required) ? 'allowed' : 'denied'}</span>
}

describe('Configuration platform RBAC et validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
  })

  it('déclare le module configuration avec la permission platform:config', () => {
    const configurationModule = ADMIN_MODULES.find(module => module.path === 'configuration')
    expect(configurationModule).toBeDefined()
    expect(configurationModule?.requiredPermissions).toContain('platform:config')
  })

  it('refuse les actions configuration sans permission dédiée', async () => {
    mockedAuthService.getSession.mockResolvedValue({
      id: '1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'manager'
    })

    mockedAuthService.getPermissions.mockResolvedValue({
      permissions: ['admin:access', 'settings:read'],
      roles: ['manager']
    })

    render(
      <AuthProvider>
        <PermissionProbe required={['platform:config']} />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText('denied')).toBeInTheDocument())
  })

  it('affiche les erreurs de validation pour les limites de débit invalides', async () => {
    mockedConfigurationService.getSnapshot.mockResolvedValue(buildSnapshot())
    mockedConfigurationService.getVersionHistory.mockResolvedValue(buildVersions())
    mockedConfigurationService.updateRateLimits.mockResolvedValue(buildSnapshot())

    render(<PlatformSettings />)

    await screen.findByText('Configuration de la plateforme')

    const rateInput = (await screen.findByLabelText('Limite maximale')) as HTMLInputElement
    fireEvent.change(rateInput, { target: { value: '0' } })

    await screen.findByDisplayValue('0')

    const submitButton = screen.getByRole('button', { name: 'Enregistrer les limites' })
    const form = submitButton.closest('form')
    if (!form) {
      throw new Error('Formulaire des limites introuvable')
    }

    fireEvent.submit(form)

    await waitFor(() => expect(rateInput).toHaveAttribute('aria-invalid', 'true'))

    expect(
      await screen.findByText('La limite doit être un nombre positif.')
    ).toBeInTheDocument()

    expect(mockedConfigurationService.updateRateLimits).not.toHaveBeenCalled()
  })

  it('soumet des limites valides et affiche la confirmation', async () => {
    const snapshot = buildSnapshot()
    mockedConfigurationService.getSnapshot.mockResolvedValue(snapshot)
    mockedConfigurationService.getVersionHistory.mockResolvedValue(buildVersions())
    mockedConfigurationService.updateRateLimits.mockResolvedValue(snapshot)

    render(<PlatformSettings />)

    await screen.findByText('Configuration de la plateforme')

    const submitButton = screen.getByRole('button', { name: 'Enregistrer les limites' })
    fireEvent.click(submitButton)

    await waitFor(() =>
      expect(mockedConfigurationService.updateRateLimits).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'api-auth', limit: 60, windowSeconds: 60, burstLimit: 80 })
        ])
      )
    )

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Limites de débit enregistrées.')

    const rateInput = (await screen.findByLabelText('Limite maximale')) as HTMLInputElement
    expect(rateInput).toHaveAttribute('aria-invalid', 'false')
  })
})

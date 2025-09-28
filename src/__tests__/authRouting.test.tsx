import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../app'
import { AuthService } from '../services/authService'

vi.mock('../services/authService', () => ({
  AuthService: {
    getSession: vi.fn(),
    getPermissions: vi.fn()
  }
}))

const mockedAuthService = vi.mocked(AuthService, true)

describe('Auth routing guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
  })

  it('affiche un état de chargement pendant la récupération des permissions', () => {
    mockedAuthService.getSession.mockReturnValue(new Promise(() => {}))
    mockedAuthService.getPermissions.mockReturnValue(new Promise(() => {}))

    const { unmount } = render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Chargement des permissions...')

    unmount()
  })

  it('autorise l’accès lorsque les permissions requises sont présentes', async () => {
    window.history.pushState({}, '', '/admin/users')

    mockedAuthService.getSession.mockResolvedValue({
      id: '1',
      email: 'admin@example.com',
      name: 'Admin Example',
      role: 'super-admin'
    })

    mockedAuthService.getPermissions.mockResolvedValue({
      permissions: ['admin:access', 'users:read'],
      roles: ['super-admin']
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Export CSV')).toBeInTheDocument())
  })

  it('redirige vers /unauthorized lorsque les permissions sont insuffisantes', async () => {
    window.history.pushState({}, '', '/admin/events')

    mockedAuthService.getSession.mockResolvedValue({
      id: '1',
      email: 'admin@example.com',
      name: 'Admin Example',
      role: 'super-admin'
    })

    mockedAuthService.getPermissions.mockResolvedValue({
      permissions: ['admin:access', 'users:read'],
      roles: ['super-admin']
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Accès refusé')).toBeInTheDocument())
    expect(window.location.pathname).toBe('/unauthorized')
  })
})

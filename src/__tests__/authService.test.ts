import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAxios, type AxiosMockController } from './utils/networkMocks'

declare global {
  // eslint-disable-next-line no-var
  var __axiosMockController: AxiosMockController | undefined
}

vi.mock('axios', () => {
  const { module, controller } = createMockAxios()
  globalThis.__axiosMockController = controller
  return module
})

import type { AuthServiceError } from '../services/authService'

let AuthService: typeof import('../services/authService').AuthService

describe('AuthService', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:4000')
    const module = await import('../services/authService')
    AuthService = module.AuthService
  })

  afterEach(() => {
    globalThis.__axiosMockController?.reset()
    vi.unstubAllEnvs()
  })

  it('fetches admin session using axios client', async () => {
    const axiosMock = globalThis.__axiosMockController
    if (!axiosMock) {
      throw new Error('Axios mock not initialised')
    }

    const session = { id: '1', email: 'admin@meetinity.com', name: 'Admin', role: 'superadmin' }
    axiosMock.get.mockResolvedValueOnce({ data: session })

    await expect(AuthService.getSession()).resolves.toEqual(session)
    expect(axiosMock.get).toHaveBeenCalledWith('http://localhost:4000/api/admin/me')
  })

  it('normalizes backend error responses', async () => {
    const axiosMock = globalThis.__axiosMockController
    if (!axiosMock) {
      throw new Error('Axios mock not initialised')
    }

    const error = axiosMock.createError('Unauthorized', {
      status: 401,
      data: { message: 'Token expiré' }
    })
    axiosMock.get.mockRejectedValueOnce(error)

    await expect(AuthService.getPermissions()).rejects.toMatchObject({
      message: 'Token expiré',
      status: 401
    } satisfies Partial<AuthServiceError>)
  })
})

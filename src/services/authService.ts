import axios, { AxiosError } from 'axios'

const API = import.meta.env.VITE_API_BASE_URL

export interface AdminSession {
  id: string
  email: string
  name: string
  role: string
}

export interface AdminPermissionsResponse {
  permissions: string[]
  roles?: string[]
}

export class AuthServiceError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'AuthServiceError'
  }
}

const normalizeError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Une erreur est survenue lors de la vérification de la session.'

    throw new AuthServiceError(message, axiosError.response?.status)
  }

  if (error instanceof Error) {
    throw new AuthServiceError(error.message)
  }

  throw new AuthServiceError('Une erreur inattendue est survenue.')
}

export const AuthService = {
  async getSession() {
    try {
      const { data } = await axios.get(`${API}/api/admin/me`)
      return data as AdminSession
    } catch (error) {
      return normalizeError(error)
    }
  },

  async getPermissions() {
    try {
      const { data } = await axios.get(`${API}/api/admin/permissions`)
      return data as AdminPermissionsResponse
    } catch (error) {
      return normalizeError(error)
    }
  }
}

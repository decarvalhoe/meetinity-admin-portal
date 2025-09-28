import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { AuthService, AuthServiceError, AdminSession } from '../services/authService'

interface AuthContextValue {
  admin: AdminSession | null
  permissions: string[]
  roles: string[]
  isLoading: boolean
  error: string | null
  hasPermissions: (required?: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const [session, permissionsResponse] = await Promise.all([
          AuthService.getSession(),
          AuthService.getPermissions()
        ])

        if (!isMounted) {
          return
        }

        if (!session || !permissionsResponse) {
          throw new AuthServiceError('Session administrateur invalide.')
        }

        setAdmin(session)
        setPermissions(permissionsResponse.permissions || [])
        setRoles(permissionsResponse.roles || [])
        setError(null)
      } catch (err) {
        if (!isMounted) {
          return
        }

        const message = err instanceof AuthServiceError ? err.message : 'Accès refusé.'
        setAdmin(null)
        setPermissions([])
        setRoles([])
        setError(message)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [])

  const hasPermissions = useCallback(
    (required?: string[]) => {
      if (!required || required.length === 0) {
        return true
      }

      return required.every(permission => permissions.includes(permission))
    },
    [permissions]
  )

  const value = useMemo<AuthContextValue>(
    () => ({ admin, permissions, roles, isLoading, error, hasPermissions }),
    [admin, permissions, roles, isLoading, error, hasPermissions]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const usePermissions = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('usePermissions doit être utilisé dans un AuthProvider')
  }

  return context
}

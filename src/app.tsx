import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { UserManagement } from './components/UserManagement'
import { EventManagement } from './components/events/EventManagement'
import { AuthProvider, usePermissions } from './hooks/usePermissions'
import { AdminLayout } from './components/layout/AdminLayout'
import { ADMIN_MODULES } from './utils/adminNavigation'
import { ModerationDashboard } from './components/moderation/ModerationDashboard'
import { PlatformSettings } from './components/configuration/PlatformSettings'
import { SecurityCenter } from './components/security/SecurityCenter'

interface RequirePermissionsProps {
  requiredPermissions?: string[]
  children: React.ReactElement
}

function RequirePermissions({ children, requiredPermissions = [] }: RequirePermissionsProps) {
  const { isLoading, error, hasPermissions } = usePermissions()

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ padding: '48px', textAlign: 'center', fontSize: '1rem' }}
      >
        Chargement des permissions...
      </div>
    )
  }

  if (error) {
    return <Navigate to="/unauthorized" replace state={{ message: error }} />
  }

  if (!hasPermissions(requiredPermissions)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

function UnauthorizedPage() {
  const location = useLocation<{ message?: string }>()
  const message = location.state?.message

  return (
    <section style={{ padding: '64px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Accès refusé</h1>
      <p style={{ marginBottom: '16px' }}>
        {message || "Vous n'avez pas accès à cette section de l'espace d'administration."}
      </p>
      <a href="/admin" style={{ color: '#2563eb', textDecoration: 'underline' }}>
        Retourner au tableau de bord
      </a>
    </section>
  )
}

function ModulePlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <section>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>{title}</h2>
      {description && <p style={{ marginBottom: '12px', color: '#4b5563' }}>{description}</p>}
      <p style={{ color: '#6b7280' }}>Le module sera disponible prochainement.</p>
    </section>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequirePermissions requiredPermissions={['admin:access']}>
                <AdminLayout />
              </RequirePermissions>
            }
          >
            <Route index element={<Navigate to="users" replace />} />
            {ADMIN_MODULES.map(module => (
              <Route
                key={module.path}
                path={module.path}
                element={
                  <RequirePermissions
                    requiredPermissions={['admin:access', ...module.requiredPermissions]}
                  >
                    {module.path === 'users' ? (
                      <UserManagement />
                    ) : module.path === 'events' ? (
                      <EventManagement />
                    ) : module.path === 'moderation' ? (
                      <ModerationDashboard />
                    ) : module.path === 'security' ? (
                      <SecurityCenter />
                    ) : module.path === 'configuration' ? (
                      <PlatformSettings />
                    ) : (
                      <ModulePlaceholder title={module.label} description={module.description} />
                    )}
                  </RequirePermissions>
                }
              />
            ))}
            <Route
              path="events/requests"
              element={
                <RequirePermissions requiredPermissions={['admin:access', 'events:approve']}>
                  <EventManagement initialFilters={{ status: 'pending' }} lockedStatus="pending" />
                </RequirePermissions>
              }
            />
          </Route>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

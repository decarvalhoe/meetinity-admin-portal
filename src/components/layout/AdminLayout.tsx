import React, { useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { ADMIN_MODULES } from '../../utils/adminNavigation'

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: '#f3f4f6'
}

const sidebarStyle: React.CSSProperties = {
  width: '260px',
  backgroundColor: '#111827',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  padding: '24px 16px',
  boxSizing: 'border-box'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 24px',
  backgroundColor: '#fff',
  borderBottom: '1px solid #e5e7eb'
}

const mainStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column'
}

const contentStyle: React.CSSProperties = {
  padding: '24px',
  flex: 1
}

const navLinkBaseStyle: React.CSSProperties = {
  color: '#e5e7eb',
  padding: '10px 14px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 500,
  marginBottom: '6px',
  display: 'block'
}

const navLinkActiveStyle: React.CSSProperties = {
  ...navLinkBaseStyle,
  backgroundColor: '#1f2937',
  color: '#fff'
}

const breadcrumbNavStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '0.875rem',
  color: '#6b7280'
}

export function AdminLayout() {
  const location = useLocation()
  const { admin, hasPermissions } = usePermissions()

  const availableModules = useMemo(
    () => ADMIN_MODULES.filter(module => hasPermissions(module.requiredPermissions)),
    [hasPermissions]
  )

  const labelMap = useMemo(() => {
    const map = new Map<string, string>()
    map.set('admin', 'Administration')
    ADMIN_MODULES.forEach(module => {
      map.set(module.path, module.label)
    })
    return map
  }, [])

  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    let currentPath = ''

    return segments.map(segment => {
      currentPath += `/${segment}`
      const label = labelMap.get(segment) || segment
      return { path: currentPath, label }
    })
  }, [labelMap, location.pathname])

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Meetinity Admin</span>
        </div>
        <nav aria-label="Navigation principale">
          {availableModules.map(module => (
            <NavLink
              key={module.path}
              to={`/admin/${module.path}`}
              style={({ isActive }) => (isActive ? navLinkActiveStyle : navLinkBaseStyle)}
            >
              <div style={{ fontWeight: 600 }}>{module.label}</div>
              {module.description && (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{module.description}</div>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div style={mainStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Tableau de bord</h1>
            <nav aria-label="Fil d'Ariane" style={breadcrumbNavStyle}>
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.path}>
                  {index > 0 && <span style={{ margin: '0 8px' }}>/</span>}
                  <span>{crumb.label}</span>
                </React.Fragment>
              ))}
            </nav>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600 }}>{admin?.name || 'Administrateur'}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{admin?.email}</div>
          </div>
        </header>
        <main style={contentStyle}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

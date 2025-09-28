export interface AdminModuleConfig {
  path: string
  label: string
  requiredPermissions: string[]
  description?: string
}

export const ADMIN_MODULES: AdminModuleConfig[] = [
  {
    path: 'users',
    label: 'Utilisateurs',
    requiredPermissions: ['users:read'],
    description: 'Gérez les comptes utilisateurs et leurs statuts.'
  },
  {
    path: 'events',
    label: 'Événements',
    requiredPermissions: ['events:read'],
    description: 'Supervisez les événements publiés sur Meetinity.'
  },
  {
    path: 'moderation',
    label: 'Modération',
    requiredPermissions: ['moderation:read'],
    description: 'Suivez les signalements et prenez des mesures disciplinaires.'
  },
  {
    path: 'reports',
    label: 'Rapports',
    requiredPermissions: ['reports:read'],
    description: 'Analysez les indicateurs clés de la plateforme.'
  },
  {
    path: 'settings',
    label: 'Paramètres',
    requiredPermissions: ['settings:read'],
    description: 'Configurez les paramètres globaux et les intégrations.'
  }
]

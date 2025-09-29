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
    path: 'security',
    label: 'Sécurité',
    requiredPermissions: ['security:read'],
    description: 'Surveillez les logs, demandes GDPR et incidents de sécurité.'
  },
  {
    path: 'finance',
    label: 'Finances & BI',
    requiredPermissions: ['finance:read'],
    description: 'Suivez les performances financières et les indicateurs clés.'
  },
  {
    path: 'configuration',
    label: 'Configuration',
    requiredPermissions: ['platform:config'],
    description: 'Gérez les paramètres et l’orchestration de la plateforme.'
  }
]

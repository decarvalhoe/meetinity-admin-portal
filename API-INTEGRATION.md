# Meetinity Admin Portal – Guide d'intégration API

## Vue d'ensemble

Le portail d'administration consomme un ensemble d'API REST et de flux WebSocket exposés par la passerelle Meetinity. Chaque module (Utilisateurs, Événements, Modération, Sécurité, Configuration, Finances) repose sur un service dédié défini dans `src/services`.

## Variables d'environnement

Définir les variables suivantes dans `.env.local` :

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_WS_BASE_URL=ws://localhost:5001/ws
# Optionnel : jeton de conformité pour tracer les exports
VITE_AUDIT_EXPORT_TOKEN=dev-audit-token
```

- `VITE_API_BASE_URL` : URL de la passerelle REST. Tous les services utilisent `axios` avec cette valeur (`const API = import.meta.env.VITE_API_BASE_URL`).
- `VITE_WS_BASE_URL` : URL de base pour les sockets temps réel (terminer par le chemin racine, ex. `/ws`).
- `VITE_AUDIT_EXPORT_TOKEN` : valeur facultative à transmettre à votre middleware si un collector d'audit exige un jeton spécifique.

## Clients REST

Chaque service local (`UserService`, `EventService`, etc.) construit ses routes à partir de `VITE_API_BASE_URL`. Les requêtes sont effectuées avec `axios` sans wrapper supplémentaire.

| Module | Fichier service | Endpoints principaux | Permissions RBAC |
| ------ | ---------------- | -------------------- | ---------------- |
| Auth | `src/services/authService.ts` | `/api/admin/me`, `/api/admin/permissions`, `/api/auth/logout` | `admin:access` |
| Utilisateurs | `src/services/userService.ts` | `/api/users`, `/api/users/stats`, `/api/users/engagement`, `/api/users/activity-heatmap`, `/api/users/cohorts`, `/api/users/geo-distribution`, `/api/users/export` | `users:read`, `users:write` |
| Événements | `src/services/eventService.ts` | `/api/events`, `/api/events/bulk`, `/api/events/categories`, `/api/events/tags`, `/api/events/analytics`, `/api/events/attendance`, `/api/events/conversions`, `/api/events/approval-funnel`, `/api/events/engagement-heatmap` | `events:read`, `events:manage`, `events:approve` |
| Modération | `src/services/moderationService.ts` | `/api/moderation/reports`, `/api/moderation/reports/{id}`, `/api/moderation/reports/{id}/decisions`, `/api/moderation/rules`, `/api/moderation/appeals`, `/api/moderation/audit`, `/api/moderation/audit/export` | `moderation:read`, `moderation:write` |
| Sécurité | `src/services/securityService.ts` | `/api/security/audit-logs`, `/api/security/audit-logs/export`, `/api/security/gdpr/requests`, `/api/security/gdpr/requests/{id}/status`, `/api/security/gdpr/requests/{id}/confirm`, `/api/security/incidents/playbooks`, `/api/security/incidents/playbooks/{id}`, `/api/security/compliance/reports` | `security:read`, `security:respond` |
| Configuration | `src/services/configurationService.ts` | `/api/configuration`, `/api/configuration/versions`, `/api/configuration/parameters`, `/api/configuration/feature-flags`, `/api/configuration/notifications`, `/api/configuration/rate-limits`, `/api/configuration/revert` | `platform:config` |
| Finances | `src/services/financialService.ts` (mocké) | `/api/finance/metrics`, `/api/finance/projections` (mock), futurs `/api/finance/settlements`, `/api/finance/payouts` | `finance:read` |

> Les services Finances utilisent actuellement des données simulées. Dès que les endpoints REST seront disponibles, mettez à jour les appels côté `FinancialService` et ajustez la documentation.

## Sockets temps réel

| Flux | URL complète | Description | Permissions |
| ---- | ------------ | ----------- | ----------- |
| Utilisateurs | `${VITE_WS_BASE_URL.replace(/\/$/, '')}/users` | Diffuse les métriques d'engagement et de cohorte utilisateurs. | `admin:access` + `users:read` |
| Événements | `${VITE_WS_BASE_URL.replace(/\/$/, '')}/events` | Diffuse KPI d'événements, heatmaps et conversion funnels. | `admin:access` + `events:read` |

Les connexions sont gérées par le hook `useWebSocket` (`src/hooks/useWebSocket.ts`). Il normalise l'URL, écoute les messages JSON et déclenche les callbacks fournis par les modules.

## Configuration temps réel

1. **Déployer la passerelle** : exposer un serveur compatible WebSocket sur le même domaine que l'API (recommandé `wss://`).
2. **Configurer `.env`** :
   ```env
   VITE_WS_BASE_URL=wss://admin.example.com/ws
   ```
3. **Permissions** : la passerelle doit valider les scopes RBAC avant d'autoriser la souscription (`admin:access` + scope du module).
4. **Test local** : lancer un serveur WS mock (ex. `ws://localhost:5001/ws`) puis exécuter `npm run test:analytics` pour vérifier les flux utilisateurs/événements.

## Gestion des exports et audit

- Les fonctions `exportCsv`, `exportExcel`, `exportPdf` (dans `src/utils/export.ts`) déclenchent `exportAuditLogger.log` après chaque téléchargement.
- Pour relayer ces événements vers un collector externe, enregistrer un subscriber :
  ```ts
  exportAuditLogger.subscribe(entry => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/security/export-audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Audit-Token': import.meta.env.VITE_AUDIT_EXPORT_TOKEN ?? ''
      },
      body: JSON.stringify(entry)
    })
  })
  ```
- Les endpoints `/api/moderation/audit/export` et `/api/security/audit-logs/export` retournent directement un `Blob`. Utiliser `downloadBlob(blob, filename)` dans les composants pour déclencher le téléchargement.

## Bonnes pratiques d'intégration

- **Time-out** : laisser la configuration par défaut d'axios (les services gèrent les erreurs localement). Ajouter des interceptors uniquement si votre passerelle impose des en-têtes supplémentaires.
- **Retry** : le portail ne tente pas de retries automatiques. Gérez la résilience côté passerelle ou via un wrapper axios spécifique si nécessaire.
- **Sécurité** : toutes les requêtes supposent que la session admin est chargée (`AuthProvider`). Vérifiez que votre passerelle renvoie `401`/`403` correctement pour déclencher les écrans de permission.
- **Versioning API** : documenter les changements dans `docs/release-notes.md` et mettre à jour ce guide en cas de nouvelle route ou de modification de schéma.


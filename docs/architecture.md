# Architecture du portail d'administration

## Vue d'ensemble

Le portail est une application React 18 / TypeScript servie par Vite. Les modules fonctionnels (utilisateurs, événements, modération, sécurité, configuration, finances) partagent les mêmes fondations :

- `AuthProvider` charge la session administrateur et les permissions via l'API (`/api/admin/me`, `/api/admin/permissions`).
- `AdminLayout` fournit la navigation et distribue les routes décrites dans `src/app.tsx` et `src/utils/adminNavigation.ts`.
- Chaque module consomme son service dédié sous `src/services`, ce qui simplifie l'intégration avec les API backend.
- Les flux temps-réel sont gérés par `useWebSocket`, configuré à partir de `VITE_WS_BASE_URL`.

```
┌──────────────┐   REST / WebSocket   ┌────────────────────────┐
│ React + Vite │ ───────────────────▶ │ API Gateway & Services │
└──────────────┘                      └────────────────────────┘
        │                                         │
        │                     ┌───────────────────┴───────────────────┐
        │                     │                                       │
        ▼                     ▼                                       ▼
  AuthProvider ───▶ AdminLayout ───▶ Domain Modules (Users, Events, Moderation,…)
```

## Services et endpoints consommés

| Service backend | Port par défaut | Endpoints clés | Permissions principales |
| ---------------- | -------------- | --------------- | ----------------------- |
| **Authentification** | 5000 | `/api/admin/me`, `/api/admin/permissions` | `admin:access` |
| **Utilisateurs** | 5001 | `/api/users`, `/api/users/stats`, `/api/users/export`, `/api/users/engagement`, `/api/users/activity-heatmap`, `/api/users/cohorts`, `/api/users/geo-distribution` | `users:read`, `users:write` |
| **Événements** | 5002 | `/api/events`, `/api/events/bulk`, `/api/events/categories`, `/api/events/tags`, `/api/events/analytics`, `/api/events/attendance`, `/api/events/conversions`, `/api/events/approval-funnel`, `/api/events/engagement-heatmap` | `events:read`, `events:manage`, `events:approve` |
| **Modération** | 5003 | `/api/moderation/reports`, `/api/moderation/reports/{id}/decisions`, `/api/moderation/rules`, `/api/moderation/audit`, `/api/moderation/audit/export`, `/api/moderation/appeals` | `moderation:read`, `moderation:write` |
| **Sécurité** | 5004 | `/api/security/audit-logs`, `/api/security/audit-logs/export`, `/api/security/gdpr/requests`, `/api/security/incidents/playbooks`, `/api/security/compliance/reports` | `security:read`, `security:respond` |
| **Configuration** | 5005 | `/api/configuration`, `/api/configuration/versions`, `/api/configuration/parameters`, `/api/configuration/feature-flags`, `/api/configuration/experiments`, `/api/configuration/email-templates`, `/api/configuration/notifications`, `/api/configuration/rate-limits`, `/api/configuration/revert` | `platform:config` |
| **Finances** | 5006 | Service de modélisation interne (données agrégées exposées via le module `FinancialService`) | `finance:read` |

> Les chemins exacts sont visibles dans les fichiers correspondants de `src/services`.

## Permissions disponibles

| Permission | Description | Modules concernés |
| ---------- | ----------- | ----------------- |
| `admin:access` | Accès au layout administrateur. | Toutes les routes `/admin`. |
| `users:read` | Lecture de la base utilisateurs, statistiques et exports. | Utilisateurs. |
| `users:write` | Actions en masse (activer, désactiver, supprimer). | Utilisateurs. |
| `events:read` | Lecture du catalogue d'événements et des analytics. | Événements. |
| `events:manage` | Création / mise à jour, gestion des tags et catégories. | Événements. |
| `events:approve` | Validation / rejet des demandes d'événements. | Événements. |
| `moderation:read` | Consultation des signalements, règles et audit trail. | Modération. |
| `moderation:write` | Prise de décision, gestion des règles et appels. | Modération. |
| `security:read` | Lecture des journaux, incidents et rapports de conformité. | Sécurité. |
| `security:respond` | Traitement des demandes GDPR et exécution des playbooks. | Sécurité. |
| `platform:config` | Modification des paramètres plateforme et feature flags. | Configuration. |
| `finance:read` | Visualisation des dashboards financiers. | Finances. |

## Flux WebSocket

Les modules analytics se branchent sur les topics suivants :

- `events.analytics` – résumé temps-réel des KPI événements, heatmap d'engagement, conversions.
- `users.analytics` – engagement utilisateurs, heatmap d'activité, taux de matching.

Les URLs sont construites à partir de `VITE_WS_BASE_URL` dans `useWebSocket` (`ws://localhost:5001/ws` en local).

## Suites de tests

Les scripts ajoutés dans `package.json` permettent de cibler chaque domaine :

| Commande | Description | Fichier exécuté |
| -------- | ----------- | --------------- |
| `npm test` | Exécute l'intégralité de la suite Vitest. | Tous les fichiers dans `src/__tests__/`. |
| `npm run test:events` | Scénarios fonctionnels du module événements. | `src/__tests__/events.suite.test.tsx` |
| `npm run test:analytics` | Flux analytics (événements + utilisateurs) avec WebSocket mock. | `src/__tests__/analytics.suite.test.tsx` |
| `npm run test:moderation` | Tableau de modération, règles et appels. | `src/__tests__/moderation.suite.test.tsx` |
| `npm run test:configuration` | Paramétrage plateforme, versioning et previews. | `src/__tests__/configuration.suite.test.tsx` |
| `npm run test:finance` | Dashboard financier et visualisations D3. | `src/__tests__/finance.suite.test.tsx` |
| `npm run test:security` | Centre de sécurité, GDPR et incidents. | `src/__tests__/security.suite.test.tsx` |

Ces suites partagent des mocks mutualisés (`createMockWebSocket`, `createMockAxios`) définis dans `src/__tests__/utils/networkMocks.ts`.

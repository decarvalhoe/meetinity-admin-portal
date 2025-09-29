# Meetinity Admin Portal

This repository contains the administration portal for the Meetinity platform, providing comprehensive user management, event operations, analytics, moderation, finance and security capabilities.

## Overview

The admin portal is built with **React 18**, **TypeScript**, and **Vite**. It offers a modern interface for platform administrators to manage users, view analytics, and perform administrative tasks while enforcing the Meetinity RBAC model across modules.

## Delivery Status

- **Overall progress**: ~85% of the functional scope has shipped to production-like environments.
- **Delivered modules**: Users, Events, Moderation, Security, Configuration and Finance are available in the UI with their baseline workflows and dashboards.
- **In-progress work**: Finance settlement exports still rely on mocked data until the financial modelling backend exposes the `/api/finance/settlements` endpoints. Follow the tracking issue `FIN-128` for updates.
- **Next iterations**: tighten alerting hooks for moderation SLA breaches and extend security incident automation with playbook-level notifications.

## Architecture & Modules

The admin portal is organised into domain modules that share a common layout and permissions context:

- **Authentication & Permissions** – `AuthProvider` centralises session loading and exposes `usePermissions` to gate each module with `admin:access` plus domain scopes.
- **Users** – dashboards and tables for cohort analysis, segmentation and exports (`users:read`, `users:write`).
- **Events** – operational console for event approvals, tagging and analytics streaming via WebSocket topics (`events:read`, `events:approve`).
- **Moderation** – workflow to review reports, manage rules, audit trails and appeals (`moderation:read`, `moderation:write`).
- **Security** – GDPR requests, incident response playbooks and compliance exports (`security:read`, `security:respond`).
- **Configuration** – platform feature flags, notifications and rate limits with versioning (`platform:config`).
- **Finance** – revenue, subscription and cost analytics backed by the financial modelling service (`finance:read`).

Each module renders inside `AdminLayout` (see `src/app.tsx`) and consumes the dedicated service under `src/services`. A detailed breakdown of services, permissions and backend endpoints is available in [`docs/architecture.md`](docs/architecture.md).

## Feature Highlights

- **User Management**: Complete CRUD operations for user accounts with advanced filtering and search capabilities.
- **Event Operations**: Approval workflows, bulk actions, tagging and real-time analytics dashboards for event health monitoring.
- **Moderation Cockpit**: Unified queue for reports, automated rule management, appeals handling and CSV audit exports.
- **Security Centre**: GDPR requests lifecycle, incident playbooks and compliance reporting.
- **Financial Insights**: Revenue trends, cohort retention and cost insights rendered with D3.
- **Export Functionality**: Export data to CSV, Excel (multi-onglets) ou PDF pour l'analyse et l'audit, avec métadonnées injectées et traçabilité (`exportAuditLogger`).
- **Real-time Streams**: WebSocket updates enrich analytics widgets for events and users without refreshing the page.

## Tech Stack

- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Static typing for improved code quality and developer experience
- **@tanstack/react-table**: Powerful table component with sorting, filtering, and selection
- **Chart.js & React-Chart.js-2**: Interactive data visualization
- **Date-fns**: Date manipulation and formatting utilities
- **Axios**: HTTP client for API communication
- **Vite**: Fast build tool and development server

## Onboarding

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** – copy `.env.example` (or create `.env.local`) with the required variables:

   ```
   VITE_API_BASE_URL=http://localhost:5000
   VITE_WS_BASE_URL=ws://localhost:5001/ws
   # Optional compliance hooks
   VITE_AUDIT_EXPORT_TOKEN=dev-audit-token
   ```

   - `VITE_API_BASE_URL` points to the REST API gateway that fronts the domain services listed below.
   - `VITE_WS_BASE_URL` is used by `useWebSocket` to subscribe to analytics topics (`events.analytics`, `users.analytics`).
   - `VITE_AUDIT_EXPORT_TOKEN` is optional and only required if your backend enforces an audit token for export tracking. The value is surfaced to Axios interceptors so that custom middleware can enrich requests.

3. **Backend services** – start the API gateway and domain services consumed by the portal:

   | Service                     | Default port | Notes |
   | --------------------------- | ------------ | ----- |
   | API Gateway                 | 5000         | Routes REST requests to domain services |
   | Authentication Service      | 5000         | `/api/admin/me`, `/api/admin/permissions` |
   | User Service                | 5001         | Users CRUD, engagement & exports |
   | Event Service               | 5002         | Events lifecycle and analytics endpoints |
   | Moderation Service          | 5003         | Reports, rules, appeals and audit trail |
   | Security Service            | 5004         | GDPR requests, incidents, compliance |
   | Configuration Service       | 5005         | Feature flags, notifications, experiments |
   | Financial Modelling Service | 5006         | Revenue and cost aggregations for dashboards |

4. **Launch the portal**

   ```bash
   npm run dev
   ```

## Tests

Run the full suite:

```bash
npm test
```

Domain-specific suites are also available:

```bash
npm run test:events
npm run test:analytics
npm run test:moderation
npm run test:configuration
npm run test:finance
npm run test:security
```

Each command executes the corresponding Vitest file under `src/__tests__/` to speed up targeted QA checks.

## Export helpers

Les exports sont centralisés dans `src/utils/export.ts`. Trois fonctions sont disponibles :

- `exportCsv({ filename, data, columns, metadata })`
- `exportExcel({ filename, sheets, metadata })`
- `exportPdf({ filename, title, data, columns, metadata })`

Toutes appliquent automatiquement les métadonnées aux journaux (`exportAuditLogger`) afin de tracer les téléchargements. Les colonnes définissent l'ordre et les intitulés des colonnes exportées, tandis que `metadata` permet d'ajouter des informations de contexte (filtres actifs, compteurs, horodatage). Les exports Excel acceptent plusieurs feuilles pour combiner KPI et détails, comme démontré dans `UserManagement`.

### Export multi-format

1. Compose the dataset and metadata in the calling component (e.g. active filters, total rows).
2. Call the appropriate helper:
   - `exportCsv` pour des extractions légères.
   - `exportExcel` afin de générer plusieurs onglets (KPI + données détaillées) avec une feuille « Metadata » optionnelle.
   - `exportPdf` pour les rapports prêts à partager.
3. Abonnez un collecteur d'audit si nécessaire, par exemple :

   ```ts
   exportAuditLogger.subscribe(entry => {
     const token = import.meta.env.VITE_AUDIT_EXPORT_TOKEN
     if (!token) return

     fetch(`${import.meta.env.VITE_API_BASE_URL}/api/security/export-audit`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-Audit-Token': token
       },
       body: JSON.stringify(entry)
     })
   })
   ```

Les exports JSON de secours (audits et incidents) sont réalisés via les services dédiés (`ModerationService`, `SecurityService`) qui renvoient un `Blob` déjà authentifié côté API.

## Configuration temps réel

- Définissez `VITE_WS_BASE_URL` avec le protocole (`ws://` ou `wss://`), l'hôte et le chemin de base exposé par votre passerelle temps réel, par exemple `ws://localhost:5001/ws`.
- Les clients `useWebSocket` ajoutent automatiquement les suffixes `/users` et `/events` pour se connecter aux flux suivants :
  - `ws://…/ws/users` pour l'activité utilisateurs.
  - `ws://…/ws/events` pour l'analytics événements.
- **Permissions requises** :
  - `users:read` est nécessaire pour que les messages issus de `/ws/users` soient diffusés.
  - `events:read` ou `events:manage` débloquent `/ws/events`.
  - Les modules Modération, Sécurité et Finances ne consomment pas encore de flux temps réel ; leurs hooks RBAC restent gérés par `AuthProvider` côté REST.

Pour déployer en production, préférez `wss://` derrière un reverse proxy mutualisé avec le gateway HTTP et assurez-vous que les souscriptions WebSocket appliquent la même politique RBAC que les endpoints REST (`admin:access` + scope du module).

## API Integration

Detailed endpoint coverage, permission scopes and service contracts are documented in [`docs/architecture.md`](docs/architecture.md).

Latest functional releases are tracked in [`docs/release-notes.md`](docs/release-notes.md).

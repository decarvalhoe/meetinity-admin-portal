# Meetinity Admin Portal

This repository contains the administration portal for the Meetinity platform, providing comprehensive user management, event operations, analytics, moderation, finance and security capabilities.

## Overview

The admin portal is built with **React 18**, **TypeScript**, and **Vite**. It offers a modern interface for platform administrators to manage users, view analytics, and perform administrative tasks.

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
- **Export Functionality**: Export data to CSV, Excel (multi-onglets) ou PDF pour l'analyse et l'audit.
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
   ```

   `VITE_WS_BASE_URL` is used by `useWebSocket` to subscribe to analytics topics (`events.analytics`, `users.analytics`).

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

## API Integration

Detailed endpoint coverage, permission scopes and service contracts are documented in [`docs/architecture.md`](docs/architecture.md).

Latest functional releases are tracked in [`docs/release-notes.md`](docs/release-notes.md).

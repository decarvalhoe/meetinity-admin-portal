# Portail d'Administration Meetinity

Ce repository contient le portail d'administration de la plateforme Meetinity, offrant des capacités complètes de gestion des utilisateurs et d'analyse.

## Vue d'ensemble

Le portail d'administration est développé avec **React 18**, **TypeScript** et **Vite**. Il offre une interface moderne permettant aux administrateurs de la plateforme de gérer les utilisateurs, consulter les analyses et effectuer des tâches administratives en respectant la matrice de permissions RBAC de Meetinity.

## État du projet

- **Avancement global** : ~85 % du périmètre fonctionnel est disponible dans l'interface.
- **Modules livrés** : Utilisateurs, Événements, Modération, Sécurité, Configuration et Finances (tableaux de bord et exports).
- **Travaux en cours** : l'intégration du backend finances pour les exports de règlements (`/api/finance/settlements`) reste à finaliser ; suivre la tâche `FIN-128`.
- **Chantiers à suivre** : automatisation des alertes SLA de modération et notifications temps réel pour les playbooks d'incident.

## Fonctionnalités

- **Gestion des utilisateurs** : Opérations CRUD complètes pour les comptes utilisateurs avec filtrage avancé et capacités de recherche
- **Visualisation de données** : Graphiques interactifs et statistiques utilisant Chart.js et React Chart.js 2
- **Opérations en masse** : Effectuer des actions sur plusieurs utilisateurs simultanément (activer, désactiver, supprimer)
- **Fonctionnalité d'export** : Exporter les données utilisateur au format CSV, Excel multi-feuilles ou PDF avec traçabilité via `exportAuditLogger`
- **Pagination** : Gestion efficace de grands ensembles de données avec tailles de page personnalisables
- **Filtrage en temps réel** : Recherche et filtrage avec anti-rebond par statut, secteur et plages de dates

## Stack Technique

- **React 18** : React moderne avec hooks et composants fonctionnels
- **TypeScript** : Typage statique pour une meilleure qualité de code et expérience développeur
- **@tanstack/react-table** : Composant de tableau puissant avec tri, filtrage et sélection
- **Chart.js & React-Chart.js-2** : Visualisation de données interactive
- **Date-fns** : Utilitaires de manipulation et formatage de dates
- **Axios** : Client HTTP pour la communication API
- **Vite** : Outil de build rapide et serveur de développement

## Jalons récents

- **Sprint actuel** : consolidation des modules livrés (Utilisateurs, Événements, Modération, Sécurité, Configuration, Finances).
- **Livraisons majeures** : analytics temps réel, exports multi-format, workflows GDPR et playbooks incidents.
- **À finaliser** : intégration backend finances pour les exports de règlements et notifications avancées sur la modération.

## Développement

```bash
npm install
npm run dev
```

## Configuration `.env`

Créer un fichier `.env.local` à partir de `.env.example` :

```
VITE_API_BASE_URL=http://localhost:5000
VITE_WS_BASE_URL=ws://localhost:5001/ws
# Optionnel : clé de conformité
VITE_AUDIT_EXPORT_TOKEN=dev-audit-token
```

- `VITE_API_BASE_URL` : URL de la passerelle REST.
- `VITE_WS_BASE_URL` : base WebSocket utilisée par `useWebSocket` pour `/ws/users` et `/ws/events`.
- `VITE_AUDIT_EXPORT_TOKEN` : valeur facultative à transmettre aux collecteurs d'audit si votre backend exige un jeton dédié pour les exports.

## Tests

```bash
npm test
```

## Intégration API

Le portail communique avec les services backend Meetinity via la passerelle API. Assurez-vous que les services suivants sont en cours d'exécution :

- Passerelle API (port 5000)
- Service Utilisateur (port 5001)
- Service Événements (port 5002)
- Service Modération (port 5003)
- Service Sécurité (port 5004)
- Service Configuration (port 5005)
- Service Financier (port 5006)

## Exports multi-format

Les utilitaires d'export (`src/utils/export.ts`) exposent trois helpers :

- `exportCsv` pour les extractions rapides.
- `exportExcel` pour produire plusieurs feuilles (KPI + détails) et une feuille « Metadata » optionnelle.
- `exportPdf` pour générer des rapports prêts à être partagés.

Chaque helper déclenche `exportAuditLogger.log` ; vous pouvez enregistrer un listener pour envoyer ces événements vers un collecteur externe. Exemple :

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

Fournir `VITE_AUDIT_EXPORT_TOKEN` permet de signer ces requêtes côté middleware.

Les modules Modération et Sécurité offrent en complément des exports JSON/CSV fournis par leur API respective (`/api/moderation/audit/export`, `/api/security/audit-logs/export`).

## Configuration temps réel

- Configurez `VITE_WS_BASE_URL` avec le schéma adéquat (`ws://` en local, `wss://` en production).
- Les modules Utilisateurs et Événements établissent les connexions vers `/ws/users` et `/ws/events`.
- Permissions requises :
  - `users:read` pour recevoir les flux utilisateurs.
  - `events:read` ou `events:manage` pour la télémétrie événements.
- Les modules Modération, Sécurité, Configuration et Finances s'appuient uniquement sur les endpoints REST mais héritent de `admin:access` plus leur scope dédié pour la navigation.

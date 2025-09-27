# Portail d'Administration Meetinity

Ce repository contient le portail d'administration de la plateforme Meetinity, offrant des capacités complètes de gestion des utilisateurs et d'analyse.

## Vue d'ensemble

Le portail d'administration est développé avec **React 18**, **TypeScript** et **Vite**. Il offre une interface moderne permettant aux administrateurs de la plateforme de gérer les utilisateurs, consulter les analyses et effectuer des tâches administratives.

## Fonctionnalités

- **Gestion des utilisateurs** : Opérations CRUD complètes pour les comptes utilisateurs avec filtrage avancé et capacités de recherche
- **Visualisation de données** : Graphiques interactifs et statistiques utilisant Chart.js et React Chart.js 2
- **Opérations en masse** : Effectuer des actions sur plusieurs utilisateurs simultanément (activer, désactiver, supprimer)
- **Fonctionnalité d'export** : Exporter les données utilisateur au format CSV pour analyse externe
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

## État du Projet

- **Avancement** : 60%
- **Fonctionnalités terminées** : Interface de gestion des utilisateurs, tableaux de données, filtrage, opérations en masse, fonctionnalité d'export
- **Fonctionnalités en attente** : Gestion des événements, tableau de bord d'analyse des utilisateurs, permissions basées sur les rôles

## Développement

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

Définir l'URL de base de l'API via `.env` :

```
VITE_API_BASE_URL=http://localhost:5000
```

## Intégration API

Le portail communique avec les services backend Meetinity via la passerelle API. Assurez-vous que les services suivants sont en cours d'exécution :

- Passerelle API (port 5000)
- Service Utilisateur (port 5001)

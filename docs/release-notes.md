# Release Notes – Meetinity Admin Portal

## 2024-11-22

### Highlights
- Mise en place des tableaux de bord par domaine : utilisateurs, événements, modération, sécurité, configuration et finances.
- Ajout du pipeline analytics temps-réel (WebSocket) pour les modules événements et utilisateurs.
- Gestion avancée des règles de modération, des appels et des exports CSV/PDF.
- Centre de sécurité couvrant journaux d'audit, demandes GDPR et incidents avec playbooks.
- Expérimentation et configuration plateforme avec versioning, previews et notifications.
- Dashboard financier (revenu, abonnements, cohortes, coûts) rendu avec D3.

### Tests et qualité
- Suites Vitest ciblées par domaine (`test:events`, `test:analytics`, `test:moderation`, `test:configuration`, `test:finance`, `test:security`).
- Mutualisation des mocks Axios et WebSocket pour simplifier les tests d'intégration.
- Couverture dédiée pour `AuthService` afin de vérifier la normalisation des erreurs backend.

### Documentation
- Nouvelle documentation d'architecture détaillant permissions, endpoints et services requis.
- Mise à jour du guide d'onboarding (variables d'environnement et dépendances backend).

# amn-desktop

Application de bureau AMN pour la supervision de sites, construite avec Electron, React, TypeScript et Vite (via Electron Forge).

## Écrans

- **Connexion** (`/login`) — authentification par email/mot de passe (mock, à brancher sur une vraie API).
- **Accueil** (`/`) — vue d'ensemble après connexion.
- **Dashboard des sites** (`/sites`) — liste des sites surveillés avec statut, disponibilité et vulnérabilités ouvertes.
- **Vue détail d'un site** (`/sites/:siteId`) — informations détaillées d'un site.

## Démarrage

```bash
npm install
npm start
```

## Scripts

- `npm start` — lance l'application en mode développement.
- `npm run lint` — vérifie le code avec ESLint.
- `npm run typecheck` — vérifie les types TypeScript.
- `npm run package` / `npm run make` — packagent l'application.

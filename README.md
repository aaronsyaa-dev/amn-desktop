# amn-desktop

Application de bureau **AMN DevSec** pour la supervision de sites (statut,
disponibilité, sécurité), construite avec Electron, React, TypeScript et Vite
(via Electron Forge). Interface sombre « premium » avec Tailwind CSS v4 et
animations Framer Motion.

> Les données sont actuellement mockées (6 sites de démonstration). Le backend
> réel sera branché ultérieurement.

## Fonctionnalités

- **Connexion** (`/login`) — formulaire email/mot de passe (authentification
  mock, à brancher sur une vraie API), logo AMN.
- **Accueil** (`/`) — KPIs de supervision, sites à surveiller et flux
  d'activité récente cross-sites.
- **Sites surveillés** (`/sites`) — cards par site avec statut, disponibilité,
  vulnérabilités, sparkline de tendance, recherche, filtres de statut et tri.
- **Panel de détail (slide-over)** — glisse depuis la droite au clic sur un
  site : analytics (visiteurs, CA + tendance), timeline de sécurité des
  alertes, et actions mock (bloquer paiements / connexion). Fermeture via
  Échap, overlay ou bouton.
- **Command palette** (`⌘/Ctrl + K`) — recherche rapide de sites et de pages,
  navigation clavier.
- **Centre de notifications** — cloche dans le header avec les alertes
  critiques cross-sites.

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

## Stack

Electron Forge · Vite · React · TypeScript · React Router · Tailwind CSS v4 ·
Framer Motion · lucide-react · Inter (fontsource).

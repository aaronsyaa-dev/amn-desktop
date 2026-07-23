# amn-desktop

Application de bureau **AMN DevSec** pour la supervision de sites (statut,
disponibilité, sécurité), construite avec Electron, React, TypeScript et Vite
(via Electron Forge). Interface sombre « premium » avec Tailwind CSS v4 et
animations Framer Motion.

> Les données sont actuellement mockées (6 sites de démonstration). Le backend
> réel sera branché ultérieurement.

## Fonctionnalités

- **Connexion** (`/login`) — authentification réelle (SQLite + bcrypt dans le
  process main Electron, fallback navigateur), logo AMN. Deux comptes seedés
  (voir `docs/ARCHITECTURE.md`).
- **Accueil / QG** (`/`) — brief du jour (typewriter), KPIs animés, fil
  d'activité continu (alertes, messages, veille, insights), insights
  automatiques et mini-résumé de la semaine.
- **Sites surveillés** (`/sites`) — cards par site avec statut, disponibilité,
  vulnérabilités, sparkline de tendance, recherche, filtres de statut et tri.
- **Équipe** (`/team`) — messagerie persistée, présence, mentions `@site`
  cliquables ouvrant le panel du site.
- **Panel de détail (slide-over)** — glisse depuis la droite au clic sur un
  site : analytics (visiteurs, CA + tendance), timeline de sécurité des
  alertes, et actions mock (bloquer paiements / connexion). Fermeture via
  Échap, overlay ou bouton.
- **Assistant IA** — rapports (interne/client), résumé du jour, veille,
  suggestions proactives. Mock isolé, prêt à brancher l'API Claude.
- **Command palette** (`⌘/Ctrl + K`) et **centre de notifications**.

## Architecture

L'authentification et le stockage local (SQLite + bcrypt, via un « bridge »
main/renderer avec fallback navigateur) sont documentés dans
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — à lire avant de brancher l'API
centrale.

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
Framer Motion · lucide-react · Inter (fontsource) · better-sqlite3 · bcryptjs.

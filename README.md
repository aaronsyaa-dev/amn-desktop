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
- **Équipe** (`/team`) — messagerie persistée, présence, mentions `@site` et
  `@client` cliquables (ouvrent la fiche correspondante) avec aperçu au survol,
  et messages rapides personnalisables par utilisateur.
- **Panel de détail (slide-over)** — glisse depuis la droite au clic sur un
  site : analytics (visiteurs, CA + tendance), timeline de sécurité des
  alertes, et actions mock (bloquer paiements / connexion). Fermeture via
  Échap, overlay ou bouton.
- **Assistant IA** — rapports (interne/client), résumé du jour, veille,
  suggestions proactives. Mock isolé, prêt à brancher l'API Claude.
- **Command palette** (`⌘/Ctrl + K`) et **centre de notifications**.
- **Aide rapide** — bouton `?` dans la barre du haut (ou touche `?`) : rappel
  des raccourcis, des mentions et des messages rapides.
- **Robustesse & confort** — indicateur de synchronisation (Synchronisé / Hors
  ligne), indicateur d'enregistrement sur les zones de texte libre, écrans
  squelettes au chargement, error boundary (jamais d'écran blanc), suppression
  annulable (« Annuler » pendant quelques secondes avant suppression
  définitive), et mémoire de session (dernier onglet + taille de la fenêtre).
- **À propos & mises à jour** — écran « À propos » (Paramètres) avec la version
  et l'historique des changements ; notification « Nouvelle mise à jour ! » au
  premier lancement après une mise à jour. Le changelog est maintenu dans
  [`src/data/changelog.ts`](src/data/changelog.ts).
- **Sauvegarde** — export d'un instantané JSON complet de l'espace de travail
  depuis les Paramètres.

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

## Branding / icônes

L'icône de l'app et de la fenêtre est `images/icon.png` (placeholder AMN). Pour
utiliser le vrai logo, remplacez / ajoutez dans `images/` :

- `icon.png` — icône de fenêtre + barre des tâches (min. 512×512).
- `icon.ico` — icône de l'exécutable/installeur **Windows** (multi-résolutions).
- `icon.icns` — icône de l'app **macOS**.

`forge.config.ts` pointe déjà sur `./images/icon` (sans extension) : Forge
choisit automatiquement la bonne extension par plateforme. Aucune autre
modification nécessaire.

## Publier une nouvelle version (mise à jour automatique)

L'app se met à jour toute seule via le service gratuit `update.electronjs.org`
(lu par `update-electron-app`, câblé dans `src/main/updater.ts`). Pour qu'une
mise à jour se déclenche chez les utilisateurs :

1. **Bumper la version** dans `package.json` (ex. `0.1.0` → `0.1.1`).
2. **Ajouter une entrée de changelog** dans `src/data/changelog.ts` (elle
   s'affiche en « Nouvelle mise à jour ! » au premier lancement après update,
   et dans Paramètres → À propos).
3. **Publier** : `GITHUB_TOKEN=<token> npm run publish`. Cela construit les
   artefacts Squirrel et les téléverse dans les *GitHub Releases* du dépôt
   `aaronsyaa-dev/amn-desktop` (fichier `RELEASES` inclus).

Conditions pour que l'auto-update fonctionne réellement :

- le dépôt GitHub est **public** (ou autorisé sur update.electronjs.org) ;
- le build Windows est **signé** (un build non signé peut se mettre à jour
  mais Windows affichera un avertissement à l'installation) ;
- les utilisateurs ont installé une version **packagée** (l'auto-update est
  inactif en `npm start`/dev).

## Intégration bureau (Windows/macOS)

- **Démarrer avec Windows** : case à cocher dans Paramètres → Démarrage
  (`app.setLoginItemSettings`). Au démarrage de session, l'app se lance
  discrètement en arrière-plan (argument `--hidden`) et n'affiche qu'une
  notification « AMN Desktop est prêt » ; le Welcome complet (voix + animation)
  ne joue qu'à l'ouverture manuelle de la fenêtre.
- **Barre système (tray)** : fermer la fenêtre la réduit dans la barre système
  au lieu de quitter. Clic sur l'icône = ouvrir ; clic droit = « Quitter ».
  L'icône signale une notification importante en attente (tooltip + flash de la
  barre des tâches + badge du dock macOS).

## Modules natifs & empaquetage (`better-sqlite3`)

L'app utilise `better-sqlite3`, un module natif. Sa distribution est configurée
dans `forge.config.ts` :

- **`plugin-auto-unpack-natives`** extrait le binaire `.node` de l'archive
  `asar` (`app.asar.unpacked/`), car un binaire natif ne peut pas être
  `require()` depuis l'intérieur de l'`asar`.
- **`packagerConfig.ignore`** : le plugin Vite, laissé seul, exclut **tout**
  `node_modules` de l'app (il suppose que Vite bundle tout). On fournit donc
  notre propre `ignore` qui embarque uniquement la fermeture des dépendances
  runtime (`RUNTIME_MODULES` en tête de `forge.config.ts`). Sans ça, l'app
  installée plantait avec `Cannot find module 'better-sqlite3'`.
- **`rebuildConfig: { onlyModules: [] }`** : `better-sqlite3` v13 fournit des
  *prebuilds* N-API (`prebuilds/<plateforme>-<arch>.node`). N-API étant stable
  entre Node et Electron, ce binaire fonctionne tel quel sous Electron — aucune
  recompilation, aucun compilateur ni header Electron requis sur la machine de
  build.

### Vérifier un build packagé

```bash
npm run package          # empaquette l'app dans out/<AppName>-<os>-<arch>/
```

Puis contrôler que le module natif est bien présent et dépacké :

```bash
# le binaire natif doit exister HORS de l'asar :
ls out/*/resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/
# et node_modules dans l'asar ne doit contenir QUE les deps runtime :
npx @electron/asar list out/*/resources/app.asar | grep '^/node_modules/'
```

Pour un test de chargement réel du module (le prebuild N-API se charge à
l'identique sous Node et Electron) :

```bash
node -e "const D=require('better-sqlite3'); const d=new D(':memory:'); d.exec('create table t(x)'); console.log('OK');"
```

`npm run make` produit ensuite l'installeur de la plateforme courante
(Squirrel `.exe` sur Windows, `.zip` sur macOS, `.deb`/`.rpm` sur Linux — ces
deux derniers exigent `dpkg`/`rpmbuild` installés).

## Veille cybersécurité (flux RSS réels)

L'onglet **Veille** de l'assistant n'affiche plus de contenu factice : il agrège
de vrais flux RSS publics, récupérés et analysés **dans le process main**
(`src/main/watch.ts`) — le renderer ne peut pas lire un flux RSS cross-origin.

- **Sources** : CERT-FR (le CERT national français, opéré par l'ANSSI —
  alertes, avis, actualité) et The Hacker News. *Anthropic ne publie pas de flux
  RSS officiel : la source est volontairement omise plutôt que simulée.*
- **Cache + rafraîchissement** : résultats mis en cache sur disque
  (`userData/watch-cache.json`), TTL de 3 h, réchauffés en arrière-plan au
  démarrage. Les sources ne sont jamais interrogées à chaque ouverture du
  panneau.
- **Dégradation gracieuse** : une source injoignable est simplement ignorée
  (le dernier cache valide, même périmé, reste servi) ; l'écran ne casse jamais
  et signale discrètement un contenu partiel.
- En **fallback navigateur** (dev/preview web), la veille en direct est
  indisponible (pas de main process) — l'onglet l'indique clairement.

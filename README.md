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
(lu par `update-electron-app`, câblé dans `src/main/updater.ts`).

**Côté utilisateur, zéro terminal** : l'app vérifie les nouvelles versions en
arrière-plan (toutes les heures), télécharge et prépare la mise à jour
automatiquement, puis affiche un panneau in-app « Mise à jour prête » avec un
seul bouton « Redémarrer et installer » (`src/components/UpdateReady.tsx`). Après
le redémarrage, l'écran « Nouveau dans cette version » liste les changements
(`src/components/UpdateNotice.tsx`, lus depuis `src/data/changelog.ts`). Aucune
commande à taper — exactement comme Discord/Spotify.

**Côté développeur, une seule action** pour publier une version :

1. **Bumper la version** dans `package.json` (ex. `1.0.0` → `1.0.1`).
2. **Ajouter une entrée de changelog** dans `src/data/changelog.ts` (elle
   s'affiche en « Nouvelle mise à jour ! » au premier lancement après update,
   et dans Paramètres → À propos).
3. **Publier**, deux options :
   - **Automatique (recommandé)** — pousser un tag Git correspondant à la
     version : `git tag v1.0.1 && git push origin v1.0.1`. Le workflow
     `.github/workflows/release.yml` construit et publie tout seul (build
     Windows sur GitHub Actions, aucune machine locale requise).
   - **Manuel** — `GITHUB_TOKEN=<token> npm run publish` depuis une machine
     Windows. Construit les artefacts Squirrel et les téléverse dans les
     *GitHub Releases* du dépôt `aaronsyaa-dev/amn-desktop` (fichier
     `RELEASES` inclus).

Conditions pour que l'auto-update fonctionne réellement :

- le dépôt GitHub est **public** (ou autorisé sur update.electronjs.org) ;
- le build Windows est **signé** (un build non signé peut se mettre à jour
  mais Windows affichera un avertissement à l'installation) ;
- les utilisateurs ont installé une version **packagée** (l'auto-update est
  inactif en `npm start`/dev).

### ⚠️ Secrets requis pour la synchronisation temps réel

Pour que l'app packagée se connecte à amn-api (sync, présence, WebSocket) au
lieu de rester en mode **« Local »**, l'URL et le token doivent être **injectés
dans le build** (`vite.main.config.ts` les *inline* au moment du build ; un
`.env` n'existe pas dans une app packagée, donc une lecture à l'exécution
échouerait). Réglez **deux secrets de dépôt** GitHub (Settings → Secrets and
variables → Actions) :

| Secret | Valeur |
|---|---|
| `AMN_API_URL` | `https://amn-api.onrender.com` (l'URL publique du serveur amn-api) |
| `AMN_API_OPERATOR_TOKEN` | **la même valeur** que la variable `OPERATOR_TOKEN` configurée sur le serveur amn-api (Render) |

Le workflow `release.yml` passe ces secrets au build. **Si `AMN_API_OPERATOR_TOKEN`
diffère de l'`OPERATOR_TOKEN` du serveur, la WebSocket est fermée avec le code
`4401` (token refusé)** — visible dans les logs de l'app (lancez l'exe depuis un
terminal pour voir les lignes `[amn-api] WS …`). En développement (`npm start`),
les mêmes variables sont lues depuis un fichier `.env` local (non commité).

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

### `npm ci`/`npm install` ne doit JAMAIS compiler `better-sqlite3`

Les *prebuilds* ci-dessus rendent toute compilation inutile — mais
`better-sqlite3` ne déclare **aucun script `install`/`postinstall` explicite**
alors qu'il contient un `binding.gyp`. Or npm a un comportement historique
implicite : *« si un paquet a un `binding.gyp` et aucun script
`install`/`postinstall`/`preinstall`, lance automatiquement
`node-gyp rebuild` »*. Ce comportement se déclenche **pendant `npm install`/
`npm ci` lui-même**, avant même que Forge n'intervienne, et échoue sans
compilateur C++ installé — c'est exactement ce qui cassait le workflow de
release sur les runners Windows GitHub Actions (`Could not find any Visual
Studio installation`), alors que rien n'était compilé en local (Linux/macOS
ont `gcc`/`clang` par défaut, donc la compilation implicite y réussissait
silencieusement, masquant le problème).

**Fix** : [`.npmrc`](.npmrc) porte `ignore-scripts=true`, qui désactive tous
les scripts de cycle de vie (le nôtre compris) pendant `npm install`/`ci` — la
seule façon fiable d'empêcher ce déclenchement implicite, sur n'importe quelle
plateforme. Les deux dépendances qui ont vraiment besoin de leur script
d'installation (`esbuild`, pour Vite ; `electron-winstaller`, pour le maker
Squirrel Windows) sont réactivées explicitement et de façon déterministe via
`npm run bootstrap` (`npm rebuild esbuild electron-winstaller fsevents`),
chaîné en tête de `start`/`package`/`make`/`publish` dans `package.json` — donc
toujours exécuté, sans dépendre de l'ordre des scripts npm. **Aucun changement
n'est nécessaire dans `.github/workflows/release.yml`** : `.npmrc` est lu
automatiquement par `npm ci`, et `npm run publish` chaîne déjà `bootstrap`.

Vérifié en local par une reproduction fidèle des conditions CI
(`rm -rf node_modules && npm ci`, équivalent à un runner propre sans cache) :
aucune invocation de `node-gyp` (confirmée par l'absence du dossier
`node_modules/better-sqlite3/build/`, qui n'apparaît que si une compilation a
eu lieu), le module se charge et fonctionne, et `npm run package` aboutit
normalement (Vite/esbuild et l'empaquetage natif intacts). Non vérifiable
depuis cet environnement : l'échec réel sur un runner Windows sans Visual
Studio — seul le prochain push de tag (`git tag vX.Y.Z && git push origin
vX.Y.Z`) le confirmera en conditions réelles.

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

## Veille cyber & tech (flux RSS réels)

L'onglet **Veille** de l'assistant n'affiche plus de contenu factice : il agrège
de vrais flux RSS publics, récupérés et analysés **dans le process main**
(`src/main/watch.ts`) — le renderer ne peut pas lire un flux RSS cross-origin.
L'onglet propose un filtre par catégorie (**Cybersécurité** / **Actu monde
tech**), et le « Résumé du jour » couvre les deux.

- **Sources — Cybersécurité** : CERT-FR (le CERT national français, opéré par
  l'ANSSI — alertes, avis, actualité) et The Hacker News.
- **Sources — Actu monde tech** : Hacker News (news.ycombinator.com), TechCrunch
  et Ars Technica. *Anthropic ne publie pas de flux RSS officiel : la source est
  volontairement omise plutôt que simulée.*
- **Cache + rafraîchissement** : résultats mis en cache sur disque
  (`userData/watch-cache.json`), TTL de 3 h, réchauffés en arrière-plan au
  démarrage. Les sources ne sont jamais interrogées à chaque ouverture du
  panneau.
- **Dégradation gracieuse** : une source injoignable est simplement ignorée
  (le dernier cache valide, même périmé, reste servi) ; l'écran ne casse jamais
  et signale discrètement un contenu partiel.
- En **fallback navigateur** (dev/preview web), la veille en direct est
  indisponible (pas de main process) — l'onglet l'indique clairement.

## Assistant IA local via Ollama (gratuit, privé)

L'assistant peut utiliser un vrai modèle d'IA tournant **localement** sur la
machine via [Ollama](https://ollama.com) — gratuit, privé (aucune donnée ne
sort du poste), et indépendant par machine (pas de serveur central partagé).
S'il n'est pas présent, l'assistant retombe proprement sur son moteur intégré.

### Installation

1. Télécharger et installer Ollama depuis **https://ollama.com**.
2. Dans un terminal, récupérer un modèle léger mais correct (recommandé) :
   ```bash
   ollama pull llama3.2
   ```
   `llama3.2` (3B) est un bon compromis taille/qualité pour du français et des
   réponses courtes. Alternatives plus légères : `qwen2.5:3b`, `phi3.5`.
3. Ollama tourne alors sur `http://localhost:11434`. AMN Desktop le **détecte
   automatiquement** — voir **Paramètres → Assistant IA local (Ollama)** pour
   le statut de connexion et pour choisir le modèle parmi ceux installés.

### Comment ça marche

- La détection et les appels passent par le **process main** d'Electron
  (`src/main/ollama.ts`) — pas de souci de CORS/origine, et chaque poste utilise
  son propre modèle.
- Les **questions libres** de l'onglet Chat sont générées par le modèle local,
  avec un *system prompt* ancré sur les **données réelles du parc** (sites,
  statuts, alertes) pour des réponses concrètes, pas génériques
  (`assistantSystemPrompt` dans `src/assistant/engine.ts`).
- Les **rapports structurés** (interne/client) restent déterministes et
  formatés — c'est volontaire pour des documents fiables et reproductibles côté
  client ; ils s'appuient sur les mêmes données réelles.
- Si Ollama est absent, indisponible, ou renvoie une erreur, l'assistant utilise
  son moteur intégré sans interruption pour l'utilisateur.
- **Premier appel plus long** : Ollama doit charger le modèle en mémoire avant
  de générer quoi que ce soit — cela peut prendre de 10 s à plus d'une minute
  selon la taille du modèle et la machine, avant même le début de la
  génération. Le délai d'attente côté app est donc généreux (5 min) et
  l'interface l'indique clairement (« Ajmani réfléchit… » puis un message plus
  explicite après ~20 s). Les appels suivants au même modèle sont rapides tant
  qu'il reste chargé en mémoire (`keep_alive` par défaut d'Ollama).
- Variable optionnelle : `AMN_OLLAMA_URL` pour pointer vers une instance Ollama
  non standard (défaut `http://localhost:11434`).

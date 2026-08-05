# Version mobile (PWA) — « Ajouter à l'écran d'accueil »

AMN Desktop peut aussi tourner comme une **PWA installable** sur iPhone (via
Safari → « Ajouter à l'écran d'accueil »), en réutilisant **le même code React /
Vite** que l'application Electron. Aucun backend supplémentaire n'est nécessaire.

## Architecture retenue

**PWA servie depuis le renderer existant** (adaptation responsive + détection de
plateforme), plutôt qu'un second point d'entrée séparé. Raison : le pont
navigateur (`src/lib/bridge.ts` → `createBrowserRemote`) parle déjà directement à
amn-api en `fetch` + WebSocket. Donc, hors d'Electron, **la synchronisation
temps réel fonctionne telle quelle** : chat, tâches, clients, décisions, notes,
médias, rapports, présence, accusés de lecture — tout ce qui passe par amn-api.

### Ce qui marche sur mobile

Tout ce qui est synchronisé via amn-api : Accueil, Équipe (chat + @/# mentions +
accusés de lecture), Tâches (Kanban, commentaires, repères, rapports), Clients,
Décisions, Notes d'équipe, Médias, Rapports, recherche Cmd/Ctrl+K.

### Ce qui est masqué / indisponible sur mobile (spécifique Electron)

Ces fonctions dépendent du processus Electron et sont soit masquées, soit
dégradées proprement :

- **Démarrer avec Windows** et **Ajmani (Ollama local)** — masqués dans
  Paramètres (`bridge().env.isElectron`).
- **Veille tech (RSS)** — nécessite le fetch cross-origin du processus principal ;
  le panneau affiche un état « desktop uniquement ».
- **Mises à jour auto (Squirrel)**, **notifications natives Windows**,
  **base SQLite locale** — sans objet sur le web (les notifications retombent sur
  les Web Notifications du navigateur quand c'est permis).
- **Notes personnelles** — restent en `localStorage`, donc propres à l'appareil
  (jamais synchronisées, comme sur desktop).

Le service worker (`public/sw.js`) met en cache la coquille de l'app pour un
lancement rapide ; il **n'intercepte jamais** le trafic amn-api (les données
restent toujours fraîches).

## Token web séparé (sécurité)

Le build web est un bundle JavaScript **public** : tout token qu'il contient est
lisible par quiconque a l'URL. Pour éviter d'y exposer le token opérateur du
desktop, amn-api accepte **deux** tokens :

| Token (env amn-api) | Utilisé par | Droits |
| --- | --- | --- |
| `OPERATOR_TOKEN` | AMN Desktop (Electron) | Accès complet, y compris l'enregistrement de sites / clés API tracker |
| `WEB_OPERATOR_TOKEN` | build web / PWA | Synchronise les collections (chat, tâches, clients, décisions, notes, médias, rapports, présence) **mais est refusé** sur l'admin des sites (`/v1/sites`) |

Les deux sont **rotables indépendamment** : si le token web fuite, on le change
sans toucher au desktop d'Aaron et Mohamed.

### Générer / configurer le token web

1. Générer une valeur aléatoire, p. ex. `openssl rand -hex 32`.
2. Côté **amn-api** (Render → service amn-api → *Environment*) : ajouter la
   variable `WEB_OPERATOR_TOKEN` avec cette valeur, puis laisser Render
   redéployer. (Ne pas toucher à `OPERATOR_TOKEN`.)
3. Côté **build web** : passer cette même valeur dans `VITE_AMN_API_WEB_TOKEN`
   (voir ci-dessous).

### Révoquer en urgence

Sur Render → amn-api → *Environment* : remplacer `WEB_OPERATOR_TOKEN` par une
nouvelle valeur (ou la supprimer pour couper tout accès web), enregistrer →
Render redéploie. L'ancien token est immédiatement refusé. Le desktop continue
de fonctionner. Rebuild + redéploie ensuite le web avec la nouvelle valeur.

> **Limite résiduelle assumée.** Un token dans un bundle client reste visible par
> nature : l'objectif ici est de **limiter les dégâts** d'une fuite (le token web
> ne peut pas créer de sites ni de clés API tracker, et se révoque seul), pas de
> rendre le token invisible — cela demanderait un vrai backend d'auth par
> utilisateur. Les vraies barrières restent : une URL non devinable, l'écran de
> connexion de l'app elle-même (compte Aaron/Mohamed), et le token révocable
> ci-dessus. **Ne mets PAS de protection au niveau de la plateforme d'hébergeur
> (mot de passe Vercel/Netlify)** — voir « Dépannage » plus bas, ça casse le
> rendu de la page.

## Construire le build web

Le build web a besoin, **au moment du build**, de l'URL amn-api et du **token
web** (préfixe `VITE_`, lus par le pont navigateur) :

```bash
export VITE_AMN_API_URL="https://amn-api.onrender.com"
export VITE_AMN_API_WEB_TOKEN="<la valeur de WEB_OPERATOR_TOKEN côté amn-api>"
npm run build:web
```

Le site statique est généré dans `dist/` (index.html + assets + manifest + icône
+ service worker).

> Ne mets **jamais** `VITE_AMN_API_OPERATOR_TOKEN` dans un build web public — il
> n'est qu'un repli de dev local. Pour le web, utilise `VITE_AMN_API_WEB_TOKEN`.

## Déployer (Vercel ou Netlify, gratuit)

Le routage est en `HashRouter` : aucun rewrite serveur n'est nécessaire.

**Vercel**
- Le dépôt contient un `vercel.json` (build command, output directory) — Vercel
  le lit automatiquement, rien à configurer manuellement pour ça.
- Variables d'environnement à ajouter dans le projet : `VITE_AMN_API_URL`,
  `VITE_AMN_API_WEB_TOKEN`.
- **Settings → Deployment Protection : laisser désactivé** (voir « Dépannage »
  ci-dessous — l'activer casse l'affichage de la page).

**Netlify**
- Build command : `npm run build:web`
- Publish directory : `dist`
- Mêmes variables d'environnement.

## Dépannage : page qui s'affiche en texte brut, sans style (ou blanche)

Ce bug a eu deux couches — la protection Vercel expliquait les erreurs de
console, mais pas la cause réelle du défaut d'affichage, qui persistait une
fois cette protection désactivée.

### Couche 1 (résolue) : protection de déploiement Vercel

Si **Settings → Deployment Protection** est activé, Vercel intercepte les
requêtes vers la page ET vers les sous-ressources (CSS, manifest, chunks JS)
avec une redirection vers son interstitiel d'authentification, sans en-tête
`Access-Control-Allow-Origin`. Les balises `<link rel="stylesheet"
crossorigin>` / `<script type="module" crossorigin>` que Vite génère
(comportement standard, non spécifique à ce projet) chargent en mode CORS, donc
le navigateur bloque la ressource redirigée — d'où des erreurs CORS en console
au tout premier chargement. **Correctif : laisser Deployment Protection sur
Disabled.** Les vraies barrières d'accès restent l'URL non devinable, l'écran
de connexion de l'app, et le token web révocable (documentés plus haut) —
inutile d'ajouter une couche Vercel qui bloque au passage les propres
ressources de la page.

### Couche 2 (root cause réelle, résolue) : bug du service worker

Une fois la protection désactivée, le symptôme a persisté (texte brut sans
style, console propre) puis évolué en **page complètement blanche** après
avoir vidé le cache et désinscrit le service worker. C'est la vraie cause,
**reproduite et prouvée** (pas une hypothèse) :

`public/sw.js` (v1) faisait, pour toute requête GET same-origin échouant au
niveau réseau :
```js
.catch(() => caches.match('./index.html'))
```
**sans distinguer une navigation de page d'une sous-ressource.** Un CSS ou un
JS dont le fetch réseau échoue (coupure transitoire, blocage CORS — exactement
ce que produisait la couche 1 ci-dessus) recevait donc, à la place, le contenu
HTML de `index.html` mis en cache — avec un statut `200`, sous l'URL du
fichier CSS/JS. Le navigateur refuse silencieusement d'appliquer du HTML comme
feuille de style (page non stylée, **aucune erreur console** — exactement le
symptôme observé) et refuse d'exécuter du HTML comme script de module (React
ne monte jamais → **page blanche** — le symptôme observé après avoir vidé le
cache, qui a fait retomber le problème sur la requête du script JS plutôt que
du CSS). **Un seul bug, deux symptômes différents selon quelle ressource
échouait au moment du test.**

Preuve (le fetch handler de `sw.js` a été exécuté directement, hors navigateur,
dans un mock minimal du contexte Service Worker, pour éliminer toute ambiguïté
réseau) :

| Scénario | `sw.js` v1 (avant) | `sw.js` v2 (après) |
| --- | --- | --- |
| Asset (CSS/JS), échec réseau | **résout avec le HTML mis en cache** (bug confirmé) | rejette pour de vrai (comportement correct) |
| Navigation de page, échec réseau | résout avec le HTML mis en cache (voulu, hors-ligne) | inchangé |

**Correctif appliqué** (`public/sw.js`, `CACHE` passé à `'amn-pwa-v2'` pour
purger les caches déjà corrompus chez les utilisateurs ayant l'ancien SW) :
seule une navigation de page (`request.mode === 'navigate'`) retombe sur le
HTML en cache ; l'échec d'une sous-ressource échoue pour de vrai, au lieu
d'être remplacé silencieusement par le mauvais contenu.

En complément, `ErrorBoundary` a été déplacé pour envelopper directement
`<App />` dans `src/renderer.tsx` (au lieu d'être imbriqué à l'intérieur du
rendu d'`App`) : un crash React futur affiche désormais un message d'erreur
lisible plutôt qu'une page blanche muette, ce qui facilitera un diagnostic
rapide si un problème similaire réapparaît.

**Vérification finale** : rendu confirmé visuellement (capture d'écran) via un
vrai Chromium headless chargeant le build `npm run build:web` corrigé, servi
par un serveur statique renvoyant de vraies erreurs 404 (pas de `npx serve`
« magique ») — écran de connexion entièrement stylé, zéro erreur console, zéro
requête échouée, 129 règles CSS appliquées.

**Non reproduit malgré plusieurs configurations testées** (aucune donnée
n'expliquant ce point précis n'a pu être obtenue sans accès à l'URL Vercel
réelle) : le chargement dans un contexte totalement neuf (sans aucun service
worker, comme en navigation privée) avec le vrai `VITE_AMN_API_URL` et un
token volontairement invalide — pour tester l'hypothèse d'un crash au boot lié
à l'appel amn-api — s'est chargé et affiché correctement à chaque tentative.
Si la page blanche revient après ce correctif, l'ErrorBoundary racine
affichera désormais un message exploitable au lieu d'un écran muet.

## Installer sur iPhone

1. Ouvrir l'URL de déploiement dans **Safari** (pas Chrome — l'ajout à l'écran
   d'accueil PWA n'est pris en charge que par Safari sur iOS).
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. L'icône AMN apparaît ; l'app se lance en plein écran (mode standalone), sans
   la barre d'adresse.
4. Se connecter avec le compte habituel (Aaron / Mohamed) — la synchro est
   immédiate avec le poste desktop.

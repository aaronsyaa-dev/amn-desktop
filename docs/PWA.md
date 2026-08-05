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
> utilisateur. Déploie tout de même derrière une URL non devinable et/ou une
> protection d'accès, et ne mets pas l'URL publiquement en avant.

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
- Build command : `npm run build:web`
- Output directory : `dist`
- Variables d'environnement : `VITE_AMN_API_URL`, `VITE_AMN_API_WEB_TOKEN`.

**Netlify**
- Build command : `npm run build:web`
- Publish directory : `dist`
- Mêmes variables d'environnement.

(Le dépôt ne contient volontairement pas de fichier de config d'hébergeur : à
créer côté plateforme, avec les variables ci-dessus.)

## Installer sur iPhone

1. Ouvrir l'URL de déploiement dans **Safari** (pas Chrome — l'ajout à l'écran
   d'accueil PWA n'est pris en charge que par Safari sur iOS).
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. L'icône AMN apparaît ; l'app se lance en plein écran (mode standalone), sans
   la barre d'adresse.
4. Se connecter avec le compte habituel (Aaron / Mohamed) — la synchro est
   immédiate avec le poste desktop.

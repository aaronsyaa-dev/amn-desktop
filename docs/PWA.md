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

## Construire le build web

Le build web a besoin, **au moment du build**, de l'URL et du token opérateur
amn-api (préfixe `VITE_`, lus par le pont navigateur) :

```bash
export VITE_AMN_API_URL="https://amn-api.onrender.com"
export VITE_AMN_API_OPERATOR_TOKEN="<le même token que OPERATOR_TOKEN côté amn-api>"
npm run build:web
```

Le site statique est généré dans `dist/` (index.html + assets + manifest + icône
+ service worker).

> ⚠️ **Sécurité — à lire avant de déployer.** Contrairement au build Electron, le
> token opérateur est inclus dans le bundle JavaScript **public** du site web :
> toute personne ayant l'URL peut le lire et écrire dans amn-api. Pour un outil
> privé à deux, c'est un compromis acceptable, mais :
> - déploie derrière une URL **non devinable** et/ou une protection d'accès
>   (mot de passe de déploiement Vercel/Netlify) ;
> - idéalement, prévois côté amn-api un **token distinct** pour le web (révocable
>   indépendamment) ou une restriction (IP / domaine `Origin`).
> Ne mets pas cette URL publiquement en avant.

## Déployer (Vercel ou Netlify, gratuit)

Le routage est en `HashRouter` : aucun rewrite serveur n'est nécessaire.

**Vercel**
- Build command : `npm run build:web`
- Output directory : `dist`
- Variables d'environnement : `VITE_AMN_API_URL`, `VITE_AMN_API_OPERATOR_TOKEN`.

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

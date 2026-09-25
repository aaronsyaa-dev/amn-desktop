# Visite guidée qui saute des étapes, et préparation TURN

Rapport du 25 septembre 2026, branche `claude/first-pr-github-setup-ltpqqo`.

Tout a été mesuré en bac à sable, sur les bundles web des deux éditions, avec l'API locale. Aucune donnée de production n'a été lue.

---

## 0. En bref

| | État |
|---|---|
| **Bug « pagination »** : c'était le compteur de la visite guidée (« Étape n sur N ») | **Cause trouvée, corrigée à la source, prouvée** : `check:visite` échoue avant correctif (7 défauts côté cliente, 11 côté interne) et passe après, sur les deux éditions |
| **TURN** | **Prêt côté client** : poser les trois variables suffit, aucun code à retoucher. Un défaut réel a été corrigé au passage : une URL mal écrite faisait planter l'appel. |
| Logique validée d'un chantier précédent (fusion de synchro) | **Non touchée** : `check:fusion-sync` et `check:sync` sont verts |

---

## 1. Le bug : la visite saute des étapes

### 1.1 Ce qui a été cherché, et écarté

La demande parlait d'abord de pagination. Avant votre précision, j'ai vérifié les vraies listes paginées du produit :
- « Afficher plus » par 200 lignes : Factures, Dépenses ;
- listes par curseur de 50 : parc des Organisations, file des incidents.

J'ai aussi fait parcourir par un navigateur les 117 écrans de l'édition cliente, trois fois chacun, en relevant tous les compteurs (« N pages », « X sur Y », « N restants ») à 150 ms, 600 ms, 2 s et 4 s : **aucun compteur instable**.

Vous avez ensuite précisé : c'est le compteur d'étapes de la visite guidée. La suite porte donc sur `src/guide/GuideOverlay.tsx`.

### 1.2 Vos deux pistes, mesurées

**Double déclenchement.** Un geste à la fois (clic sur « Suivant », →, Espace ou Entrée sur le bouton, clic à droite du voile) sur des écrans chargés, dans les deux éditions : **chaque geste avance d'une seule étape**. Le clic sur « Suivant » ne remonte pas jusqu'au voile, grâce à `stopPropagation` sur la carte. L'écouteur clavier est bien retiré à chaque changement. Cette piste n'est pas la cause, mais le correctif la ferme quand même (§1.4).

**Saut automatique.** C'est la cause. Mesure sur l'édition interne, visite générale, un clic toutes les 3 s :

```
1@-19   2@98   ∅@106   3@2626      ← aucun geste entre 98 et 3305
geste @3305 → 4@3351
```

Après un clic, le « 2 » s'affiche une image, s'efface, puis la visite passe **seule** à 3 au bout de 2,5 s. Le clic suivant mène à 4 : c'est le « de 2 à 4 ».

### 1.3 La cause exacte : trois défauts qui s'additionnent

1. **Un délai d'horloge aveugle.** Une cible absente était sautée après 2,5 s, que l'écran ait fini de charger ou non. La cible de « Votre Accueil » (`main h1`) n'existe pas tant que l'Accueil lit ses données : `SiGardeLue` rend un bloc `aria-busy` vide. Si la Garde répond en moins de 2,5 s, l'étape s'affiche ; sinon elle saute. **Le résultat dépend du temps de réponse du serveur**, d'où l'irrégularité.
2. **Des Accueils sans cible.** L'Accueil par défaut (`HomeScreen`, « On démarre, … ? ») n'a ni `h1` ni ancre : l'étape y était **toujours** sautée. Les 19 Accueils au choix n'ont qu'un `h1` invisible de 1 px (`sr-only`), qu'ils n'affichent qu'une fois leurs données lues. L'étape passait donc ou non selon l'Accueil choisi et le moment.
3. **Deux défauts d'affichage** qui rendaient le saut visible :
   - l'état « prêt » était un booléen, qui restait vrai pendant l'image suivant un changement d'étape. La carte montrait alors le **nouveau** numéro à l'**ancienne** place (le « 2 » entrevu) ;
   - le compteur numérotait tout le parcours, étapes sautées comprises : un saut se lisait « 1 → 3 ».

### 1.4 Le correctif, à la source

**`src/guide/GuideOverlay.tsx`**
- **Un geste = une étape.** Un geste reçu pendant que l'étape demandée se cherche encore est ignoré (verrou en `ref`, lu au moment du geste). Une touche maintenue (`e.repeat`) ne compte qu'une fois.
- **Attendre avant de sauter.** Une cible absente n'est sautée qu'aux deux conditions suivantes :
  - **au moins 1,5 s** d'attente ;
  - **un écran calme** : plus de `aria-busy`, plus de roue qui tourne, aucun changement du DOM depuis 600 ms.

  Plafond : 10 s, pour un écran qui s'animerait sans fin. Un écran qui charge est donc attendu, et seule une cible vraiment absente est sautée.
- **Plus de carte fantôme.** L'étape prête est un numéro (`pretPour === index`) et non plus un booléen : la carte ne paraît que pour sa propre étape.
- **Pas de trou dans le compte.** Une étape sautée parce que sa cible n'est pas sur cet écran sort du total : on lit « 2 sur 8 » au lieu de « 3 sur 9 ». Si on y revient et que la cible est là, elle y rentre.

**Les ancres**
- `data-guide="titre"` est posé sur l'en-tête de l'Accueil par défaut (`HomeScreen`) et sur les deux en-têtes partagés par les Accueils au choix (`EnTeteQG` pour l'interne, `EnTeteAccueil` pour la cliente).
- L'étape vise `main [data-guide="titre"], main h1`.
- Vérifié : les 20 Accueils exposent maintenant une cible.

Le composant est **partagé par les deux éditions** : un seul correctif les couvre toutes les deux.

### 1.5 La preuve

Nouveau garde-fou navigateur **`check:visite`** (`scripts/check-visite.mjs`, dans `package.json`). Il rejoue la visite générale et relève chaque carte affichée, horodatée.

| Scénario | Ce qui est exigé |
|---|---|
| A · un geste = une étape | Clic sur « Suivant », →, Entrée sur le bouton, clic à droite du voile, deux → dans la même image : le rang avance d'**exactement 1**, rien ne bouge ensuite, aucune carte entrevue puis effacée |
| B · cible en retard | L'écran se charge (`aria-busy`, DOM qui bouge) et la cible n'arrive qu'après **4 s**, plus que l'ancien délai : l'étape doit s'afficher |
| C · cible absente | L'étape est sautée **après** au moins 1,5 s, le compteur passe au rang suivant, le total perd une unité |
| D · interne, le cas réel | La Garde répond en **5 s** : « Votre Accueil » doit s'afficher |

**Résultats** (sorties complètes dans `docs/mesures/visite-2026-09-25/`) :

| Bundle | Avant correctif | Après correctif |
|---|---|---|
| Édition cliente | **échec**, 7 défauts. B : « 3 puis 4 », carte fantôme. C : total 8 → 8, carte changée 4 ms après le geste | **vert**, 7 gestes |
| Édition interne | **échec**, 11 défauts. **Les cinq gestes du scénario A mènent de 1 à « 2 puis 3 »** : c'est votre symptôme. « Votre Accueil » n'est jamais montrée | **vert**, 8 gestes, dont D |

**Contre-épreuve.** Ancien `GuideOverlay` avec les nouvelles ancres : le test échoue encore (7 défauts). Il vise donc bien la logique de la visite, pas seulement les ancres.

---

## 2. TURN : prêt, sans rien à retoucher côté client

### 2.1 Ce qui était déjà en place, et vérifié

- `src/lib/serveursIce.ts` est la **seule** source ICE. `CallContext` et `GuestCallScreen` appellent `serveursIce()`, et aucun des deux ne lit une variable `VITE_AMN_TURN_*` lui-même. C'est vérifié par `check:appels`, qui refuse aussi un troisième chemin d'appel non déclaré.
- Sans variables : STUN publics seuls, le comportement d'aujourd'hui.

### 2.2 Ce qui a été ajouté

- **Un défaut réel corrigé : une URL mal écrite faisait planter l'appel.** Mesuré dans Chromium : `new RTCPeerConnection` **lève une `SyntaxError`** sur `turn.exemple.net:3478` (sans schéma) ou `https://turn.exemple.net`. Une faute de frappe dans la variable aurait donc cassé **tous** les appels. Désormais, une URL qui n'est ni `turn:` ni `turns:` est écartée, et l'on retombe sur STUN seul.
- **Plusieurs URL** acceptées, séparées par des virgules (usage courant : UDP et TLS).
- **La décision est une fonction pure** (`etatTurn`, `serveursIcePour`), sans `import.meta`, pour que `check:appels` puisse l'**exécuter**.
- **Journal de développement**, une ligne par session, au premier appel, jamais en production (vérifié : absent du bundle de production). Il n'affiche jamais l'identifiant ni le mot de passe.
  - actif : `[appels] relais TURN actif : turns:… (identifiants posés). Les STUN publics restent essayés d'abord.`
  - inactif : `[appels] relais TURN inactif : <raison>. STUN publics seuls.` La raison dit laquelle des trois variables manque, ou quelle URL a été écartée.
- **`release.yml`** transmet maintenant les trois variables au build du **poste installé**. Avant, même avec un serveur prêt, l'application Windows serait restée sans relais : seul le web aurait eu TURN. Tant que les secrets n'existent pas, elles arrivent vides et on reste sur STUN seul.

### 2.3 `check:appels` couvre-t-il le cas ? Oui, désormais

Avant, il ne faisait que **lire** les sources : il ne vérifiait pas le repli. Il exécute maintenant la décision sur 9 configurations :

| Configuration | Attendu |
|---|---|
| rien de posé ; URL vide (espaces) ; URL seule ; URL et identifiant sans mot de passe ; URL sans schéma ; URL en `https://` | STUN seul, sans exception, et `relaisDisponible()` à faux |
| les trois posées (`turns:`) ; deux URL ; une valable et une mal écrite | STUN d'abord, puis le TURN avec ses seules URL valables et ses identifiants |

Contre-épreuves :
- retirer la validation de l'URL fait échouer le contrôle (4 fautes) ;
- ignorer l'absence d'identifiants aussi ;
- une fois le code restauré, tout redevient vert.

Un build fait avec les trois variables les contient bien. Un build fait sans elles ne contient aucun TURN.

### 2.4 Les trois variables à poser quand le serveur coturn sera prêt

| Variable | Valeur | Exemple |
|---|---|---|
| `VITE_AMN_TURN_URL` | URL(s) du relais, `turn:` ou `turns:`, séparées par des virgules | `turns:turn.amn-devsec.com:5349,turn:turn.amn-devsec.com:3478?transport=udp` |
| `VITE_AMN_TURN_USER` | identifiant du relais | (celui de coturn) |
| `VITE_AMN_TURN_PASS` | mot de passe du relais | (celui de coturn) |

**Où les poser :**
1. **Vercel**, dans chaque projet qui construit une édition web (*Settings → Environment Variables*, environnement *Production*), puis redéployer. `vercel.json` lance `npm run build:web`, qui lit ces variables.
2. **GitHub**, en *secrets* du dépôt, sous les **mêmes noms**, pour le poste installé (`release.yml`, étape « Build »). Puis publier une version.

**Pour vérifier :**
- en développement, le journal `[appels] relais TURN actif` ;
- en production, `chrome://webrtc-internals` pendant un appel : un candidat de type `relay` doit apparaître ;
- dans l'application, la phrase d'échec d'un appel change (`phraseEchecConnexion`) : elle n'accuse plus « un relais qui manque côté AMN ».

**Une réserve à connaître.** Des identifiants posés à la construction sont **lisibles** dans le bundle, par quiconque ouvre l'application. C'est l'usage courant, mais il vaut mieux donner à coturn un compte dédié avec un quota. Le mieux, plus tard : des identifiants éphémères délivrés par amn-api (RFC 7635, `use-auth-secret` côté coturn). `serveursIce()` deviendrait alors asynchrone, au même endroit, et c'est un chantier serveur.

---

## 3. Garde-fous

| | Cliente | Interne |
|---|---|---|
| **check:visite** (nouveau) | vert | vert |
| check:appels (9 cas TURN exécutés) | vert | |
| 40 contrôles statiques (langue, encres, naming, roles, supervision, persistence, sync, fusion-sync…) | vert | |
| tsc, lint | 0 erreur (85 avertissements, déjà là) | |
| check:coquille, check:signal, check:mobile, check:xss | vert | vert |
| check:contraste | vert (118 écrans, 25 224 textes) | vert (162 écrans, 44 188 textes) |
| check:support | — | vert |
| check:veille-cliente | vert | — |
| check:business (aucune trace interne dans le bundle cliente) | vert | — |

`check:package` n'a pas tourné : il exige une application Electron empaquetée, qu'on ne peut pas construire ici.

---

## 4. Vu en passant, non corrigé (hors du périmètre)

Deux courses réelles dans les listes par curseur de l'édition interne, relevées pendant la recherche de la « pagination » :
- `useParcPage` : « Charger plus » cliqué pendant qu'une nouvelle recherche se charge demande la suite avec le curseur de l'**ancienne** requête. Il annule aussi la réponse de la nouvelle.
- `ParcSocPanel` : changer le filtre de gravité pendant un chargement laisse une réponse périmée écraser la nouvelle, car il n'y a pas de garde de génération.

Elles ne causent pas le symptôme signalé. Elles sont proposées en tâche séparée.

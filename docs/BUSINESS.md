# AMN Business — l'édition livrée aux organisations clientes

Ce document explique comment l'édition Business est construite, pourquoi elle
l'est de cette façon, et ce qu'il faut faire pour livrer une nouvelle cliente.
Il ne répète pas les messages de commit : on n'y trouve que les arbitrages et
la marche à suivre.

## La décision : cible de build, pas drapeau runtime

Le cahier des charges disait « aucun code, aucune route, aucune donnée liée aux
outils exclusifs n'est accessible ni présente ». Ces deux mots — *accessible*
et *présente* — ne demandent pas la même chose, et c'est ce qui a tranché.

Un drapeau runtime (`org.plan !== 'internal'` → on masque) rend les modules
**inaccessibles**. Il ne les rend pas **absents** : le catalogue Tracker, les
libellés de Comply, le journal des versions listant tous nos produits, les
adresses `@amn-devsec.com`, l'empreinte bcrypt du mot de passe de départ —
tout cela reste en clair dans l'`app.asar` de la cliente, à une recherche de
texte de distance. Vérifié, pas supposé : c'est ce qu'on trouvait dans le
premier build.

D'où **une cible de build, dans un seul dépôt**. `AMN_EDITION=business`
réécrit les points d'entrée `@edition/*` vers leurs variantes Business, dans
les trois bundles (renderer, process main, preload). Rollup part d'une autre
racine de routes et ne trouve aucun chemin vers les écrans exclusifs.

Ce n'est **pas** un fork : un seul dépôt, une seule table de routes par
édition, et les écrans partagés (Clients, Tâches, Notes, Rapports, Paramètres,
Coffre-fort) sont littéralement les mêmes fichiers. Ce qui diffère passe par
une couture explicite.

Le drapeau runtime existe quand même, en second rempart : dans un build
**interne**, un compte d'organisation cliente est refusé à la connexion avec un
message clair. L'inverse est permis — Aaron peut ouvrir AMN Business avec son
propre compte pour voir exactement ce que voit sa cliente.

## Les coutures

Un écran partagé n'importe **jamais** directement `RemoteSitesContext`,
`trackerCatalog`, `scanner/*` ou `comply/*`. S'il en a besoin, ça passe par un
alias `@edition/*`, résolu à la compilation :

| Alias | Ce qu'il porte |
| --- | --- |
| `@edition/appRoot` | La table de routes de l'édition. C'est la garantie centrale. |
| `@edition/modules` | Les modules du lanceur et de la barre latérale, les onglets suivis, les animations par route. |
| `@edition/exclusive` | Les morceaux d'écrans partagés qui touchent aux produits (sites liés, offres de devis, détails de scan, section Ollama, rubriques du coffre-fort). |
| `@edition/mainExclusive` | Les appels amn-api et les canaux IPC des produits, côté process main. |
| `@edition/preloadExclusive` | Les entrées correspondantes du pont `window.amn`. |
| `@edition/browserExclusive` | Idem pour le repli navigateur (build web / vérification headless). |
| `@edition/seeds` | Comptes locaux et jeu de démonstration du pont navigateur. |
| `@edition/dbSeed` | Comptes et jeu de démonstration de la base SQLite locale. |
| `@edition/changelog` | Le journal des versions — le fichier le plus bavard de tout le bundle. |

`npm run typecheck:business` rejoue la vérification de types contre l'autre
face de chaque couture. Un écran partagé qui réimporterait `RemoteSitesContext`
compile toujours en interne — et casse là. C'est le garde-fou contre la dérive
silencieuse.

## Ce que contient l'édition Business

**Modules** : Accueil (vue du jour), Agenda, Clients, Tâches, Notes, Médias,
Rapports, Paramètres, Coffre-fort.

**Retirés, et pas seulement masqués** : Sites, Trackers, Scanner, Comply,
SSL Monitor, Équipe, Décisions, Connaissances, appels audio, partage d'écran,
contrôle à distance, assistant Ajmani et veille RSS.

**Adaptations solo** : pas de champ « Assigné à » sur les tâches, pas de portée
« perso / équipe » sur les notes, pas de section « sites liés » sur une fiche
client, pas de fil « activité de l'équipe » sur l'accueil. Les devis proposent
un intitulé de prestation libre au lieu du catalogue Tracker, et portent le nom
de l'organisation connectée en émetteur.

**Différences d'exploitation** :

- l'auto-mise à jour est **coupée**. Le service de mise à jour lit les Releases
  de `aaronsyaa-dev/amn-desktop`, qui portent les artefacts de l'édition
  interne : la brancher installerait notre application chez la cliente ;
- le nom de l'application diffère (`AMN Business`), donc le dossier `userData`
  aussi. Les deux éditions cohabitent sur une même machine sans partager base
  locale, session ni préférences ;
- le build **n'embarque aucun jeton**. Seule `AMN_API_URL` est inlinée ; le
  justificatif est la session de la cliente, obtenue à la connexion. Un poste
  qui n'est connecté à aucun compte ne peut atteindre aucune donnée.

## Livrer une nouvelle cliente

### 1. Créer l'organisation et son compte propriétaire

**Depuis AMN Desktop** : le « + » en bas du rail, ou le bouton « Nouvelle
organisation » de la Tour de contrôle → Organisations. Le formulaire demande la
raison sociale, l'adresse du compte propriétaire, un logo optionnel et
l'édition, puis affiche l'accès à remettre — mot de passe temporaire (se dicte
au téléphone, ne périme pas) ou lien d'activation (elle choisit son mot de
passe, 7 jours, usage unique), avec un bouton pour le copier.

Le nom saisi est celui qui apparaît **dans son app et en émetteur sur ses devis
imprimés**. Le formulaire le dit sous le champ : mettez sa vraie raison sociale,
pas un surnom.

Le script terminal reste disponible pour un usage sans interface (poste sans
l'app installée, script de reprise) :

```sh
AMN_API_URL=https://amn-api.onrender.com \
AMN_API_OPERATOR_TOKEN=<jeton opérateur> \
node scripts/create-business-org.mjs --name "Sa raison sociale" --email elle@exemple.fr
```

### 2. Lui donner l'application

Deux formes, même code, même compte. Aucun `AMN_API_OPERATOR_TOKEN` dans l'une
ni dans l'autre : le mettre reviendrait à donner à la cliente une clé qui ouvre
AMN DevSec.

**Accès web (le plus rapide, et celui qui a débloqué la première cliente)** —
la même coquille React que l'Electron, servie en HTTPS statique, installable
depuis le navigateur (« Ajouter à l'écran d'accueil », voir `docs/PWA.md`).
Rien à installer, rien à signer, disponible tout de suite sur n'importe quelle
machine :

```sh
AMN_API_URL=https://amn-api.onrender.com  # côté Vercel : variable de projet
npm run build:web:business
npm run check:business -- --dir dist       # contrôle d'hygiène, voir ci-dessous
```

Sur Vercel, **un projet distinct** du web AMN DevSec, sur le même dépôt.

L'édition ne se choisit PAS par la commande de build : `vercel.json` est lu par
les deux projets et sa `buildCommand` écrase toujours celle du tableau de bord.
C'est une variable d'environnement **de projet** qui décide, parce qu'elle est
le seul réglage que Vercel ne partage pas entre deux projets du même dépôt.

| Réglage du projet Business | Valeur |
| --- | --- |
| Environment Variables | `AMN_EDITION` = `business` (Production **et** Preview) |
| Environment Variables | `VITE_AMN_API_URL` = URL d'amn-api |
| Build Command | laissé au fichier `vercel.json` (override désactivé) |
| Output Directory | laissé au fichier `vercel.json` (override désactivé) |

Le projet interne ne définit **rien** : sans `AMN_EDITION`, `resolveEdition()`
construit l'édition interne (voir `vite.edition.ts`).

Un déploiement Business est relu automatiquement : `scripts/build-web.mjs`
lance `check:business` sur la sortie dès que l'édition construite est Business,
et fait échouer le build — chez Vercel comme en local. Après mise en ligne,
`npm run check:deployed -- --url https://…` relit ce qui est RÉELLEMENT servi.

Ce qui a précédé, et pourquoi c'est écrit ainsi : un `vercel.business.json`
existait, censé configurer ce projet. Vercel ne lit que `vercel.json` à la
racine pour un déploiement Git — ce fichier n'a donc jamais servi à rien, et le
projet Business a construit l'édition INTERNE, livrée telle quelle à une
cliente. Le fichier a été supprimé plutôt que corrigé : une configuration que
personne ne lit est pire que pas de configuration du tout.

`VITE_AMN_API_WEB_TOKEN` n'a aucun effet sur ce build et **ne doit pas y être** :
`createBrowserRemote` ignore les jetons partagés quand `IS_BUSINESS`, et comme
c'est une constante remplacée à la compilation, les deux `import.meta.env` sont
supprimés par Rollup. Le jeton ne peut donc pas être inliné dans un bundle
public, même par erreur d'environnement.

**Application Windows** :

```sh
AMN_API_URL=https://amn-api.onrender.com npm run make:business
```

### 2 bis. Vérifier que le build ne contient rien de nous

Trois filets, du plus automatique au plus manuel — le premier suffit dans le
cas normal, les deux autres existent parce que le premier a déjà été contourné
par une configuration de déploiement.

```sh
# 1. Automatique : tout build Business relit sa propre sortie et échoue si elle
#    est sale. Rien à lancer, c'est déjà dans `npm run build:web:business`.

# 2. À la main, sur un dossier déjà construit :
npm run check:business -- --dir dist

# 3. Sur ce qu'une URL SERT vraiment — le seul contrôle qui voit ce que la
#    cliente reçoit, y compris quand le build s'est fait ailleurs :
npm run check:deployed -- --url https://mon-projet.vercel.app
```

Le troisième est celui qui manquait. La fuite livrée à Syraagensy venait d'une
configuration Vercel, pas du code : aucun contrôle tournant sur nos machines
n'aurait pu la voir, parce que le mauvais bundle n'y a jamais existé. À lancer
après chaque déploiement Business, avant de donner l'adresse à qui que ce soit.

Le script relit la sortie en texte brut et échoue sur la moindre trace : nos
adresses, notre raison sociale, les empreintes bcrypt des comptes de départ, les
noms de produits (Sentinel, Scanner, Comply, SSL Monitor, Ajmani), les routes
`/v1/admin/*`, nos clients de démonstration, les noms de variables de jeton. Il
échoue aussi si les marqueurs attendus (`AMN Business`, `Agenda`, `Coffre-fort`)
manquent — sinon un dossier vide passerait au vert.

Le web est le plus exposé des deux : un bundle servi en HTTPS se lit avec le
clic droit du navigateur, là où il faut au moins ouvrir un `asar` côté Electron.
Le contrôle a d'ailleurs trouvé une fuite que la relecture manuelle du build
Electron avait laissée passer — l'écran Rapports, partagé, gardait les chaînes
`"comply"`, `"scanner"`, `"rgpd"` et les appels `listScans()` /
`listComplyChecks()` dans le bundle de la cliente. Ils étaient sautés à
l'exécution par `PRODUCTS_ENABLED`, mais Rollup ne peut pas supprimer une
branche dont la condition n'est connue qu'au runtime. Le morceau est passé
derrière `@edition/exclusive` (`useProductReports`) : l'écran partagé ne
manipule plus que des entrées opaques, et la face Business n'importe rien.

### 3. Vérifier la synchronisation avant de remettre l'accès

```sh
AMN_API_URL=https://amn-api.onrender.com \
AMN_API_EMAIL=elle@exemple.fr AMN_API_PASSWORD=<le mot de passe> \
npm run check:sync
```

La sonde exerce chaque collection **pour son organisation à elle**, pas
seulement pour AMN DevSec : une collection peut très bien passer d'un côté et
échouer de l'autre.

### 4. Remettre les identifiants

De vive voix, pas par email. Faites-lui changer le mot de passe dès la première
connexion (Paramètres → mot de passe) : le changement passe par amn-api et
prend effet immédiatement.

## Le contexte client — voir ce que voit la cliente

Cliquer sur son icône dans le rail ouvre son espace de travail : ses écrans, ses
données, sa navigation. C'est ce qui permet de la dépanner en conditions
réelles, au lieu de lui demander de décrire ce qu'elle voit.

**Comment ça marche, en une phrase** : AMN Desktop demande à amn-api une
*session de support* — un jeton d'une heure, limité à cette organisation,
réservé aux membres d'AMN DevSec et journalisé côté serveur — puis bascule
dessus le justificatif de TOUTES ses requêtes et de sa WebSocket. Le détail des
garde-fous est dans `amn-api/README.md` ; ce qu'il faut retenir ici :

- **Un bandeau permanent** occupe le haut de l'écran : « Vous consultez X en
  tant qu'administrateur AMN DevSec ». Il n'a pas de bouton de fermeture — son
  seul bouton met fin au contexte. Il survit à un redémarrage de l'app : le
  jeton est conservé et revalidé au lancement, et s'il a expiré l'app revient
  franchement à AMN DevSec plutôt que d'afficher ses écrans sans explication.
- **Le miroir local est indexé par contexte** (`amn.sync.ctx-<org>.*`) et effacé
  en sortant. Les données d'une cliente ne restent pas sur le poste.
- **Aucune de nos données n'entre chez elle** : les écrans partagés basculent
  sur leur face Business (pas de sites liés, pas d'assignation à
  `@amn-devsec.com`, pas de catalogue Tracker dans ses devis, pas d'import du
  magasin hérité de notre poste).
- **Tout accès laisse une trace** : Tour de contrôle → Journal d'accès (qui,
  quelle organisation, quand), lisible aussi depuis le panneau Administration
  de l'organisation concernée.

### « Connectez-vous avec votre compte AMN DevSec » alors qu'on l'est déjà

Le refus vient d'amn-api, et il est juste de son point de vue : il n'ouvre un
contexte client qu'à un **compte nominatif**, parce qu'un jeton partagé
(`OPERATOR_TOKEN`) n'appartient à personne et ne donne aucun nom à inscrire au
journal d'accès. Le message dit donc exactement ce que le serveur voit.

Ce que le serveur ne pouvait pas savoir, c'est *pourquoi* le poste lui envoyait
le jeton partagé alors que l'opérateur venait de se connecter : l'écran de
connexion **retombait silencieusement sur le compte local du poste** dès
qu'amn-api refusait. Or les deux comptes portent la même adresse
(`aaron@amn-devsec.com`) et n'ont pas le même mot de passe. Taper celui du poste
ouvrait une session d'apparence parfaitement normale — accueil, rail rempli
(la liste des organisations part avec le jeton partagé, qui a le droit de la
lire), création d'organisation possible — mais sans aucun jeton nominatif
derrière. Le seul geste qui en exige un, ouvrir un contexte client, échouait
alors sur cette phrase incompréhensible. C'est ce qui est arrivé à Syraagensy :
l'organisation a été créée, son entrée au journal porte « jeton partagé », et
son contexte refusait de s'ouvrir.

Trois changements, tous dans le desktop :

1. **Le repli local ne rattrape plus un refus.** Il ne sert plus qu'à ce pour
   quoi il existe : travailler quand amn-api est *injoignable*. Un refus
   d'amn-api est une réponse, et c'est sa phrase qui s'affiche
   (« Email ou mot de passe incorrect. »). Les deux cas se distinguent par un
   marqueur porté dans le message — seul ce qui survit au passage IPC
   (`API_UNREACHABLE_PREFIX`, `isApiUnreachable`).
2. **L'état a un nom** : `sessionKind` vaut `'api'` ou `'local'`. Une session
   locale allume une pastille permanente au bas du rail, qui explique le geste
   qui répare.
3. **Le refus arrive avant le réseau.** Ouvrir un contexte client ou créer une
   organisation depuis une session locale est refusé sur place, avec la vraie
   raison, plutôt qu'après un aller-retour dont le message serait à contresens.

Si le message revient malgré une session amn-api valide, c'est alors vraiment
côté serveur : vérifier que le compte existe bien dans AMN DevSec
(`POST /v1/admin/bootstrap-owner` pour le tout premier, ou une invitation
ensuite), qu'il est `active` et que son organisation est `internal`.

## Le coffre-fort : « Organisations clientes » et le transfert générique

Le mot de passe temporaire d'une organisation et son jeton d'activation ne
s'affichent **qu'une fois** — amn-api n'en garde que l'empreinte. L'écran qui
les montre est donc la seule occasion de les conserver, et jusqu'ici la seule
issue était de copier, ouvrir le Coffre-fort, créer une entrée, choisir une
rubrique, coller, nommer. Six gestes pendant qu'on a une cliente au téléphone :
en pratique, le secret finissait dans un presse-papiers, donc nulle part, et il
fallait en réémettre un — ce qui invalide celui déjà remis.

Un bouton **« Transférer dans le coffre-fort »** est posé partout où un secret
s'affiche ponctuellement (remise d'accès à la création d'une organisation,
réémission et mot de passe temporaire depuis le panneau Administration). Un clic
range l'information, étiquetée, dans la bonne rubrique — le retour du bouton
nomme la rubrique d'arrivée, sinon on ne saurait pas où chercher.

La rubrique **« Organisations clientes »** regroupe ces accès : raison sociale,
adresse du compte propriétaire, et le secret au moment de sa génération, avec sa
nature (mot de passe temporaire / jeton d'activation) et sa date d'expiration
s'il en a une. La clé est l'adresse du compte propriétaire : réémettre un accès
met l'entrée à jour au lieu d'empiler des quasi-doublons.

Comme « Trackers installés » — où la clé d'API d'un tracker est écrite
automatiquement au moment de l'enregistrement du site —, cette rubrique vient de
`@edition/exclusive` : elle n'existe pas dans le coffre-fort d'une cliente, qui
n'a pas d'organisations clientes à elle.

## Suspendre ou réactiver une cliente

Depuis l'app : Tour de contrôle → Organisations (bouton « Suspendre »), ou le
panneau Administration à l'intérieur de son contexte. En ligne de commande :

```sh
curl -X PUT "$AMN_API_URL/v1/admin/organizations/<id>/status" \
  -H "Authorization: Bearer $AMN_API_OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"suspended"}'
```

La suspension mord à la requête suivante et coupe aussi la WebSocket. L'app
affiche le message d'amn-api tel quel plutôt qu'une erreur opaque. Elle coupe
aussi les sessions de support en cours : « suspendre une cliente » n'a pas
d'exception silencieuse pour nous.

## Mot de passe perdu chez une cliente

Panneau Administration de son contexte → « Mot de passe temporaire » (le compte
est activé au passage et ses sessions en cours sont révoquées) ou « Réémettre
l'invitation » (elle choisit son mot de passe, 7 jours, usage unique). Les deux
n'affichent leur secret **qu'une fois** : amn-api n'en garde que l'empreinte.

C'était le point noir de la livraison précédente — l'invitation d'origine étant
à usage unique et expirant en 7 jours, un mot de passe perdu n'avait aucune
issue.

## Envoyer l'installeur : ce qui existe, ce qui manque, et ce qu'il faut fournir

Audit fait le 14 août 2026, pas une conception en l'air : voici l'état réel de
la chaîne « nouvelle cliente acceptée → lien d'installation entre ses mains ».

### La bonne nouvelle : il n'y a PAS d'exécutable par cliente

L'idée d'un `.exe` généré à la création de chaque organisation part d'une
supposition fausse. L'application Business est **exactement la même pour
toutes** : elle apprend son organisation à la connexion, par la session
qu'amn-api lui rend. Rien de la cliente n'est compilé dedans — ni son nom, ni
son identifiant, ni ses modules.

Il y a donc **un installeur par version**, pas un par cliente. Ce qui change
d'une cliente à l'autre, c'est son compte, et il est déjà créé par le
formulaire de l'écran Organisations.

C'est une simplification majeure : pas de file de compilation à faire tourner,
rien à déclencher à la création d'une organisation.

### Ce qui existe aujourd'hui

| Étape | État |
| --- | --- |
| Créer l'organisation + le compte propriétaire | **Fait**, un formulaire (écran Organisations) |
| Lien d'activation à durée limitée (7 jours, usage unique) | **Fait**, rendu par la création |
| Construire l'installeur Business | `npm run make:business` — **manuel**, sur une machine Windows |
| Enregistrer la version publiée | **Fait**, `npm run publish:release` (relit l'artefact avant d'enregistrer) |
| Lien de téléchargement à durée limitée (30 jours) | **Fait**, rendu par l'Atelier en même temps que l'accès |
| Mise à jour automatique des installations en place | **Fait** (BLOC O) — canal distinct servi par amn-api |

Le web/PWA reste le chemin de livraison le plus simple : une URL, rien à
installer, rien à signer. L'installeur Windows est le chemin de celles qui
veulent une vraie application sur leur poste — et depuis le BLOC O, il ne les
condamne plus à rester sur la version du jour de leur installation.

### Publier un correctif Business — la procédure, dans l'ordre

C'est le seul geste manuel de la chaîne, et il le reste **exprès** : c'est
Aaron qui décide quand un correctif part chez ses clientes, version par version.
La CI, elle, ne publie que l'édition interne (`.github/workflows/release.yml`,
sur un tag `v*`) et n'a aucun moyen d'atteindre le canal Business.

Sur une machine **Windows**, à la racine du dépôt :

```sh
# 1. Le correctif est sur main, et la version a été incrémentée dans package.json.
git pull

# 2. Construire l'édition Business — et SEULEMENT elle.
#    `npm run make` (sans le suffixe) construit l'édition interne : le
#    publisher ci-dessous refusera l'artefact, mais autant ne pas se tromper.
npm run make:business

# 3. Enregistrer la version sur le canal des clientes.
#    Le script relit l'application empaquetée AVANT d'enregistrer quoi que ce
#    soit : produits internes, jeton opérateur figé, marqueurs Business
#    manquants — au moindre problème il refuse et rien n'est publié.
AMN_API_URL=https://amn-api.onrender.com OPERATOR_TOKEN=<le jeton opérateur> \
  npm run publish:release -- --notes "Ce que ce correctif change, en une phrase."
```

Et c'est tout. Les installations déjà en place voient la version à leur
prochaine ronde — au plus tard six heures — ou tout de suite si la cliente
clique « Vérifier les mises à jour maintenant » dans ses Paramètres.

Trois précisions qui évitent trois surprises :

- **`--notes` est lu par la cliente**, mot pour mot, dans le bandeau
  « Mise à jour prête ». Une phrase en français, pas un numéro de ticket.
- **Sans `--location`, l'emplacement enregistré est le chemin du fichier sur
  la machine de build.** amn-api ne pourra le servir que si elle tourne sur
  cette machine — ce qui n'est pas le cas en production. Téléversez le `.exe`
  sur un stockage objet et passez son URL : `--location https://…`.
- **Rien n'oblige à publier.** Un correctif interne qui ne concerne pas les
  clientes se merge et se tague comme d'habitude ; tant que `publish:release`
  n'a pas tourné, leur canal ne bouge pas.

### Comment une installation se met à jour, exactement

```
   l'app (toutes les 6 h, et sur demande)
     └─ GET  /v1/updates/business?platform=win32&version=1.2.31
          ├─ « none »      rien n'est publié → l'app le dit, elle ne dit pas « à jour »
          ├─ « uptodate »  rien de plus récent
          └─ « available » version, notes, poids, EMPREINTE, adresse
               └─ téléchargement en fond dans %APPDATA%/AMN Business/mises-a-jour
                    └─ SHA-256 comparé à celui annoncé
                         ├─ différent → fichier jeté, rien n'est proposé
                         └─ identique → bandeau « Mise à jour prête »
                              └─ un clic : l'installeur est lancé, l'app se ferme
```

Ce que ce mécanisme **ne fait pas**, et qu'il ne faut pas promettre :

- **Il ne s'installe pas tout seul.** Une version se télécharge et se vérifie
  sans rien demander, mais l'installation exige un clic et un redémarrage de
  l'application. Ce n'est pas un choix de confort : sous Windows, un
  exécutable en cours d'exécution ne peut pas se remplacer lui-même.
- **Il ne fait jamais reculer.** Une version antérieure réenregistrée par
  erreur n'est pas proposée : la comparaison est numérique et stricte, des deux
  côtés (serveur et poste).
- **Il ne remplace pas la signature du binaire.** Sans certificat, SmartScreen
  avertit à l'installation — voir plus bas.

### L'infrastructure qu'Aaron doit fournir lui-même
### L'infrastructure qu'Aaron doit fournir lui-même

Le jeton et l'expiration sont du code. **Les octets du `.exe` doivent vivre
quelque part**, et c'est un choix d'hébergement, pas de programmation. Trois
options, avec leur vrai coût :

| Option | Ce que ça donne | Ce que ça coûte |
| --- | --- | --- |
| **Disque persistant Render** | Le plus simple : amn-api sert le fichier elle-même, le lien est déjà à durée limitée | Un disque Render est **payant** (le plan gratuit n'en a pas) ; ~100 Mo suffisent |
| **Stockage objet** (Cloudflare R2, Backblaze B2, S3) | Le plus propre : amn-api ne sert que des redirections signées, la bande passante ne passe pas par elle | Un compte à ouvrir, des clés à ranger dans le coffre-fort ; R2 : gratuit jusqu'à 10 Go |
| **Release GitHub sur un dépôt privé** | Zéro nouvelle infrastructure | Le lien est celui de GitHub : **on ne maîtrise ni sa durée ni sa révocation**, ce qui contredit le principe du lien à durée limitée |

Recommandation : **Cloudflare R2**. Gratuit à cette échelle, l'URL signée porte
nativement l'expiration, et la bande passante de téléchargement ne passe pas par
amn-api — qui tourne sur un plan où elle compte.

Tant que ce choix n'est pas fait, écrire les tables et la route reviendrait à
livrer une plomberie qui ne mène nulle part.

### À faire aussi, le jour où l'installeur devient la voie principale

- **Signer le binaire.** Sans signature, SmartScreen affiche un avertissement
  rouge à l'installation. Sur le poste d'une cliente, c'est ce qui décide si
  elle installe ou si elle appelle. Un certificat de signature de code coûte
  quelques centaines d'euros par an — c'est une dépense, pas une ligne de code.
- ~~Un canal de mise à jour distinct~~ — **fait** (BLOC O). Il n'est pas passé
  par un dépôt de Releases séparé mais par amn-api, qui tenait déjà le registre
  des versions : un dépôt de plus aurait été une chose de plus à tenir, et le
  service de mise à jour d'Electron ne sait pas filtrer les Releases d'un dépôt
  par édition. `npm run check:updates` vérifie en six règles que les deux
  chaînes ne peuvent pas se toucher.


## Ce qui reste à faire

- **Réinitialisation de mot de passe en autonomie.** Un mot de passe oublié
  demande toujours une remise par AMN DevSec. amn-api n'a pas de transport mail ;
  en inventer un est un chantier à part. C'est aussi la seule capacité qui reste
  à AMN DevSec sur le compte d'une cliente (voir `amn-api/README.md`, « Aucune
  propriété durable chez une cliente ») — bruyante, tracée, et sans identité
  durable chez elle, mais réelle.
- ~~Canal de mise à jour propre à l'édition Business~~ — **fait** (BLOC O).
  Voir « Publier un correctif Business » plus haut. Reste ouvert dans ce
  domaine : la **signature du binaire**, qui est une dépense et non une ligne
  de code, et le **choix d'hébergement des octets** (`--location`), sans lequel
  le canal ne sert que depuis la machine de build.
- **Signature du binaire Windows.** Sans elle, SmartScreen avertit à
  l'installation — sur un poste qui n'est pas le nôtre, c'est un vrai frein.
- **Moteur de configuration dynamique** (choix des modules depuis un site) —
  explicitement hors périmètre de cette livraison.

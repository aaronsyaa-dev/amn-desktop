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

### 2. Construire l'application

```sh
AMN_API_URL=https://amn-api.onrender.com npm run make:business
```

Aucun `AMN_API_OPERATOR_TOKEN` ici : le mettre reviendrait à donner à la
cliente une clé qui ouvre AMN DevSec.

### 3. Vérifier avant de remettre l'accès

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

## Ce qui reste à faire

- **Canal de mise à jour propre à l'édition Business.** Aujourd'hui les mises à
  jour sont remises à la main. Un dépôt de Releases distinct (ou un préfixe de
  tag) permettrait de rétablir l'auto-mise à jour sans risque de croisement.
- **Signature du binaire Windows.** Sans elle, SmartScreen avertit à
  l'installation — sur un poste qui n'est pas le nôtre, c'est un vrai frein.
- **Réinitialisation de mot de passe en autonomie.** Un mot de passe oublié
  demande aujourd'hui une nouvelle invitation émise par AMN DevSec. amn-api n'a
  pas de transport mail ; en inventer un est un chantier à part.
- **Moteur de configuration dynamique** (choix des modules depuis un site) —
  explicitement hors périmètre de cette livraison.

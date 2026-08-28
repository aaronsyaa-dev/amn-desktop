# Bloc 0 — Audit global, avant tout code

*Établi en lisant le code de `main` et en exerçant les applications réellement
construites, pas en relisant des notes. Chaque constat dit sur quoi il repose.*

Ce document est le point de départ du Chantier A : il dit ce qui existe déjà,
ce qui n'existe pas, et — pour trois points — corrige une hypothèse que le
backlog tenait pour acquise.

---

## 0.1 — Les noms, et où ils vivent vraiment

Le décompte brut est trompeur (41 occurrences de « AMN Desktop », 30 de « AMN
Business »), parce que la plupart sont des **commentaires**. L'identité réelle
tient en quatre endroits :

| Endroit | Ce qu'il décide |
|---|---|
| `src/edition/edition.ts` → `EDITION_PRODUCT_NAME` | **le nom affiché**, source unique lue par 10+ fichiers |
| `electron-builder.config.mjs` → `appId`, `productName`, `executableName` | l'identité du paquet : dossier d'installation, nom de l'exe, nom de l'installeur |
| `src/main.ts` → `app.setName()`, `app.setAppUserModelId()` | le dossier de données utilisateur et l'AUMID Windows (groupement barre des tâches, notifications) |
| `package.json` → `name`, `productName` | **le dossier d'installation par utilisateur** (voir le correctif CI : NSIS `oneClick`+`perMachine:false` nomme le dossier d'après `name`) |

**Bonne nouvelle pour le Bloc 1** : le nom affiché n'est écrit qu'à un seul
endroit. Le renommage n'est donc pas un chercher-remplacer à 71 occurrences,
c'est l'échange de deux chaînes dans quatre fichiers — plus la vérification
qu'aucun littéral ne traîne ailleurs.

**Attention** : `package.json.name` vaut `amn-desktop` et sert de dossier
d'installation. Le renommage y touche, donc il touche au chemin vérifié par
`release.yml` — les deux doivent bouger ensemble.

---

## 0.2 — Le canal de mise à jour client fait bien plus que notifier

Le backlog demandait : « télécharge-t-il et installe-t-il réellement, ou se
contente-t-il de notifier ? » **Il fait le trajet complet.**

`checkBusiness()` (`src/main/updater.ts`) interroge le flux `amn-api`, et
`telechargerBusiness()` télécharge l'installeur, **vérifie son SHA-256 contre
l'empreinte annoncée**, le met de côté, purge les versions précédentes, puis
`appliquerBusiness()` le lance et quitte l'application.

Deux vrais manques, tous deux petits :

1. **L'installeur est lancé sans `/S`** (`spawn(fichier, [])`). L'installeur
   NSIS `oneClick` s'exécute donc avec sa bannière de progression au lieu d'être
   silencieux. C'est le seul écart réel avec ce que demande le Bloc 3.
2. **Le commentaire parle de « l'installeur Squirrel »** — périmé depuis la
   migration vers NSIS. Un commentaire faux sur un chemin critique coûte cher au
   prochain qui le lit.

---

## 0.3 — Le mobile est une PWA, sans projet natif

Aucun dossier `android/`, `ios/`, aucune configuration Capacitor ou React
Native dans les deux dépôts. Le mobile est servi par le build web
(`scripts/build-web.mjs`), installable via `public/manifest.webmanifest`, avec
un service worker enregistré dans `src/renderer.tsx` (uniquement en production
et hors Electron).

Le cas « un projet natif existe déjà » du Bloc 4 ne se présente donc pas.

---

## 0.4 — Icônes : le bureau est complet, le mobile ne l'est pas

`images/icon.ico` embarque **7 tailles** (16, 24, 32, 48, 64, 128, 256) — rien
à régénérer côté Windows.

Le manifeste PWA, lui, déclare **un seul fichier physique**, `icon.png` en
1024×1024, référencé deux fois : une fois en `purpose: any`, une fois en
`purpose: maskable`. Trois manques qui se voient sur un vrai téléphone :

- pas de **192×192 ni 512×512**, les deux tailles qu'Android et Chrome
  attendent explicitement pour l'installation ;
- la version `maskable` est **la même image, sans marge de sécurité** : Android
  applique un masque circulaire et rognera donc le logo ;
- **aucun `apple-touch-icon`** — l'ajout à l'écran d'accueil sur iOS retombe sur
  une capture de la page.

---

## 0.5 — Aucun écran ne liste les membres, mais le serveur sait déjà le faire

Confirmé : les Paramètres contiennent six panneaux (accent, sécurité du compte,
MFA, modules, Ollama, mise à jour) et **aucun panneau « membres »**.

Ce qui est plus intéressant : **les routes existent déjà côté cliente**, et
aucun écran ne les consomme.

| Route | Qui y a droit | Consommée par un écran ? |
|---|---|---|
| `GET /v1/auth/users` | tout compte connecté | **non** |
| `POST /v1/auth/invitations` | `owner` / `admin` | **non** |
| `PUT /v1/auth/users/:id/status` | `owner` / `admin` | **non** |

Le Bloc 6 et le Bloc 7 sont donc, pour l'essentiel, **du travail d'interface**.

**Une exception à signaler** : il n'existe **aucune route pour CHANGER le rôle**
d'un membre. Seul le *statut* (actif/suspendu) est modifiable. Le Bloc 6
demandant un rôle « modifiable par owner/admin », il faudra une route serveur
nouvelle — c'est le seul travail d'API des deux blocs.

---

## 0.6 — La création de compte a deux points d'entrée, pas un

L'atelier de création n'est **pas** le seul chemin, contrairement à ce que le
backlog suppose :

- **Côté AMN DevSec** : `POST /v1/admin/organizations/:id/users` ouvre un compte
  chez une cliente. C'est ce que fait le dossier d'organisation (bouton
  « Ouvrir »), déjà en place.
- **Côté cliente elle-même** : `POST /v1/auth/invitations` invite dans sa propre
  organisation. **Aucune interface ne l'expose** — c'est le manque du Bloc 7.

---

## 0.7 — Messagerie : un seul fil, aucun destinataire

`Message` porte `authorEmail`, `body`, `attachments`, `replyToId`, `reactions`,
`pinned`. **Aucun champ de canal, de fil ou de destinataire.** Il y a donc
exactement une conversation par organisation, à laquelle tout le monde
participe.

Les Blocs 8 (messages privés) et 9 (groupes) demandent donc une notion de
**destination** qui n'existe pas encore dans le modèle.

Sur l'envoi d'email (Bloc 7.2) : **amn-api n'a aucun transport mail.** Pas de
nodemailer, sendgrid, postmark, resend ni SMTP — la seule occurrence de « SMTP »
dans le dépôt est le nom d'un port dans le scanner. Le code le dit lui-même :
« Delivery (email) is the caller's responsibility; amn-api has no mail transport
and inventing one here would be worse. » Le lien d'invitation devra donc être
**copiable**, comme le backlog l'anticipait.

Point rassurant pour le Bloc 7.3 : l'écran d'activation public existe déjà
(`/invitation`), et **c'est l'invitée qui choisit son mot de passe** — Aaron n'a
jamais à en fabriquer un à sa place.

---

## 0.8 — Aucune suppression de message, mais un motif établi ailleurs

Rien ne permet aujourd'hui de supprimer un message, par qui que ce soit.

En revanche le dépôt a **un motif de suppression cohérent et réutilisable** :
le composant `ConfirmDelete`, employé dans Clients, Devis, Décisions,
Facturation. Le Bloc 10 doit s'y conformer plutôt qu'inventer un geste.

---

## 0.9 — Photo de profil : où elle vit, et pourquoi je ne conclus pas

Le profil vit dans la collection **synchronisée** `profiles`, un enregistrement
par adresse, la photo en data-URL dans `photoDataUrl` (`ProfilesContext.tsx`).

Un effet d'amorçage crée un profil vide (`photoDataUrl: ''`) quand aucun
enregistrement ne correspond au compte connecté. C'était mon principal suspect —
un amorçage qui partirait avant l'arrivée des données écraserait la photo.

**J'ai vérifié, et cette piste est infirmée** : `setReady(true)` n'est appelé
qu'**après** `await pullAll()`, et le garde `pullFailed` couvre explicitement le
cas de l'échec réseau — le code documente d'ailleurs ce danger précis.

Second suspect : l'amorçage écrit l'identifiant `user.email` **brut** alors que
lecture et écriture normalisent (`trim().toLowerCase()`). Une casse différente
créerait deux enregistrements. Mais le serveur normalise déjà l'adresse à la
connexion, donc les deux coïncident en pratique.

**Conclusion honnête : la cause n'est pas établie.** Le Bloc 11 exige une
reproduction réelle avant tout correctif — c'est d'ailleurs ce que le backlog
demande, et ce bug a déjà été « corrigé » plusieurs fois sur hypothèse.

---

## 0.10 — Le chemin d'arrière-plan existe déjà, il n'est pas configuré

Le backlog demande s'il existe « déjà un chemin en arrière-plan ». **Oui, et il
est complet** :

- `web-push` est une dépendance d'amn-api ;
- `/v1/push/key` expose la clé VAPID, `routes/push.js` gère les abonnements ;
- `public/sw.js` écoute `push` et `notificationclick`, et route un appel vers
  `#/team`.

Ce qui manque n'est pas du code mais **une configuration** : au démarrage,
amn-api journalise « VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents — les
notifications push (appels sur PWA fermée) sont désactivées ».

Sur le **bureau**, les notifications passent par `Notification` d'Electron
(`src/main/ipc.ts`) : elles ne peuvent, par nature, s'afficher que pendant que
le processus tourne.

---

## 0.11 — Le rail mobile : déjà réglé, ne pas y toucher

**Mesuré** sur un gabarit de téléphone réel (390×844), édition interne
construite, compte de test :

- le rail latéral est bien **masqué** (`hidden md:flex`) — c'est voulu, une
  colonne d'icônes et un tiroir ne tiennent pas côte à côte sur un téléphone ;
- le tiroir de navigation expose `OrgSwitchButton`, et **« Grosse Essai » comme
  « Petite Essai » y sont atteignables**.

C'est le correctif rôle/session fusionné juste avant ce chantier qui l'a réglé :
le `useMemo` d'`OrgContextContext` publiait `myOrganizations` sans le surveiller,
donc les consommateurs gardaient une liste vide.

**Le Bloc 13 est donc sans objet — il n'y a rien à recorriger.**

---

## 0.12 — Les deux supervisions ne sont pas confondues, parce qu'il n'y en a qu'une

Il n'y a **aucun suivi d'erreurs de l'application elle-même** : pas de Sentry,
pas de `captureException`, pas de `crashReporter`. Le Bloc 24.3 est donc
entièrement à faire.

La question du backlog — « est-ce que ça prête à confusion dans l'état
actuel ? » — n'a donc pas encore de raison de se poser : il n'existe qu'un seul
domaine de supervision (les sites clients). **Le risque de confusion naîtra
précisément le jour où le Bloc 24.3 sera construit**, et c'est à ce
moment-là qu'il faudra séparer les deux, visuellement et dans le vocabulaire.

---

## Ce que cet audit change dans le plan

Trois blocs changent de nature :

- **Bloc 13** — sans objet, déjà réglé, mesuré.
- **Blocs 6 et 7** — presque entièrement de l'interface : le serveur sait déjà
  lister les membres et émettre une invitation. Seul le changement de rôle
  demande une route nouvelle.
- **Bloc 12** — surtout une configuration (clés VAPID) plutôt qu'une
  construction ; le chemin technique existe de bout en bout.

Et un bloc devient plus lourd qu'annoncé :

- **Blocs 8 et 9** — le modèle `Message` n'a aucune notion de destination. Il
  faut l'introduire, côté serveur comme côté poste, avant tout écran.

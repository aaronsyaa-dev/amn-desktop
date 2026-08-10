# AMN Desktop v2 — décisions du chantier

Ce document consigne les décisions prises en autonomie pendant le chantier v2,
et ce qu'il faut savoir pour reprendre le travail dessus. Il ne répète pas ce
que disent les messages de commit ni les commentaires du code : il n'y a ici
que les arbitrages qui ne se lisent pas dans le diff.

## Refonte multi-organisations — arbitrages

**Le contexte client n'est pas dans l'URL.** Deux tables de routes montées
selon le contexte, aux mêmes chemins, plutôt qu'un préfixe `/org/<id>/…`. Les
écrans partagés naviguent en chemins absolus (`/clients`, `/agenda`) : un
préfixe aurait demandé de réécrire chaque lien de chaque écran, et un seul
oubli aurait éjecté l'opérateur du contexte au milieu d'une session de support.
Conséquence assumée : on ne peut pas coller un lien vers le dossier d'une
cliente. C'est cohérent avec le reste — l'accès est un jeton d'une heure
journalisé, pas une adresse qu'on s'échange.

**Les chemins des modules n'ont pas bougé.** Ranger les produits sous
`/tour/tracker` aurait cassé les liens profonds, la mémoire d'onglet, les
pastilles d'activité et les entrées de la palette de commandes, pour un gain
purement cosmétique. L'espace est une propriété du module, déduite du chemin,
pas un préfixe.

**Décisions et Connaissances restent au Poste de travail.** Le cahier des
charges ne les listait pas ; les retirer aurait supprimé deux modules qui
fonctionnent et que rien ne demandait de retirer. Ils sont regroupés dans une
section « Mémoire », qui dit mieux ce qu'ils sont.

**Le bureau SOC a été déplacé, pas dupliqué.** Il vivait dans l'écran Trackers,
entre le catalogue de modules et la liste des sites. L'écran Trackers redevient
le catalogue et l'état d'installation ; il porte un lien vers la Tour de
contrôle plutôt qu'une seconde copie du mur.

**Une session de support plutôt qu'une lecture inter-tenant côté serveur.**
`amn-api` refusait, par conception, de laisser une organisation en lire une
autre. Plutôt que d'ouvrir les routes de lecture, on émet une session ordinaire
dont la PORTÉE est déplacée : expiration, révocation et contrôle de suspension
empruntent alors le code existant. Une deuxième mécanique d'authentification
aurait été une deuxième chose à oublier de vérifier. Détail des garde-fous dans
`amn-api/README.md`.

**Le journal est écrit par le serveur, et son échec fait échouer l'action.** Un
journal que l'application cliente pourrait omettre d'écrire ne prouve rien —
et c'est exactement ce qu'on veut pouvoir montrer à une cliente qui demande qui
a vu ses données.

**Ce que la session de support autorise vraiment.** Rôle `admin` dans
l'organisation cliente : lecture ET écriture de son espace de travail. C'est ce
que « la supporter en conditions réelles » demande — un support qui s'arrête au
diagnostic ne sert à rien. Elle est en revanche refusée sur la console admin et
sur toute route touchant à des comptes : ces gestes-là passent par la console,
qui les journalise. À relire si le périmètre change.

**Le logo d'organisation voyage dans la liste.** `GET /v1/admin/organizations`
rend les logos avec le reste, plafonnés à 48 Ko. Simple et suffisant jusqu'à
quelques centaines d'organisations ; au-delà, il faudra une route dédiée et
paresseuse plutôt que de charger tout le parc à l'ouverture.

## Décisions structurantes

**La « carte » des visiteurs est un classement à barres, pas une carte du
monde.** Un choroplèthe demande une géométrie embarquée (100–300 ko sur un
bundle déjà à 800 ko) pour répondre exactement à la même question à la même
granularité — la part de trafic par pays. Le classement la donne de façon
lisible et immédiate. Si une vraie carte est souhaitée un jour, seul le
panneau `Origine des visiteurs` de `SocDesk.tsx` change.

**Le code pays vient du tracker, jamais d'une déduction d'amn-api.** amn-api
n'a pas de base IP → localisation et ne fait aucun appel de géolocalisation
tiers. Le tracker lit l'en-tête géo de son hébergeur (`x-vercel-ip-country`,
`cf-ipcountry`, …) et le place dans `payload.country`. Conséquence pratique :
la répartition par pays reste vide tant que le tracker d'un site n'envoie pas
ce champ, et le panneau le dit explicitement plutôt que d'afficher un graphique
trompeusement vide.

**Le jeton du badge de sécurité est public, mais n'est pas un identifiant de
connexion.** C'est le client qui colle l'adresse sur son propre site : elle est
donc publique par construction. Le point important est ce qu'elle déverrouille
— le nom du site et son score, rien d'autre. `GET /badge/:token.svg` est la
seule route non authentifiée qui touche à des données de site, et c'est
délibéré.

**Les alertes des produits ne sont pas des événements de site.** Une régression
Scanner/Comply est poussée en `product:regression` plutôt qu'enregistrée comme
événement : une URL planifiée n'a pas à correspondre à un site du parc, et
inventer un site pour y accrocher l'alerte mettrait une ligne fantôme dans le
parc. Les alertes SSL, elles, sont bien des événements de site — parce qu'elles
portent toujours sur un site supervisé — et apparaissent donc dans le fil
d'incidents du bureau SOC.

**L'état « corrigé » d'une faille est indexé sur l'hôte, pas sur le scan.** Un
scan est un instantané ; c'est la faille qu'on suit. Indexer sur le scan aurait
remis chaque case à zéro à l'analyse hebdomadaire suivante — exactement
l'historique qu'on veut conserver.

**Appels audio : STUN public uniquement, pas de TURN en V1.** Cela couvre le
cas courant (deux postes derrière un NAT ordinaire) et échoue honnêtement quand
ce n'est pas le cas : au bout de 20 s sans chemin média, l'appel se termine avec
un message clair au lieu de rester sur une ligne muette. Ajouter un TURN est un
choix d'infrastructure (coût, hébergement) à faire séparément.

**Ajmani reste local.** Le contexte — tâches, clients, notes, décisions,
connaissances, parc, scores — est assemblé dans le renderer et remis au modèle
Ollama par le chemin IPC existant. Rien dans le BLOC 3 n'ouvre de connexion
sortante nouvelle. Sans modèle local, le repli est extractif : il liste les
enregistrements correspondants avec leur source. Il peut être incomplet, il ne
peut pas être faux.

**Un appel non délivré ne raccroche plus tout de suite.** Le concentrateur
prévient l'appelant quand personne n'écoute (`signal:undelivered`) ; jusqu'ici
l'appel s'arrêtait aussitôt avec « correspondant hors ligne ». Cela rendait la
notification push inutile : le téléphone sonnait, l'opérateur touchait la
notification, et l'appelant avait déjà abandonné. Désormais l'appel continue de
sonner pendant toute la fenêtre (35 s), l'offre est ré-émise toutes les 3 s pour
qu'un appareil réveillé par la push puisse encore la rattraper, et l'appelant
lit « Hors ligne — notifié… » au lieu d'un abandon immédiat. Le destinataire
ignore une offre portant l'identifiant d'appel qu'il traite déjà, sans quoi la
ré-émission se répondrait à elle-même « occupé ».

**Les notifications web passent par le service worker, jamais par
`new Notification()`.** Dans une PWA Android, ce constructeur lève une
exception : c'est la raison pour laquelle les notifications fonctionnaient sur
un navigateur de bureau et ne faisaient strictement rien sur le téléphone.
`ServiceWorkerRegistration.showNotification` est le seul chemin accepté, et
c'est aussi le seul disponible quand l'application est fermée.

**Les push nécessitent une paire de clés VAPID côté serveur.** Sans
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, amn-api démarre normalement et le
reste fonctionne — seuls les téléphones fermés ne sonnent plus, et l'écran
Paramètres le dit explicitement plutôt que d'échouer en silence. Générer la
paire une fois avec `node -e "console.log(require('web-push').generateVAPIDKeys())"`.

**Contrôle à distance : l'injection passe par `SendInput` (user32) via koffi.**
`webContents.sendInputEvent()` d'Electron n'injecte que dans la fenêtre
Electron — inutile pour aider quelqu'un sur SA machine. `robotjs` n'est plus
maintenu et se recompile à chaque version d'Electron ; `nut.js` récent est
passé derrière une licence payante ; PowerShell/SendKeys coûte un processus par
événement. `koffi` appelle directement `SendInput` sans compilation, avec des
binaires préfabriqués. Conséquence à connaître : `isRemoteInputAvailable()`
renvoie faux hors Windows, et une demande de contrôle y est alors REFUSÉE avec
la raison affichée — plutôt que d'accorder un contrôle qui ne ferait rien.

**Le consentement n'est jamais déduit du trafic.** Le processus principal est
un exécutant : il n'a aucune notion d'autorisation. C'est le renderer qui tient
l'état, et une trame `input` n'est exécutée que si CE poste a explicitement
accordé le contrôle. Un pair qui enverrait des événements sans demander — ou
après révocation — est ignoré, pas cru. Le canal se ferme avec l'appel, ce qui
révoque le contrôle sans qu'aucun message n'ait besoin d'arriver.

## Réglages d'exploitation

| Variable | Défaut | Effet |
| --- | --- | --- |
| `SCHEDULE_SWEEP_MS` | 15 min | Fréquence du balayage des analyses récurrentes. |
| `SSL_SWEEP_MS` | 6 h | Fréquence du balayage des certificats. |
| `PUBLIC_BASE_URL` | déduit des en-têtes | Base des URL du badge (à fixer derrière un proxy). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | absentes | Sans elles, pas de notification d'appel sur une PWA fermée. |
| `VAPID_SUBJECT` | `mailto:contact@amn-devsec.com` | Contact exigé par les services de push. |

Un hôte déjà vérifié il y a moins de 6 h est sauté par le balayage SSL, quelle
que soit la cadence : abaisser `SSL_SWEEP_MS` ne se transforme donc pas en
pluie de poignées de main chez les clients.

## Action en attente — suppression des magasins hérités

**Statut : en attente de la validation d'Aaron. Ne pas exécuter avant.**

Les magasins par plateforme qui précédaient les collections synchronisées
(SQLite derrière l'IPC côté Electron, `amn.fallback.*` côté navigateur) sont
conservés en LECTURE SEULE, comme source de la migration unique décrite dans
`src/state/useClients.ts`. Ils sont déclarés explicitement dans
`LEGACY_MIGRATION_ONLY_STORES` (`src/lib/bridge.ts`), et c'est cette déclaration
qui les fait tolérer par `npm run check:sync`.

Condition de suppression : Aaron confirme avoir utilisé cette version en
conditions réelles pendant plusieurs jours, sur sa machine ET sur celle de
Mohamed, sans perte de données. Tant que cette confirmation n'est pas donnée,
les magasins restent en place — ils sont le seul filet si la migration s'est
mal passée sur un poste.

Une fois la confirmation donnée, la suppression couvre : les APIs de domaine
`clients`/`quotes`/`tasks`/`decisions`/`knowledge`/`objectives`/`messages`/
`profiles` du pont navigateur, leurs gestionnaires IPC et leurs entrées de
preload, les tables SQLite correspondantes, et l'entrée
`LEGACY_MIGRATION_ONLY_STORES` elle-même. C'est une suppression de code de
données : elle se fait délibérément, avec une sauvegarde préalable, jamais en
fin de chantier.

## Ce qui n'a pas pu être vérifié dans le bac à sable

L'environnement de développement n'a pas d'accès sortant libre. Les analyses
Scanner et Comply récurrentes ont donc été vérifiées contre des cibles publiques
réellement joignables depuis le bac à sable (`registry.npmjs.org`, `pypi.org`)
plutôt que contre les sites clients. La chaîne exercée est la même — vraie
planification, vrai scan, vraie comparaison, vraie poussée WebSocket, vraie
notification — seule la cible diffère.

## Idées écartées de ce chantier, à reprendre plus tard

- **Comply multi-pays** — CCPA (Californie), LGPD (Brésil), PDPA (Singapour) en
  plus du RGPD, avec un référentiel par pays et un score par juridiction.
- **AMN Backup** — sauvegarde vérifiée des sites clients, avec test de
  restauration périodique (une sauvegarde jamais restaurée n'est pas une
  sauvegarde).
- **AMN Uptime multi-régions** — sonde de disponibilité depuis plusieurs points
  du globe, pour distinguer une panne réelle d'un incident réseau local.
- **AMN Forms Firewall** — protection des formulaires clients (spam, injection,
  bourrage d'identifiants) au niveau du tracker.
- **Partage d'écran type Parsec** — assistance à distance entre opérateurs, en
  réutilisant la signalisation WebRTC déjà en place pour les appels audio.

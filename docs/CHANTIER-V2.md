# AMN Desktop v2 — décisions du chantier

Ce document consigne les décisions prises en autonomie pendant le chantier v2,
et ce qu'il faut savoir pour reprendre le travail dessus. Il ne répète pas ce
que disent les messages de commit ni les commentaires du code : il n'y a ici
que les arbitrages qui ne se lisent pas dans le diff.

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

## Réglages d'exploitation

| Variable | Défaut | Effet |
| --- | --- | --- |
| `SCHEDULE_SWEEP_MS` | 15 min | Fréquence du balayage des analyses récurrentes. |
| `SSL_SWEEP_MS` | 6 h | Fréquence du balayage des certificats. |
| `PUBLIC_BASE_URL` | déduit des en-têtes | Base des URL du badge (à fixer derrière un proxy). |

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

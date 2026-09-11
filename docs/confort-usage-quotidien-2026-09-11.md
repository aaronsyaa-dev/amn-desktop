# Confort d'usage à deux — ce qui a été fait, ce qui a été écarté

Cinq pistes évaluées. Deux construites (présence par fiche, journal d'activité), une déjà
couverte et enrichie côté vérification (notifications), deux rapportées sans code parce que le
code ne peut pas trancher à leur place (rôles, rattrapage — déjà là).

**Le patch amn-api est prêt et validé par les tests (13/13 sur les fichiers touchés, 477/477 sur
toute la suite), il n'est PAS poussé** (`docs/captures/confort-2026-09-11/amn-api-confort.patch`).
Il partage des fichiers avec le patch de fusion du 10/09 (`sqlite.js`, `postgres.js`, `schema.sql`,
`collections.js` sont modifiés par les deux chantiers) : ce nouveau patch contient donc les DEUX —
fusion déjà décrite, plus la présence par fiche et le journal d'activité d'aujourd'hui. Il remplace
le patch du 10/09 pour l'application, pas pour la lecture : `docs/fusion-ecriture-concurrente-2026-09-10.md`
reste le bon document pour comprendre la fusion elle-même.

## 1. Présence par fiche — construite

**Le problème concret** : Harun et Mohamed peuvent ouvrir la même fiche client au même moment sans
le savoir. La présence qui existait déjà (`onlineEmails`, `PresenceDot`) dit « Mohamed est connecté »,
jamais « Mohamed regarde CETTE fiche ».

**Ce qui a été ajouté**, en réutilisant l'infrastructure existante plutôt qu'une nouvelle voie :
- `amn-api/src/ws/hub.js` — le canal WebSocket qui portait déjà la présence et la signalisation
  d'appel porte maintenant deux trames de plus, `watch`/`unwatch` (poste → serveur) et `watchers`
  (serveur → poste), avec un registre par organisation (`watchersByOrg`) et un nettoyage automatique
  à la fermeture de la socket — jamais de fiche « occupée pour toujours » si quelqu'un ferme un onglet
  sans prévenir.
- `amn-desktop/src/state/useRecordWatchers.ts` (nouveau) — un hook qui annonce l'ouverture/fermeture
  d'une fiche et rend la liste des AUTRES opérateurs qui la regardent.
- `amn-desktop/src/screens/ClientsScreen.tsx` — la fiche client affiche un bandeau
  « X consulte aussi cette fiche en ce moment » quand c'est le cas.
- Le transport (`sendFrame`/`onFrame`, déjà générique depuis la signalisation d'appel) et le pont
  Electron ↔ navigateur ont été étendus à l'identique dans les deux implémentations
  (`main/remoteApi.ts` + `main/ipc.ts` + `preload.ts` côté Electron, `lib/bridge.ts` côté PWA), donc
  ça marche pareil sur les deux plateformes.

**Preuve** : `amn-api/test/api.test.js`, nouveau test « WebSocket: watch/unwatch a record broadcasts
who is looking at it » — deux sockets (Aaron, Mohamed), l'un ouvre une fiche client, l'autre la
voit apparaître dans la trame `watchers` ; le second l'ouvre aussi, les deux emails sont là ; le
premier ferme la fiche (`unwatch`) explicite, puis une seconde fiche pour vérifier qu'une
DÉCONNEXION SANS `unwatch` (onglet fermé) libère bien la fiche aussi. `node --test test/api.test.js`
→ 13/13. Suite complète amn-api → 477/477 (475 d'avant + les 2 tests neufs de ce chantier ; les
tests de fusion du 10/09, déjà comptés, restent verts). `tsc` propre sur les deux éditions du poste,
`eslint` sans erreur, `check:sync`, `check:modules`, `check:langue` verts.

**Ce que je n'ai pas construit, et pourquoi** : un badge « qui regarde » sur TOUTES les fiches
(tâches, devis, factures…) plutôt que sur la seule fiche client. L'exemple donné dans la demande
est le doublon sur une fiche client — c'est le point de friction réel et mesurable. Le mécanisme
serveur (hub, trame `watch`/`watchers`) est générique et accepte n'importe quelle collection sans
modification ; ajouter le badge à un autre écran est ensuite du câblage d'une ligne (le même hook,
un autre écran), pas une nouvelle fonctionnalité — à faire à la demande plutôt qu'en prévision.

## 2. Journal d'activité — construit, dans Équipe (pas un écran « Administration » séparé)

**Ce qui existait déjà** ne répondait pas à la demande : `org_access_log` ne trace que les entrées
d'AMN DevSec chez une organisation cliente (pas les gestes d'Harun et Mohamed sur leurs PROPRES
données), et les enregistrements métier (`shared_records`) n'ont jamais eu d'historique — un
dernier-écrit-gagne sans trace de qui a écrit quoi avant.

**Ce qui a été ajouté** :
- `record_activity_log`, une table neuve (schema.sql pour Postgres, DDL équivalente dans sqlite.js) :
  une ligne par création/modification/suppression, avec l'auteur, la collection, l'identifiant, un
  intitulé au mieux (`title`/`name`/`number`/`label` de la fiche, premier trouvé) et l'horodatage.
- L'auteur vient du champ `_by` que le poste appose déjà sur chaque écriture (`WRITER_KEY`,
  `SyncContext.tsx`) — aucune identité serveur à inventer, c'est le même contrat que le fil
  d'activité de l'Accueil utilise depuis longtemps. Pour une suppression (qui n'a pas de corps de
  requête), le poste envoie maintenant qui supprime dans le corps du `DELETE` (`by`), en clair,
  au même niveau de confiance que `_by` — facultatif, donc un ancien poste continue de fonctionner,
  juste sans auteur sur cette ligne.
- `GET /v1/collections/_activity` rend les 100 dernières entrées de l'organisation (500 au
  maximum sur demande), ouvert à tout opérateur authentifié — comme la présence, c'est un outil de
  coordination entre collègues, pas une console réservée à un rôle.
- Côté poste, un panneau repliable « Journal d'activité » dans l'écran **Équipe**, sous la barre de
  présence : « Mohamed a modifié client · Corvetto SARL · à l'instant ». Traduit (fr/en),
  `check:langue` vert.

**Pourquoi dans Équipe et pas un écran « Administration »** : ce dépôt n'a pas d'écran nommé
Administration pour l'organisation d'Harun et Mohamed — Réglages (`SettingsScreen`) est PERSONNEL
(un compte y règle ses propres notifications, son mot de passe), et le seul journal déjà affiché à
l'écran (`AccessLogScreen`, route `/tour/journal`) est celui d'AMN DevSec entrant chez une
organisation cliente, un concept différent. Équipe est déjà l'écran où la présence de l'équipe et
l'historique par personne (`HistoriqueMembre`) vivent — le journal d'activité y est cohérent plutôt
qu'un nouvel écran à découvrir.

**Preuve** : nouveau test « collections: activity log records who created/updated/deleted what » —
Aaron crée un client, Mohamed le modifie, Aaron le supprime en se déclarant (`by`) ; le journal
rend les trois lignes dans le bon ordre avec le bon auteur et le bon intitulé ; un test complémentaire
vérifie qu'une écriture SANS `_by` (poste d'avant ce correctif) est journalisée quand même, avec un
auteur `null` plutôt qu'une erreur ou un geste tu. `node --test` → vert (voir décompte ci-dessus).

**Limite dite** : le journal note QUE quelque chose a changé, pas CE QUI a changé (pas de diff
champ par champ — la fusion, elle, sait déjà dire quels champs elle a repris de qui, voir
`docs/fusion-ecriture-concurrente-2026-09-10.md` §3, mais ce n'est pas persisté). Aller plus loin
demanderait de stocker un diff par écriture — plus de travail et plus de données à conserver pour un
gain qui n'a pas été demandé ; à envisager seulement si « qui a créé/modifié quoi » s'avère
insuffisant à l'usage.

## 3. Notifications par personne — déjà couvert, rien à construire

Vérifié dans `NotificationsManager.tsx` et `SettingsScreen.tsx` : chaque catégorie de notification
qui existe réellement aujourd'hui (site hors ligne, alerte critique, mention — messages d'équipe ET
messages privés depuis le correctif du 10/09 —, tâche assignée, rappel de rendez-vous, reprise
d'activité côté client) a déjà son propre réglage, par personne, dans Réglages → Notifications.
Mohamed peut déjà couper ce qu'il ne veut pas voir, catégorie par catégorie.

**L'exemple donné (Facturation) ne s'applique pas** : il n'existe aujourd'hui AUCUNE notification
liée aux factures — `NotificationsManager.tsx` ne surveille pas la collection `invoices`. Il n'y a
donc rien à basculer sur ce point précis ; l'inventaire des catégories qui existent VRAIMENT est
déjà entièrement couvert.

**Écarté, et pourquoi** : ajouter une notification « nouvelle facture » ou « facture en retard »
juste pour lui donner un interrupteur serait inventer un besoin non demandé. Si Harun veut être
notifié des factures, c'est une piste à part, avec sa propre décision (notifier qui, sur quel geste).

## 4. Rôles et permissions — rapporté, pas modifié

Le rôle existe déjà (`users.role`, `memberships.role` — un rôle par organisation, pas par compte,
donc Harun peut être `owner` chez AMN DevSec et autre chose ailleurs), avec une seule liste de rôles
admin (`ADMIN_ROLES` côté poste, vérifiée par CI contre `tenantAuth.js` côté serveur — `check:roles`).
Ce que ce rôle gate aujourd'hui : les actions d'administration (inviter/retirer un membre, réglages
de l'organisation) — pas de restriction fine par section ou par donnée au-delà de admin/membre/invité.

**Je ne peux pas vérifier depuis ici si les rôles assignés aujourd'hui à Harun et Mohamed
correspondent à qui fait quoi en réalité** — ni les comptes réels ni leur usage quotidien ne sont
visibles depuis ce chantier, et les toucher sans savoir serait improviser. **Question pour Harun** :
les rôles actuels (probablement tous deux `owner`, ou l'un `owner` et l'autre `admin`/`membre`)
reflètent-ils la réalité ? Si oui, rien à faire. Si un des deux ne devrait plus pouvoir, par exemple,
retirer un membre ou changer les réglages de l'organisation, un changement de rôle suffit — aucun
nouveau système à construire.

**Écarté explicitement, comme demandé** : un système de permissions plus fin (par section, par
donnée) sans besoin exprimé. Deux personnes n'ont pas besoin d'une matrice de droits.

## 5. Rattraper l'absence — déjà là, vérifié plutôt que recréé

`ActivityContext.tsx` + le bloc « Activité récente » de l'Accueil font déjà ce qui était demandé :
un fil des changements de l'AUTRE opérateur, par onglet, avec un texte court par enregistrement
(pas juste « la fiche 42 a changé ») et un badge de non-lus par section qui se vide en visitant
l'onglet. Ce n'est pas le flux brut de la synchro — c'est une lecture déjà résumée par nature (une
ligne par fiche touchée, pas une ligne par octet reçu), plafonnée à 40 événements et affichée en 6
sur l'Accueil pour rester calme.

**Écarté** : construire un second mécanisme (un « digest » ou une modale « depuis votre dernière
connexion ») aurait dupliqué ce qui existe déjà pour un gain marginal — la seule vraie différence
serait un regroupement par compte (« 3 tâches, 1 client, 2 factures ») plutôt qu'une liste. Faisable
en une petite heure si l'usage réel montre que la liste ne suffit pas ; pas construit maintenant
faute d'un signe que c'est le cas.

## Ce qu'Harun doit tester lui-même avec Mohamed

1. **Présence par fiche** — après avoir pris connaissance de si/quand le patch amn-api est déployé :
   ouvrez la même fiche client à deux, en même temps. Chacun doit voir le bandeau nommant l'autre.
   Fermez l'onglet de l'un (sans rien cliquer d'autre) : le bandeau doit disparaître chez l'autre en
   quelques secondes.
2. **Journal d'activité** — dans Équipe, dépliez « Journal d'activité » après avoir créé, modifié et
   supprimé quelques fiches à deux (client, facture, tâche). Vérifiez que chaque geste apparaît avec
   le bon nom et un intitulé lisible, dans l'ordre chronologique inverse.
3. **Rôles** — dites-moi si les rôles actuels d'Harun et Mohamed (visibles dans Équipe → cliquer sur
   chacun, ou dans les réglages de membres) correspondent à qui devrait pouvoir administrer
   l'organisation.
4. **Dire quand pousser le patch amn-api.** Comme pour la fusion du 10/09, je ne pousse pas sans
   votre accord — une fois poussé, `npm run make` (ou l'installateur) est nécessaire pour que les
   postes envoient les nouvelles trames (`watch`/`unwatch`, `by` sur suppression) et affichent les
   nouveaux panneaux.

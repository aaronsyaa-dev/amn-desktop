# Audit de fiabilité AMN Business — avant usage quotidien réel

Édition **interne** (AMN Business), pour Harun et Mohamed. Vérification, pas construction :
chaque système a été inventorié dans le code, puis **exercé en vrai** (deux comptes connectés en
même temps, coupures réseau, redémarrage du serveur) dans un navigateur piloté contre une amn-api
locale, sur des données de test uniquement. Preuves dans
`docs/captures/audit-fiabilite-2026-09-10/` (journaux horodatés, trames WebSocket des deux côtés,
captures, patch amn-api).

Une seule correction a été appliquée dans ce dépôt (notification des messages privés, voir plus
bas). Deux correctifs côté amn-api sont **validés mais non poussés** — dépôt distinct, il faut votre
feu vert.

## Le verdict, système par système

| Système | État | Preuve la plus courte |
|---|---|---|
| Synchronisation temps réel (amn-api + WebSocket) | **Fonctionne**, avec une règle de conflit à connaître | message A → B en 73 ms ; serveur redémarré → sockets revenues en 7,8 s, écriture faite pendant la panne livrée en 8 s, 0 notification en double |
| Reprise après coupure réseau | **Fonctionne partiellement** | écriture hors ligne gardée puis livrée 4 s après le retour ; mais la socket morte n’était **pas détectée** (aucun battement) — correctif amn-api validé |
| Édition concurrente du même enregistrement | **Ne fonctionne pas** (écrasement) | la réaction faite EN LIGNE par A a été effacée par le rejeu hors ligne de B — signalé, pas modifié (logique de synchro) |
| Appels audio entre membres | **Fonctionne** (sur un même réseau) | `RTCPeerConnection` → `connected` des deux côtés 0,4 s après décroché ; sonnerie en 0,2–0,4 s ; présence à jour ~50 ms après fermeture de l’app |
| Notifications : fil d’équipe, appel entrant, tâche assignée | **Fonctionne** | au bon destinataire, une seule fois, jamais à l’expéditeur, aucune rejouée au rechargement ni à la reconnexion |
| Notifications : messages privés | **Ne fonctionnait pas** → **corrigé** | avant : reçu par la synchro, 0 notification, 0 pastille ; après : « Message privé de … » chez le destinataire seul |
| Notifications push (téléphone, PWA fermée) | **Existe**, non vérifiable d’ici | clés VAPID absentes en CI ; en production inconnu — une commande pour le savoir plus bas |
| Messagerie (fil, privés, groupes, annonces) | **Existe et fonctionne** (collections synchronisées) | groupes et annonces restent muets côté notification (non modifié) |
| Supabase (base) | **Non vérifiable d’ici** | pas d’accès ; **aucune sauvegarde configurée nulle part** — risque réel |
| amn-api sur Render | **En ligne, à jour** | témoin GitHub du 10/09 18:23 UTC : battement il y a 0 min, 20 gardes, 0 en retard, uptime 2 995 min ; commit déployé = `main` = ce qui est dans le code |

## Bloc 0 — ce qui existe vraiment (et ce qui n’est pas ce qu’on croit)

- **Il n’y a pas de Supabase Realtime.** La synchro est celle d’amn-api : HTTP (`/v1/collections`) +
  son propre hub WebSocket (`/v1/stream`, bibliothèque `ws`, un seul processus, diffusion en mémoire).
  Supabase n’héberge que le Postgres, attaqué avec le client `pg` brut. Le poste garde un miroir
  `localStorage` par collection, écrit en optimiste, et une **file d’envoi persistante** (200 entrées
  max, 10 essais, attente doublée jusqu’à 5 min) ; les conflits se règlent au dernier arrivé sur le
  serveur, enregistrement entier.
- **Appels** : vrai WebRTC audio pair-à-pair ; amn-api ne relaie que la signalisation. STUN Google
  seulement, **pas de TURN**. Partage d’écran et prise de contrôle existent (contrôle : Electron
  seulement). Liens d’appel anonymes pour un visiteur sans compte.
- **Notifications** : trois couches réelles. (1) OS natives via le process principal Electron
  (`system:notify`, badge de barre d’état quand la fenêtre est cachée), déclenchées par
  `NotificationsManager` (alerte critique — une par incident —, escalade, site hors ligne, message du
  fil d’équipe, tâche qui m’est assignée), `CallOverlay` (appel entrant / manqué), `SupportNotifier`
  (demande d’une cliente, alerte d’injection), Ajmani. (2) Toasts en application
  (`SyncActivityNotifier` : « Mohamed · 3 mises à jour »). (3) Web Push pour la PWA fermée (clés
  VAPID côté serveur). La cloche de la barre haute ne liste que les alertes de sécurité, pas les
  messages.
- **Messagerie** : fil d’équipe `messages`, privés `dms`, `groups`/`groupMessages`, `announcements` —
  toutes synchronisées à l’organisation entière (un message privé est hors de l’écran des autres, pas
  hors de leurs données : c’est écrit dans le code de l’écran, et c’est vrai).
- Rien de tout cela n’est une maquette : tout est branché et a été exercé.

## Bloc 1 — les scénarios joués, et ce qu’ils ont donné

Deux comptes internes (`demo.interne@exemple.test` = A, `mohamed.audit@exemple.test` = B), amn-api
locale en sqlite, build web interne. Notifications OS interceptées dans la page, trames WebSocket
enregistrées des deux côtés, état serveur relu après chaque geste.

**S1/S3b — présence.** Chacun voit l’autre joignable ; B ferme son application → chez A le bouton
« Appeler » se grise dans la foulée. OK.

**S2 — message du fil, A → B.** B reçoit la trame 73 ms après l’envoi, une notification « Message de
Demo Interne », A n’est pas notifié de son propre message. B recharge sa page : 0 notification
rejouée. OK. **Observation** : B reçoit la notification OS même quand il a le fil ouvert sous les
yeux (S2b) — du bruit, non modifié.

**S3 — appel A → B.** Sonnerie chez B en 217–368 ms avec notification « Demo Interne vous
appelle. » ; B accepte ; `RTCPeerConnection` passe `connected` des deux côtés ~410 ms plus tard
(compteur de durée à l’écran, capture `S3-run2-appel-etabli-A.png`) ; A raccroche, B revient au repos.
OK — **mais les deux pairs étaient sur la même machine** : la traversée de NAT entre vos deux vrais
réseaux n’est pas prouvée ici (voir la liste finale).

**S4 — B perd le réseau, écrit, puis revient.** Le message reste affiché chez B avec la bannière
« 2 modifications en attente d’envoi » (le message + une écriture de profil `teamSeenAt`), rien sur
le serveur. Retour du réseau : serveur servi en 4,05 s, A l’a reçu en 4,0 s. La file n’est vide
qu’après 49 s (l’attente doublée de la seconde entrée) — sans conséquence visible. **Défaut trouvé** :
la socket n’a **pas** été fermée dans les 20 s suivant la coupure — aucun battement n’existe, ni côté
serveur ni côté poste. Un poste dont le réseau tombe en silence (Wi-Fi, veille) continue d’afficher
« Lien actif » sans rien recevoir, et le serveur le compte présent et joignable. Le poste se rattrape
seulement au retour sur la fenêtre (relecture après 30 s de focus perdu) ou au prochain échec d’écriture.

**S5 — édition concurrente du même message.** B hors ligne épingle le message ; pendant ce temps A,
en ligne, y réagit 👍 (serveur : 1 réaction). B revient : son enregistrement rejoué **efface la
réaction de A** (serveur final : épinglé, 0 réaction ; A ne voit plus sa réaction). C’est la règle
« dernier arrivé gagne, enregistrement entier », sans comparaison de version : la version hors
ligne, plus ancienne, gagne parce qu’elle arrive après. Vaut pour tout : une tâche, une fiche client,
une facture en brouillon modifiée par les deux pendant qu’un des deux est coupé. **Non modifié** :
c’est la logique de synchro, à valider avant d’y toucher (proposition plus bas).

**S6 — amn-api s’arrête puis revient.** Les deux sockets tombent en < 50 ms ; A écrit pendant la
panne (bannière d’attente) ; serveur relancé → sockets rouvertes en 7,8 s (attente progressive
1 s → 30 s), message de panne sur le serveur en 8,0 s et visible chez B en 8,0 s ; file de A vide.
Sur toute la session B a reçu 3 notifications distinctes, **0 doublon**.

**S7 — message privé A → B.** Reçu par la synchro, **aucune notification, aucune pastille** dans la
barre latérale. Corrigé dans `NotificationsManager` (même préférence que le fil, seulement ce qui
m’est adressé) ; rejoué après correctif (S7bis) : B notifié « Message privé de Demo Interne », A non.

**S9 — tâche assignée à B.** Seul B est notifié « Nouvelle tâche assignée ». OK.

**Le serveur lui-même** : la suite amn-api passe entière ici (464 tests, 0 échec), dont les tests
qui prouvent qu’une trame ne franchit jamais une organisation et que le push d’appel vise le bon
compte.

## Bloc 2 — Render, Supabase, CI

- **Render est injoignable depuis ce bac à sable** (`onrender.com` hors politique réseau, 403 du
  mandataire — déjà documenté dans `amn-api/docs/H24.md`). Les journaux Render n’ont donc pas été lus.
  La preuve vient du **témoin extérieur** (`amn-api/.github/workflows/garde-h24.yml`, qui relit
  `/v1/health` depuis GitHub) : dernière exécution le 10/09 à 18:23 UTC — `ok`, battement de la Garde
  il y a 0 min, 20 gardes, 0 ronde en retard, aucune interruption, **uptime 2 995 min** (l’instance
  n’a pas dormi depuis deux jours). Le commit qu’il observe est `84da559`, identique à `origin/main`
  et au code audité : ce qui est déployé est ce qui est dans le dépôt.
- **Le témoin ne tourne pas toutes les 10 minutes** mais toutes les 2 à 5 heures (18:23, 15:02,
  11:13, 06:04, 01:12…) : GitHub espace les crons des dépôts peu actifs. Il ne maintient donc pas
  l’instance gratuite éveillée à lui seul — ce sont vos postes et les trackers qui le font aujourd’hui.
- **La CI d’amn-api est rouge sur `main` depuis le 08/09** (trois poussées). Pas la suite de tests
  (464 verts en CI aussi) : le contrôle `check:incidents`, qui prend les mots `created`/`updated`/
  `removed` des trames de Tour (`org:changed`, `module_request`) pour des natures d’alerte sans
  libellé. Faux positif d’un garde-fou, aucun effet à l’écran. Correctif validé (24 natures, toutes
  vérifiées), dans le patch.
- **Supabase** : aucun accès d’ici (pas de `DATABASE_URL`). Ce que le code dit : pool `pg` par défaut
  (10 connexions max) sur une seule instance — loin de toute limite. **Aucune sauvegarde n’est
  configurée nulle part** (pas de `pg_dump`, pas de workflow, pas de mention dans les docs) : une
  migration ratée, une suppression d’organisation (la route existe) ou un incident Supabase est
  irrécupérable. Pour un usage quotidien réel, c’est le risque numéro un.

## Ce qui a été corrigé, ce qui attend votre feu vert

**Corrigé ici (ce dépôt)** : `src/components/NotificationsManager.tsx` — notification OS pour un
message privé qui m’est adressé. Il faut **reconstruire l’installateur** (`npm run make`) pour l’avoir
sur les postes. Les groupes et annonces restent sans notification (non demandé, non improvisé).

**Validés, non poussés** (`amn-api-correctifs.patch`, 48 lignes, dépôt amn-api) :
1. `src/ws/hub.js` — battement : ping toutes les 30 s, un pair muet à deux battements est terminé.
   Prouvé : un poste qui ne répond plus est coupé au second battement (46 s), un poste sain reste
   connecté ; 41 tests du hub et des notifications verts. Côté poste, rien à changer : la fermeture
   déclenche la reconnexion et la relecture existantes.
2. `scripts/check-incidents.mjs` — les trois natures de trames de Tour admises explicitement ; la CI
   redevient verte.

**Signalé, pas modifié** (logique sensible) : l’écrasement S5. Proposition, à valider avant tout
code : le poste envoie avec chaque `PUT` l’`updatedAt` sur lequel il s’est basé ; le serveur refuse
(409) si l’enregistrement a bougé depuis, et le poste relit puis remontre le geste — ou, plus simple
mais partiel, une fusion par champ pour `reactions`/`pinned`. Les deux touchent la file d’envoi et le
serveur ensemble ; ce n’est pas un correctif de nuit.

## Ce qui n’a pas pu être vérifié ici

- Les notifications **natives Windows** et le badge de barre d’état (Electron) — la logique testée
  est exactement celle qui les déclenche, mais l’affichage OS n’a pas été vu.
- La traversée de **NAT** pour les appels entre deux réseaux différents (STUN seul, pas de TURN).
- Le **push sur un vrai téléphone** et la présence des clés VAPID en production. À faire depuis
  votre poste : `curl -H "Authorization: Bearer <WEB_OPERATOR_TOKEN>" https://amn-api.onrender.com/v1/push/key`
  — `"enabled": false` veut dire qu’un téléphone fermé ne sonnera pas.
- Les journaux Render et la console Supabase (connexions, taille, sauvegardes).
- Le comportement de **votre installateur** réel (quelle `AMN_API_URL` et quel jeton y sont cuits).
- Le poids du miroir local à l’usage : les médias du fil voyagent en données inline (6 Mo max par
  pièce) et le miroir `localStorage` a un quota de l’ordre de 10 Mo ; au-delà il échoue **en silence**
  (les données restent sur le serveur, l’application recharge tout à chaque ouverture). À surveiller
  si vous échangez beaucoup d’images dans le fil.

## Ce qu’Harun et Mohamed doivent savoir avant de s’en servir tous les jours

1. **Sauvegardes : il n’y en a pas.** Avant de mettre des données réelles chaque jour : soit les
   sauvegardes Supabase (plan payant, restauration à un instant), soit un `pg_dump` planifié
   (un workflow GitHub quotidien avec `DATABASE_URL` en secret, sortie chiffrée). À décider cette semaine.
2. **Ne modifiez pas le même élément à deux pendant qu’un de vous est coupé.** Le dernier arrivé
   écrase l’autre, même s’il est plus ancien. Si l’un travaille en train ou en réunion sans réseau,
   qu’il touche à ses propres tâches, pas aux vôtres. Le correctif structurel est décrit plus haut.
3. **Poussez les deux correctifs amn-api** (patch joint) : sans le battement, un poste dont le réseau
   tombe en silence reste « Lien actif » et « joignable » pour l’autre alors qu’il ne reçoit plus rien.
   Dites-moi, et je les pousse sur amn-api.
4. **Reconstruisez l’installateur** (`npm run make`) pour avoir la notification des messages privés.
5. **Testez un appel entre vos deux vrais réseaux une fois.** S’il finit sur « Connexion audio
   impossible entre les deux postes » après 20 s, il faut un serveur TURN — ce n’est pas un bug de
   l’application, c’est la limite « STUN seul » assumée dans le code.
6. **Vérifiez le push en production** (commande plus haut) si vous comptez sur le téléphone qui sonne.
7. **Lisez le rail en bas** : « Lien actif » = tout part en direct ; « Reconnexion en cours » /
   « Hors ligne » + bannière « n modifications en attente d’envoi » = vos gestes sont gardés sur ce
   poste et partiront tout seuls ; ne fermez pas l’application tant que la bannière est là. Une
   modification **refusée** par le serveur est annoncée et reste sur ce poste seulement.
8. Mineur : la notification du fil sonne même quand vous avez le fil sous les yeux ; groupes et
   annonces ne notifient pas ; un message privé est privé à l’écran, pas dans les données de
   l’organisation.

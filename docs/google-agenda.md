# Google Agenda — synchronisation de l'Agenda (état, choix, décisions)

Chantier du 28 septembre 2026. Code : amn-api `src/google/` et
`src/routes/agendaGoogle.js` ; desktop `src/components/agenda/GoogleAgenda.tsx`.

## Ce qui est construit

| Brique | État |
|---|---|
| Connexion OAuth2 | Faite : bouton dans l'Agenda (propriétaire / administrateurs, en personne), consentement Google, retour sur l'API, jetons chiffrés côté serveur, état connecté / expiré / erreur, reconnexion en un clic, déconnexion (révocation Google + effacement). |
| AMN → Google | Faite, immédiate : création, modification, annulation, suppression d'un rendez-vous répercutées par le serveur après chaque écriture. |
| Google → AMN | Faite, **déclenchée par l'écran** (ouverture de l'Agenda, retour sur la fenêtre au plus une fois par minute, bouton « Synchroniser »). Le déclenchement de fond est la décision n° 2 ci-dessous. |
| Conflits | Faits : la dernière modification l'emporte (date de modification comme arbitre), bandeau « Conflit tranché — version X gardée » sur le rendez-vous, avec « Compris ». |
| Écran | Fait : « G » sur les rendez-vous synchronisés, triangle rouge sur ceux qui n'ont pas pu l'être (avec la raison), compteur d'erreurs dans le bandeau, détail « créé dans Google / synchronisé il y a… ». |

## Sécurité des jetons

- Stockés dans `google_agenda.jetons`, chiffrés AES-256-GCM avec une clé
  dérivée de `MFA_SECRET_KEY` (même mécanisme que les secrets MFA, sel
  distinct). Sans cette clé, la connexion est refusée (échec fermé).
- Jamais renvoyés par une route, jamais dans une collection synchronisée,
  jamais écrits dans un journal (les erreurs ne recopient que le code
  d'erreur Google).
- Le `state` OAuth est aléatoire, à usage unique, valable 10 minutes, lié en
  base à l'organisation et à la personne.
- Portée demandée : `calendar.events` (+ `openid email` pour afficher le
  compte connecté). Pas d'accès aux autres calendriers ni aux paramètres.

## Décisions prises seul (et pourquoi)

1. **Calendrier synchronisé : le calendrier principal** du compte connecté.
   Le choisir parmi plusieurs demanderait la portée `calendar.readonly` en
   plus ; à ajouter si une cliente le demande.
2. **Événements Google existants à la première connexion : importés** (et
   modifiables des deux côtés), dans une fenêtre de −30 jours à +400 jours.
   Une copie en lecture seule aurait créé un troisième type de rendez-vous
   à expliquer ; l'import rend la promesse « les deux sens » vraie dès le
   premier jour. Les rendez-vous AMN à venir (à partir d'hier) sont envoyés
   vers Google au même moment.
3. **Suppressions** : supprimer ou annuler dans AMN supprime chez Google. Un
   événement supprimé chez Google passe le rendez-vous AMN à « Annulé »
   (rien n'est perdu) ; s'il avait été importé de Google, il est retiré
   d'AMN.
4. **Déconnexion** : les rendez-vous restent dans AMN, sans lien. Rien n'est
   supprimé chez Google.
5. **Conflits** : « la dernière modification l'emporte ». Il y a conflit
   quand les deux côtés ont changé depuis la dernière synchronisation
   (etag Google différent ET empreinte AMN différente) — typiquement quand
   la connexion était expirée ou Google injoignable. À la poussée, le
   serveur envoie `If-Match` : une modification Google non encore lue est
   détectée au lieu d'être écrasée en silence.
6. **Pas de doublon possible** : l'identifiant de l'événement Google est
   dérivé de celui du rendez-vous ; deux envois concurrents du même
   rendez-vous se rejoignent (409 → mise à jour).
7. **Champs synchronisés** : titre, début, durée, lieu, notes, rappel,
   annulation. Le client lié, le projet et « Terminé » restent propres à
   AMN. Les événements « journée entière » restent des journées entières
   tant qu'on ne change pas leurs dates dans AMN.
8. **Qui connecte** : la propriétaire et les administrateurs, en personne
   (pas une session de support d'AMN DevSec : c'est leur compte Google
   qu'ils engagent). Tout membre (hors invités) voit l'état et peut lancer
   « Synchroniser ».

## Décisions qui reviennent à Harun

### 1. Mode Test ou vérification Google tout de suite

La portée `calendar.events` est « sensible » : pour des utilisateurs
externes en production, Google exige la vérification de l'application
(écran de consentement, politique de confidentialité publiée, domaine
vérifié, vidéo de démonstration ; compter plusieurs semaines).

| Option | Pour | Contre |
|---|---|---|
| **A. Mode Test d'abord** (recommandé) | Utilisable tout de suite par 100 comptes déclarés (Elie, premières clientes) ; vérification lancée en parallèle. | Écran « application non vérifiée » à la connexion ; **les jetons de rafraîchissement expirent au bout de 7 jours** en mode Test → chaque compte devra se reconnecter chaque semaine (l'écran le signale : état « expiré », bouton « Reconnecter »). Chaque compte doit être ajouté à la main dans la console Google. |
| B. Vérification d'abord | Aucune friction pour les clientes. | Rien avant plusieurs semaines. |

Le code est le même dans les deux cas : c'est un réglage de la console
Google Cloud.

### 2. Déclenchement de fond Google → AMN : webhooks ou minuterie

Aujourd'hui, un changement fait dans Google apparaît dans AMN quand
quelqu'un ouvre l'Agenda (ou revient sur la fenêtre, ou clique
« Synchroniser »). Pour qu'il arrive aussi quand personne ne regarde :

| | Webhooks Google (push) | Minuterie serveur (polling) |
|---|---|---|
| Réactivité | Quelques secondes | L'intervalle choisi (ex. 10 min) |
| Ce qu'il faut ajouter | Route publique `POST /v1/agenda/google/notification` (vérifie le jeton de canal), table des canaux, `events.watch` à la connexion, **renouvellement avant 7 jours**, arrêt du canal à la déconnexion. Domaine HTTPS de l'API vérifié dans la console Google. ~1 jour de travail + tests. | Une ronde dans la mécanique existante (`monitor_runs`, déjà utilisée par la supervision) qui appelle `tirer` pour chaque organisation connectée. ~2 h. |
| Contrainte Render gratuit | L'instance s'endort après 15 min : la notification la réveille (démarrage à froid ~30–50 s), Google réessaie si la réponse tarde. Mais **le renouvellement des canaux** tourne sur une minuterie… qui ne tourne pas quand l'instance dort (voir `tracker/monitors.js`). | Ne tourne pas non plus quand l'instance dort, sauf `KEEPALIVE_URL` ou une sonde externe (UptimeRobot) — arbitrage déjà documenté dans `src/lib/keepalive.js`. |
| Quota | Négligeable | Négligeable (1 requête par organisation et par passage) |

Recommandation : **minuterie d'abord** (10 min), branchée sur les rondes
existantes, avec la sonde externe si l'on veut qu'elle tourne la nuit ;
webhooks plus tard si la réactivité devient un besoin exprimé. Rien n'est
branché tant que ce n'est pas validé.

## Mise en service (pour Harun)

Variables d'environnement de l'API :

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — client OAuth « Application
  Web » de la console Google Cloud ;
- `GOOGLE_REDIRECT_URI` — `https://<api>/v1/agenda/google/retour` (ou
  `API_PUBLIC_URL`, dont elle est déduite), déclarée à l'identique dans la
  console ;
- `MFA_SECRET_KEY` — déjà présente si la MFA fonctionne ; **ne pas la
  changer** ensuite (les jetons stockés deviendraient illisibles : l'écran
  demanderait alors de reconnecter) ;
- `APP_BUSINESS_PUBLIC_URL` / `APP_PUBLIC_URL` — pour revenir dans
  l'application web après le consentement.

Dans la console Google : activer « Google Calendar API », écran de
consentement (nom, logo, domaine, politique de confidentialité), portées
`openid`, `email`, `…/auth/calendar.events`, et en mode Test la liste des
utilisateurs autorisés.

## Tester avec un vrai compte Google avant toute cliente

1. Créer un compte Google **de test** (pas celui d'une cliente) et le
   déclarer utilisateur de test dans la console.
2. Sur une organisation de bac à sable (`@exemple.test`), ouvrir l'Agenda,
   « Connecter Google Agenda », accepter.
3. Vérifier : création d'un rendez-vous dans AMN → visible dans Google en
   quelques secondes ; modification et annulation idem.
4. Dans Google : créer, déplacer, supprimer un événement → « Synchroniser »
   dans AMN → visible, déplacé, « Annulé ».
5. Conflit : modifier le même rendez-vous des deux côtés pendant que la
   connexion est coupée (révoquer l'accès depuis
   myaccount.google.com/permissions), reconnecter, synchroniser → bandeau
   « Conflit tranché ».
6. Révoquer l'accès depuis le compte Google → l'Agenda affiche « La
   connexion Google a expiré » et « Reconnecter ».
7. « Déconnecter » → l'application disparaît de
   myaccount.google.com/permissions ; les rendez-vous restent dans AMN.

Tests automatiques : `node --test test/agenda-google.test.js` (amn-api),
contre un faux Google local — jamais un vrai compte.

# Bugs urgents, vérité sur la Garde, simulations d'échelle

Rapport du 24 septembre 2026. Branche `claude/first-pr-github-setup-ltpqqo`,
9 commits depuis `9b44dc6` (fin du chantier « vision client »). Tout a été mesuré
en **bac à sable** : bases SQLite jetables sous le répertoire de travail de la
session, comptes `@exemple.test` / `@sim.test`. Aucune donnée de production n'a
été lue ni écrite. La seule lecture de production est celle du battement public
de la Garde (voir §0.1).

---

## 0. En tête : les trois réponses attendues

### 0.1 La Garde : réelle ou pas ?

**Verdict : le mécanisme est réel, mais le chiffre affiché ne l'est pas.**

| Ce qui est affirmé | Ce qui est mesuré | Verdict |
|---|---|---|
| 20 gardes affectées | 20 agents inscrits, battement actif, **0 en retard** (bac à sable et production) | **Vrai** |
| Surveillance 24 h/24 | Production (Render) : serveur vivant sans interruption toute la journée du 24 (relevés à 00 h 29, 05 h 16, 10 h 12 et 15 h 14 ; 97 → 982 min de fonctionnement continu ; redémarrage à 19 h 14 lors d'un déploiement). Le filet GitHub `garde-h24.yml` est réglé « toutes les 10 min » mais ne se déclenche en réalité **que toutes les 2 à 5 h**. | **Vrai tant que le serveur tient**, le filet de secours est lent |
| « 4 863 passages par jour » | **818 rondes en 24 h**, dont **378 à vide (46 %)** ; 8 951 éléments lus ; 58 réglés seuls ; 40 remontés à un humain | **Faux** : 4 863 est la somme des fréquences théoriques, pas du travail fait |
| La Garde veille sur chaque cliente | Journal des 24 h : **987 lignes sur ~1 000 concernent AMN DevSec**, dont 945 « remontee-maj » répétées sur 36 situations. Chaque cliente reçoit **1 ou 2 lignes**. **3 clientes sur 15 n'en ont aucune.** Aucune ligne de sécurité ne concerne une cliente. | **Trompeur** |
| La Garde surveille les sites des clientes | Le travail sur les sites (disponibilité, certificats) est rangé sous l'organisation **AMN DevSec**, pas sous la cliente. Le dossier de la cliente n'en montre donc rien. | **Travail réel mais invisible** |

Détail des gardes à vide sur 24 h (bac à sable) : `sites.battement` 236/236,
`comptes.jetons` 48/48, `securite.campagnes` 24/24, `produit.erreurs` 17/17,
`sites.rondes-planifiees` 17/17, `clientes.rapports` 5/5, `comptes.impayes` 5/5.
Ces gardes tournent mais n'ont rien à lire. Une garde à vide n'est pas une
panne. Elle ne doit simplement pas compter comme un « passage ».

Source : `npm run verite:garde` (lecture seule), sortie datée dans
`docs/mesures/verite-garde-bac-a-sable-2026-09-24.txt`.

**Déjà corrigé :** l'Atelier n'affiche plus « 4 863 passages ». À la création
d'une organisation, il dit ce qui est vrai et vérifiable : le nombre de gardes
qui la suivent dès la création, et combien s'y ajoutent quand un site est
enregistré (`data-garde-atelier`, capture `docs/captures/urgences-2026-09-24/atelier-3-garde.png`).
L'édition cliente ne promettait déjà rien de « 24 h/24 » : ce chiffre ne
servait qu'au discours commercial.

**Non modifié, à valider par Harun** (la Garde est une logique sensible) :
voir §1.1, §2.1 et §2.2.

### 0.2 Les quatre simulations

| | Verdict chiffré (24/09/2026) | Mesures |
|---|---|---|
| **S1 · 25 simultanés, une organisation** | **Tient.** 25 postes, 100 s, 1 315 opérations (13,2/s), **0 erreur**. Écriture p50 4 ms, p95 6 ms, p99 15 ms, max 45 ms. Diffusion : 27 169 trames, p95 5 ms. Connexion p95 520 ms. Poste : trame p50 12–16 ms, plus longue tâche ~75 ms, mémoire 20–37 Mo. **Défaut trouvé et corrigé :** avant, la pluie de toasts de synchronisation (3 empilés, visibles 57 s sur 59) ; après, 1 toast, visible 17 s sur 59. Limite : deux personnes qui modifient la même fiche en même temps, la dernière écriture gagne sans prévenir. | `docs/mesures/s1-25-simultanes-2026-09-24.json` |
| **S2 · 1 mois puis 1 an** | **Un mois : tient** (3 546 fiches, synchro 1,02 Mo en 29 ms, tous les écrans ≤ 0,47 s). **Un an : cassait, corrigé.** 41 771 fiches, 12,1 Mo de synchro. Avant : **le poste gelait 145 s** après la connexion et la Facturation mettait 150–166 s à s'ouvrir. Après : synchro en 3,0 s, Facturation en 549 ms, tous les écrans ≤ 631 ms, mémoire 83 Mo. Reste : le miroir `localStorage` (5 Mo) ne tient pas 12 Mo ; croissance linéaire sans archivage. | `docs/mesures/s2-historique-{30,365}-jours-{api,navigateur}.json` |
| **S3 · sans Harun** | **8 fonctions autonomes, 10 qui attendent un humain** (lecture du code, 24/09). Le risque principal : **l'argent d'AMN ne rentre pas seul** (aucun prestataire de paiement ; les paiements sont saisis à la main). | §3 |
| **S4 · 10 / 100 / 1 000 / 1 000 000** | **10, 100 et 1 000 : tient** (p95 7, 8 et 10 ms ; 0 erreur ; 200 postes connectés à 1 000 ; serveur à 230 Mo). **Premières limites vers 1 000–10 000** : la liste complète est rechargée à chaque ouverture du QG, les gardes à 6 h ne couvrent plus le parc dans la journée, et 512 Mo de RAM sur Render gratuit. **1 000 000 : casse.** La liste complète des organisations **fait tomber le serveur pour toutes les clientes** (`RangeError: Invalid string length`, non rattrapée). Il faudrait **208 jours** à `comptes.places` et **3,4 ans** à `registre.hygiene` pour faire un tour ; les rapports mensuels deviennent impossibles au-delà de **~72 000 clientes**. | `docs/mesures/s4-echelle-*-clientes-2026-09-24.json` |

### 0.3 Les quatre bugs urgents

| | État | Preuve |
|---|---|---|
| **U1** · Harun n'entre chez aucune cliente depuis le support | **Corrigé** | Même cause que U2 : l'écran « Premiers pas » était monté sans guide dans le mode support. `npm run check:support` (nouveau) : « entrée chez « Atelier Vermeil », 110 écran(s) de la cliente parcourus ». Capture `docs/captures/vision-2026-09-24/support-apres.png`. |
| **U2** · `useGuide must be used within a GuideProvider` | **Corrigé, pour tous les points d'entrée** | `useGuide()` ne lève plus jamais : hors fournisseur, il rend un guide inerte. `PremiersPas` et `Presence` se retirent d'eux-mêmes en support ou sans guide. L'onboarding ne peut donc plus faire tomber l'application, quelle que soit la porte d'entrée. |
| **U3** · 108 cases à cocher à la création | **Corrigé** | `ChoixModules` : les modules conseillés pour le métier sont déjà cochés, avec des paquets par espace (« + Finance » : 8 → 17 modules en un clic) et une recherche (« paie »). **22 boutons visibles au lieu de 108.** Captures `atelier-1-paquet.png`, `atelier-2-recherche.png`. |
| **U4** · Message d'activation non professionnel | **Corrigé en partie, le reste est à décider par Harun** | Corrigé : l'invitation par lien est le mode par défaut. Le message a un objet (« Votre espace X est prêt ») et **ne contient plus jamais de mot de passe** (en mode mot de passe, il dit qu'il est « communiqué à part »). La **présentation du produit** (5 pages en Business, 4 en interne) passe avant la visite module par module. Rejoué de bout en bout à 1280 et à 390 px (captures `arrivee-*`). **À décider :** l'e-mail HTML de marque et la page d'accueil avant connexion. Il faut un envoi automatique (§3.1) et un visuel (briefs Claude Design, §1.5). |

### 0.4 Garde-fous après tous les correctifs

Relancés le 24/09 sur les bundles finaux des deux éditions (API bac à sable :8791).

- **Navigateur, Business et interne :** check:coquille, check:signal, check:mobile, check:contraste (118 + 159 écrans, 61 771 textes, aucun sous WCAG AA) et check:xss sont verts.
- **Navigateur, interne :** check:support est vert.
- **Navigateur, Business :** check:veille-cliente est vert.
- **Statiques :** check:langue, encres, modules, roles, sync, cinquante, accueils, appels, accent, money, calc, pages, resilience, business (bundle Business : aucune trace interne) et fusion-sync (nouveau) sont verts.
- **Build :** `tsc` sans erreur ; `lint` à 0 erreur.
- **amn-api :** 482 tests sur 482.

`check:mobile` avait trouvé une régression dans la frise du jour au téléphone :
un nom tronqué à 11 %. Elle est corrigée dans `09261ed`.
`check:veille-cliente` dépendait de l'heure du lancement : à 22 h 30, il
n'y a plus de « prochain rendez-vous », et avant midi la « nuit » n'était pas
tombée. Rejoué à 08 h puis à 22 h 30, chaque règle passait à l'une des deux
heures : il n'y avait pas de régression du produit. Le contrôle fixe désormais
l'horloge du navigateur (08:00 par défaut, `AMN_E2E_HEURE` pour une autre heure,
22 h 30 pour la règle de nuit). Il est vert à toute heure.

---

## 1. À rajouter

### 1.1 Un rapport de Garde par cliente, visible par la cliente *(Garde, à valider)*
Une page hebdomadaire dans le dossier de chaque cliente. Elle dirait ce qui a été
lu chez elle, ce qui a été réglé, ce qui attend, et l'état de ses sites. C'est la
seule façon de rendre le travail visible avec des preuves. Aujourd'hui, 3
clientes sur 15 n'ont aucune trace en 24 h. Préalable : §2.1.

### 1.2 Un compteur honnête dans la Salle de Garde
Remplacer tout total théorique par trois nombres mesurés sur 24 h : **rondes
utiles** (qui ont lu quelque chose), **éléments lus**, **réglés / remontés**.
`scripts/verite-garde.mjs` calcule déjà ces nombres. Il suffit de les exposer.

### 1.3 Un encaissement automatique pour AMN
Aujourd'hui, un paiement se saisit à la main
(`POST /v1/garde/comptes/:orgId/paiement`). Les relances et la mise en pause
des modules sont déjà automatiques. L'encaissement, lui, ne l'est pas. Il
faudrait brancher un prestataire (prélèvement ou carte) qui appelle cette même
route. **Facturation réelle : à valider par Harun, rien n'a été changé.**

### 1.4 L'envoi automatique de l'invitation
Le lien d'activation existe (7 jours, en libre-service). Il reste à l'envoyer
nous-mêmes au lieu de le copier dans un message. Le service de courrier est déjà
prévu côté serveur (`RESEND_API_KEY`). Il faut le configurer en production et
brancher l'Atelier dessus.

### 1.5 Briefs Claude Design (à commander)

**A. L'e-mail d'invitation HTML.**
- Objet : « Votre espace {Organisation} est prêt ».
- Contenu :
  - en-tête sobre au logo AMN ;
  - une phrase d'accueil au prénom ;
  - un seul bouton, « Activer mon espace », avec la date limite (« jusqu'au 1er octobre ») ;
  - en dessous, le lien en clair ;
  - un bloc « Sur ordinateur » (lien web + téléchargement Windows facultatif) ;
  - le rappel « À la première ouverture, votre espace se présente en deux minutes » ;
  - un pied de page avec le nom de la personne chez AMN à qui répondre.
- Contraintes :
  - jamais de mot de passe ;
  - lisible sans images ;
  - version texte identique à `handoverMessage()` ;
  - rendu Gmail / Outlook / Apple Mail, sombre et clair ;
  - largeur 600 px, lisible à 360 px.

**B. La page d'activation (avant connexion).**
- La cliente arrive depuis le lien et choisit son mot de passe.
- La page doit montrer :
  - le nom de son organisation (et non « AMN DevSec ») ;
  - qui l'a invitée ;
  - un indicateur de robustesse du mot de passe ;
  - ce qui l'attend ensuite (la présentation en 5 pages).
- États à dessiner : lien valide, lien expiré (avec « Demander un nouveau lien »), lien déjà utilisé.
- Contraintes : mêmes jetons de couleur que l'application (`check:encres`), AA sur les deux thèmes, 390 px d'abord.

**C. Les illustrations de la présentation.**
- 5 dessins pour Business, 4 pour l'interne. Ils sont faits aujourd'hui avec les briques du système (captures `arrivee-2-presentation-*`).
- Demande : une illustration par page (votre journée, vos clientes, votre argent, votre équipe, AMN veille), dans le style monochrome + une seule touche d'ambre.
- Contraintes :
  - SVG de moins de 20 Ko ;
  - aucun texte dans l'image (traduit par i18n) ;
  - respect du mode « mouvement réduit ».

### 1.6 Un rattrapage d'erreur global dans l'API
Aujourd'hui, une erreur dans une route asynchrone arrête le processus, donc toutes
les clientes. Il faut un intercepteur qui transforme ces erreurs en réponse 500
et en entrée de `produit.erreurs`. S4 l'a démontré au palier 1 000 000 (§2.4).

### 1.7 L'archivage et la synchro par période
Au bout d'un an, `groupMessages` pèse 4,35 Mo sur 12,1 Mo. Il faudrait ne
synchroniser que les 90 derniers jours par défaut, et charger l'antérieur à la
demande. **Synchro : à valider, non modifié.**

---

## 2. À modifier

### 2.1 Ranger le travail de la Garde sous la bonne organisation *(Garde, à valider)*
Le travail sur les sites (`sites.disponibilite`, `sites.certificats`,
`sites.battement`) est écrit avec l'`orgId` d'AMN DevSec. Il faut l'écrire avec
celui de la cliente à qui appartient le site. Sans ce changement, aucun rapport
par cliente (§1.1) n'est possible. Fichiers : `amn-api/src/garde/equipes/sites.js`,
appels à `ctx.journal(...)`.

### 2.2 Arrêter le bruit « remontee-maj » *(Garde, à valider)*
945 lignes sur 24 h répètent 36 situations déjà connues, et elles noient les 13
lignes qui parlent des clientes. Il faudrait ne journaliser une mise à jour de
remontée que si sa gravité ou son contenu change, et sinon incrémenter un compteur.

### 2.3 Des tours de Garde à la mesure du parc *(Garde, à valider)*
Chaque garde lit une page fixe (100 ou 200 organisations) à fréquence fixe.
Le temps d'un tour complet vaut donc parc ÷ page × fréquence :

| Garde | Débit | 1 000 clientes | 10 000 | 100 000 | 1 000 000 |
|---|---|---|---|---|---|
| `comptes.places` | 200/h | 5 h | 2,1 j | 21 j | **208 j** |
| `registre.hygiene`, `produit.integrite` | 200/6 h | 1,25 j | 12,5 j | 125 j | **3,4 ans** |
| `clientes.rapports` (mensuel) | 100/h | 10 h | 4,2 j | **42 j > 1 mois** | 417 j |
| `clientes.accueil` | les 50 plus récentes / 15 min | OK | OK | OK si < 50 créations par 15 min | idem |

Il faudrait calculer la taille de page à partir d'un objectif de tour (« chaque
cliente vue au moins une fois par 24 h ») et répartir le travail entre plusieurs
processus au-delà de ~100 000 clientes.

### 2.4 Le QG d'Harun ne doit plus charger la liste complète
`src/accueils/interne/qg.ts` et `accueils.internal.tsx` appellent
`GET /v1/admin/organizations`, qui renvoie **toutes** les organisations :

| Clientes | Temps | Poids |
|---|---|---|
| 10 | 4 ms | 12 Ko |
| 100 | 7 ms | 109 Ko |
| 1 000 | 60 ms | 1 060 Ko |
| 1 000 000 | **processus tué au bout de 15 s** | chaîne JSON > limite V8 |

La rupture se situe entre ~100 000 (~106 Mo) et 500 000 clientes. Le Parc passe
déjà par `/organizations/page` (23 ms au million) et `/summary` (686 ms au million).
Le QG doit faire de même. À terme, la route complète doit disparaître ou être
plafonnée (§5.3).

### 2.5 Le miroir local de la synchro : de `localStorage` à IndexedDB *(Synchro, à valider)*
Le miroir est limité à 5 Mo et re-sérialise toute la collection à chaque lot.
Avec un an d'historique (12,1 Mo), il déborde et ne sert plus de copie hors ligne.
Il faudrait passer à IndexedDB, avec une écriture par fiche.

### 2.6 Le conflit sur une même fiche
S1 a montré que deux personnes qui modifient la même fiche au même moment
voient la dernière écriture gagner **sans que personne soit prévenu**. Il
faudrait au minimum un avis « Nadia a modifié cette fiche pendant que vous
l'éditiez », avec comparaison. **Synchro : à valider.**

### 2.7 Correctif de synchro déjà appliqué — **validé par Harun le 24/09/2026**
S2 a trouvé que la fusion des lots reçus (`mergeRecord`) recopiait toute la
collection à chaque fiche. C'est un coût quadratique : 5 000 fiches mettaient
4 205 ms, et le poste gelait 145 s avec un an d'historique. Elle a été remplacée
par `fusionnerLot` (`src/lib/fusionSync.ts`), qui copie une seule fois par lot.

- **Règle inchangée :** la fiche la plus récente (`updatedAt`) gagne, et à égalité la fiche entrante gagne, exactement comme avant.
- **Preuve :** `npm run check:fusion-sync` rejoue 10 000 lots aléatoires contre l'ancienne fonction, avec un résultat identique à chaque fois. 20 000 fiches passent en 7–8 ms.
- **Validation :** Harun a validé le changement le 24/09/2026 : l'équivalence prouvée sur 10 000 cas suffit. `check:fusion-sync` reste dans les garde-fous pour la tenir.
- **Pour revenir en arrière (si un jour nécessaire) :** dans `src/state/SyncContext.tsx:479`, remplacer `fusionnerLot(prev[collection] ?? {}, incoming)` par l'ancienne boucle `mergeRecord`. `fusionnerFicheAncienne` est gardée dans `fusionSync.ts` pour cela. Sinon, `git revert 5783821`, qui annule aussi la pagination des longues listes.

---

## 3. À automatiser

### 3.1 S3 — ce qui tourne sans Harun (état au 24/09/2026, lecture du code)

**Autonome (8) :**
1. Contrôle des places par formule ; les jetons d'activation ouvrent les modules seuls.
2. Impayé → avis → grâce de 7 jours → mise en pause automatique des modules.
3. Intégrité (rôles, formules, listes) et hygiène du registre.
4. Accueil des nouvelles clientes.
5. Sentinelle d'injection → incident → escalade dans la pile.
6. Surveillance des sites enregistrés (disponibilité, certificats).
7. Vérification des mises à jour du poste.
8. Lien d'activation en libre-service (7 jours) ; file de modération du Hall versée dans l'assistance.

**Attend un humain (10) :**
1. **L'encaissement d'AMN** : aucun prestataire, paiements saisis à la main → §1.3.
2. Réponse aux demandes de support.
3. Réinitialisation de mot de passe (manuelle tant que le courrier n'est pas configuré) → §1.4.
4. L'envoi de l'invitation (copier-coller) → §1.4.
5. La création d'une organisation (Atelier, par Harun).
6. Les demandes de places supplémentaires.
7. Les décisions de la pile « À votre avis ».
8. La modération du Hall.
9. L'enregistrement d'un site dans le Parc.
10. Le cerveau d'Ajmani (hors ligne sans `ANTHROPIC_API_KEY`).

Côté cliente, les relances de factures sont **préparées** (lien `mailto:`),
mais pas envoyées.

### 3.2 Priorités d'automatisation
1. Encaissement (§1.3) : sans lui, l'entreprise ne tourne pas sans Harun.
2. Courrier sortant (invitation, mot de passe oublié, relances clientes) : un seul service, déjà prévu.
3. Demande de places : paiement accepté → places ajoutées, sans validation.
4. Filet de Garde : remplacer le cron GitHub (irrégulier, 2–5 h) par un vrai planificateur (Render Cron Job ou un moniteur externe payant), et/ou un plan Render qui ne s'endort pas.

---

## 4. À améliorer

### 4.1 Ce qui a été amélioré pendant ce chantier
- **Onboarding incassable** : le guide inerte hors fournisseur (U2), plus un garde-fou navigateur sur le support (U1).
- **Création d'organisation** : paquets métier et recherche (U3).
- **Arrivée d'une cliente** : un message court et sans secret, puis la présentation du produit (U4).
- **Poste à 25** : les toasts de synchro fusionnent sur 30 s au-delà de 3 lots.
- **Poste à un an d'historique** :
  - fusion linéaire ;
  - animations d'entrée limitées aux 30 premières lignes ;
  - listes de factures et de dépenses paginées par 200 (« Afficher 200 de plus »).
- **Téléphone** : la frise du jour ne tronque plus les noms.

### 4.2 Ce qui reste à améliorer
- **Recherche au million** : 304 ms en balayage (`LIKE`). Il faudrait un index plein texte (FTS5 / `pg_trgm`) au-delà de 100 000 clientes.
- **Démarrage du serveur** : 18,6 s avec 1 million d'organisations, ce qui pèse sur chaque déploiement. À profiler (initialisation de la Garde ?).
- **Instruments d'un an** : lisibles (barres mensuelles des dépenses, demi-cercle des factures). Un artefact a été vu : « 1 745 de plus en 7 jours ». Il vient de la graine de simulation, pas du produit, mais le libellé devrait plafonner ou résumer au-delà de 999.
- **Temps de connexion** : p95 520 ms à 25 connexions simultanées, à cause du coût voulu du hachage. C'est acceptable, à surveiller si des vagues de connexion arrivent.

---

## 5. À enlever

### 5.1 Le chiffre « 4 863 passages par jour »
**Fait** (Atelier). Il ne doit réapparaître nulle part tant qu'il n'est pas
mesuré (§1.2).

### 5.2 Le mot de passe dans les messages
**Fait.** `handoverMessage()` ne peut plus l'inclure, quel que soit le mode.

### 5.3 La route `GET /v1/admin/organizations` sans pagination
À retirer une fois le QG passé en pages (§2.4), ou à plafonner (par exemple
413 au-delà de 5 000). C'est la seule route mesurée qui peut arrêter le serveur.

### 5.4 Les rondes à vide comptées comme du travail
Il faudrait ne plus compter, ni journaliser comme « passage », une ronde qui n'a
rien lu (46 % aujourd'hui). La garde reste en place ; seul son compte change.

### 5.5 Le bruit du journal
Il s'agit des « remontee-maj » répétées (§2.2) : 94 % du journal d'une journée.

---

## Annexe — ce que chaque palier casse, et ce qu'il faut pour le suivant

| Palier | Ce qui casse ou plafonne | Pour tenir le palier suivant |
|---|---|---|
| **10** (mesuré) | Rien. 41 comptes, 3 170 fiches, 2,9 Mo ; p95 7 ms ; 140 Mo de RAM. | Rien. |
| **100** (mesuré) | Rien. 292 comptes, 17 910 fiches, 13,3 Mo ; p95 8 ms ; 58 postes ; 206 Mo. | Encaissement et courrier automatiques (le temps d'Harun devient la limite). |
| **1 000** (mesuré) | Techniquement, rien : 2 733 comptes, 187 495 fiches, 126 Mo ; 200 postes, 2 642 opérations, p95 10 ms, p99 25 ms, 0 erreur ; 230 Mo. Mais le QG charge 1 Mo à chaque ouverture, et l'hygiène met 1,25 jour à faire le tour. | Le QG en pages (§2.4). Un plan Render payant : 512 Mo, c'est ~2× la mémoire mesurée. Le rattrapage d'erreur global (§1.6). |
| **10 000** (extrapolé) | Base ~1,3 Go ; ~2 000 postes connectés sur un seul processus Node (non mesuré) ; tour d'hygiène 12,5 jours ; liste complète ~10 Mo. | Postgres (déjà supporté par `createDb`) plutôt que SQLite. Tours de Garde calculés (§2.3). Synchro par période (§1.7). |
| **100 000** (extrapolé) | Rapports mensuels impossibles au-delà de ~72 000 ; tour de places 21 jours ; liste complète ~106 Mo ; ~13 Go de données clientes (126 Ko par cliente mesurés à 1 000). | Plusieurs instances d'API, donc un bus (Redis ou Postgres LISTEN/NOTIFY) pour le hub WebSocket, aujourd'hui en mémoire. Gardes réparties par tranche d'organisations. Index plein texte. |
| **1 000 000** (mesuré sur le squelette : 1 M organisations + 1 M comptes, 1,18 Go sans fiches) | **La liste complète tue le serveur.** Démarrage 18,6 s. Résumé 686 ms, recherche 304 ms, tri par activité 157 ms, page de 50 en 23 ms, connexion d'une cliente 53 ms. Les rondes de Garde restent rapides (18–129 ms), mais un tour complet prend 208 jours à 3,4 ans. Avec les fiches, ~126 Go de données. | Architecture découpée (organisations réparties par base), Garde en file de travaux, facturation et support entièrement en libre-service. |

Scripts pour rejouer : `scripts/simulations/` (s1, s2, s4-echelle, s4-million).

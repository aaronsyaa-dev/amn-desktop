# Arrivée cliente et automatisation prioritaire

Rapport du 25 septembre 2026.

- **Poste** : branche `claude/first-pr-github-setup-ltpqqo`.
- **Serveur** : série `docs/patchs/amn-api-2026-09-25/`, cinq patchs, aussi sur la branche `claude/arrivee-cliente` d'amn-api (24 fichiers, +1 687 lignes).
- **Environnement** : tout a été mesuré en bac à sable. Aucune donnée de production n'a été lue ni écrite.

---

## 0. L'état réel, en une page

| Partie | Code | En production aujourd'hui |
|---|---|---|
| **1.1** Lire l'invitation avant l'activation | **Fait et testé** (10 tests, protection anti-sondage intacte) | Non : patch à déployer |
| **1.2–1.4** Laissez-passer, illustrations, e-mail de marque, données de démonstration | **Pas fait** : le paquet `AMN Desktop - Arrivee cliente.dc.html` (tour 43) **n'est pas arrivé** dans la session. Seules les archives des paquets 2 et 4 y sont jointes, et aucune ne contient 43a–43f. | — |
| **2** Courrier automatique | **Fait et testé** : invitation, mot de passe oublié, relance de facture (10 tests + contrôle des modèles) | **Non** : patchs à déployer, clé Resend et domaine à configurer (§3) |
| **3** Encaissement automatique | **Fait et testé** : Stripe, webhook signé (12 tests, 4 contre-épreuves) | **Non** : compte Stripe, prix et webhook à créer (§4) |
| **4** Journal de la Garde et attribution des sites | **Corrigé et mesuré** (6 tests, contre-épreuve, relevé sur le bac à sable) | Non : patch à déployer, puis `scripts/rattacher-sites.mjs` |

**Garde-fous.** Verts sur les deux éditions, et amn-api passe 519 tests sur 519 (détail §6).

**Logique déjà validée.** Rien n'a été modifié dans la fusion de synchro validée le 24 septembre (`src/lib/fusionSync.ts`, `SyncContext.tsx`).

---

## 1. Arrivée cliente

### 1.1 La route qui lit l'invitation — faite

`POST /v1/auth/invitations/lire` (patch 0001) prend `{ token }` et rend :
- l'état : `valable`, `expire`, `utilise`, `suspendu` ou `incomplet` ;
- l'organisation qui invite ;
- **qui invite** (nouvelle colonne `invited_by_name` : un nom court, jamais une adresse) ;
- l'adresse invitée **masquée** (`m•••••@gmail.com`) ;
- la date limite ;
- la nature : `activation`, ou `appartenance` pour un compte qui existe déjà.

**La protection contre le sondage n'est pas affaiblie.** Elle repose sur les mêmes verrous qu'à l'acceptation :

1. **Freinage avant toute lecture.** On utilise **le même seau** par adresse IP que `/invitations/accept` (20 échecs par 15 min, puis 429). Alterner lecture et acceptation ne double donc pas le budget d'essais. C'est testé : 10 lectures plus 10 acceptations au hasard suffisent à bloquer.
2. **Une seule réponse pour tout ce qui n'est pas un vrai jeton.** Jeton mal formé, jeton inconnu ou corps vide rendent tous `{ "etat": "incomplet" }`, identiques octet pour octet, et comptent comme un échec. Qui tape au hasard ne voit rien d'autre.
3. **L'entropie.** Un jeton fait 256 bits. Les états distincts ne se voient qu'avec un vrai lien, et leur porteur n'apprend rien que le courriel ne lui ait déjà dit.

S'y ajoutent trois précautions :
- le jeton voyage dans le **corps** d'un POST, jamais dans une URL (un GET est refusé) ;
- la réponse est servie en `Cache-Control: no-store` ;
- aucun identifiant interne (compte, organisation) n'est rendu.

**Côté poste.** La page d'activation lit l'invitation avant tout, et chaque état a sa suite :

| État | Ce que la page propose |
|---|---|
| Valable | Choisir son mot de passe |
| Expiré | En redemander une à la personne qui a invité |
| Déjà utilisé | Se connecter |
| Incomplet | Recoller le lien complet |

Face à un serveur d'avant, l'ancien parcours reste. La mise en page est **provisoire**, faite avec les briques du système. Captures à 390 px : `docs/captures/arrivee-2026-09-25/activation-{valable,expire,utilise,incomplet}-390.png`.

### 1.2 à 1.4 — en attente du paquet 43

Ces pièces n'ont **pas** été construites de mémoire : les inventer contredirait un design validé que je n'ai pas sous les yeux. Dès que le paquet est joint :

- **Laissez-passer** (e-mail et page) et son talon ambre selon l'état. Les quatre états sont déjà servis par la route (§1.1) : il ne manque que la carte.
- **Les 4 illustrations**, construites à partir du vrai catalogue : les 13 familles à leur vraie taille (`NAV_SECTIONS`), les modules épinglés par profil (`@edition/guide`).
- **L'e-mail de marque** : il remplacera la mise en page du modèle `invitation` sans changer ce qu'il dit. Le texte actuel est déjà sans mot de passe, avec le lien, la date en toutes lettres et qui invite. Il faudra ensuite vérifier le rendu dans deux clients mail. Ce n'est pas faisable d'ici, faute d'accès à de vrais clients mail.
- **Données de démonstration** (Studio Lumen, Nadia, Mohamed, `app.amn.fr`) : rien à retirer tant que le cahier n'est pas implémenté. Les vraies valeurs viendront du serveur : organisation, qui invite, `APP_BUSINESS_PUBLIC_URL`.
- **Mention légale** : **aucune information légale réelle d'AMN DevSec** (raison sociale, forme, SIREN, adresse) n'existe dans les dépôts. Je n'en ai pas inventé. Elle devient un réglage : `COURRIER_MENTION_LEGALE`, ajoutée au pied de chaque courriel quand elle est renseignée (testé).

---

## 2. Courrier automatique — ce qui est branché

Le service Resend existait déjà. Ce chantier y branche trois flux :

| Flux | Ce qui part | Garde-fous |
|---|---|---|
| **Invitation** d'une nouvelle cliente : création dans l'Atelier, réémission, collègue invitée par une propriétaire | Objet « Votre espace X est prêt ». Contenu : le lien, « valable jusqu'au 2 octobre », « Harun vous a ouvert… ». **Jamais de mot de passe.** | La réponse dit à l'Atelier si le courriel est parti, ou pourquoi pas : `sans_cle`, `sans_adresse_app`, `non_demande`, `echec`. Le message à copier reste en secours. En mode mot de passe provisoire, rien ne part. Une appartenance (compte existant) ne reçoit pas le texte d'activation. |
| **Mot de passe oublié** | Lien valable 60 min, à usage unique | Déjà complet avant ce chantier : même réponse que l'adresse existe ou non. Il n'attend que la clé. |
| **Relance de facture** (côté cliente) | Le texte gradué du module Relances, envoyé au client de la facture, « Fleurs de Lune via AMN », réponse à la personne qui relance. La relance se note seule. | **Le destinataire n'est jamais libre** : le serveur le relit dans la facture de l'organisation, et une adresse glissée dans la requête est ignorée (testé). La facture doit être émise et échue. Une relance par facture et par 20 h, 40 par jour et par organisation. Jamais en mode support. Le domaine d'expédition reste celui d'AMN, seul le nom affiché change. |

**Côté poste.**
- L'Atelier a un champ « qui invite », retenu sur ce poste.
- Les Relances ont un bouton « Envoyer à … ». Il n'apparaît que si le courrier est en ligne et que la facture porte une adresse, et il devient alors la seule action ambre.

---

## 3. Courrier — ce qui manque côté infrastructure

**Pas en production aujourd'hui**, pour trois raisons :

1. **Le code n'est pas déployé.** amn-api n'est pas modifiable depuis cette session : il faut appliquer `docs/patchs/amn-api-2026-09-25/` puis déployer sur Render.
2. **Pas de clé Resend** en production. Au démarrage, le serveur l'écrit : `[courrier] hors ligne : RESEND_API_KEY ou EMAIL_FROM absent`.
3. **DNS non vérifiable d'ici.** La politique réseau de cet environnement bloque `dns.google`, `api.resend.com`, `resend.com`, `api.stripe.com` et `docs.stripe.com`. Je n'ai donc pu ni lire les enregistrements actuels d'`amn-devsec.com`, ni faire un envoi réel. Pour des essais réels depuis une session, il faut ajouter ces hôtes aux domaines autorisés de l'environnement (menu de l'environnement cloud, *Edit* → *Network access*).

**Les étapes exactes, pour Harun.** Les valeurs DNS exactes sont celles qu'affiche Resend pour le domaine : je n'ai pas pu relire leur documentation d'ici.

1. Créer un compte sur resend.com.
2. **Domains → Add domain** : `amn-devsec.com`. Resend affiche 3 enregistrements, à recopier chez l'hébergeur DNS du domaine :
   - un **MX** et un **TXT (SPF)** sur le sous-domaine de retour indiqué (de la forme `send.amn-devsec.com`) ;
   - un **TXT (DKIM)** sur `resend._domainkey.amn-devsec.com`.
3. Ajouter aussi un **DMARC**, recommandé : TXT `_dmarc.amn-devsec.com` = `v=DMARC1; p=none; rua=mailto:<adresse d'AMN>`.
4. Attendre l'état « Verified ».
5. **API Keys → Create** : permission « Sending access », limitée au domaine.
6. Sur Render, service amn-api, **Environment** :
   - `RESEND_API_KEY` = la clé ;
   - `EMAIL_FROM` = `AMN <bonjour@amn-devsec.com>` (une adresse du domaine vérifié) ;
   - `COURRIER_SECRET` = 32 caractères aléatoires (signe les liens de désabonnement) ;
   - `COURRIER_MENTION_LEGALE` = la mention légale réelle d'AMN DevSec ;
   - `APP_BUSINESS_PUBLIC_URL` = l'adresse de l'application des clientes. **Sans elle, aucun lien d'invitation ne peut partir** (`sans_adresse_app`).
7. Déployer. Le journal de démarrage doit dire `[courrier] en ligne, expéditeur …`.

---

## 4. Encaissement automatique

### 4.1 Ce qui est fait (patch 0003)

Rien n'était amorcé dans le produit : aucune trace de Stripe, Paddle, Mollie ou autre. J'ai donc intégré Stripe, sans SDK : l'API Stripe se parle en formulaire HTTP, comme le fait déjà Resend.

**Comment les paiements arrivent.**
- **Webhook** `POST /v1/paiements/stripe/webhook`, monté *avant* le parseur JSON.
- La signature se vérifie en HMAC-SHA256 sur le corps **brut**, avec une tolérance de 5 minutes, une comparaison à temps constant et plusieurs `v1` acceptées (rotation du secret).
- Un événement non signé, périmé ou modifié ne fait **rien** (testé).

**Événements traduits.**

| Événement Stripe | Effet |
|---|---|
| `invoice.paid` | Cliente à jour ; si elle était en impayé, réouverture automatique des modules |
| `invoice.payment_failed` | Impayé, puis la mécanique existante **inchangée** : préavis à la ronde suivante, 7 jours de grâce, pause des modules souscrits |
| `checkout.session.completed` | La cliente est reliée à son client Stripe |
| `customer.subscription.deleted` | **Remonté à Harun**, rien n'est fermé : une résiliation se traite avec la cliente |

**Garanties testées.** Chacune a été contre-éprouvée : on casse la protection, et le test échoue.
- **Idempotence** : chaque événement est réservé atomiquement avant traitement. Cinq livraisons simultanées du même événement donnent un seul traitement.
- **Reprise** : si le traitement échoue en cours de route, la réservation est rendue et la relance de Stripe refait le travail.
- **Ordre** : un échec plus ancien que le dernier paiement, arrivé en retard, ne remet pas la cliente en impayé.
- **Grâce** : un nouvel échec de prélèvement pendant la grâce ne la remet **pas** à zéro.
- **Sans configuration** : 503 « hors ligne », et le flux manuel (`/v1/garde/comptes/:id/paiement`) reste.

**Libre-service.**
- La propriétaire ou une administratrice souscrit depuis **Paramètres → Mon abonnement** (page Stripe), puis gère carte, factures et résiliation dans le portail Stripe.
- La carte ne passe jamais par AMN.
- La phrase « rien n'est facturé automatiquement » ne s'affiche plus que tant que c'est vrai.

**Côté Harun.** Le bureau des Comptes a un bouton « Page Stripe » qui copie la page de paiement d'une cliente.

### 4.2 Ce que Harun doit créer, avec les étapes exactes

Il faut un **compte Stripe au nom d'AMN DevSec** (société, IBAN de versement). Ni le compte ni les clés ne peuvent être créés d'ici. Le connecteur Stripe de cette session demande aussi une autorisation, à faire dans les réglages des connecteurs claude.ai.

1. Stripe, **en mode test** d'abord : **Product catalog → Add product**.
   - Créer « AMN Business Standard » et « AMN Business Premium », chacun avec un **prix récurrent mensuel en EUR**.
   - Noter les deux identifiants `price_…`.
   - **À décider** : un forfait par formule, ou un prix par place (`STRIPE_QUANTITE=places` multiplie par le nombre de places).
2. **Developers → Webhooks → Add endpoint** :
   - URL : `https://<adresse d'amn-api>/v1/paiements/stripe/webhook` ;
   - événements : `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted` ;
   - copier le **signing secret** `whsec_…`.
3. **Settings → Billing → Customer portal** : activer la mise à jour du moyen de paiement, l'historique des factures et la résiliation.
4. **Settings → Billing → Subscriptions and emails**, relances automatiques :
   - garder les nouvelles tentatives de Stripe ;
   - si toutes échouent, **laisser l'abonnement impayé** (ne pas l'annuler). C'est la grâce d'AMN qui met en pause, et elle est réversible.
5. Moyens de paiement : carte, et prélèvement SEPA si voulu.
6. Sur Render, service amn-api :
   - `STRIPE_SECRET_KEY=sk_test_…` ;
   - `STRIPE_WEBHOOK_SECRET=whsec_…` ;
   - `STRIPE_PRIX_STANDARD=price_…` ;
   - `STRIPE_PRIX_PREMIUM=price_…` ;
   - `STRIPE_QUANTITE=forfait` ou `places`.
7. Déployer. Le journal doit dire `[paiements] Stripe en ligne (mode test)`.
8. Essai de bout en bout, en mode test :
   - souscrire avec la carte `4242 4242 4242 4242` : le journal de la Garde dit « a souscrit », puis « paiement reçu » ;
   - la carte d'échec de Stripe (`4000 0000 0000 0341`) doit faire passer la cliente en impayé, puis le préavis part à la ronde suivante.
9. Passer en **mode réel** : clés `sk_live_…`, nouveaux prix, **nouveau webhook** avec son propre secret.

---

## 5. Garde : journal et attribution — corrigés

**Journal.** Une situation déjà remontée, retrouvée telle quelle, n'écrit plus de ligne à chaque passage. Seul un changement de **gravité** s'écrit. Le compteur de la remontée continue d'avancer, ce qui garde la trace du passage sans bruit.

**Attribution.**
- Nouvelle colonne `sites.client_org_id` : « le site de quelle cliente ». Elle **n'ouvre aucun accès** : le site, sa clé, ses événements et ses incidents restent à AMN, et l'isolation ne change pas (testé : la cliente ne voit toujours pas le site).
- La Garde y range son travail : pannes, certificats (retrouvés par l'hôte), incidents non pris.
- La détection de **campagnes** compte enfin les clientes touchées. Avant, avec tous les sites sous AMN, elle ne pouvait jamais voir plus d'une organisation, d'où ses 24 rondes à vide sur 24.
- Seule AMN DevSec pose le rattachement (403 sinon), et jamais vers elle-même.
- Sur le poste interne, chaque ligne de la liste des Sites a un bouton pour choisir la cliente.

**Sites existants.** `scripts/rattacher-sites.mjs` (amn-api) propose les rattachements par le nom et n'applique qu'avec `--appliquer`, et seulement les correspondances **uniques**. Sur le bac à sable : 8 sites rattachés sur 9. `syraagensy.com` reste à faire à la main, car deux organisations portent ce nom.

**Mesuré sur le bac à sable** (`docs/mesures/verite-garde-apres-partie4-2026-09-25.txt`, fenêtre courte d'environ 1 h) :

| | Avant (24/09, sur 24 h) | Après (25/09) |
|---|---|---|
| Lignes de journal | 987 pour AMN DevSec, environ 41 par heure | **13 en 1 h** |
| « remontee-maj » répétées | 945 par jour | **0** |
| Travail sur un site client | rangé sous AMN DevSec | rangé chez **Cabinet Arnoux** (panne de `rdv.arnoux-avocats.fr`) |

La fenêtre est courte : un relevé sur 24 h après déploiement confirmera. Qu'une cliente sans incident n'ait **aucune** ligne est désormais normal, puisque le journal ne dit plus que ce qui change. Le futur rapport de Garde par cliente devra donc lire les rondes et les compteurs, pas seulement le journal.

---

## 6. Garde-fous

Relancés le 25/09 sur les bundles finaux des deux éditions (API de bac à sable :8791, code final).

| Garde-fou | Business | Interne |
|---|---|---|
| check:coquille, check:signal, check:mobile, check:xss | vert | vert |
| check:contraste | vert (118 écrans, 24 871 textes) | vert (159 écrans, 37 529 textes) |
| check:support | — | vert (110 écrans de la cliente) |
| check:veille-cliente | vert | — |
| check:business (aucune trace interne dans le bundle cliente) | vert | — |
| check:langue, encres, modules, roles, sync, cinquante, fusion-sync, accent, money, calc, pages, resilience, accueils, appels, relances | vert | vert |
| tsc | 0 erreur | 0 erreur |
| lint | 0 erreur | 0 erreur |
| amn-api `npm test` | 519 / 519 | |
| amn-api `check:emails` | 18 rendus conformes | |

**Un défaut trouvé par la matrice, corrigé.** `check:roles` a relevé que « Mon abonnement » testait « propriétaire ou administratrice » à la main. La section passe maintenant par `isAdminRole`, la seule source de vérité des rôles, et le contrôle est relancé au vert.

---

## 7. Ce qu'Harun doit faire, dans l'ordre

1. **Joindre le paquet** `AMN Desktop - Arrivee cliente.dc.html` (tour 43) à la session. Il n'est pas arrivé, et sans lui le laissez-passer, les illustrations et l'e-mail de marque ne peuvent pas être construits fidèlement.
2. **Relire et appliquer** la série `docs/patchs/amn-api-2026-09-25/` sur amn-api (`git am`), puis `npm test` : 519 tests attendus. Trois zones sensibles sont touchées :
   - une nouvelle route d'authentification publique (lecture d'invitation) ;
   - l'encaissement ;
   - l'envoi de courriels.
3. **Déployer** sur Render. Sans clé, rien ne change de comportement : tout part en « hors ligne ».
4. **Rattacher les sites existants** :
   ```
   AMN_API_URL=… AMN_OPERATEUR=… node scripts/rattacher-sites.mjs
   ```
   Relire les propositions, puis relancer avec `--appliquer`. Finir les cas ambigus depuis la liste des Sites.
5. **Resend** : domaine, DNS, clé, variables (§3), dont `APP_BUSINESS_PUBLIC_URL` et la **mention légale réelle**.
6. **Tester le courrier** :
   - « Mot de passe oublié » avec sa propre adresse ;
   - créer une organisation d'essai avec sa propre adresse : l'invitation doit arriver et la page d'activation afficher « valable » ;
   - vérifier le rendu dans Gmail et dans Outlook ou Apple Mail.
7. **Stripe en mode test** : produits, prix, webhook, portail, variables, essai de bout en bout (§4.2).
8. **Décider** : forfait ou prix par place, et les montants.
9. **Passer Stripe en mode réel.**
10. Après 24 h en production, relancer `npm run verite:garde` et comparer avec le relevé du 24/09.

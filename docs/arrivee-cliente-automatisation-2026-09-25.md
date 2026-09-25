# Arrivée cliente et automatisation prioritaire

Rapport du 25 septembre 2026, mis à jour après la livraison du paquet Claude Design (tour 43).

- **Poste** : branche `claude/first-pr-github-setup-ltpqqo`.
- **Serveur** : série `docs/patchs/amn-api-2026-09-25/`, **neuf patchs** sur `355cde7`, aussi sur la branche locale `claude/arrivee-cliente` d'amn-api (30 fichiers, +2 007 lignes). Vérifié : appliquée par `git am` sur `355cde7`, la série redonne exactement l'arbre testé.
- **Environnement** : tout a été mesuré en bac à sable. Aucune donnée de production n'a été lue ni écrite, aucun courriel réel n'est parti, aucun paiement réel n'a été créé.

---

## 0. L'état réel, en une page

| Partie | Code | En production aujourd'hui |
|---|---|---|
| **1.1** Lire l'invitation avant l'activation | **Fait et testé**, au contrat du cahier (`/lookup`, `/relance`, `/signalement`). Protection anti-sondage intacte. | Non : patchs à déployer |
| **1.2** Laissez-passer et talon ambre par état | **Fait** : page d'activation 43b–43e, quatre états plus les états d'erreur, vérifiée de bout en bout contre l'API | Non : suit le déploiement du poste et du serveur |
| **1.3** Quatre illustrations tirées des données réelles | **Fait** : 43f, trois pages puis la porte. Deux illustrations sont générées depuis le catalogue et les profils. | Oui, dès la prochaine version du poste |
| **1.4** Données de démonstration retirées, mention légale | **Fait** : plus aucune valeur du cahier dans le produit. La mention légale est un réglage, **vide** tant qu'Harun ne l'a pas fournie (§1.4). | La mention attend la vraie information légale |
| **2** Courrier automatique | **Fait et testé** : invitation de marque, mot de passe oublié, relance de facture | **Non** : patchs à déployer, clé Resend et domaine à configurer (§3) |
| **3** Encaissement automatique | **Fait et testé** : Stripe, webhook signé (12 tests, 4 contre-épreuves) | **Non** : compte Stripe, prix et webhook à créer (§4) |
| **4** Journal de la Garde et attribution des sites | **Corrigé et mesuré** | Non : patch à déployer, puis `scripts/rattacher-sites.mjs` |

**Garde-fous.** Verts sur les deux éditions. amn-api passe 523 tests sur 523 (détail §6). La matrice a aussi mis au jour deux rouges **antérieurs à ce chantier** (le Hall), corrigés au passage.

**Logique déjà validée.** Rien n'a été modifié dans la fusion de synchro validée le 24 septembre (`src/lib/fusionSync.ts`, `SyncContext.tsx`) : `check:fusion-sync` et `check:sync` sont verts.

**Ce qui n'a pas pu être prouvé d'ici.** Le rendu de l'e-mail dans de **vrais** clients mail (Gmail, Outlook, Apple Mail). L'environnement ne joint ni un service d'envoi ni une boîte. J'ai rendu le HTML réel du serveur dans Chromium, dans cinq conditions qui imitent ces clients (§1.3). La vérification dans deux vrais clients reste à faire par Harun, et c'est l'étape 6 du §7.

---

## 1. Arrivée cliente

Captures : `docs/captures/arrivee-2026-09-25/`.

### 1.1 Lire l'invitation avant l'activation — au contrat du cahier (patchs 0001, 0006)

Trois routes publiques, toutes en `POST` avec le jeton **dans le corps**, jamais dans l'URL :

| Route | Rend |
|---|---|
| `/v1/auth/invitations/lookup` | `statut` (`valide`, `expiree`, `utilisee`, `suspendue`), `nature`, organisation, qui invite (prénom et libellé, jamais une adresse), adresse invitée, rôle, dates d'émission, d'expiration et d'usage, et si un mot de passe est à choisir |
| `/v1/auth/invitations/relance` | Lien expiré seulement : prévient la personne qui a invité |
| `/v1/auth/invitations/signalement` | Lien déjà utilisé seulement : prévient la personne qui a invité |

**La protection anti-sondage n'est pas affaiblie.**
1. **Même frein qu'à l'acceptation.** Les quatre routes (lookup, relance, signalement, accept) partagent **un seul seau** par adresse IP : 20 échecs par 15 min, puis 429. Alterner les routes ne multiplie pas les essais (testé).
2. **Une seule réponse pour tout ce qui n'est pas un vrai jeton.** Jeton mal formé, inconnu ou absent : le même 404 `invitation_introuvable`, identique octet pour octet, compté comme un échec. Le format est contrôlé avant toute lecture (43 caractères base64url).
3. **L'entropie.** Un jeton fait 256 bits. Les états distincts ne se voient qu'avec un vrai lien.
4. `Cache-Control: no-store`. Aucun identifiant interne n'est rendu.
5. Relance et signalement : **une fois par lien et par 24 h** (table `invitation_demandes`), et 409 si l'état ne s'y prête pas.

**Où va la demande.**
- Invitation ouverte par AMN : une demande dans la file d'assistance d'Harun, avec la même alerte que les autres demandes.
- Invitation d'une collègue : une annonce dans l'espace de l'invitante, et un courriel `demande_invitation` si le courrier est en ligne.

**Écart assumé.** L'adresse invitée est rendue **en clair**, comme le dessine le cahier. Ma première version la masquait. Le risque est nul pour un tiers : il faut détenir le vrai lien, qui a été envoyé à cette adresse même.

Tests : `test/invitation-lookup.test.js` (patch 0006).

### 1.2 Le laissez-passer et ses états (43b–43e)

`src/screens/InvitationScreen.tsx`, réécrit d'après le cahier.
- Une barre de 64 px, puis deux colonnes (420 et 380 px) qui s'empilent sous 900 px.
- La carte est à gauche, avec un **talon ambre** qui change avec l'état (un seul objet ambre, `data-signal-groupe="talon"`).
- Tant que la lecture n'a pas répondu, une carte vide (après 300 ms, pour éviter un clignotement).

| État | Talon | Action | Captures (1280 et 390 px) |
|---|---|---|---|
| Valable (43b) | « Valable jusqu'au … », décompte | Choisir un mot de passe. Le bouton reste inactif tant que le mot de passe est trop court. Puis « Activé à l'instant ». | `activation-43b-valable-*`, `-mot-de-passe-trop-court`, `-pret`, `-reussite` |
| Expiré (43c) | « Expiré le … » | « Demander un nouveau lien » → confirmation | `activation-43c-expire-*`, `-demande-envoyee` |
| Déjà utilisé (43d) | « Utilisé le … » | Se connecter, ou « Ce n'était pas moi » → signalement | `activation-43d-deja-utilise-*`, `-signalement-envoye` |
| Incomplet (43e) | — | Recoller le code **ou** le lien complet. Le jeton est aussitôt retiré de l'adresse. | `activation-43e-incomplet-*` |

Sont aussi traités : suspendu, freiné (429), serveur injoignable.

Vérifié **de bout en bout** contre l'API du bac à sable :
- l'activation ouvre bien la session ;
- la relance et le signalement arrivent dans la file d'Harun (« Nouveau lien d'activation demandé — … », « Signalement : … ») ;
- une seconde demande dans les 24 h ne crée rien.

### 1.3 L'e-mail de marque (43a) (patch 0007)

- Le gabarit du paquet est repris **tel quel** : `src/lib/modeles/invitation.template.{html,txt}`. Seules les valeurs sont injectées, toutes échappées.
- La typographie française (espaces fines) s'applique au texte, jamais aux adresses ni aux liens.
- Deux cas : **AMN ouvre l'espace** (« Harun, de l'équipe AMN ») et **une collègue invite** (« Prénom vous invite… »).
- Le nom du produit vient de l'organisation (`productNameForOrg`), comme partout sur le serveur, qui sert les deux éditions.
- Les deux logos (encre et blanc, @2x) sont servis par l'application elle-même (`public/email/`), **en https**, depuis `APP_BUSINESS_PUBLIC_URL`. `check:emails` refuse toute autre image.
- Le message à copier de l'Atelier est désormais **la partie texte du même gabarit**, mot pour mot.

**Rendus** (HTML réel produit par le serveur, dans Chromium) :

| Condition | Capture | Ce qu'elle imite |
|---|---|---|
| Clair, 600 px | `email-43a-clair-600.png` | Gmail, Outlook web |
| Sombre | `email-43a-sombre-600.png` | Apple Mail en mode sombre (`prefers-color-scheme`) |
| Images bloquées | `email-43a-images-bloquees-600.png` | Outlook par défaut : le texte de repli du logo tient |
| Téléphone, 375 px | `email-43a-telephone-375.png` | Mail iOS, Gmail mobile |
| Cas « collègue » | `email-43a-equipe-600.png` | Le second cas du cahier |

**Ce n'est pas un rendu dans deux vrais clients mail**, et je ne le présente pas comme tel. Outlook pour Windows (moteur Word) en particulier ne se simule pas dans un navigateur. Le gabarit du paquet est construit pour lui (tables, `mso-line-height-rule`), mais seul un envoi réel le prouvera (§7, étape 6).

### 1.4 Données de démonstration et mention légale

- **Retirées du produit** : Studio Lumen, Nadia, Mohamed, `app.amn.fr`. Toutes les valeurs viennent de l'invitation réelle : organisation, qui invite, adresse, rôle, dates (fuseau Europe/Paris) et lien construit sur `APP_BUSINESS_PUBLIC_URL`. Il ne reste d'exemples que dans les jeux d'essai des tests et de `check:emails`, qui ne partent jamais.
- **Mention légale.** Les dépôts ne contiennent **aucune information légale réelle d'AMN DevSec** : ni raison sociale, ni forme, ni SIREN, ni adresse. Je n'en ai pas inventé : une fausse mention légale dans un courriel commercial serait pire qu'aucune. Elle se règle dans `COURRIER_MENTION_LEGALE`. Vide, la ligne disparaît proprement du pied (testé). **À fournir par Harun** (§7).

### 1.5 La présentation de première connexion (43f)

Édition cliente : trois pages, puis la porte « Qui êtes-vous ? » dans la même feuille.
- Clavier : ← → pour naviguer, Échap pour passer ; un clic dans la moitié droite avance.
- La visite guidée qui suit ne redit pas « Bienvenue ».
- **Paramètres › Guide › Revoir la présentation** la rejoue.
- L'édition interne garde sa présentation.

**Les quatre illustrations**, chacune monochrome avec un seul ambre (`illustration-0{1,2,3,4}-*.png`) :

| | Source | Mesuré dans le bundle cliente |
|---|---|---|
| 01 Les familles | **Générée** depuis `NAV_SECTIONS` : une tour par famille, à sa taille réelle ; l'ambre dans « Clients & revenus » | `data-familles="16,14,6,9,17,9,6,5,9,5,8,7,6"` : 13 familles, 117 modules |
| 02 Ce qui compte | SVG du paquet (une règle, pas une donnée), encres converties en jetons | — |
| 03 Vos données | SVG du paquet, encres converties en jetons | — |
| 04 Le point de départ | **Générée** depuis `PROFILS[].epingles` : une branche par profil, l'Accueil en premier | `data-epingles="7,6,7,7"` |

Si une famille change de taille, l'illustration 01 change avec elle, sans redessin.

Parcours vérifié avec un compte **réellement créé et activé** dans le bac à sable (`camille.arrivee@exemple.test`) :
- première connexion → page 1 « Bienvenue, Camille · 1 / 3 » → pages 2 et 3 → la porte illustrée (`presentation-43f-*`, à 1280 et 390 px) ;
- choisir un profil lance la visite à « Votre Accueil », sans « Bienvenue » ;
- « Revoir la présentation » la rejoue et se ferme sans rouvrir la porte.

**Le prénom.** Le serveur ne garde pas de nom : le poste le déduit de l'adresse. Une adresse de boîte partagée (`contact@`, `bonjour@`…) ou avec des chiffres salue donc **sans** prénom, plutôt que « Bienvenue, Contact ».

### 1.6 Écarts au cahier, tous volontaires

1. Le gris `#6b6b68` du paquet, refusé par `check:encres`, devient le gris atténué du système.
2. Les formulations genrées du paquet (« il suspend », « est prévenu ») deviennent neutres.
3. E-mail sur téléphone : la colonne des valeurs de la carte se décalait ; ajout d'un `display:block` sur `.val`. C'est le seul changement au gabarit.
4. Illustration 01 : **117** modules et non les 116 du paquet, qui datait d'avant le dernier ajout. C'est l'effet même d'une illustration générée.
5. Route renommée : ma `/lire` provisoire devient la `/lookup` du cahier, avec son contrat 404.
6. Adresse invitée en clair (§1.1).
7. Nouvelle nature de courriel `demande_invitation`, pour prévenir une invitante. Le cahier ne la dessine pas : elle reprend l'enveloppe sobre.
8. **Limite connue, antérieure** : un compte qui existe déjà et qu'on invite dans une seconde organisation (« appartenance ») voit « Connectez-vous ». Le poste ne sait pas encore accepter une appartenance après connexion. C'était déjà le cas avant ce chantier.
9. Le gabarit dit « l'espace de travail de {organisation} ». Pour une organisation dont le nom commence par « Le » ou « La », cela donne « de Le Jardin ». C'est la phrase du paquet ; à reprendre dans le cahier si l'on veut l'élision.

---

## 2. Courrier automatique — ce qui est branché

Le service Resend existait déjà. Ce chantier y branche trois flux :

| Flux | Ce qui part | Garde-fous |
|---|---|---|
| **Invitation** d'une nouvelle cliente : création dans l'Atelier, réémission, collègue invitée par une propriétaire | L'e-mail de marque du cahier 43a (§1.3). Objet « Votre espace X est prêt » ou « Prénom vous invite dans l'espace X ». Expéditeur affiché « Prénom via AMN Desktop », à l'adresse d'AMN. **Jamais de mot de passe.** | La réponse dit à l'Atelier si le courriel est parti, ou pourquoi pas : `sans_cle`, `sans_adresse_app`, `non_demande`, `echec`. Le message à copier reste en secours. En mode mot de passe provisoire, rien ne part. Une appartenance (compte existant) ne reçoit pas le texte d'activation. |
| **Mot de passe oublié** | Lien valable 60 min, à usage unique | Déjà complet avant ce chantier : même réponse que l'adresse existe ou non. Il n'attend que la clé. |
| **Relance de facture** (côté cliente) | Le texte gradué du module Relances, envoyé au client de la facture, « Fleurs de Lune via AMN », réponse à la personne qui relance. La relance se note seule. | **Le destinataire n'est jamais libre** : le serveur le relit dans la facture de l'organisation, et une adresse glissée dans la requête est ignorée (testé). La facture doit être émise et échue. Une relance par facture et par 20 h, 40 par jour et par organisation. Jamais en mode support. Le domaine d'expédition reste celui d'AMN, seul le nom affiché change. |

**Côté poste.**
- L'Atelier a un champ « qui invite », retenu sur ce poste.
- Les Relances ont un bouton « Envoyer à … ». Il n'apparaît que si le courrier est en ligne et que la facture porte une adresse, et il devient alors la seule action ambre.

---

## 3. Courrier — ce qui manque côté infrastructure

**Pas en production aujourd'hui**, pour trois raisons :

1. **Le code n'est pas déployé.** amn-api n'est pas dans le périmètre GitHub de cette session : il faut appliquer `docs/patchs/amn-api-2026-09-25/` puis déployer sur Render.
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

Relancés le 25/09 sur les bundles finaux des deux éditions (API de bac à sable :8791, code final, après tous les correctifs).

| Garde-fou | Cliente | Interne |
|---|---|---|
| check:coquille, check:signal, check:mobile, check:xss | vert | vert |
| check:contraste | vert (118 écrans, 24 935 textes) | vert (159 écrans, 40 425 textes) |
| check:support | — | vert (entrée chez une cliente, 17 écrans parcourus) |
| check:veille-cliente | vert | — |
| check:business (aucune trace interne dans le bundle cliente) | vert | — |
| Les 40 contrôles statiques (`check:langue`, `encres`, `naming`, `supervision`, `persistence`, `roles`, `modules`, `sync`, `fusion-sync`, `cinquante`, `accent`, `money`, `calc`, `pages`, `resilience`…) | vert | vert |
| tsc | 0 erreur | |
| lint | 0 erreur (85 avertissements, déjà là) | |
| amn-api `npm test` | 523 / 523 | |
| amn-api `check:emails` | 20 rendus conformes (10 natures × FR/EN) | |

**Défauts trouvés par la matrice, et corrigés.**
- **`check:roles`** : « Mon abonnement » testait « propriétaire ou administratrice » à la main. La section passe maintenant par `isAdminRole`.
- **`check:naming`** : j'avais écrit « AMN Desktop » en dur à plusieurs endroits (e-mail, expéditeur, annonce, message à copier, page d'activation). Le serveur tire maintenant le nom de `productNameForOrg(orgId)`, et le poste de `CLIENT_PRODUCT_NAME` / `EDITION_PRODUCT_NAME` (patch 0009).
- **`check:supervision`** : la demande d'assistance créée par la relance et le signalement portait `kind: 'message'` en clair, que le contrôle lit comme une alerte. Elle passe par la constante `DEMANDE_MESSAGE` de `support.js`.
- **Antérieurs à ce chantier** (le Hall, chantier « Vie, couleur et dimension sociale »), corrigés au passage :
  - `hall.js` avait le même `kind: 'message'` (même correctif) ;
  - le module `hall` n'était pas déclaré dans `check:persistence` (il n'écrit rien en local, tout passe par l'API : déclaré tel quel) ;
  - `LexiqueSupervision.tsx` écrivait « AMN Business » en dur.

  Ces trois rouges existaient déjà sur la base, et mon précédent rapport les avait manqués.

---

## 7. Ce qu'Harun doit faire, dans l'ordre

1. **Relire et appliquer** la série `docs/patchs/amn-api-2026-09-25/` (neuf patchs) sur amn-api :
   ```
   git am docs/patchs/amn-api-2026-09-25/*.patch && npm test
   ```
   523 tests attendus. Trois zones sensibles sont touchées :
   - des routes d'authentification publiques : lecture, relance et signalement d'invitation (§1.1) ;
   - l'encaissement ;
   - l'envoi de courriels.
2. **Déployer** amn-api sur Render, puis publier une version du poste. Sans clé, rien ne change de comportement : le courrier et Stripe restent « hors ligne », et le message à copier reste le chemin.
3. **Fournir la mention légale réelle** d'AMN DevSec : raison sociale, forme, capital s'il y a lieu, RCS/SIREN, adresse du siège. Elle va dans `COURRIER_MENTION_LEGALE`. Je ne l'ai pas inventée.
4. **Rattacher les sites existants** :
   ```
   AMN_API_URL=… AMN_OPERATEUR=… node scripts/rattacher-sites.mjs
   ```
   Relire les propositions, relancer avec `--appliquer`, puis finir `syraagensy.com` depuis la liste des Sites.
5. **Resend** : domaine, DNS, clé et variables (§3). Parmi elles, **`APP_BUSINESS_PUBLIC_URL` en https**, car elle construit les liens et sert les deux logos de l'e-mail.
6. **Tester le courrier pour de vrai** :
   - « Mot de passe oublié » avec sa propre adresse ;
   - créer une organisation d'essai avec sa propre adresse. L'e-mail de marque doit arriver « Harun via AMN Desktop », et la page d'activation afficher le laissez-passer valable ;
   - **ouvrir cet e-mail dans deux vrais clients au moins** : Gmail (web et téléphone), et Outlook pour Windows ou Apple Mail. Regarder les logos, les images bloquées et le mode sombre, et comparer aux captures `email-43a-*` ;
   - laisser expirer (ou réémettre) le lien, puis essayer « Demander un nouveau lien » : la demande doit arriver dans la file d'assistance.
7. **Stripe en mode test** : produits, prix, webhook, portail, variables, essai de bout en bout (§4.2).
8. **Décider** : forfait ou prix par place, et les montants.
9. **Passer Stripe en mode réel.**
10. **Première vraie cliente** : vérifier qu'à sa première connexion la présentation s'ouvre (« Bienvenue, Prénom »), puis la porte.
11. Après 24 h en production, relancer `npm run verite:garde` et comparer avec le relevé du 24/09.

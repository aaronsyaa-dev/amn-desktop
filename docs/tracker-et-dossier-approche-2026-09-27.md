# Tracker (B6) et configuration d'un dossier client (D1) — approche à valider

Deux points du lot « Bugs et points de design » demandent une refonte
structurelle. Conformément à la règle du lot, ce document décrit l'approche
**avant** implémentation. Ce qui n'était pas structurel est déjà livré (voir
« Déjà fait »).

## B6 — Tracker sur un site tiers

### Diagnostic (vérifié sur le bac à sable)

| # | Blocage | Effet | Statut |
|---|---------|-------|--------|
| 1 | `/v1/events` ne lisait que le JSON. Or le script navigateur (mode 3) envoie par `navigator.sendBeacon`, donc en `text/plain`. | 400 à chaque envoi : un site statique ne remontait **jamais** rien. | Corrigé (amn-api 4789cb6, test ajouté). |
| 2 | La clé du site est acceptée depuis n'importe quelle origine. En mode 3, cette clé est publique (dans le HTML). | N'importe qui peut injecter des événements au nom du site (faux incidents, bruit). | À décider. |
| 3 | Installation par `npm install github:aaronsyaa-dev/security-monitor` : paquet absent de npm. Si le dépôt est privé, l'hébergeur de la cliente ne peut pas l'installer. En mode 3, le fichier est à recopier à la main depuis GitHub. | Installation fragile, versions qui dérivent, pas de mise à jour. | À décider. |
| 4 | L'API ne sert aucun script hébergé : pas d'installation « une ligne ». | Chaque intégration est artisanale. | À décider. |
| 5 | Aucune vérification d'installation : rien ne dit « premier signal reçu ». Le silence d'un site est ambigu (mal installé ? pas de trafic ?). | Faux « traceur silencieux », ou vraie panne non vue. | À décider. |
| 6 | CORS : `*` par défaut en local ; la valeur de `CORS_ORIGIN` en production n'a pas pu être lue (Render hors d'accès). | Si elle est restrictive, les navigateurs des sites tiers sont refusés. | À vérifier par Harun. |

Le code du dépôt `security-monitor` n'a pas pu être relu dans cette session
(accès refusé) : le diagnostic porte sur l'API qui reçoit ses événements.

### Approche proposée

1. **Deux clés par site.**
   - Clé publique d'ingestion (mode 3, navigateur) : liée à une liste de
     domaines autorisés. L'API compare `Origin` / `Referer` à cette liste et
     refuse le reste. Débit limité par site.
   - Clé secrète serveur (modes 1 et 2) : jamais dans le HTML ; en option,
     événements signés HMAC (horodatage + corps) pour refuser les rejeux.
   - Migration : les clés actuelles restent valides en « serveur » ; la clé
     publique est générée à la volée, domaine = domaine déclaré du site.
2. **Script hébergé par l'API**, versionné : `GET /v1/t.js?site=<id public>`.
   L'installation devient une ligne `<script>` à coller ; la mise à jour se
   fait côté AMN.
3. **Vérification d'installation** dans l'écran du site : « en attente du
   premier signal » → « reçu il y a N min », avec un bouton « tester
   maintenant » qui envoie un événement de contrôle.
4. **Attente de signal par mode** : un site statique sans trafic n'est pas
   « silencieux » ; seuls les modes serveur envoient un battement régulier.
5. **Paquet** publié sur npm (ou script autonome téléchargeable depuis AMN)
   pour les modes 1 et 2.

Décisions attendues de Harun : (a) accord sur les deux clés et la liaison
aux domaines ; (b) publier le paquet sur npm ou non ; (c) valeur de
`CORS_ORIGIN` en production.

## D1 — Configuration d'un dossier client

### Déjà fait (écran seul, sans changement d'API)

- Les sections de modules se **replient** ; chaque en-tête affiche
  « ouverts / total ». Repliées d'office : on lit la liste des sections avant
  les tuiles.
- **Recherche rapide** (nom ou besoin : « facture » trouve Facturation,
  Relances, Abonnements…) ; une recherche déplie ce qui correspond.

### Reste : bascules groupées par section (structurel)

L'API ne connaît qu'un module à la fois
(`PUT /v1/admin/organizations/:id/modules/:key`). Ouvrir une section de 17
modules = 17 appels et 17 lignes de journal, et un échec au milieu laisse un
état à moitié appliqué.

Proposition : `PUT /v1/admin/organizations/:id/modules` avec
`{ ouvrir: [...], fermer: [...] }`, appliqué en **une transaction**, **une**
ligne de journal (« section Finance ouverte : 9 modules »), modules
« toujours ouverts » ignorés. Côté écran : « Tout ouvrir / Tout fermer » dans
l'en-tête de chaque section, avec confirmation pour la fermeture.

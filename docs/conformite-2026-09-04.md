# Conformité — inventaire technique à limites dites (Bloc 8, 4 septembre 2026)

## Ce que ce document est, et n'est pas

**Je ne suis pas juriste.** Ce document est un inventaire technique, écrit depuis le code des deux dépôts (`amn-desktop`, `amn-api`) tel qu'il est ce soir. Il dit ce que l'application fait réellement des données, ce qui est en place et prouvé par un test ou une sonde, et ce qui manque. Il ne dit **jamais** qu'une chose est « légale » ou « conforme au RGPD » : cette appréciation demande une relecture humaine par un professionnel du droit, avec les faits ci-dessous sous les yeux.

Aucun texte juridique engageant n'a été inventé. Les seuls textes à portée légale présents dans le produit sont des **gabarits marqués** — ils sont listés en fin de document, avec leur emplacement, pour qu'Aaron les remplace. Les mentions `[À COMPLÉTER — AARON]` sont des faits que le code ne connaît pas (hébergement, contrats) ; les mentions `[À VALIDER — JURISTE]` sont des points où une lecture juridique décide.

## 1. Les rôles, tels que le produit les suppose

Le produit est construit autour de trois cercles, et c'est un fait technique, pas une qualification juridique :

- **AMN DevSec** (organisation fondatrice, plan `internal`) administre le parc : crée les organisations clientes, ouvre et ferme des modules, entre en session de support chez une cliente. Chacun de ces gestes est journalisé (`org_access_log`).
- **Chaque organisation cliente** tient son espace : ses comptes, ses données de modules (fiches clients, factures, notes, agenda…), et décide seule des modules qu'elle ferme à son prestataire (verrous de consentement, Bloc 4).
- **Les clients des clientes** (le public) n'ont pas de compte ; ils déposent des données par les pages publiques (prise de rendez-vous, mini-page, formulaire de commande, lien d'appel anonyme) et leurs visites sur le site de la cliente sont observées par le tracker de supervision.

`[À VALIDER — JURISTE]` : la qualification de ces rôles (responsable de traitement, sous-traitant, sous-traitant ultérieur) pour chaque flux, et ce qu'elle impose contractuellement (accord de sous-traitance entre AMN DevSec et chaque cliente, information des personnes par la cliente).

## 2. Inventaire des données — ce que le code stocke, où, combien de temps

| Donnée | Table / lieu | Qui y accède | Durée de conservation dans le code | Constat |
|--------|--------------|--------------|-------------------------------------|---------|
| Comptes : adresse email, rôle, statut, empreinte de mot de passe (scrypt N=16384) | `users` | l'organisation, AMN en support | jusqu'à suppression du compte ou de l'organisation | aucune purge de comptes inactifs |
| Sessions : empreinte de jeton, dates | `sessions` | — | 30 jours (`SESSION_TTL_MS`), révocables depuis l'écran des sessions | les lignes expirées ne sont pas effacées, seulement refusées |
| Double authentification : secret TOTP ; défis avec **adresse IP** | `users`, `mfa_challenges` | — | défi : 5 minutes, purgé (`purgeExpiredMfaChallenges`) | conforme à l'intention ; l'IP ne vit que le temps du défi |
| Freinage des connexions : compteurs par compte et **par adresse IP** | `login_attempts` (clé `ip:<adresse>`) | — | effacé au succès de la connexion ; **jamais sinon** | une IP d'attaquant (ou d'un visiteur qui s'est trompé) reste en base sans limite `[À VALIDER — JURISTE]` |
| Journal d'accès : email de l'acteur, action, détail, date | `org_access_log` | la cliente (écran « Journal »), AMN | **illimitée** | aucune IP ; conservation à définir |
| Données des modules : fiches clients, devis, factures, commandes, notes, agenda, tâches, messages, rapports, médias… (noms, emails, téléphones, adresses des clients de la cliente) | `shared_records` (JSON par collection) | l'organisation ; AMN en support, sauf modules verrouillés | jusqu'à suppression ; une suppression laisse une **tombe** (`deleted = true`) conservée pour la synchronisation | les tombes gardent le contenu supprimé ; l'export le dit (« marqué comme supprimé ») |
| Supervision : sites (nom, URL), **événements bruts du tracker** (`payload` JSON : ce que le site a observé, requêtes, connexions — adresses IP des visiteurs y compris, puisque les incidents désignent un « acteur »), incidents, escalades | `sites`, `events`, `incidents` | l'organisation, AMN | **illimitée** | c'est le point le plus lourd : des données de visiteurs du site de la cliente, sans durée |
| Scanner de sécurité : résultats de scans (lite/pro/elite) sur une URL saisie par l'opérateur | `scans` | AMN, la cliente concernée | illimitée | un scan actif (en-têtes, ports courants, injections sur paramètres existants) suppose l'accord du propriétaire du site `[À VALIDER — JURISTE]` |
| Notifications push : point de terminaison du navigateur + email | `push_subscriptions` | — | jusqu'à désabonnement | la charge utile est chiffrée de bout en bout (web-push, RFC 8291) ; contenu minimal (titre, corps, lien) |
| Préférences personnelles (barre allégée…) | `user_prefs` | la personne | jusqu'à suppression du compte | — |
| Invitations, liens de bienvenue : empreintes de jeton, email du créateur | `invitations`, `welcome_links` | — | 7 jours de validité ; lignes non purgées | — |
| Accès invité : minutes consommées par jour | `guest_usage` | — | illimitée | faible sensibilité |
| Liens d'appel anonymes | `call_links` | — | selon `amn-api/docs/APPEL-ANONYME.md` | l'inconnu qui appelle ne laisse pas de compte ; le média passe en pair à pair |
| Pages publiques : prise de rendez-vous (nom, email, téléphone, note), commandes du site, mini-page | écrites dans les collections de l'organisation (`appointments`, `orders`…) | l'organisation | comme les données de modules | **aucune information des personnes** n'est affichée sur ces pages (voir § 4) |
| Journaux de l'hébergeur (adresses IP des requêtes HTTP) | Render, Vercel/Netlify — hors du code | l'hébergeur, Aaron | selon l'hébergeur `[À COMPLÉTER — AARON]` | le code lui-même ne journalise ni IP ni email dans sa sortie |

Le code ne pose **aucun cookie** et n'embarque **aucun traceur tiers** (pas d'analytics, pas de Sentry) : le jeton de session vit dans `localStorage` du navigateur.

## 3. Ce qui est en place, et prouvé

Chaque ligne renvoie à la preuve (test, sonde ou garde), pas à une intention.

- **Isolation par organisation.** Une cliente ne lit, n'écrase ni n'efface rien chez une autre, même en connaissant l'identifiant (`amn-api/test/casser.test.js`, « droits »). Les notifications temps réel ne fuient pas entre organisations ni vers la Tour (`test/confidentialite-notifications.test.js`).
- **Consentement de la cliente sur le support.** Elle ferme un module à son prestataire ; la session de support est refusée dessus (403 `module_locked`), le geste est journalisé chez elle et visible d'AMN dans le dossier (`test/consentement-groupe.test.js`, Bloc 4). Le compte reste administrable (suspension, formule), la donnée non.
- **Session de support bornée et tracée.** Entrée et sortie journalisées (`enter`/`leave`), bandeau permanent « accès temporaire, inscrit à son journal », durée limitée (capture 21).
- **Journal d'accès lisible par la cliente** (`AccessLogScreen`, route `/v1/auth/access-log`, 32 actions déclarées dans `ACCESS_LOG_ACTIONS`, garde `check:journal`).
- **Export complet** : `GET /v1/auth/organization/export` rend comptes (sans empreintes), collections (tombes comprises et marquées), sites, incidents, suppressions, maintenances ; l'écran « Données » le déclenche et dit ce qu'il contient.
- **Effacement** : `DELETE /v1/admin/organizations/:id` détruit l'organisation en cascade (comptes, enregistrements, sites, journal). L'écran « Données » dit que l'effacement se demande à l'équipe et se fait à la main, et pourquoi.
- **Mots de passe** : scrypt (mémoire-dur), huit caractères au minimum, jamais journalisés ; **double authentification TOTP** disponible ; **freinage** progressif des essais (40 mots de passe faux → 429, mesuré) ; sessions révocables une à une.
- **Bornes d'entrée** : corps de requête 12 Mo, nom d'organisation 120, identifiant 200, étiquettes 40 × 20, préférences 8 Ko ; injection, HTML actif et emoji relus tels quels et rendus en texte (capture 16) ; 600 écritures par minute et par personne.
- **Politique d'utilisation acceptée avant la remise des accès** : le serveur refuse la révélation sans `policyAccepted: true` (`routes/welcome.js`). Le texte, lui, est un gabarit (§ 5).
- **Transport chiffré** par les hébergeurs (TLS Render, Vercel/Netlify) ; origine CORS configurable (`CORS_ORIGIN`).
- **Notifications push** chiffrées de bout en bout par web-push ; contenu réduit au titre, au corps et au lien.

## 4. Ce qui manque — constats techniques, sans qualification

1. **Aucune durée de conservation n'est définie ni appliquée**, hors défis MFA. Événements bruts du tracker (avec données de visiteurs), incidents, journal d'accès, compteurs de freinage par IP, sessions expirées, invitations périmées, tombes d'enregistrements : tout reste. Proposition technique, à faire trancher : une ronde de purge avec des durées réglables par table (par exemple événements bruts 90 jours, compteurs de freinage 24 heures après le dernier échec, sessions et invitations expirées 30 jours après expiration). `[À VALIDER — JURISTE]` pour les durées.
2. **L'acceptation de la politique n'est pas horodatée en base** : le serveur l'exige au moment de la révélation, mais aucune colonne ne garde qui a accepté quoi, quelle version, quand.
3. **Aucun écran de mentions légales, de politique de confidentialité ni de conditions d'utilisation** dans l'application, sur la page de connexion, ni sur les **pages publiques** (prise de rendez-vous, mini-page, commandes, page de statut, lien d'appel) — qui collectent pourtant nom, email et téléphone de personnes sans compte. Les textes n'existent pas ; les emplacements non plus. `[À COMPLÉTER — AARON]` pour les textes, `[À VALIDER — JURISTE]` pour leur contenu.
4. **Tracker sur les sites des clientes** : les observations brutes (dont les adresses des visiteurs) arrivent dans `events.payload` sans minimisation ni durée. La cliente qui installe le tracker doit pouvoir en informer ses visiteurs ; rien dans le produit ne l'y aide.
5. **Scanner** : l'opérateur saisit une URL ; rien ne vérifie qu'elle appartient bien à la cliente qui l'a demandé (pas de preuve de propriété, pas de trace d'accord). Un scan « pro » teste des injections sur les paramètres existants du site.
6. **En-têtes de sécurité HTTP** : le serveur ne pose ni `Strict-Transport-Security`, ni `Content-Security-Policy`, ni `X-Frame-Options`, ni `X-Content-Type-Options` (pas de `helmet`). Ce que Render et Vercel ajoutent d'eux-mêmes est `[À COMPLÉTER — AARON]`. Sans CSP, le jeton de session en `localStorage` reste exposé à toute injection de script — l'échappement des contenus par l'écran est aujourd'hui la seule défense (elle a tenu, capture 16).
7. **Sous-traitants et localisation** : Render (API et base Postgres), Vercel ou Netlify (application web), services push des navigateurs (Google, Apple, Mozilla — contenu chiffré), GitHub (code, jamais de données). Régions d'hébergement, sauvegardes de la base (fréquence, durée, plan Render), durée des journaux d'accès HTTP : `[À COMPLÉTER — AARON]`. Le code n'implémente aucune sauvegarde.
8. **Droits des personnes sans compte** (un client de la cliente qui demande ses données ou leur effacement) : seul l'export de l'organisation entière existe ; pas de recherche par personne, pas d'effacement ciblé qui traverse toutes les collections. Aujourd'hui, c'est un geste manuel dans chaque module.
9. **Notification de violation, registre des traitements, accord de sous-traitance** : rien dans le code, et rien ne peut y être — ce sont des documents et des procédures `[À VALIDER — JURISTE]`.
10. **Double authentification facultative**, y compris pour les comptes d'AMN DevSec qui entrent chez toutes les clientes. Une obligation pour les rôles `owner`/`admin` de l'organisation fondatrice est une décision, pas un défaut de code.
11. **Le module « Comply »** de l'édition interne est un produit (listes de contrôle pour les clientes) ; il n'est en rien une preuve de conformité du produit lui-même.

## 5. Les gabarits présents dans le produit — à remplacer, jamais à prendre pour un texte engageant

| Où | Ce que c'est | Marquage |
|----|--------------|----------|
| `src/screens/WelcomeScreen.tsx`, `politiqueGabarit()` | quatre points d'une « politique d'utilisation » affichée avant la remise des accès | commence par `[GABARIT — À REMPLACER PAR LE TEXTE D'AARON]`, finit par `[Fin du gabarit.]` |
| pages publiques (`routes/public.js`, `booking.js`, `orders.js`, `status.js`, `callLinks.js`) | aucune mention ; l'emplacement est à créer | absent |
| page de connexion, réglages | aucune mention légale, aucun lien | absent |

Recommandation technique (pas juridique) : servir ces textes par le dictionnaire i18n (`fr.ts`/`en.ts`) depuis un seul fichier, avec un numéro de version, et horodater l'acceptation (compte, version, date) dans une table dédiée.

## 6. Ce qu'un professionnel du droit doit relire

- Les rôles (§ 1) et le contrat AMN DevSec ↔ cliente qui en découle.
- Les durées de conservation à fixer (§ 4.1) et le sort des adresses IP (freinage, tracker).
- Les textes : politique d'utilisation, confidentialité, mentions légales, conditions ; leur place sur les pages publiques.
- La base sur laquelle le tracker observe les visiteurs des sites des clientes, et ce que la cliente doit leur dire.
- Le cadre d'un scan de sécurité actif sur un site (accord, preuve de propriété).
- Les procédures qui n'existent pas dans le code : violation de données, registre, exercice des droits des personnes.

Rien de ce qui précède ne prétend qu'une pratique est licite ou ne l'est pas. C'est l'état du code, mis à plat pour qu'une personne qualifiée puisse en juger.

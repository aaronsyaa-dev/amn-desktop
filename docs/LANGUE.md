# LA LANGUE — architecture, couverture, et comment on en ajoute une

*Écrit pendant la nuit du 30 au 31 août 2026, en même temps que le chantier.
Ce document dit ce qui est VRAI, pas ce qui est espéré : la couverture
anglaise est partielle et la frontière exacte est écrite plus bas.*

## Les décisions

**L'anglais est la BASE, le français est PREMIÈRE CLASSE.** Le schéma des
clés vit dans `src/i18n/en.ts` (`CleTraduction = keyof typeof en`) ; le
français est typé contre lui (`fr: Dictionnaire`), donc une traduction
oubliée ne compile pas. Mais la langue AFFICHÉE par défaut reste le
français : sans choix personnel et sans langue d'organisation, tout poste
parle exactement comme avant le chantier. Le produit actuel ne perd rien.

**Qui décide de la langue affichée** (`src/i18n/index.ts`, `langueActive`) :

1. le choix de la PERSONNE sur ce poste — Réglages → Langue, stocké en
   `localStorage` (`amn.langue.utilisateur`), jamais synchronisé ;
2. sinon la langue de l'ORGANISATION — choisie à l'atelier à la création,
   colonne `organizations.language` d'amn-api, portée par l'identité de
   session et posée par `AuthContext` (`poserLangueOrganisation`) ;
3. sinon le français.

**Zéro dépendance.** Pas d'i18next : des clés typées littérales, un magasin
de module avec abonnés (le motif de `poulsDuParc`), `useLangue()` pour le
re-rendu. La bascule dans les Réglages re-rend l'écran À L'INSTANT — c'est
vérifié en capture.

**Chaque langue a SA grammaire, jamais un gabarit traduit.** La Relève
(`src/lib/releve.ts`) écrit ses verdicts par langue (« Tout va bien. » /
« All is well. », nombres en lettres 0-10 selon la convention de chaque
langue, « Pendant le week-end » / « Over the weekend », dates en-GB). Les
salutations d'accueil (`src/lib/homeGreetings.ts`) ont leurs variantes
écrites par langue, avec les MÊMES familles (neutres / sereines) et le même
défaut prudent. La ligne d'alerte du parc accorde à l'anglaise (« 1 site
offline », « 2 sites have never given a sign of life »). Les points
d'exclamation restent interdits dans toutes les langues.

**La navigation : le catalogue français est la SOURCE, l'anglais est un
LEXIQUE.** Les catalogues de modules (`src/edition/modules.*.ts`,
`ClientSidebar`) gardent leurs littéraux français — les gardes de
`check-modules` les lisent tels quels (parité support/business). L'anglais
vit par clé de module dans `src/i18n/nav.en.ts` (tronc commun) et
`src/edition/navLexique.internal.ts` (entrées internes), résolu AU RENDU
par `libelleNav` / `indiceNav` / `libelleSection` / `libelleEspace`, avec
des indices par surface (« Your day » chez la cliente, « Their day » en
support). Une entrée absente retombe sur le français — visible, honnête.

**Le lexique est découpé PAR ÉDITION** (`@edition/navLexique`, même alias
que les catalogues). Le premier build Business a été REFUSÉ par le contrôle
de pureté du bundle : « Comply », « Scanner », la Tour de contrôle
n'existent pas dans l'édition cliente et n'ont pas le droit d'exister dans
son bundle, en anglais non plus. Même règle pour « AMN DevSec » du pied de
l'écran de connexion : la valeur du dictionnaire est un gabarit neutre
(`{marque} · Centre de supervision`) et la marque est un littéral derrière
la branche interne, que l'élimination de code mort retire du build client.

**Le choix d'organisation se fait à l'ATELIER.** Section « Langue de
l'espace » à la création d'un desktop (GeneratorScreen) → `language` dans
`CreateOrganizationInput` → les deux ponts (navigateur + Electron) →
`POST /v1/admin/organizations` (validé contre `ORG_LANGUAGES`, refus 400
d'une langue inconnue) → colonne `language` → identité de session. Le rail
est le CLONE exact de celui de la couleur d'accent. Au passage, un vrai bug
corrigé : les deux ponts perdaient silencieusement `trade` (et auraient
perdu `language`) entre l'atelier et l'API depuis le BLOC 6.

## Ce qui parle anglais aujourd'hui (vérifié en capture, build réel)

- **Connexion** : tout l'écran (libellés, MFA, erreurs, pied, badge
  en/hors ligne).
- **Rideau de bienvenue** : titre, salut, VOIX (la synthèse choisit une
  voix anglaise), « Click to skip ». L'écran bilingue
  « Welcome to… / BONJOUR » n'existe plus.
- **La coquille entière, deux éditions** : barre du haut (Search…, menu,
  profil), barres latérales (sections, modules, Sign out,
  replier/déplier), lanceur « All modules », barre du pouce, centre de
  notifications, aide rapide (bouton), sélecteur d'espace
  (Workstation / Control tower), sélecteur d'organisation, badge de
  synchronisation, bandeau d'état du bas (WORKSPACE · LIVE LINK · date
  localisée en-GB).
- **Accueil interne** : date, salutation, ligne d'alerte du parc,
  Relève SOC, compteurs, destinations et raccourcis.
- **Accueil cliente** : salutation, Majordome (relève complète), panneau
  d'attention (« Attention points · nothing to report · checked at… »).
- **Réglages → Language** : la section elle-même, et la bascule re-rend
  l'écran immédiatement.
- **Navigation** : les ~35 modules et toutes les sections, trois surfaces.

## La frontière honnête — ce qui reste français en mode anglais

Par ordre de visibilité :

- le CORPS des écrans de modules (Facturation, Clients, Tâches, Agenda,
  Supervision, Notes… : en-têtes d'écran, boutons, états vides) ;
- le corps de l'accueil cliente (cartes Aujourd'hui / À faire / Raccourcis,
  première visite, DayBand) et la ligne de date (`lib/calendar`) ;
- le moteur des points d'attention (les phrases de preuve : « échue depuis
  34 jours ») et les textes d'incidents ;
- la ligne de tendance (« 259 écritures chez vos clientes sur 7 jours ») ;
- le contenu de l'aide rapide, la palette de commandes (hors libellés de
  modules), les pastilles d'activité (`ACTIVITY_TABS.noun`) ;
- les messages d'erreur SERVEUR (amn-api répond en français : « Ce compte
  appartient à une organisation cliente… ») ;
- les Réglages hors section Langue, l'atelier lui-même (outil interne
  d'Aaron — volontairement dernier).

Le repli est toujours le français complet : jamais un trou, jamais une clé
brute à l'écran.

## Les gardes

- `npm run check:langue` (CI : editions.yml) — 8 contrôles : mêmes clés,
  mêmes interpolations `{nom}`, rien de vide, zéro « ! », apostrophes
  typographiques et espaces fines côté FR, anglais sans résidu français
  (mots français fréquents, guillemets, espaces fines), et le lexique de
  navigation aux mêmes règles (91 entrées). Éprouvé par mutation ×3.
- `npm run check:releve` — 19 contrôles, dont la grammaire anglaise et
  « sans langue demandée, le français ».
- `npm run check:attention` — les salutations n'affirment le calme
  qu'avec certificat, DANS LES DEUX LANGUES ; la ligne d'alerte anglaise
  a son contrôle propre (accord singulier « 1 site offline »).
- `check-business-bundle` (au build) — aucune trace interne dans le bundle
  client, l'anglais compris.

## Ajouter une langue (l'architecture est prête)

1. `src/i18n/es.ts` : `export const es: Dictionnaire = {...}` — le type
   force la complétude ; ce qui manque à l'exécution retombe sur l'anglais
   (la BASE), jamais sur un trou.
2. Étendre `Langue`, `LANGUES` et le sélecteur des Réglages.
3. Écrire SA grammaire de Relève dans `releve.ts` et ses salutations dans
   `homeGreetings.ts` — jamais traduire les gabarits existants.
4. Son lexique de navigation (`nav.es.ts` + moitié interne).
5. `ORG_LANGUAGES` côté amn-api pour l'offrir à l'atelier.
6. `check:langue` prend la langue dans ses boucles.

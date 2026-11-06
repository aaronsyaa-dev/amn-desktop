# Rapport de fin de session — LOT-00 Système et démarrage

## Résumé

1. Socle étendu : contrôles, situations, graphiques, archétypes, démo interne (`/dev/socle`).
2. Coquille : barre latérale (Vue d'ensemble, + N autres, Tous les modules, En ligne), en-tête, barre Ajmani, ⌘K, ⌘J, cloche.
3. Écrans système : H40, H41, H42, H47, H43, D02, G06, G05 — 8 sur 8 construits.
4. Redirection unique vers Démarrage à la toute première connexion.
5. Aucune capture : l'application n'a pas été lancée (consigne).

## Branche et sha

- Branche : `claude/refonte-socle`
- Partie de : `claude/refonte-design-socle`

## Fichiers sensibles ou hors zone

| Fichier | Changement | Pourquoi |
|---|---|---|
| `src/edition/appRoot.internal.tsx` | routes ajoutées, `ConnexionRefonte` sur `/login`, `FournisseurToasts` | interne seulement |
| `src/edition/navigation.internal.tsx` | export `TousLesModules` | D02 |
| `src/refonte/modules/declarations/*.ts` | noms de familles alignés sur les maquettes | D02 |
| `package.json`, `.github/workflows/editions.yml` | scripts `check:socle-*`, `check:systeme-*` | gardes du lot |

Aucun fichier de l'édition cliente (`*.business.*`) modifié.

## Gardes

Lancées avant/après : `typecheck`, `typecheck:business`, `lint`, `check:accueils`, `check:socle`, `check:moments`, `check:ajmani`, `check:navigation`, `check:garde-refonte`, `check:clavier`, `check:langue`, `check:modules` et tous les `check:*` sans navigateur : **identiques à la base** (`check:encres`, `check:migration`, `check:xss`, `check:visite`, `check:support` en échec avant comme après). Nouveaux : `check:socle-*` et `check:systeme-*` verts.

## Points à trancher

Voir « LOT-00 » dans `STATUT.md` (nouvelle coquille par défaut, G06 : phrase Garde et « 12 organisations », réglage d'organisation du métier, émetteurs mail/mobile).

## Ce qui n'a pas été vérifié

- Rendu réel et comparaison aux images ±2 px.
- Gardes à navigateur : `check:coquille`, `signal`, `mobile`, `contraste`, `focus`, `cibles`, `etiquettes`, `mouvement`, `xss`, `isolation`, `business`.
- `mailto:` dans Electron (peut être bloqué côté processus principal).

> La section courte de LOT-00 est dans `STATUT.md` § 7 ; ce fichier est le dossier complet (v2 puis v3).

## v3 (design v3 du dirigeant, 1er nov.) (design v3 du dirigeant, 2026-11-01)

Sur `claude/refonte-socle`, avant la fusion de LOT-00. Remplace la v2 pour les 8 écrans et la coquille. La nouvelle coquille reste **éteinte par défaut** (drapeau `amn.coquille`) ; l'édition client n'a pas changé (aucun fichier `*.business.*` touché ; `src/components/AppLayout.tsx` ne change que derrière le drapeau `@edition/coquille`, toujours faux côté client).

#### Méthode de capture

L'app n'est pas lancée (ni `npm start`, ni `build:web`, ni serveur). Chaque écran a un aperçu statique `scripts/apercu/ecrans/<ID>.tsx` : il rend les **vrais composants** de l'écran sur des données fictives de bac à sable (jamais dans `src/`). `npm run apercu -- <ID>` en fait une page `file://`, capturée à 1440 × 900 en mouvement réduit (état final) et comparée à l'image avec l'outil de T1 (`docs/refonte/CONTROLE-FIDELITE.md`). Les zones de données d'exemple qui ne peuvent pas venir des données réelles sont écartées (`--ignorer`).

| Écran | Commit | Pixels en écart (brut) | Hors données d'exemple | Reste |
|---|---|---|---|---|
| Coquille (H42, H40, D02, H47) | `f9251f7` | — | 0,10 à 0,14 % (zone principale écartée) | teintes d'avatar calculées depuis le nom ; dégradé du logo |
| H40 Notifications | `a45e770` | 1,03 % | 0,22 % | pied du point d'Ajmani (texte), puces à 1–2 px |
| H41 Recherche ⌘K | `dd54ca3` | 2,52 % (palette) | 0,62 % | lignes sans source (contacts, note, « Appeler ») |
| H42 Démarrage | `ea6f7b4` | 0,33 % | — | icône du grand nœud, teinte de « Brouillon » |
| H43 États et messages | `ac99f5e` | 0,72 % | — | hachures du modèle 4, reflet figé des squelettes |
| H47 Choisir son métier | `214ef8e` | 0,51 % | — | exemples de journée génériques, bandes de couleurs réelles |
| D02 Tous les modules | `4aea75d` | 3,05 % | 0,30 % (lignes du registre écartées) | noms et icônes fictifs de la colonne droite |
| G06 Connexion | `cf2aca6` | 15,6 % | 0,09 % (balayage et méthodes absentes écartés) | titre « Connexion » au lieu de « Bon retour, … » |
| G05 Ajmani ⌘J | `c347081` | 13,8 % (palette) | chaque bande à ± 1 px | bas décalé de 38 px : texte en 2 lignes, pas de ligne « Objet » |

**8 écrans sur 8 faits en v3, plus G09 (9 sur 9).** Gardes : `typecheck`, `typecheck:business`, `lint`, tous les `check:*` sans navigateur identiques à la base (seuls `check:encres`, `check:migration`, `check:xss`, `check:visite`, `check:support` échouent, avant comme après) ; tous les `check:socle-*` et `check:systeme-*` verts, dont les nouveaux `check:socle-vivant` et `check:systeme-connexion`.

#### Composants v3 disponibles (internes seulement, depuis `src/socle/ui`)

| Quoi | Chemin | Usage |
|---|---|---|
| Couche de mouvement §0.2 | `src/socle/mouvement.css`, `src/socle/couche-mouvement.ts` | attribut `data-mvt="entree\|cascade\|arrivee\|fondu\|remplit\|anneau\|arc\|pousse\|trace\|aire\|point-final\|onde\|flux\|balayage\|curseur"`, survols `data-mvt-survol="carte\|bouton\|ligne\|noeud"` ; outils `styleRang(i)`, `entreeMotion`, `decalageBarres`, `dureeFlux`. Coupée par `prefers-reduced-motion` et par Mouvement « aucun » ; « réduit » = fondus de 200 ms |
| Police monospace | `src/socle/noir.css` | jeton `--socle-police-mono`, classe `.sc-mono` (chiffres tabulaires) |
| `LiveDot`, `Caret`, `Severity` | `src/socle/ui/vivant/Signaux.tsx` | voyant vivant (ton, libellé lu, onde) ; curseur ; niveaux en capitales monospace |
| `Gauge`, `HeatCell` | `src/socle/ui/vivant/Mesures.tsx` | demi-jauge 180° ; case de chaleur (opacité .18 à .90) |
| `FlowLine` | `src/socle/ui/vivant/FlowLine.tsx` | lien pointillé qui avance (`<path>` dans un `<svg>`) |
| `FilterChips` | `src/socle/ui/vivant/FilterChips.tsx` | puces à choix unique (`radiogroup`, flèches) |
| `InlineSuggestion` | `src/socle/ui/vivant/InlineSuggestion.tsx` | bandeau étincelle + Oui/Non |
| États compacts | `src/socle/ui/situations/` | `BlocEtat taille="compact"`, `EtatErreurChargement`, `EtatAucunResultat`, toasts et dialogues compacts ; pièces de H43 dans `EnSituation.tsx` (non exportées, voir questions) |
| Coquille v3 | `src/socle/coquille/`, `src/refonte/coquille/` | barre latérale §0.1, en-tête avec pastille de La Garde à onde, barre Ajmani v3 ; une page donne son fil et sa famille avec `usePageCoquille({ famille, sousPage, miettes, tousLesModules?, ajmani? })` (`page.ts`) ; table des pages système `pagesSysteme.ts` |
| Aperçus de capture | `scripts/apercu/` | `npm run apercu -- <ID>` ; `ApercuBureau` (`scripts/apercu/coquille.tsx`) pour un écran dans la coquille |

Les archétypes du §5 (`src/socle/ui/archetypes/`) restent des briques, plus des gabarits (§0.3).

#### Écarts de T1 (`docs/qualite/fidelite/ECARTS-LOT-00.md`, `0a1751c`), mesurés sur l'ancien socle

Corrigés :

- **C1 fil d'Ariane** : plus de libellé tiré de la route ; « Ma journée / Notifications », « Ma journée / Démarrage », « Ma journée / Démarrage / Votre métier », « Espace / Tous les modules ».
- **C7 « EN LIGNE »** : remplacé par la carte « Aujourd'hui » (v3) ; la présence des collègues donne le nom du module, jamais une route (coquille et Accueil).
- **C11 chiffres tabulaires** : retirés du corps de page dans `noir.css` (sans toucher `src/index.css`, partagé avec le client) et des racines de page (`.dem-page`, `.met-page`, notifications, palettes) ; gardés sur les nombres.
- **C12 titres de carte** : en `#EDEDED` (H42, H47), vérifié par `check:systeme-demarrage`.
- **C13 boutons d'en-tête** : H42 et H47 utilisent le bouton de H40, 31 px de haut, haut à y = 107.
- **H41.1 palette ⌘K trop large** : libellés en 13,5 px.
- **G06** : formulaire aux positions de l'image (G06.1), plus de numéro de version dans le pied (G06.4), anneau de focus 2 px décalé de 2 (G06.6), lueur (G06.7). Les indicateurs (G06.3) et l'ancienne note (G06.2, G06.5) n'existent plus en v3.
- **D02** : rythme vertical à ± 1 px (D02.1) ; plus de rangée coupée, le répertoire défile dans sa carte et les bas de colonnes s'alignent (D02.2) ; champ sans croix ni anneau épais (D02.4) ; « La Garde » en entier (D02.5, C6) ; D02.3 sans objet (D02 est une page).
- Aussi : C6 (libellés tronqués), C8 (« ⌘K » d'un bloc), C10 (pas de point ✦ flottant sur la nouvelle coquille), H40.1 (suggestion d'Ajmani en 3ᵉ carte quand son déclencheur réel joue), H42.2 (étapes faites en vert, comme l'image v3), H43.1 (lueur de page), H43.2 (tuiles), H43.4 (squelettes), G05.5 (voile figé et flouté).

Laissés, avec la raison :

- **Bac à sable** (3 personnes en ligne, 14 notifications, « reconnexion en cours », H40.2, H42.5, H42.6, D02.7, G05.4, G06.8) : pas des défauts.
- **Voulus** : H41.2 (pas de ⌘↵, fenêtre unique), H42.4 (« N · créer, partout » : la touche n'existe pas), G05.1 et G05.2 (Ajmani prépare, n'envoie rien), D02.6 (comptes du registre), H43.3 (noms neutres).
- **À décider par le CO** : C9 (sélecteur d'organisation dans l'en-tête), H41.3 (nom complet ou prénom), H47.3 (tag « Exemple »).
- **Non vérifiable** : H40.3 (survol).

#### Écarts v3 (écran, raison, différence)

- **Coquille** : repli de la barre = état de session (aucun repli n'existait) ; compteurs retirés de la sous-liste (absents des images) ; Cyber mène à `/cyber` et ne se déplie pas (ses écrans ont leur propre cadre) ; étincelle de la barre Ajmani en gris, comme sur les images.
- **H40** : pas de « lu par … » (aucune source) ; « Voir les points » devient « Voir le détail » (agenda) ; point d'Ajmani fait des titres des sources ; pied « Résumé du matin à 8:00 » et « Régler » (aucun résumé n'est envoyé) ; paquets aux titres génériques ; niveau de bruit et silence sans émetteur (effet : pointillé de l'anneau) ; lignes de 46 px (image) au lieu de 48 (fiche).
- **H41** : pas d'effectif, de « 1 urgent », de contacts ni de note épinglée, pas d'« Appeler » (aucune source) ; la facture passe avant le contrat.
- **H42** : « Créer le devis » ouvre les clients (aucun devis prérempli, H07) ; « 7 importés d'Excel » devient « N enregistrés » ; pas de ligne Sauvegarde ; pas de référent ni de créneaux (« L'équipe AMN vous répond », vers `/assistance`) ; papier posé droit (image) plutôt qu'incliné (fiche).
- **H43** : le titre d'erreur standard perd son point final (tous usages).
- **H47** : encarts « automatisations » et « modèles de documents » absents (les modèles de métier n'en créent pas) ; totaux réels des modèles (10 à 12) au lieu de 20 ; exemples de journée génériques.
- **D02** : comptes du registre, donc la 4ᵉ colonne défile dans la carte ; noms longs coupés avec info-bulle ; pas de « +N ce mois » (le journal ne garde que la dernière ouverture) ; « À découvrir » = jamais ouverts ; Cyber « 9 espaces » (catalogue) au lieu de 12 ; lignes de 21 px (fiche) sous les 34 px du §7.6 ; nouvelle coquille éteinte : D02 s'affiche comme une page dans l'ancienne mise en page.
- **G06** : clé d'accès, lien par e-mail et compte enregistré n'existent pas dans le dépôt : non dessinés (fiche §8, « sans compte mémorisé ») ; titre « Connexion », adresse et mot de passe ; pastille « La Garde veille · connexion chiffrée » (pas d'état public des services) ; « Écrire à l'équipe » affiche un texte d'aide (aucune adresse d'assistance) ; authentification inchangée, vérifiée par `check:systeme-connexion`.
- **G05** : « Préparer les n relances » au lieu d'« Envoyer » (écart décidé) ; pas de « attend un appel », de modèle approuvé, de ligne « Objet » ni de « Programmer » (aucune source) ; Relances ne lit pas encore les factures présélectionnées.

#### G09 Écran de veille (9ᵉ écran, ajout du dirigeant)

- **Fait** : capture comparée à l'image, 0,00 % de pixels hors ± 2 px, 15 textes sur 15 retrouvés.
- **Composants** (`src/refonte/systeme/veille/`) : `IdleScreen` (calque plein écran `#000` au-dessus de tout, sans clic fantôme, rend le focus), `DayRing24`, `WatchOrbit` (avec `SlowSweep` 60 s), `BigClock`, `StatusPill`. Le noir `#000` est un jeton propre (`--socle-veille-noir`), utilisé là seulement.
- **Bascule** : par `src/components/IdleScreensaver.tsx`. Nouvelle coquille allumée → G09 ; éteinte (défaut) → le voile d'avant (Salle de situation), inchangé. `amn:veille-ouverte` part dans les deux cas. Côté client, `EcranDeVeille` de `@edition/coquille` ne rend rien.
- **Données** : l'horloge du poste, l'état global de La Garde (même règle que la pastille de l'en-tête, `usePoulsGarde`) et la prochaine ronde (`prochaineRondeAt` des gardes actives, déjà chargé ; absente si aucune ronde n'est annoncée). Aucun nom de client ou d'organisation, aucun montant (vérifié par `check:systeme-veille`).
- **Jamais pendant** un appel, un partage ou une prise de contrôle d'écran, une dictée d'Ajmani ou une vidéo en lecture.
- **Réglage H18** : Paramètres, ligne « Écran de veille » entre « Mouvement » et « Nouvelle coquille » (couture interne, rien côté client) : activer (oui par défaut), « Veille après » 5 min par défaut, « Verrouiller l'espace après » 15 min par défaut (ou « Jamais »). Stockage par poste `amn.ecranDeVeille`.
- **Mouvement** : couche commune ; tout s'arrête avec `prefers-reduced-motion` ou Mouvement « aucun » (fond figé, halo et point fixes, pas de dérive).

Écarts :

1. **Aucun verrouillage après inactivité n'existe dans le dépôt** : rien n'a été créé (interface seulement, authentification inchangée). Le délai de verrouillage est enregistré sans effet, et l'aide des Paramètres le dit ; « Espace verrouillé » et « · verrouillage après 15 min » ne s'affichent pas dans l'app (seulement dans l'aperçu de capture).
2. Message vocal de l'équipe (`VoiceRecorder`) : aucun état lisible ; couvert indirectement (3 min au plus, délai minimal 5 min).
3. Plusieurs écrans : une seule fenêtre Electron, le calque ne couvre qu'elle.
4. Entrée par l'animation commune `entree` (montée de 6 px) plutôt qu'un fondu pur ; halo du repère en anneau fixe et onde sur le point.
5. État « La Garde ne répond pas » repris de l'en-tête (la fiche ne le prévoit pas).

Questions pour le CO : basculer la coquille (donc G09) par défaut ? Créer un vrai verrouillage menant à G06 (touche à l'authentification) ? Masquer les notifications natives du système pendant la veille ?

#### Questions pour le CO (v3)

1. Brancher Ajmani (G05) sur l'envoi réel de Relances, en N3 avec 10 s pour annuler ?
2. G06 : créer un compte mémorisé sur le poste (adresse et initiale en local) ?
3. D02 : lignes de 21 px (fiche) ou cibles de 34 px (§7.6) ? Équilibrer les colonnes ? Le « 101 » de la barre exclut les modules allégés, D02 les compte.
4. Sources manquantes à créer : devis prérempli (H07), créneaux du référent, contacts par client, note épinglée, automatisations et modèles des métiers (L04), historique des ouvertures.
5. H40 : émetteurs pour le niveau de bruit, le silence et le résumé du matin ; retenir les rendez-vous en « L'essentiel » (fiche) ou non (image) ?
6. H43 : exporter les pièces de `EnSituation.tsx` (et les ajouter à `/dev/socle`) ?
7. Coquille : gérer la hauteur des pages sous les enveloppes d'`AppLayout` dans la coquille plutôt que page par page.

## Socle v3 complet (§1.10), 6 nov. 2026

Demande du dirigeant (« Mode ULTRA ») : terminer le socle v3 complet pour les deux éditions, livrer les briques partagées citées par les autres lots, le calcul unique « Aujourd'hui », Cyber toujours visible, une page de réglages propre à chaque écran concerné ; zéro bug, gardes vertes, un commit par écran, aucune fonctionnalité factice, branches seulement, aucun secret.

Cinq chantiers menés en parallèle sur des branches `claude/refonte-socle-v3s*` depuis `a94dc07`, fusionnés un par un (`--no-ff`) dans `claude/refonte-socle`, puis vérifiés de façon adverse (sept vérificateurs indépendants, trois réfutateurs par constat grave) ; le chantier des briques a été rejoué en un commit par écran avant la fusion. Les treize aperçus (neuf écrans, quatre en coquille) sont recapturés après la fusion : **identiques au pixel** à ceux d'avant, donc mêmes pourcentages que la table v3. Gardes : toutes vertes (`typecheck`, `typecheck:business`, `lint`, 65 `check:*` sans navigateur dont les 19 du socle et du système, `check:substitutions`, `check:client-statique`), les cinq échecs connus (`check:encres`, `check:migration`, `check:xss`, `check:visite`, `check:support`) inchangés ; `check:coquille --page` vert sur les quatre aperçus en coquille.

#### 1. Briques partagées (`src/socle/ui/briques-partagees/`, `noms.ts`)

- `IconTile` (huit tailles, famille ou ton, `part` / `bordure` pour les variantes mesurées sur les images), `CountBadge` (standard, latérale, texte ; rien à zéro, « 99+ »), `ModuleTile` (standard 41 px, ligne 34 px ; lien ou bouton ; `aria-current`), `ModuleGroupGrid`, `AddModuleTile`, `PageHead` (= `EnTeteDePage`, avec `controles`, `className`, `attributsTitre`, info-bulle des actions), `StatusPill` (= `PastilleEtat`).
- Le catalogue des noms des fiches (`noms.ts`) : `Card`, `Button`, `Kpi`, `Progress`, `Ring`, `Kbd`, `AvatarStack`, `Check`, `Field`, `Toggle`, `IconButton`, `Select`, `SearchBox`, `Tabs`, `Segmented`, `Suggestion`, `Subcard`, `FlagUrgent`, `Chips`, `SuggestionCompact`, `Sparkline`, `TimelineItem`, `StatusPill` ; `Sidebar`, `Header`, `AjmaniBar` depuis `src/socle/coquille` ; `Empty` = `EtatVide` (alias posé après la vérification, voir plus bas). `EtatVide` et `BlocEtat` restent deux briques (question 3).
- D02 (tuiles, grille des épinglés, tuile d'ajout), la barre latérale (compteurs), H40, H42, H47 (en-tête), H41 (tuile d'icône) et H43 (`BlocEtat`) passent par ces briques : captures avant / après strictement identiques (D02 : 2 pixels sur 1 296 000, crénelage d'un glyphe). Seule différence de balisage : H40, H42 et H47 gagnent un groupe ARIA « Actions de la page » autour des boutons d'en-tête (`PageHead`), que l'ancien balisage n'avait pas.
- Garde `check:socle-briques` (valeurs du §4 lues dans la feuille, alias, écrans passés par les briques), en CI. Mots fr/en : `src/socle/mots/briques.ts`.
- Provisoire : `ModuleTile` standard, `ModuleGroupGrid`, `AddModuleTile` (rayon 9, marge, écart 6, titre de groupe 11 px capitales) jusqu'aux fiches F10 à F70 (`LiveModuleTile` de F70 non construite) ; `IconTile` 44, rayon 12 supposé.

#### 2. Audit du §4, Mono, formats, jetons, mouvement

- Chaque brique du §4 mesurée dans le CSS calculé de `/dev/socle` : à la valeur exacte, sauf le filet de `TimelineItem` (`#2A2A2D` → `#222224`) et Empty (`EtatVide` : pointillé `#2E2E33`, rayon 14, titre 14 px, texte 300 px, tuile 44 px, action obligatoire), corrigés. `EtatVide` est employé hors de LOT-00 par l'Accueil vivant (LOT-01) et les archétypes `Tableau` et `Scinde` : leur état vide suit désormais le §4 (aucun des 9 écrans ne change ; pour les deux états vides de l'Accueil : pointillé `#28282B` → `#2E2E33`, rayon 12 → 14, à signaler à LOT-01).
- Ajouts demandés par LOT-06 : `Anneau` 26 à 80 px (épaisseur et centre proportionnés, seuils décidés faute de fiche), `CaseACocher` 16 px, `Segmente` compact (26 px, sous la cible de 34 px : réservé aux rangées denses), `BoiteRecherche` 38 px, `Mono` (11 à 18 px), `src/socle/formats.ts` (formats français importables de tout code interne, réexport sans copie), jetons `--socle-decor-1/2/3`, hachures et pointillés d'état, teinte de sélection = `--socle-fam-creer`, classes `.amn-grow`, `.amn-slide`, `.amn-bar` et keyframes `amnFlow`, `amnHalo` sur la couche commune (anciens noms internes `sc-mvt-flux`, `sc-mvt-onde` retirés : aucune feuille ne les nommait).
- Section « Alignement § 4 » de `/dev/socle` ; `check:socle`, `check:socle-controles`, `check:socle-graphiques`, `check:socle-archetypes`, `check:socle-vivant`, `check:systeme-demo` tiennent chaque valeur mesurée ou corrigée (`check:socle` : 63 propriétés).
- Écart laissé : la bordure de 1,5 px de `Check` est déclarée mais rendue à 1 px en échelle 1 par Chromium.

#### 3. `useAujourdhui` et compteurs déclarables (`src/refonte/coquille/aujourdhui/`, `compteurs.ts`)

- `calculerAujourdhui(sources, maintenant, libelles)` : fonction pure qui appelle les règles de S2 (`construireFil`, `appliquerRetouches`, `meilleureSerie`) sans les recopier ; `useCalculAujourdhui` lit les hooks d'accès (tâches, priorités, rendez-vous, routines, clients, factures, présence) ; `FournisseurAujourdhui` monté une fois dans la coque interne (branche nouvelle coquille), exporté aussi par `@edition/coquille` (jumeau cliente inerte) ; `useAujourdhui` lit le contexte s'il existe, sinon calcule. `useCarteAujourdhui` (barre) et `useAccueil` (N01) lisent le même objet : plus aucun second calcul du fil, de la série, du prochain rendez-vous ni de la présence.
- Compteurs : `declarerCompteurs({ famille, useCompteurs })` dans `src/refonte/compteurs/<famille>.ts`, ramassés par `import.meta.glob` (repli vide sous esbuild), ordre stable, fusion par adresse (somme). Livrés : `jour.ts` (activité non vue, agenda, tâches, relances, priorités : chiffres d'avant mot pour mot) et `cyber.ts` (alertes ouvertes du SOC, rien tant que `useCyber().pret` est faux). `donnees.ts` n'a plus de calcul en dur. Captures COQUILLE-H42 et COQUILLE-D02 identiques octet pour octet ; `check:socle-coquille` passe de 20 à 28 propriétés.
- Non branché : les compteurs de Stock, Chantiers, Commandes (LOT-06) ; `jour.ts` lit l'horloge à la minute (`useMaintenant`, correction après vérification : la première version ne rejouait qu'à un changement de donnée, alors que l'ancien calcul suivait l'heure par accident).

#### 4. Mécanisme de substitution (§1.3) et preuve statique d'isolement

- `declarerSubstitutions(lot, [{ route, module?, composant, support?, toujours? }])` dans `src/refonte/substitutions/declarations/<lot>.tsx`, ramassé seul ; `trouverSubstitution` (route exacte, puis paramétrée, la plus précise l'emporte ; doublon noté, jamais d'exception) ; `SubstitutionDEcran` remplace les quatre `Outlet` de la coque interne (`AppLayout` × 2, `ClientContextLayout` en support, `CadreBureau` des cinq bureaux — ajouté après vérification : 77 routes y échappaient) : substitut sous `Suspense` et sous `ModuleRoute` si `module`, sinon l'écran d'origine, sans enveloppe (sortie HTML identique). Par défaut un substitut ne joue que coquille allumée (`toujours` pour forcer). Jumeau cliente : `Outlet`, registre vide. `appRoot.internal.tsx` et `src/screens/**` ne bougent pas.
- Aucune substitution réelle : la déclaration `systeme.tsx` est vide avec l'exemple commenté ; le contrôle monte une substitution factice.
- `check:substitutions` (23 propriétés : la clé `module` est comparée aux gardes `ModuleRoute` de la route d'origine, `node_modules` reconnu au segment, `declarations/` en `.tsx` seulement) et `check:client-statique` (graphe d'imports esbuild depuis `src/renderer.tsx` avec les alias client : aucun fichier de `src/socle`, `src/refonte`, `*.internal.*`, `AppLayout`, `IdleScreensaver` atteint ; aucun motif FORBIDDEN de `check:business` ; marqueurs REQUIRED présents), en CI. Constat rapporté sans échouer : C-001, `src/index.css` atteint par le paquet client avec 48 références au socle (feuilles du socle non chargées côté client).

#### 5. `check:coquille` sur la barre v3, audit du §1.2, réglages propres

- `scripts/check-coquille.mjs` : premier passage inchangé (T1), second passage coquille allumée (`localStorage['amn.coquille']` posé avant la navigation, 1440 × 900, écrans internes) mesurant la barre v3 (252 px, sections à l'encre T4 et à l'interlettrage .09em, familles sans pastille, La Garde et Cyber, sous-liste de 27 px et repère, carte « Aujourd'hui », en-tête 60, barre Ajmani 46 / rayon 14, aucun ambre — opaque ou translucide — hors voyant de La Garde, une seule ligne active) ; mode `--page <index.html>` sans serveur ni réseau, prouvé sur les quatre aperçus en coquille et sur une copie sabotée (20 fautes dites). Le mode bundle n'a pas tourné ici (aucun build servi) : T1.
- §1.2 : tout déjà conforme sauf le rayon de bouton (10 → 9 px) ; `check:socle` tient chaque ligne du §1.2 et la présence des composants du §4.
- Réglages : Mouvement (segmenté à trois niveaux, état en pastille, note du système, « Suivre le système »), Écran de veille (interrupteur dans l'en-tête de carte, « Veille après » en segmenté, « Verrouiller l'espace après » en liste, délais coupés quand l'interrupteur est éteint), Nouvelle coquille (ce qu'elle apporte avec ⌘K et ⌘J, pastille d'état, interrupteur) ; `ANCRES_REGLAGES` / `ancreDeReglages`, défilement vers la rubrique demandée par l'état de navigation ; H40 « Réglages » → Notifications ; G09 inactif ; aperçu `REGLAGES-LOT-00`. `SettingsScreen` (partagé) ne change pas.
- `ANCRES_REGLAGES` couvre chaque rubrique du plan des Paramètres, Guide et Extensions comprises (leurs ancres existent dans `GuideSection` et `ExtensionsSection` ; le premier compte rendu disait le contraire, à tort).

#### Vérification adverse (6 nov.)

Sept vérificateurs indépendants (briques, alignement § 4, « Aujourd'hui », substitution, `check:coquille` et réglages, transversal, visuel) ont relu la fusion `a94dc07..cbcd397` avec pour consigne de prouver chaque constat (fichier, ligne, commande, sabotage dans un worktree jetable) ; chaque constat majeur a ensuite été soumis à trois réfutateurs (reproduction, consigne, portée). Résultat : aucun bloquant ; **dix constats majeurs distincts confirmés** (aucun réfuté) ; 59 mineurs ou notes. Les majeurs, tous corrigés sur la branche (commits « Corrections après vérification ») :

1. `noms.ts` (catalogue des noms des fiches) affirmait encore qu'`EtatVide` ne suit pas le § 4 et que son action est facultative, alors que l'audit du § 4 l'y a aligné ; `check:socle-briques` verrouillait la phrase périmée. → Catalogue corrigé, alias `Empty` = `EtatVide`, garde retournée. (`633d3d3`)
2. `src/socle/formats.ts` promettait « — » pour une valeur illisible, mais `formaterMontant(NaN)` rendait « NaN € », `formaterRatio(NaN)` « 0 % », et `formaterDate`/`formaterHeure` levaient une exception sur une date illisible (préexistant à la fusion, réexporté tel quel). → Les quatre formats rendent « — », gardes `check:socle-graphiques` et `check:socle-archetypes` étendues. (`be0736c`)
3. Les pastilles `/agenda`, `/relances`, `/priorites` de `jour.ts` ne se rafraîchissaient plus qu'à un changement de donnée (l'ancien calcul se rejouait à chaque rendu par accident) : un rendez-vous fini restait compté à côté d'une carte « Aujourd'hui » à jour. → `jour.ts` suit l'horloge à la minute ; le compte rendu disait à tort « comme avant ». (`312cb9a`)
4. `CadreBureau` (bureaux La Garde, Cyber, Supervisor, Studio, Stratégie : 77 routes sur 211) gardait son propre `Outlet` : ces routes échappaient au point de substitution, et `check:substitutions` acceptait leur déclaration. → Quatrième point de substitution dans `CadreBureau`, garde étendue. (`d9c3738`)
5. `check:substitutions` acceptait une substitution sans clé `module`, ou avec une clé inexistante, là où la route d'origine est gardée par `ModuleRoute` (session de support). → La clé déclarée doit être celle de la route d'origine dans `ClientContextRoutes` (ou une clé connue), sinon faute. (`d9c3738`)
6. `check:substitutions` rougissait à tort dès qu'une déclaration importait `lazy` de `react` quand `node_modules` est un lien symbolique (filtre par préfixe). → Filtre par segment, comme `check:client-statique`. (`d9c3738`)
7. `check:coquille` (second passage, barre v3) ne voyait pas l'ambre translucide (`rgba(224, 179, 90, .13)`, la forme même des fonds de pastille) : une copie sabotée passait. → Comparaison par composantes, quelle que soit l'opacité (le premier passage, celui de T1, reste tel quel). (`6ccedb2`)
8. Le compte rendu du chantier des réglages affirmait que `SettingsScreen` annonce « guide » et « extensions » sans ancres : faux, les deux ancres existent (`GuideSection`, `ExtensionsSection`) ; `ANCRES_REGLAGES` les omettait et une question au CO reposait sur cette prémisse. → Ancres ajoutées, garde `check:socle` lit aussi ces deux fichiers, question retirée. (`9c5c863`)
9. `Segmente` n'avait aucun état désactivé visible : « Veille après » restait allumé (curseur, couleur, survol) quand l'écran de veille est éteint, alors que le sélecteur voisin passe à 60 % (préexistant). → `.sc-segment:disabled` (curseur, opacité), survol coupé, garde `check:socle-controles`. (`f16d148`)
10. `ModuleTile` ouverte : le sous-texte T4 sur le fond actif `#262629` tombait à 4,39:1, sous AA et sous le plancher § 7.6 (5,4). → Sous-texte en T3 (5,8:1) sur la tuile ouverte, garde `check:socle-briques`. (`633d3d3`)

Mineurs corrigés : rayon des puces et de la tuile d'ajout lus par le jeton `--socle-rayon-controle` ; quatre valeurs du § 4 enfin tenues par `check:socle-briques` (poids 500 et 600, icône « + » 14 px, `--socle-ligne-choisie`) ; `BlocEtat` passe réellement son ton à `IconTile` (H43 identique au pixel) ; `vers` / `onClick` exclusifs sur `ModuleTile` et `AddModuleTile`, `controles` exclusif des actions sur `PageHead` (typage) ; effectif de `ModuleGroupGrid` en texte caché plutôt qu'en `aria-label` sur un `span` ; singulier « 1 alerte critique » ; `CountBadge` latéral en `inline-flex` (21 × 16 partout) ; `check:socle` refuse un gris de décor sur un état ou un texte SVG dans les feuilles ; libellé « Alignement § 4 » sans nom de chantier ; `Kpi` borné à 92 px (variation sur une ligne, en ellipse, phrase entière en infobulle) ; assertion vide de `check:socle-graphiques` remplacée ; anneau muet à centre 11 px ; `Mono` borné même sous `style.fontSize`, ±∞ ramené ; `CLASSES_MOUVEMENT` exporté et en-tête de `mouvement.css` exact ; numéro de section de la démo ; légendes traduites, alignées, voyant « en direct » avec son mot ; un rendez-vous « fait » dans le jeu de `check:socle-coquille` ; `useAccueil` ne monte plus de seconde instance des accès (`useAujourdhui().acces`) ; commentaire et doc d'« Aujourd'hui » exacts ; tri des déclarations par unités de code ; `declarations/` en `.tsx` seulement ; propriété « point réel » calculée depuis le registre ; `check:client-statique` interdit `src/client-context/**` et `src/bureaux/**` ; doc de substitution (session de support et drapeau) ; texte du commutateur de la coquille dans un `<label>` ; clés i18n mortes retirées ; `check:coquille` mesure l'encre et l'interlettrage des sections, refuse `AMN_COQUILLE=allumee` hors édition interne, lève l'événement du drapeau ; ÉPINGLÉS documenté ; aucune taille en pixels hors feuille dans les réglages (aides sur `.sc-champ__aide`).

Mineurs laissés (et pourquoi) : la cible de clic de l'interrupteur reste 34 × 20 (§ 4 « Toggle 34 × 20 » contre § 7.6 « cibles ≥ 34 px » : décision du CO, comme les boutons de `PageHead` à 31 px) ; la teinte `--fam` vient de `src/index.css` (mécanisme antérieur, documenté) ; les glyphes 18 et 20 px des tuiles 38 et 44 sont supposés (provisoire) ; D02 n'a pas de drapeau « critique » dans son registre et déborde en 4ᵉ colonne avec le registre fictif (antérieurs, écarts dits) ; C-001 et la fusion par somme des compteurs restent des questions au CO ; `--socle-rayon-bouton` reste un jeton sans lecteur monté ; deux PNG à la racine du dépôt (antérieurs) ; une valeur de case de chaleur à 2,58:1 dans la section Vivant (antérieure).

Notes des vérificateurs sans défaut, portées au CO : boutons de `PageHead` à 31 px et interrupteurs 34 × 20 (cotes du § 4 lui-même, sous les 34 px du § 7.6 : contradiction interne de la spec) ; teinte de famille `--fam` fournie par `src/index.css` et non par `noir.css` ; D02 n'a pas de drapeau « critique » dans son registre (le chiffre rouge d'Alertes de la fiche n'est câblé ni avant ni après) ; `--socle-rayon-bouton` n'a aucun lecteur monté (jeton redondant avec `--socle-rayon-controle`) ; le segment choisi n'est porté que par le fond et l'encre (conforme au § 4) ; deux captures PNG suivies à la racine du dépôt public (antérieures, hors socle) ; les trois réglages partagent le même cadre de carte faute de fiche H18 ; une valeur de case de chaleur à 2,58:1 dans la section Vivant (antérieure) ; D02 déborde en 4ᵉ colonne avec le registre fictif (antérieur, données d'exemple).

#### Seconde passe adverse (6 nov., interrompue)

Une seconde passe, sur les corrections elles-mêmes (`c9f7ead..efc227b`), a été lancée avec quatre lentilles (corrections du groupe A, corrections du groupe B, transversal, visuel) puis trois réfutateurs par constat grave. Le CO l'a fait **arrêter avant son arbitrage complet** : les quatre lentilles avaient rendu leur rapport (chaque correction du premier passage retrouvée et tenue, sauf ce qui suit), trois constats étaient devant les réfutateurs. **Rien de cette passe n'a été corrigé** ; tout est consigné ici avec le plus petit correctif proposé, pour décision du CO. Aucun de ces constats ne change un pixel des 13 aperçus de référence.

Constats graves, non corrigés :

1. **Confirmé (trois réfutateurs sur trois)** — `.sc-segment:hover:not(:disabled)`, ajouté par la correction de l'état désactivé (`f16d148`), a une spécificité supérieure à `.sc-segment[aria-checked='true']` : au survol, le segment actif passe de T1 à `--socle-texte-courant` (mesuré : rgb 237 → 196) dans tous les segmentés de l'édition interne (Réglages, D02, H47) ; invisible dans les captures, qui ne survolent rien. Correctif : `.sc-segment:hover:where(:not(:disabled))` (spécificité inchangée) et la ligne de `check:socle-controles` qui lit cette règle. `src/socle/ui/controles/controles.css:221`.
2. **Confirmé (deux sur trois)** — `Kpi` : la variation sur une ligne (`nowrap` + ellipse, correction du plafond de 92 px) coupe des textes réels de l'Accueil vivant (« Fixé à la revue hebdo », « encaissé en novembre ») dans une colonne de deux tuiles (824 px, cas sans coquille), sans infobulle quand `detail` manque, et le texte coupé passe sous la mini-courbe dans le gabarit de la démo ; le troisième réfutateur la tient pour mineure (§ 4 : une sous-valeur, hauteur 84 à 92). Correctif : `title` complet sur la tuile dès qu'il y a une variation, et revenir au retour à la ligne ou exiger une variation courte par les fiches (question 11). `src/socle/ui/briques.css:258`, `src/socle/ui/Indicateurs.tsx`.
3. **Un vote reçu sur trois (grave)** — `check:socle-briques` et `check:socle-situations` ne refusent une redéfinition de `.sc-bloc-etat__icone` que si le sélecteur est écrit tel quel : `.sc-bloc-etat__icone.sc-icon-tile { … }` ajouté à `situations.css` redessine la tuile (mesuré sur H43 : 50 px, rayon 4) avec les quatre gardes vertes ; la phrase « refusent toute redéfinition » du compte rendu de correction est fausse. Correctif : refuser toute règle dont le sélecteur contient `sc-bloc-etat__icone` et qui pose taille, rayon, fond ou couleur. `scripts/check-socle-briques.ts:316`, `scripts/check-socle-situations.ts:297`.
4. **Non arbitré (vu par deux lentilles)** — `check:socle` (« un gris de décor ne teinte ni un état ni un texte SVG ») ne lit que la dernière ligne d'une liste de sélecteurs : un état en première ligne d'une liste sur deux lignes passe. Correctif : `scripts/check-socle.ts:565`, lire la liste entière (`replace(/\s+/g, ' ')`).
5. **Non arbitré** — `check:coquille` (second passage) ne reconnaît que `rgb()` / `rgba()` : un ambre écrit en `color-mix()`, `color(srgb …)` ou `oklch()` passe, encre opaque comprise. Correctif : lire `color(srgb …)` par composantes et refuser par prudence toute autre écriture. `scripts/check-coquille.mjs:777` (et les deux autres portes).
6. **Non arbitré, démonstration seulement** — `align-items: flex-end` posé sur toutes les rangées `.sd-rangee` de `/dev/socle` (alignement des légendes) : 20 rangées bougent et trois rangées à pièces sans légende se dérèglent (avatars carrés 22 px plus bas que leurs voisins, anneau, jauge et courbe au bas des barres, bouton « Exporter »). Correctif : `.sd-rangee > :not(.sd-cas) { align-self: flex-start; }`. `src/refonte/systeme/demo/demo.css:134`. Aucun écran n'est touché.

Mineurs et notes, non corrigés : `formaterMontant(−0,001)` rend « -0,00 € » (le « jamais -0 € » ne tient que pour −0 ; arrondir au centime avant le test) ; les en-têtes de `useAccueil.ts` et `useAujourdhui.ts` promettent « une seule instance » des accès : coquille allumée, l'instance inactive de `useCalculAujourdhui(false)` reste montée (règle des hooks), une de moins qu'avant ; `check:socle` refuserait le `fill` d'une illustration ciblée par le ton de son bloc d'état (aucune feuille du dépôt dans ce cas) et ne reconnaît pas un gris de décor écrit en `rgb()` ; la teinte du neutre standard de `BlocEtat` tient par l'ordre d'import des feuilles dans `Ambiance.tsx` ; `jour.ts` prend son horloge dans le modèle de Supervisor (`src/bureaux`, interne seulement) et la carte « Aujourd'hui » a la sienne (deux phases possibles d'une minute) ; `check:substitutions` refuse tout fichier non `.tsx` dans `declarations/`, un README compris, et son « aucun autre `Outlet` » parcourt aussi `src/screens` (un écran futur à routes imbriquées serait refusé : voulu) ; `check:coquille` n'est pas dans la CI (navigateur) ; dans la démo des tuiles, la colonne « ligne » descend de 56 px pour aligner sa légende ; une teinte voisine de l'ambre passe la comparaison par triplets ; le segmenté désactivé à 0,6 d'opacité tombe à 2,7:1 (contrôle inactif, exempt, comme le sélecteur voisin) ; le typage exclusif de `PageHead` refuse aussi une bascule conditionnelle entre `controles` et `primaire` (deux branches JSX, aucun appelant concerné).

#### Écarts du socle complet (ce qui n'est pas branché ou diffère, avec la raison)

- Coquille éteinte par défaut (§1.9, passage 2 de T1).
- Compteurs LOT-06 non déclarés ; alertes Cyber nulles tant que le SOC n'est pas prêt.
- Délai de verrouillage de l'écran de veille sans effet (aucun verrou dans l'application ; l'aide le dit).
- Aucune substitution déclarée.
- `check:coquille` mode bundle, second passage : non exécuté ici.
- `Segmented` compact et `Check` 16 px sous 34 px : rangées denses seulement (LOT-06 en porte l'usage).
- `EtatVide` (Empty) : aspect de l'Accueil vivant et des archétypes `Tableau` / `Scinde` changé pour suivre le §4.
- Régression connue, non corrigée (seconde passe interrompue) : au survol, le segment actif d'un `Segmented` s'affiche en T2 au lieu de T1.
- Le chantier des briques, livré en un commit, a été rejoué en neuf commits (socle, barre, H43, D02, H40, H42-H47, H41, démo, garde) avant la fusion ; l'arbre final est identique.

#### Questions pour le CO (socle complet)

Voir la section LOT-00 de `STATUT.md` § 7 (quatorze questions).

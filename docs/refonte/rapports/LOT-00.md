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

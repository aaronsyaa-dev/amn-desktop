# Rapport de fin de session — DS Design en code (socle noir et gris)

## Résumé (5 lignes au plus)

1. **Jetons** : `src/socle/noir.css` porte les valeurs de la direction (fonds, bordures, encres, rayons, gabarits 252/60/48, halo, 7 familles, 4 états). Les noms du socle S0 sont redéfinis depuis les mêmes valeurs. Ce fichier remplace `src/refonte/accueil/ambiance.css`.
2. **Briques** (`src/socle/ui/`) : tuile KPI, barre et anneau de progression, pastille d'état, étiquette, avatar et pile, case à cocher, ligne de tâche, activité et étape franchie, état vide, squelette, raccourci. `Bouton` et `Carte` d'origine prennent le noir sans changer d'API.
3. **Coquille** (`src/socle/coquille/`) : barre latérale (7 familles, la Garde, « Tous les modules (101) », « En ligne »), en-tête (fil d'Ariane, « 3 en ligne », cloche, pastille de la Garde), barre Ajmani 48 px, palette ⌘J. Branchée sur les vraies données par `src/refonte/coquille/`. **Éteinte par défaut** (Paramètres › « Nouvelle coquille »).
4. **Accueil** (`AccueilVivant`) recâblé sur ces briques, aux mesures de la référence, avec états vides, chargement et « Ajouter une carte ». Sans la nouvelle coquille, il garde sa barre de familles d'avant.
5. `check:socle` passe de 25 à 49 propriétés (jetons, contrastes, `discret` interdit en texte, ARIA des briques et de la coquille, aucun personnage, éditions, drapeau). Paquet client identique octet pour octet.

## Branche et sha

- Branche : `claude/refonte-design-socle` (pas de PR, rien sur `main`)
- Dernier commit : voir le message au CO
- Partie de : `claude/refonte-vivante` @ `f059f32`

## Fichiers touchés

Sortie de `git diff --name-status origin/claude/refonte-vivante...HEAD` : voir le commit. Résumé :

- nouveaux : `src/socle/noir.css`, `src/socle/ui/{briques.css,Indicateurs,Pastilles,Taches,Activite,Etats}.tsx`, `src/socle/coquille/*`, `src/refonte/coquille/*`, `src/edition/coquille.{internal,business}.tsx`
- modifiés dans la zone du socle : `src/socle/i18n.ts` (clés de la coquille, noms de familles de la direction), `src/socle/ui/{Bouton,Carte,index}`
- modifiés dans la zone de l'Accueil : `AccueilVivant.tsx`, `Ambiance.tsx`, `i18n.ts`, `ajmani/phrases.ts` (vouvoiement), `ambiance.css` déplacé vers `src/socle/noir.css`

Fichiers **sensibles** ou **hors zone** touchés, avec la raison :

| Fichier | Changement (ajout seulement ?) | Pourquoi |
|---|---|---|
| `vite.edition.ts`, `tsconfig.json`, `tsconfig.business.json` | une ligne chacun (alias `@edition/coquille`) | nouvelle couture |
| `src/edition/coquille.business.tsx` | nouveau, **jumeau vide** (n'importe que React) | couture. Aucun fichier du paquet client ne l'importe. |
| `src/components/AppLayout.tsx` | ajout d'une branche `coquille ? <CoquilleRefonte> : (ancienne)` et d'un import | brancher la coquille derrière le drapeau. Fichier interne seulement. L'ancienne branche n'est pas modifiée. |
| `src/edition/socle.internal.tsx` | `MouvementSection` rend aussi `CoquilleSection` | une seule porte dans les Réglages : `SettingsScreen` (partagé) n'est pas touché |
| `scripts/check-socle.ts` | 24 propriétés ajoutées | garde |
| `scripts/check-ajmani.ts` | lit `src/socle/noir.css` au lieu de `ambiance.css` ; les contrastes de famille lisent la même feuille ; mêmes assertions | le fichier a changé de place |

`src/index.css`, `src/renderer.tsx`, `src/App.tsx`, `package.json`, `editions.yml`, `src/assistant/**`, `BarreRail.tsx`, `MobileBottomNav.tsx` : **non touchés**.

## Gardes

| Garde | Résultat |
|---|---|
| `typecheck` | OK |
| `typecheck:business` | OK |
| `lint` | OK (0 erreur, aucun nouvel avertissement) |
| `check:accueils` | OK |
| `check:socle` | OK, 49 propriétés |
| `check:moments` | OK |
| `check:navigation`, `check:garde-refonte`, `check:ajmani` | OK |
| les 40 autres `check:*` de `editions.yml` sans navigateur (sauf `business`, `updates`, `sync`, `signing`) | OK |
| `check:cibles`, `check:etiquettes`, `check:focus`, `check:largeur`, `check:mouvement` | OK (statiques) |
| `check:encres` (hors CI) | échoue comme avant (copies de jetons dans `src/refonte/garde/equipes.ts`) : sortie identique avant et après |
| Paquet client (esbuild de `renderer.tsx`, `tsconfig.business.json`, minifié) | **identique octet pour octet** avant et après (`261b6960e18a85eb`) ; aucun fichier `socle/` ni `refonte/` dedans |

## Points à trancher

- **Basculement.** Deux coquilles cohabitent (l'ancienne `AppLayout` avec son rail, et l'Accueil `42k` qui portait sa propre barre). Choix : drapeau, **éteint par défaut**. Au basculement (Harun et le CO), évoluent : `check:coquille` (mesure le rail 52/184, deux plaques, pas d'ambre : il échoue déjà côté interne depuis S1), `check:signal` (ambre), `check:mobile` (la barre du pouce n'existe pas dans la nouvelle coquille), `check:contraste`. Aucune n'a été modifiée ni contournée.
- **Ambre contre famille.** « Créer et produire » (`#D9A27A`) et l'état « attention » (`#D9A27A`) tombent dans la teinte de l'ambre (`--color-signal`, « une décision par écran »). La direction l'impose ; `check:socle` ne teste la règle de teinte que sur le graphite d'origine.
- **Bordures de contrôle** `#28282B` (1,3:1) : sous les 3:1 de WCAG 1.4.11 sur boutons contour et barre Ajmani. Le libellé identifie le contrôle, le focus (`#EDEDED`, 2 px) et le survol (`#6E6E73`) passent 3:1. Les rapprocher de `#6E6E73` rend l'écran plus dur : à voir sur capture.
- **Noms de familles** : ceux de la direction sont posés (« Mes contacts et clients », « Écrire et retenir », « L'argent », « Créer et produire », « Outils et réglages »). Ils règlent le point de STATUT sur « Créer ».
- **Vouvoiement** : appliqué à l'Accueil et à la bibliothèque de phrases d'Ajmani (fr). Le reste de l'application n'a pas été relu.
- **Ajouts à la référence** : l'en-tête garde l'état de synchronisation et le changement d'organisation (utiles, absents de la référence). Sous 900 px, la barre latérale devient un tiroir ; le geste de balayage de `AppLayout` ne l'ouvre pas encore.
- **Reste à faire** : migrer les autres écrans de référence (Tous les modules, Salle de contrôle, Veille H24, Facturation, Fiche client, Messagerie, Connexion, Tableau de bord configurable) ; la zone `largeur="lecture"` donne en attendant une colonne de 72 rem aux écrans non migrés.

## Ce qui n'a pas été vérifié

- **L'application n'a pas été lancée** (règle). Le rendu a été contrôlé hors dépôt, sans serveur : un fichier HTML statique (briques et Accueil sur données d'essai) ouvert dans Chromium sans tête, à 1440, 1100, 768 et 400 px. Mesures : barre 252, en-tête 60, barre Ajmani 48, tuile 92, ligne 60, titre 32/1,1 ; aucun débordement horizontal à 400 px ; 0 texte sous 4,5:1 sur 87 nœuds ; anneau de focus de 2 px sur chaque contrôle atteint au clavier.
- **Pas vérifié en conditions réelles** : ⌘J qui prend la touche à `AssistantContext` (capture + `stopImmediatePropagation`), le volet de la cloche et la palette sur le vrai catalogue, le tiroir sur téléphone, `check:business` (demande un build : remplacé par la comparaison du paquet).
- **Captures de la référence** : non reçues. Les mesures de Harun ont été suivies à la lettre ; les marges de la barre Ajmani (12/40/16 px) et la hauteur de l'en-tête de carte sont des suppositions.
- `check:coquille`, `check:mobile`, `check:contraste`, `check:signal`, `check:isolation` : demandent un build servi.

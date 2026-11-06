/**
 * LE CATALOGUE DES NOMS DES FICHES — les briques du socle sous le nom (anglais) que les fiches v3 leur donnent
 * (01-SOCLE-DESIGN §4, §0.4, §3 et STATUT §1.10 point 1), par simple alias d'export. Un alias n'est posé que si la
 * brique correspond, valeur pour valeur, à la ligne du §4 (`check:socle-briques` relit chaque ligne) ; sinon l'écart
 * est dit ici, et le nom reste libre.
 *
 * | Nom de fiche        | Brique              | Fichier                                   | Vérifié contre le §4 |
 * |---------------------|---------------------|-------------------------------------------|----------------------|
 * | Card                | Carte               | src/socle/ui/Carte.tsx (+ briques.css)    | rayon 14, dégradé, bordure, ombre interne, padding 16 × 18 / 14 × 16 |
 * | Button              | Bouton              | src/socle/ui/Bouton.tsx                   | primaire 8 × 15 / rayon 9 / 12,5 600, secondaire 7 × 13, icône 14, raccourci |
 * | Kpi                 | TuileKpi            | src/socle/ui/Indicateurs.tsx              | 84 à 92, libellé 12 T4, valeur 24 / 600, mini-courbe 70 × 26, barre 5 |
 * | Progress            | BarreProgression    | src/socle/ui/Indicateurs.tsx              | 5 px (4, 8), rayon 99, piste `--socle-piste`, dégradé ou couleur d'état |
 * | Ring                | AnneauProgression   | src/socle/ui/Indicateurs.tsx              | `taille={72}` à 76, `epaisseur={8}`, `piste="anneau"` (`--socle-anneau-fond`), extrémités rondes, valeur 600 tabulaire |
 * | Kbd                 | Raccourci           | src/socle/ui/Pastilles.tsx                | 11 px, bordure `--socle-bord-kbd`, fond `--socle-kbd`, rayon 5, T4 |
 * | Avatar              | Avatar              | src/socle/ui/Pastilles.tsx                | 22 à 34 px, lettres, carré arrondi 9 (`forme="carre"` = `Sq`) |
 * | AvatarStack         | PileAvatars         | src/socle/ui/Pastilles.tsx                | chevauchement −7 px, anneau de la couleur du fond |
 * | Check               | CaseACocher         | src/socle/ui/Taches.tsx                   | rond 18 (24 en série), bordure 1,5 `--socle-case-vide`, fait = disque primaire |
 * | Toggle              | Interrupteur        | src/socle/ui/controles/Formulaire.tsx     | 34 × 20, actif `--socle-toggle-actif`, inactif `--socle-toggle-inactif` |
 * | IconButton          | BoutonIcone         | src/socle/ui/controles/Formulaire.tsx     | 34 × 34, rayon 9, bordure `--socle-bord-bouton`, icône 15 |
 * | Select              | Selecteur           | src/socle/ui/controles/Formulaire.tsx     | 40 px, rayon 10, bordure `--socle-bord-champ`, 13,5 px |
 * | SearchBox           | BoiteRecherche      | src/socle/ui/controles/Formulaire.tsx     | 34 px, rayon 10, fond `--socle-champ`, bordure `--socle-bord-controle`, loupe 14 |
 * | Field               | Saisie              | src/socle/ui/Saisie.tsx                   | étiquette 12 T4 à 6 px, champ 40, rayon 10, bordure `--socle-bord-champ`, 13,5, aide 11,5 T4 |
 * | Tabs                | Onglets             | src/socle/ui/controles/Navigation.tsx     | écart 26, 13 px, actif 600 T1 filet 2 px, inactif T4, compteur `--socle-onglet-compteur` |
 * | Segmented           | Segmente            | src/socle/ui/controles/Navigation.tsx     | conteneur `--socle-encart` bordé, rayon 10, padding 3, actif `--socle-segment-actif` T1 500 |
 * | Suggestion          | SuggestionAjmani    | src/socle/ui/controles/Suggestion.tsx     | carte teintée, étincelle, titre 13 / 600, texte 12,5, primaire + secondaire |
 * | Subcard             | SousCarte           | src/socle/ui/controles/Surfaces.tsx       | rayon 11, fond `--socle-sous-carte`, bordure, padding 12 × 14 |
 * | FlagUrgent          | DrapeauUrgent       | src/socle/ui/controles/Surfaces.tsx       | 11 / 600 critique, fond 13 %, drapeau, rayon 6 |
 * | Chips               | FilterChips         | src/socle/ui/vivant/FilterChips.tsx       | puces 12 px, active `--socle-segment-actif` |
 * | SuggestionCompact   | InlineSuggestion    | src/socle/ui/vivant/InlineSuggestion.tsx  | bandeau étincelle + texte + Oui/Non |
 * | Sparkline           | MiniCourbe          | src/socle/ui/graphiques/MiniCourbe.tsx    | 70 × 26 par défaut |
 * | TimelineItem        | LigneTemps          | src/socle/ui/archetypes/LigneTemps.tsx    | heure 42 (12 T4), pastille 26, filet, titre 13,5 / 500, détail 12 T4 |
 * | StatusPill          | PastilleEtat        | src/socle/ui/Pastilles.tsx                | point 6 + libellé 11,5, fond teinté 12 %, padding 3 × 9, rayon 99 |
 * | PageHead            | PageHead (= EnTeteDePage) | src/socle/ui/archetypes/Page.tsx    | h1 28 / 600 −.02 em 1,1, sous-titre 13,5 T4 à 7 px, boutons 31 à 9 px, `controles` |
 * | IconTile            | IconTile            | src/socle/ui/briques-partagees/IconTile.tsx         | carré arrondi teinté 13 % ou neutre, 22 à 48 px |
 * | CountBadge          | CountBadge          | src/socle/ui/briques-partagees/CountBadge.tsx       | 16 px, `--socle-pastille-compte`, 10,5 / 600, rouge si critique |
 * | ModuleTile          | ModuleTile          | src/socle/ui/briques-partagees/ModuleTile.tsx       | `ligne` (D02, 34 px) et `standard` (41 px, provisoire) |
 * | ModuleGroupGrid     | ModuleGroupGrid     | src/socle/ui/briques-partagees/ModuleTile.tsx       | titre 11 capitales T4 .08em + effectif, N colonnes (provisoire) |
 * | AddModuleTile       | AddModuleTile       | src/socle/ui/briques-partagees/ModuleTile.tsx       | pointillé `--socle-pointille`, même hauteur que ModuleTile |
 * | Sidebar             | BarreLaterale       | src/socle/coquille/BarreLaterale.tsx      | §0.1 (capturée : COQUILLE-H42, 0,10 %) |
 * | Header              | EnTete              | src/socle/coquille/EnTete.tsx             | §3 (capturée) |
 * | AjmaniBar           | BarreAjmani         | src/socle/coquille/BarreAjmani.tsx        | §0.4 (capturée) |
 *
 * SANS ALIAS (la brique ne correspond pas à la ligne du §4 ; à décider par le CO) :
 * · `Empty` ≠ `EtatVide` : le §4 veut un pointillé `--socle-pointille` (#2E2E33), un rayon 14, une icône de 44 px
 *   dans un carré arrondi, un titre 14 / 600, un texte 12,5 T4 (300 px au plus) et TOUJOURS une action ; `EtatVide`
 *   dessine un pointillé `--socle-bord-controle` (#28282B), un rayon 12, aucune icône, un titre de 15 px sous
 *   l'ambiance noire (cote de H43), et son action est facultative. Les écrans qui l'emploient (`AccueilVivant`)
 *   gardent leurs pixels : il n'est pas retouché ici. `BlocEtat` (situations, 48 ou 36 px) couvre les états de H43.
 *
 * `Sq` n'est pas une brique à part : `<Avatar forme="carre" />`. `Pill` = `Etiquette`, `Tag`, `Severity`, `LiveDot`,
 * `Caret`, `Gauge`, `HeatCell`, `FlowLine`, `Table`, `Ticket`, `Donut` gardent déjà leur nom de fiche ou leur nom
 * propre (`Tableau`, `Ticket`, `Donut`) dans leur groupe.
 */
export { Carte as Card } from './Carte';
export { Bouton as Button } from './Bouton';
export { TuileKpi as Kpi, BarreProgression as Progress, AnneauProgression as Ring } from './Indicateurs';
export { Raccourci as Kbd, PileAvatars as AvatarStack, PastilleEtat as StatusPill } from './Pastilles';
export { CaseACocher as Check } from './Taches';
export { Saisie as Field } from './Saisie';
export { Interrupteur as Toggle, BoutonIcone as IconButton, Selecteur as Select, BoiteRecherche as SearchBox } from './controles/Formulaire';
export { Onglets as Tabs, Segmente as Segmented } from './controles/Navigation';
export { SuggestionAjmani as Suggestion } from './controles/Suggestion';
export { SousCarte as Subcard, DrapeauUrgent as FlagUrgent } from './controles/Surfaces';
export { FilterChips as Chips } from './vivant/FilterChips';
export { InlineSuggestion as SuggestionCompact } from './vivant/InlineSuggestion';
export { MiniCourbe as Sparkline } from './graphiques/MiniCourbe';
export { LigneTemps as TimelineItem } from './archetypes/LigneTemps';

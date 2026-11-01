/*
 * v3 (01-SOCLE-DESIGN §0.3) : les archétypes ne sont PLUS des gabarits à copier. Ce sont des briques réutilisables
 * (un tableau, un kanban, une semaine…) qu'un écran peut poser dans SA surface ; chaque écran a sa composition
 * propre, décrite par sa fiche. Rien n'est retiré : d'autres écrans les emploient.
 */
/**
 * Briques du groupe « archetypes » (LOT-00) : le gabarit de page et les cinq archétypes de module du §5.
 *
 *   Page, EnTeteDePage, RangeeKpi, ColonneDroite, DispositionPage   — le gabarit (§3)
 *   Tableau + Cellule*                                              — « table »
 *   Kanban, ColonneKanban, Ticket                                   — « board »
 *   GrilleCartes, CarteModule                                       — « cards »
 *   Scinde, ListeScindee, ElementListe, DetailScinde                — « split »
 *   Semaine                                                         — « week »
 *   LigneTemps, ChronologieTemps                                    — TimelineItem
 *
 * Mode d'emploi : `import { Page, EnTeteDePage, RangeeKpi, DispositionPage, Tableau } from '../socle/ui';` — voir l'en-tête de `Page.tsx`.
 * La logique sans React (tri, placement des événements, clavier) est dans `./logique/*` ; les entrées utiles sont réexportées ici.
 */
export { Page, EnTeteDePage, RangeeKpi, ColonneDroite, DispositionPage, type PageProps, type ActionPage, type EnTeteDePageProps, type ColonneDroiteProps, type DispositionPageProps } from './Page';
export {
  Tableau,
  CelluleNom,
  CelluleTexte,
  CelluleEtat,
  CelluleProgression,
  CelluleAvatar,
  CelluleMontant,
  CelluleTag,
  CelluleDate,
  CelluleCase,
  CelluleInterrupteur,
  CelluleIcone,
  CelluleBouton,
  type TableauProps,
  type ColonneTableau,
  type EtatVideTableau,
  type Alignement,
} from './Tableau';
export { Kanban, ColonneKanban, Ticket, type KanbanProps, type ColonneKanbanDef, type ColonneKanbanProps, type DeplacementKanban, type TicketProps } from './Kanban';
export { GrilleCartes, CarteModule, type GrilleCartesProps, type CarteModuleProps } from './Cartes';
export { Scinde, ListeScindee, ElementListe, DetailScinde, type ListeScindeeProps, type ElementListeProps, type DetailScindeProps } from './Scinde';
export { Semaine, type SemaineProps, type EvenementSemaine } from './Semaine';
export { LigneTemps, ChronologieTemps, type LigneTempsProps } from './LigneTemps';
export { TexteTronque } from './TexteTronque';
// La logique sans React : les entrées utiles aux écrans. Le reste se lit à `./logique/*`.
export { debutDeSemaine, joursConsecutifs, memeJour, placerEvenements, positionMaintenant, PX_PAR_HEURE, type Placement } from './logique/semaine';
export { trierLignes, filtrerLignes, regrouperLignes, prochainTri, ariaSort, type TriTableau } from './logique/tableau';
export { deplacerElement, type ColonneLogique, type ResultatDeplacement } from './logique/kanban';
export { deplacerLineaire, deplacerDansGrille, nombreDeColonnes } from './logique/navigation';
export { formaterPourcent as formaterRatio, formaterMontant, formaterDate, formaterHeure } from './logique/formats';

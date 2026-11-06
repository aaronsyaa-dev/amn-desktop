/**
 * LES FORMATS DU SOCLE, IMPORTABLES PARTOUT — nombres, pour cent, euros, montants, dates, heures à la française.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Pourquoi ce module (LOT-06, point 6) : `check:socle-graphiques` interdit à tout fichier hors de `src/socle/`
 * d'importer `src/socle/ui/graphiques/*` (ses formats compris), pour que les graphiques restent un groupe fermé ;
 * les lots recopiaient donc les formats. Ce module neutre, lui, s'importe depuis tout code interne
 * (`src/refonte/**`, `src/socle/**`) : il ne fait que réexporter les deux sources, sans rien recopier.
 *
 *   import { formaterNombre, formaterPourcent, formaterEuro, formaterMontant, formaterDate, formaterHeure } from '../../socle/formats';
 *
 *   formaterNombre(1234.5)        → « 1 234,5 »      (milliers en insécable fine, virgule)
 *   formaterPourcent(78)          → « 78 % »          (DÉJÀ en pour cent, insécable avant %)
 *   formaterRatio(0.78)           → « 78 % »          (un ratio de 0 à 1, arrondi à l'entier)
 *   formaterEuro(3840)            → « 3 840 € »       (des EUROS ; décimales seulement si le montant n'est pas rond)
 *   formaterMontant(1250, 'EUR')  → « 1 250 € »       (par Intl, devise au choix)
 *   formaterDate(date)            → « 30 oct. »       (options Intl au choix)
 *   formaterHeure(date)           → « 10:42 »
 *   dateIso(date)                 → « 2026-10-30T09:42:00.000Z » (pour <time dateTime>)
 *
 * Jamais une donnée réelle ici : ce sont des fonctions pures, sans React, sans import hors du socle. Les règles
 * (espaces insécables ; « — » pour une valeur illisible — NaN, ±Infinity, date invalide — sur chacun des huit
 * exports sauf `dateIso`, qui rend « » ; mêmes euros que `formatCentsCompact`) sont tenues par
 * `check:socle-graphiques` et `check:socle-archetypes` ; ce module y est vérifié identique à ses sources.
 */
export { formaterNombre, formaterPourcent, formaterEuro, ESPACE_INSECABLE, ESPACE_FINE, TIRET_ABSENT, type OptionsNombre } from './ui/graphiques/format';
export { formaterPourcent as formaterRatio, formaterMontant, formaterDate, formaterHeure, dateIso, type Locale } from './ui/archetypes/logique/formats';

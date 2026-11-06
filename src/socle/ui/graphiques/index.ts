/** Briques du groupe « graphiques » (LOT-00). Mode d'emploi : docs/refonte-socle.md. */
export { Courbe, type CourbeProps, type PointGraphique } from './Courbe';
export { MiniCourbe, type MiniCourbeProps } from './MiniCourbe';
export { Barres, type BarresProps } from './Barres';
export { Donut, ECART_DONUT, type DonutProps, type SegmentDonut } from './Donut';
export { Anneau, EPAISSEUR_ANNEAU, TAILLE_ANNEAU_MIN, TAILLE_ANNEAU_MAX, tailleAnneau, epaisseurAnneau, coteAnneau, type AnneauProps } from './Anneau';
export { formaterNombre, formaterPourcent, formaterEuro, type OptionsNombre } from './format';
export { calculerEchelle, repartirPourcents, arcsDonut, type Echelle } from './calculs';
export { couleurTon, type TonGraphique } from './tons';

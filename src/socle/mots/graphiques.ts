/**
 * Les mots du groupe « graphiques » du socle (LOT-00). Même schéma que `src/socle/i18n.ts` :
 * l'anglais est la base, le français est typé contre lui. Fusionnés dans `i18n.ts`.
 *
 * Les résumés lus par les lecteurs d'écran (« Courbe, 12 points, de X à Y, dernier : Z »)
 * reçoivent des valeurs DÉJÀ mises en forme : ces mots ne formatent aucun nombre.
 */
export const EN_GRAPHIQUES = {
  'graphique.vide': 'No data yet',
  'graphique.aucuneDonnee': 'No data',
  'graphique.courbe': 'Line chart, {n} points, from {min} to {max}, last: {dernier}',
  'graphique.courbe.un': 'Line chart, 1 point: {dernier}',
  'graphique.courbe.vide': 'Line chart, no data yet',
  'graphique.tendance': 'Trend, {n} points, from {min} to {max}, last: {dernier}',
  'graphique.tendance.un': 'Trend, 1 point: {dernier}',
  'graphique.tendance.vide': 'Trend, no data yet',
  'graphique.barres': 'Bar chart, {n} bars, from {min} to {max}',
  'graphique.barres.vide': 'Bar chart, no data yet',
  'graphique.donut': 'Breakdown, parts: {n}, total: {total}',
  'graphique.donut.vide': 'Breakdown, no data',
  'graphique.tableau.etiquette': 'Label',
  'graphique.tableau.valeur': 'Value',
  'graphique.tableau.part': 'Share',
  'graphique.serie1': 'Series 1',
  'graphique.serie2': 'Series 2',
  'graphique.point': '{etiquette}: {valeur}',
  'graphique.points': 'Chart points. Use the left and right arrow keys to move.',
  'graphique.legende': 'Legend',
} as const;

export const FR_GRAPHIQUES: Record<keyof typeof EN_GRAPHIQUES, string> = {
  'graphique.vide': 'Pas encore de données',
  'graphique.aucuneDonnee': 'Aucune donnée',
  'graphique.courbe': 'Courbe, {n} points, de {min} à {max}, dernier : {dernier}',
  'graphique.courbe.un': 'Courbe, 1 point : {dernier}',
  'graphique.courbe.vide': 'Courbe, pas encore de données',
  'graphique.tendance': 'Tendance, {n} points, de {min} à {max}, dernier : {dernier}',
  'graphique.tendance.un': 'Tendance, 1 point : {dernier}',
  'graphique.tendance.vide': 'Tendance, pas encore de données',
  'graphique.barres': 'Barres, {n} colonnes, de {min} à {max}',
  'graphique.barres.vide': 'Barres, pas encore de données',
  'graphique.donut': 'Répartition, parts : {n}, total : {total}',
  'graphique.donut.vide': 'Répartition, aucune donnée',
  'graphique.tableau.etiquette': 'Libellé',
  'graphique.tableau.valeur': 'Valeur',
  'graphique.tableau.part': 'Part',
  'graphique.serie1': 'Série 1',
  'graphique.serie2': 'Série 2',
  'graphique.point': '{etiquette} : {valeur}',
  'graphique.points': 'Points du graphique. Utilisez les flèches gauche et droite pour vous déplacer.',
  'graphique.legende': 'Légende',
};

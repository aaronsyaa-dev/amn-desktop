/**
 * Les mots du groupe « vivant » du socle (v3, 01-SOCLE-DESIGN §0.4). Même schéma que `src/socle/i18n.ts` :
 * l'anglais est la base, le français est typé contre lui. Fusionnés dans `i18n.ts`.
 *
 * Les niveaux s'écrivent en minuscules ici : la feuille les met en capitales (`text-transform`), pour qu'un
 * lecteur d'écran lise « Critique » et non une suite de lettres.
 */
export const EN_VIVANT = {
  'vivant.niveau.critique': 'Critical',
  'vivant.niveau.moyen': 'Medium',
  'vivant.niveau.faible': 'Low',
  'vivant.niveau.info': 'Info',
  'vivant.niveau.ok': 'OK',
  'vivant.jauge.valeur': '{valeur} out of 100',
  'vivant.suggestion.oui': 'Yes',
  'vivant.suggestion.non': 'No',
} as const;

export const FR_VIVANT: Record<keyof typeof EN_VIVANT, string> = {
  'vivant.niveau.critique': 'Critique',
  'vivant.niveau.moyen': 'Moyen',
  'vivant.niveau.faible': 'Faible',
  'vivant.niveau.info': 'Info',
  'vivant.niveau.ok': 'OK',
  'vivant.jauge.valeur': '{valeur} sur 100',
  'vivant.suggestion.oui': 'Oui',
  'vivant.suggestion.non': 'Non',
};

/**
 * LES MODÈLES DE PHRASES — `{nom}` et le pluriel, partagés par la bibliothèque
 * d'Ajmani (`ajmani/phrases.ts`) et les mots de l'Accueil (`i18n.ts`).
 *
 *   {nom}                    → la valeur, telle quelle ;
 *   {n#facture|factures}     → « facture » ou « factures » selon la valeur de n.
 *
 * Le français met au singulier 0 et 1 (« 0 facture », « 1 facture »), l'anglais
 * seulement 1. Un paramètre manquant reste visible dans le texte, pour que les
 * contrôles l'attrapent plutôt qu'un « undefined » à l'écran.
 */
export type Parametres = Record<string, string | number>;

export const MOTIF_PARAMETRE = /\{(\w+)(?:#([^}|]*)\|([^}]*))?\}/g;

export function remplir(modele: string, params: Parametres = {}, langue: 'fr' | 'en' = 'fr'): string {
  return modele.replace(MOTIF_PARAMETRE, (tout, cle: string, singulier?: string, pluriel?: string) => {
    if (!(cle in params)) return tout;
    const valeur = params[cle];
    if (singulier === undefined || pluriel === undefined) return String(valeur);
    const n = Math.abs(Number(valeur));
    const un = langue === 'fr' ? n < 2 : n === 1;
    return `${valeur} ${un ? singulier : pluriel}`;
  });
}

/** Les noms de paramètres d'un modèle, triés — pour comparer le français et l'anglais. */
export function nomsDeParametres(modele: string): string[] {
  return [...modele.matchAll(MOTIF_PARAMETRE)].map((m) => m[1]).sort();
}

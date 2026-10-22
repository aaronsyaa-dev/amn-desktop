import { useLangue, type Langue } from '../../i18n';

/**
 * Les mots d'un module d'atelier, sur le modèle de `src/socle/i18n.ts` :
 * l'anglais est le schéma, le français est typé contre lui (une clé oubliée
 * ne compile pas). Rien n'entre dans `src/i18n/fr.ts` / `en.ts`.
 *
 *   const EN = { 'titre': 'Hourly rate' } as const;
 *   const FR: Record<keyof typeof EN, string> = { 'titre': 'Taux horaire' };
 *   export const { useTextes, traduire } = textes(EN, FR);
 *
 * Une valeur peut porter des trous `{nom}`, remplis par le second argument.
 */
export function textes<K extends string>(en: Record<K, string>, fr: Record<K, string>) {
  const dicos: Record<Langue, Record<K, string>> = { en, fr };
  const traduire = (langue: Langue, cle: K, vars?: Record<string, string | number>): string => {
    const brut = dicos[langue][cle] ?? en[cle];
    return vars ? brut.replace(/\{(\w+)\}/g, (_, n: string) => String(vars[n] ?? `{${n}}`)) : brut;
  };
  const useTextes = () => {
    const { langue } = useLangue();
    return { langue, tx: (cle: K, vars?: Record<string, string | number>) => traduire(langue, cle, vars) };
  };
  return { traduire, useTextes, dicos };
}

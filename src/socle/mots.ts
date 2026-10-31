import { useLangue, type Langue } from '../i18n';

/**
 * LES MOTS D'UNE ZONE — le même schéma que `src/socle/i18n.ts`, pour chaque écran.
 *
 * Chaque écran de la refonte garde ses textes dans son propre fichier
 * (`src/refonte/<zone>/i18n.ts`) : l'anglais est la base, le français est typé
 * contre lui (une clé oubliée ne compile pas), et rien n'entre dans
 * `src/i18n/fr.ts` ni `en.ts`, qui partent dans le paquet de l'édition cliente.
 *
 *   const { useMots, traduire } = definirMots(EN, FR);
 *   const { tm } = useMots();          // dans un composant : re-rend au changement de langue
 *   traduire('fr', 'titre');           // hors composant
 *
 * Les paramètres s'écrivent `{nom}` dans le texte.
 */
export type ParamsMots = Record<string, string | number>;

export function definirMots<EN extends Readonly<Record<string, string>>>(en: EN, fr: Readonly<Record<keyof EN, string>>) {
  type Cle = keyof EN & string;
  const dictionnaires: Record<Langue, Readonly<Record<string, string>>> = { en, fr };
  function traduire(langue: Langue, cle: Cle, params?: ParamsMots): string {
    const texte = dictionnaires[langue][cle] ?? en[cle];
    return params ? texte.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : texte;
  }
  function useMots(): { langue: Langue; tm: (cle: Cle, params?: ParamsMots) => string } {
    const { langue } = useLangue();
    return { langue, tm: (cle, params) => traduire(langue, cle, params) };
  }
  return { useMots, traduire, dictionnaires };
}

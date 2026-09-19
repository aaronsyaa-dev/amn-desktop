import { useCallback, useEffect, useState } from 'react';

/**
 * CE QUE LE BUDGET PERSONNEL NE FAIT PAS (BLOC 2)
 * ═══════════════════════════════════════════════
 *
 * Il ne quitte pas ce poste. Pas de collection synchronisée, pas de route
 * `/v1/collections`, rien qui parte vers amn-api — donc rien qui arrive dans
 * l'espace de l'organisation.
 *
 * Ce n'est pas une facilité, c'est le seul choix défendable. Les
 * enregistrements synchronisés sont isolés PAR ORGANISATION, jamais par
 * personne : dans une organisation à plusieurs, ce qu'un membre écrit, celui
 * qui administre l'organisation peut le lire. Un solde bancaire et une date de
 * paie sont précisément ce qu'on ne met pas dans un espace commun, et le
 * module s'appelle « Personnel ».
 *
 * La contrepartie est réelle et assumée : ces chiffres ne suivent pas sur le
 * téléphone, et une réinstallation les perd. Pour un formulaire de cinq
 * nombres qu'on met à jour une fois par mois, c'est le bon échange. La liste
 * de courses, elle, se synchronise — parce qu'on l'écrit au bureau et qu'on
 * s'en sert dans le magasin, et parce qu'une liste de courses n'est pas un
 * relevé bancaire.
 *
 * Et ce n'est pas un coffre-fort : `localStorage` n'est pas chiffré. Ce qui
 * doit l'être va dans le Coffre-fort, qui l'est.
 */

const KEY = 'amn.personnel.budget';
const KEY_ENGAGEMENTS = 'amn.personnel.budget.engagements';

export type BudgetInputs = Record<string, string>;

/**
 * UN PRÉLÈVEMENT ATTENDU — ce qui part du compte avant la paie.
 *
 * POURQUOI CETTE LISTE EXISTE. La cascade de soustraction de l'écran (système
 * de design, `13c`) a besoin d'une marche PAR ENGAGEMENT : « chaque engagement
 * du mois retire ensuite sa marche, dessinée comme un segment suspendu dont le
 * haut touche le bas du segment précédent ». Avec un seul total de
 * prélèvements, la cascade n'a qu'une marche — c'est-à-dire une soustraction
 * ordinaire, et l'instrument ne montre plus rien que le chiffre ne disait pas.
 *
 * Elle ne remplace pas le total : quand la liste est vide, le champ
 * « prélèvements » saisi à la main reste la source, et la cascade se réduit à
 * une marche. Quand elle existe, le total s'en déduit — on ne saisit jamais le
 * même nombre à deux endroits.
 *
 * Même garantie que le reste du module : ça ne quitte pas ce poste.
 */
export interface EngagementPersonnel {
  id: string;
  label: string;
  /** Le montant en euros, tel que tapé. Une chaîne, comme les autres saisies. */
  montant: string;
  /** Le jour du mois où ça part, 1–31. Vide si on ne le sait pas. */
  jour: string;
}

function lireEngagements(): EngagementPersonnel[] {
  try {
    const raw = window.localStorage.getItem(KEY_ENGAGEMENTS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
      .map((e) => ({
        id: typeof e.id === 'string' ? e.id : Math.random().toString(36).slice(2),
        label: typeof e.label === 'string' ? e.label : '',
        montant: typeof e.montant === 'string' ? e.montant : '',
        jour: typeof e.jour === 'string' ? e.jour : '',
      }));
  } catch {
    return [];
  }
}

function read(): BudgetInputs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    // Seules les chaînes sont conservées : le champ garde le TEXTE saisi, pas
    // un nombre — même convention que les Calculateurs, pour que « 45,50 »
    // reste tapable caractère par caractère.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'string'),
    ) as BudgetInputs;
  } catch {
    return {};
  }
}

export function usePersonalBudget() {
  const [values, setValues] = useState<BudgetInputs>(() =>
    typeof window === 'undefined' ? {} : read(),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(values));
    } catch {
      /* mode privé : la saisie vaut pour la session, et c'est tout. */
    }
  }, [values]);

  const setValue = useCallback((key: string, raw: string) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
  }, []);

  const [engagements, setEngagements] = useState<EngagementPersonnel[]>(() =>
    typeof window === 'undefined' ? [] : lireEngagements(),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_ENGAGEMENTS, JSON.stringify(engagements));
    } catch {
      /* mode privé : même contrepartie que pour les cinq nombres. */
    }
  }, [engagements]);

  const ajouterEngagement = useCallback(() => {
    setEngagements((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), label: '', montant: '', jour: '' },
    ]);
  }, []);

  const modifierEngagement = useCallback((id: string, patch: Partial<EngagementPersonnel>) => {
    setEngagements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const retirerEngagement = useCallback((id: string) => {
    setEngagements((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const reset = useCallback(() => {
    setValues({});
    setEngagements([]);
  }, []);

  return {
    values,
    setValue,
    reset,
    engagements,
    ajouterEngagement,
    modifierEngagement,
    retirerEngagement,
  };
}

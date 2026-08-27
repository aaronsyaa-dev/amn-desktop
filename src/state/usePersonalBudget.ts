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

export type BudgetInputs = Record<string, string>;

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

  const reset = useCallback(() => setValues({}), []);

  return { values, setValue, reset };
}

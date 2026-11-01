/* Logique pure de la barre latérale (sans React) : éprouvée par `check:socle-coquille`. */

import type { ModuleLateral } from '../../socle/coquille';

/**
 * Combien de lignes la sous-liste d'une famille montre dans la barre latérale v3 (§0.1 : « au plus 5 lignes »,
 * « Vue d'ensemble » comprise quand la famille en a une) ; le reste : « + N autres ».
 */
export const MODULES_VISIBLES = 5;

/** Les modules montrés sous une famille : cinq lignes, moins celle de la « Vue d'ensemble » quand elle existe. */
export function placesDeModules(avecEnsemble: boolean): number {
  return avecEnsemble ? MODULES_VISIBLES - 1 : MODULES_VISIBLES;
}

/**
 * Les modules qu'une famille montre : les essentiels d'abord, puis les courants, puis les avancés (dans l'ordre
 * du registre à niveau égal), au plus `MODULES_VISIBLES` — et le module courant y est toujours, quitte à prendre la
 * place du dernier. Rendus dans l'ordre du registre, pour que la liste ne saute pas d'un écran à l'autre.
 */
export function choisirLesVisibles<T extends { courant: boolean; avance: boolean; niveau?: string }>(modules: T[], max = MODULES_VISIBLES): T[] {
  if (modules.length <= max) return modules;
  const rang = (m: T) => (m.niveau === 'essentiel' ? 0 : m.avance || m.niveau === 'avance' ? 2 : 1);
  const choisis = new Set(
    modules
      .map((m, i) => ({ m, i }))
      .sort((a, b) => rang(a.m) - rang(b.m) || a.i - b.i)
      .slice(0, max)
      .map((x) => x.m),
  );
  const courant = modules.find((m) => m.courant);
  if (courant && !choisis.has(courant)) {
    const dernier = modules.filter((m) => choisis.has(m)).pop();
    if (dernier) choisis.delete(dernier);
    choisis.add(courant);
  }
  return modules.filter((m) => choisis.has(m));
}

/** Combien d'épinglés la barre montre (§0.1 : « 3 modules choisis par la personne, sans le module ouvert »). */
export const EPINGLES_BARRE = 3;

/**
 * Les épinglés : les favoris dans l'ordre où la personne les a épinglés, chacun rangé à son entrée (une entrée une
 * fois), sans le module ouvert, au plus `max`. Pur : `check:socle-coquille`.
 */
export function choisirEpingles(favoris: readonly string[], entreeDe: (cleVue: string) => ModuleLateral | undefined, max = EPINGLES_BARRE): ModuleLateral[] {
  const vus = new Set<string>();
  const sortie: ModuleLateral[] = [];
  for (const cle of favoris) {
    const m = entreeDe(cle);
    if (!m || vus.has(m.cle)) continue;
    vus.add(m.cle);
    if (m.courant) continue;
    sortie.push(m);
    if (sortie.length >= max) break;
  }
  return sortie;
}

/* Logique pure de la barre latérale (sans React) : éprouvée par `check:socle-coquille`. */

/** Combien de modules une famille montre dans la barre latérale (le reste : « + N autres »). */
export const MODULES_VISIBLES = 7;

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

/**
 * Le petit banc d'essai de l'atelier : sans dépendance, lancé par
 * `node src/ateliers/verifier.mjs`. Chaque module exporte `TESTS` depuis son
 * `tests.ts`.
 */
export interface Test {
  nom: string;
  f: () => void;
}

export function egal<T>(recu: T, attendu: T, message = ''): void {
  const a = JSON.stringify(recu);
  const b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${message ? `${message} — ` : ''}reçu ${a}, attendu ${b}`);
}

export function vrai(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

export function leve(f: () => unknown, message: string): void {
  try {
    f();
  } catch {
    return;
  }
  throw new Error(`aurait dû lever : ${message}`);
}

/** Exige une valeur présente et la rend typée (évite les `!` dans les tests). */
export function doit<T>(x: T | null | undefined, message = 'valeur attendue'): T {
  if (x === null || x === undefined) throw new Error(message);
  return x;
}

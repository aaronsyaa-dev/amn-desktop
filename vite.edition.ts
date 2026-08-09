import path from 'node:path';

/**
 * Résolution de l'édition à construire — partagée par les trois configs Vite
 * (renderer, main, preload) pour qu'elles ne puissent pas diverger.
 *
 * `AMN_EDITION=business` produit AMN Business, l'édition livrée aux
 * organisations clientes. Sans variable, on construit l'édition interne : le
 * défaut est celui d'Aaron et Mohamed, donc un build lancé par réflexe ne
 * fabrique jamais par accident une app amputée.
 *
 * Les alias ci-dessous sont le mécanisme central de l'affaire : `@edition/*`
 * pointe vers `*.internal.*` ou `*.business.*`, et Rollup ne met dans le
 * bundle que ce que la variante retenue importe. Les modules exclusifs ne sont
 * donc pas désactivés dans le build Business — ils n'y sont pas.
 */
export type Edition = 'internal' | 'business';

export function resolveEdition(env: Record<string, string> = {}): Edition {
  const raw = process.env.AMN_EDITION || env.AMN_EDITION || 'internal';
  return raw === 'business' ? 'business' : 'internal';
}

export function editionAliases(edition: Edition): Record<string, string> {
  const suffix = edition === 'business' ? 'business' : 'internal';
  const root = process.cwd();
  const at = (rel: string) => path.resolve(root, rel);
  return {
    '@edition/modules': at(`src/edition/modules.${suffix}.ts`),
    '@edition/changelog': at(`src/edition/changelog.${suffix}.ts`),
    '@edition/seeds': at(`src/edition/seeds.${suffix}.ts`),
    '@edition/browserExclusive': at(`src/edition/browserExclusive.${suffix}.ts`),
    '@edition/exclusive': at(`src/edition/exclusive.${suffix}.tsx`),
    '@edition/appRoot': at(`src/edition/appRoot.${suffix}.tsx`),
    '@edition/mainExclusive': at(`src/main/exclusive.${suffix}.ts`),
    '@edition/preloadExclusive': at(`src/preload.exclusive.${suffix}.ts`),
  };
}

/** Constante littérale `__AMN_EDITION__`, lisible depuis src/edition/edition.ts. */
export function editionDefine(edition: Edition): Record<string, string> {
  return { __AMN_EDITION__: JSON.stringify(edition) };
}

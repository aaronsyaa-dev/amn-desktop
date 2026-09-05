import fs from 'node:fs';
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
    '@edition/ajmani': at(`src/edition/ajmani.${suffix}.ts`),
    '@edition/navLexique': at(`src/edition/navLexique.${suffix}.ts`),
    '@edition/cartes': at(`src/edition/cartes.${suffix}.ts`),
    '@edition/dbSeed': at(`src/edition/dbSeed.${suffix}.ts`),
    '@edition/changelog': at(`src/edition/changelog.${suffix}.ts`),
    '@edition/seeds': at(`src/edition/seeds.${suffix}.ts`),
    '@edition/browserExclusive': at(`src/edition/browserExclusive.${suffix}.ts`),
    '@edition/exclusive': at(`src/edition/exclusive.${suffix}.tsx`),
    '@edition/appRoot': at(`src/edition/appRoot.${suffix}.tsx`),
    '@edition/mainExclusive': at(`src/main/exclusive.${suffix}.ts`),
    '@edition/preloadExclusive': at(`src/preload.exclusive.${suffix}.ts`),
  };
}

/**
 * Constantes littérales injectées dans les trois bundles, lues depuis
 * `src/edition/edition.ts`.
 *
 * `__AMN_VERSION__` vient de `package.json`, et c'est le point : la version
 * affichée était jusqu'ici la première entrée du CHANGELOG, un tableau tenu à
 * la main. Sur Electron, personne ne s'en apercevait — l'app y lit
 * `app.getVersion()`, donc la vraie. Sur le web et la PWA, où cet appel
 * n'existe pas, l'écran des réglages annonçait la version du dernier changelog
 * rédigé : 1.2.0 en interne, 1.2.11 en Business, pour un produit en 1.2.20.
 *
 * Le changelog redevient ce qu'il est — une histoire des changements notables,
 * qu'on écrit quand il y a quelque chose à dire — et la version vient de la
 * seule source qui ne peut pas dériver, puisque c'est elle qu'on incrémente
 * pour publier.
 */
export function editionDefine(edition: Edition): Record<string, string> {
  return {
    __AMN_EDITION__: JSON.stringify(edition),
    __AMN_VERSION__: JSON.stringify(readPackageVersion()),
  };
}

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

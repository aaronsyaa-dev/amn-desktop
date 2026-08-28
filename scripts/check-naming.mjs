#!/usr/bin/env node
/**
 * L'IDENTITÉ DES DEUX ÉDITIONS — un contrôle, quatre fichiers
 * ═══════════════════════════════════════════════════════════
 *
 * Le nom, l'appId, l'AUMID et le dossier d'installation d'une édition vivent
 * dans quatre fichiers différents, et rien ne les tenait ensemble.
 *
 * Ce que ça a produit, mesuré au Bloc 1 avant d'y toucher : les deux éditions
 * s'installaient dans le MÊME dossier (`%LOCALAPPDATA%\\Programs\\amn-desktop`),
 * l'une écrasant l'autre — pendant que le commentaire d'`electron-builder.config.mjs`
 * affirmait qu'elles « coexistent sans se toucher ». C'était vrai du dossier de
 * données, faux du dossier d'installation, et aucun contrôle ne pouvait le dire.
 *
 * La cause : avec `oneClick: true` + `perMachine: false`, NSIS nomme le dossier
 * d'après le champ `name` de package.json — unique pour les deux éditions,
 * puisqu'elles partagent un dépôt — et non d'après `productName`.
 *
 * Quatre règles :
 *
 *   1. l'AUMID de `src/main.ts` est EXACTEMENT l'appId d'electron-builder,
 *      édition par édition (sinon Windows n'affiche aucune notification) ;
 *   2. les deux éditions ont des identités DISTINCTES deux à deux ;
 *   3. le nom affiché (`EDITION_PRODUCT_NAME`) est celui du paquet ;
 *   4. aucun nom de produit n'est écrit en dur hors des deux sources.
 *
 *   node scripts/check-naming.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** La configuration telle qu'electron-builder la verra, pour une édition. */
async function configPour(edition) {
  const avant = process.env.AMN_EDITION;
  process.env.AMN_EDITION = edition;
  // Le suffixe casse le cache de modules : sans lui, le second import rendrait
  // la configuration du premier, et ce contrôle comparerait une édition à
  // elle-même en se croyant exhaustif.
  const mod = await import(
    `${path.join(ROOT, 'electron-builder.config.mjs')}?edition=${edition}`
  );
  if (avant === undefined) delete process.env.AMN_EDITION;
  else process.env.AMN_EDITION = avant;
  return mod.default;
}

const interne = await configPour('internal');
const cliente = await configPour('business');

/* ─── 1. L'AUMID du process est l'appId de l'installeur ─────────────────── */

const mainSrc = read('src/main.ts');
const aumid = /setAppUserModelId\(IS_BUSINESS \? '([^']+)' : '([^']+)'\)/.exec(mainSrc);
if (!aumid) {
  failures.push(
    "src/main.ts ne pose plus d'AUMID sous la forme attendue : sans lui, Windows " +
      "n'affiche AUCUNE notification d'une application empaquetée.",
  );
} else {
  const [, aumidCliente, aumidInterne] = aumid;
  if (aumidCliente !== cliente.appId) {
    failures.push(
      `AUMID de l'édition cliente (« ${aumidCliente} ») ≠ appId d'electron-builder ` +
        `(« ${cliente.appId} »). Windows n'affichera aucune notification : le raccourci ` +
        `installé et le processus ne se réclameront pas de la même application.`,
    );
  }
  if (aumidInterne !== interne.appId) {
    failures.push(
      `AUMID de l'édition interne (« ${aumidInterne} ») ≠ appId d'electron-builder ` +
        `(« ${interne.appId} »).`,
    );
  }
}

/* ─── 2. Les deux éditions ne se marchent pas dessus ────────────────────── */

const champs = [
  ['appId', (c) => c.appId],
  ['productName', (c) => c.productName],
  ['dossier d’installation (extraMetadata.name)', (c) => c.extraMetadata?.name],
  ['exécutable Linux', (c) => c.linux?.executableName],
];

for (const [nom, lire] of champs) {
  const a = lire(interne);
  const b = lire(cliente);
  if (a === undefined || b === undefined) {
    failures.push(`« ${nom} » n'est pas défini pour les deux éditions.`);
    continue;
  }
  if (a === b) {
    failures.push(
      `Les deux éditions partagent « ${nom} » = « ${a} ». Elles ne peuvent pas coexister ` +
        `sur une même machine : l'une écrasera l'autre à l'installation. C'est exactement ` +
        `le défaut trouvé au Bloc 1 sur le dossier d'installation.`,
    );
  }
}

/* ─── 3. Le nom affiché est celui du paquet ─────────────────────────────── */

const editionSrc = read('src/edition/edition.ts');
const affiche = /EDITION_PRODUCT_NAME = IS_BUSINESS \? '([^']+)' : '([^']+)'/.exec(editionSrc);
if (!affiche) {
  failures.push("EDITION_PRODUCT_NAME est introuvable dans src/edition/edition.ts.");
} else {
  const [, afficheCliente, afficheInterne] = affiche;
  if (afficheCliente !== cliente.productName) {
    failures.push(
      `L'édition cliente s'affiche « ${afficheCliente} » et s'installe sous ` +
        `« ${cliente.productName} » : la cliente lirait un nom dans l'application et un autre ` +
        `dans son menu Démarrer.`,
    );
  }
  if (afficheInterne !== interne.productName) {
    failures.push(
      `L'édition interne s'affiche « ${afficheInterne} » et s'installe sous ` +
        `« ${interne.productName} ».`,
    );
  }
}

/* ─── 4. Aucun nom de produit écrit en dur ailleurs ─────────────────────── */

/*
  Les deux sources légitimes : `edition.ts` (le nom affiché) et la config
  d'electron-builder (le nom du paquet). Partout ailleurs, un nom en dur est
  un nom qui ne suivra pas le prochain renommage — c'est ce qui a laissé
  « AMN Business » dans le repli d'un bandeau et dans les marqueurs attendus
  du contrôle de bundle.

  `business-bundle-rules.mjs` est admis : il décrit ce qu'un artefact CLIENT
  doit contenir, donc il doit nommer ce nom-là en toutes lettres.
*/
const SOURCES_LEGITIMES = new Set([
  'src/edition/edition.ts',
  'electron-builder.config.mjs',
  'scripts/business-bundle-rules.mjs',
  'scripts/check-naming.mjs',
]);

const NOMS = [interne.productName, cliente.productName];
const fichiers = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) parcourir(rel);
    else if (/\.(tsx?|mjs)$/.test(e.name)) fichiers.push(rel.replace(/^\.\//, ''));
  }
})('src');
fichiers.push(...fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => /\.(mjs|ts)$/.test(f)).map((f) => `scripts/${f}`));

for (const fichier of fichiers) {
  if (SOURCES_LEGITIMES.has(fichier)) continue;
  const source = read(fichier).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const nom of NOMS) {
    if (source.includes(`'${nom}'`) || source.includes(`"${nom}"`)) {
      failures.push(
        `${fichier} écrit « ${nom} » en dur. Le nom d'une édition vient de ` +
          `EDITION_PRODUCT_NAME (affichage) ou de la configuration d'electron-builder ` +
          `(paquet) — une chaîne figée ne suivra pas le prochain renommage.`,
      );
    }
  }
}

/* ─────────────────────────────── verdict ───────────────────────────────── */

if (failures.length > 0) {
  console.error('\nIdentité des éditions : incohérences trouvées.\n');
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  `\nIdentité des éditions : cohérente.\n` +
    `  interne  → « ${interne.productName} »  ${interne.appId}  dossier « ${interne.extraMetadata.name} »\n` +
    `  cliente  → « ${cliente.productName} »  ${cliente.appId}  dossier « ${cliente.extraMetadata.name} »`,
);

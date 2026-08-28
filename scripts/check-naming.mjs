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

/* ─── 3 bis. Le nom que la PWA annonce est celui du produit ──────────────── */

/*
  LA QUATRIÈME LISTE, celle qu'aucun contrôle ne regardait.

  `vite.renderer.config.mts` remplace les jetons du manifeste PWA et du service
  worker. Elle décide donc du nom sur l'écran d'accueil d'un téléphone, du
  titre de la fenêtre, et du titre des notifications push.

  Mesuré : elle n'avait pas suivi l'échange du Bloc 1. Une cliente installait
  « AMN Desktop » et son téléphone affichait « AMN Business » ; l'édition
  interne s'annonçait « AMN DevSec », le nom de la boîte et non du produit.
  Invisible depuis `src/`, invisible en CI, visible uniquement sur un vrai
  téléphone — c'est-à-dire chez la cliente.
*/
const vite = read('vite.renderer.config.mts');
const identite = /const IDENTITY: Record<Edition, \{ name: string; description: string \}> = \{([\s\S]*?)\n\};/.exec(vite);

if (!identite) {
  failures.push(
    "`IDENTITY` est introuvable dans vite.renderer.config.mts : le nom annoncé par " +
      'la PWA ne peut plus être croisé avec celui de l’installeur.',
  );
} else {
  const noms = {};
  for (const m of identite[1].matchAll(/(internal|business):\s*\{\s*name:\s*'([^']+)'/g)) {
    noms[m[1]] = m[2];
  }
  if (noms.internal !== interne.productName) {
    failures.push(
      `La PWA interne s'annonce « ${noms.internal} » et l'installeur produit ` +
        `« ${interne.productName} ». C'est le nom que porte l'icône sur un écran ` +
        `d'accueil et le titre des notifications.`,
    );
  }
  if (noms.business !== cliente.productName) {
    failures.push(
      `La PWA CLIENTE s'annonce « ${noms.business} » et l'installeur produit ` +
        `« ${cliente.productName} ». Une cliente installerait donc une application ` +
        `dont le nom sur son téléphone n'est pas celui qu'elle a acheté.`,
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
    /*
      Le nom NU, une fois les commentaires retirés — pas seulement `'AMN
      Business'`.

      Cette règle cherchait les formes entre guillemets, et ratait donc le
      cas le plus naturel pour un nom VISIBLE : le texte JSX, qui n'en a pas.

        <p className="…">
          AMN Business
        </p>

      Exactement ce qui se trouvait sous le nom d'une CLIENTE dans son
      dossier — notre produit interne, affiché comme si c'était le sien.

      C'est le même défaut que la règle 5 a eu, et qui y a déjà été corrigé de
      la même façon : un nom de produit contient une espace ; hors commentaire,
      il ne peut être que du texte affiché.
    */
    if (source.includes(nom)) {
      failures.push(
        `${fichier} écrit « ${nom} » en dur. Le nom d'une édition vient de ` +
          `EDITION_PRODUCT_NAME (affichage) ou de la configuration d'electron-builder ` +
          `(paquet) — une chaîne figée ne suivra pas le prochain renommage.`,
      );
    }
  }
}

/* ─── 5. Le SERVEUR ne nomme pas un produit en dur ───────────────────────── */

/*
  LE RENOMMAGE N'AVAIT JAMAIS ATTEINT amn-api.

  Mesuré après coup : deux textes que des HUMAINS lisent nommaient
  « AMN Desktop » en dur — la notification d'un appel entrant et celle du
  bouton d'essai. Depuis l'échange des noms, ce nom désigne le produit des
  CLIENTES : un opérateur d'AMN DevSec recevait donc un appel « sur AMN
  Desktop », c'est-à-dire sur une application qui n'est pas la sienne.

  Personne ne l'aurait vu. Le message reste plausible, il est simplement faux —
  et un produit qui ne connaît pas son propre nom use la confiance d'une
  cliente plus vite qu'une panne, parce qu'une panne s'explique.

  Quatre commentaires étaient inversés par-dessus le marché, dont deux sur les
  variables d'environnement `APP_PUBLIC_URL` / `APP_BUSINESS_PUBLIC_URL` : de
  quoi configurer les deux adresses à l'envers, une fois, en silence.

  La règle est celle du poste, appliquée au serveur : le nom se déduit de
  l'organisation du destinataire (`productNameForOrg`), et `links.js` est le
  seul fichier autorisé à l'écrire.
*/
const apiRoot = ['/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].find((c) =>
  fs.existsSync(path.join(c, 'src/lib/links.js')),
);

if (!apiRoot) {
  console.log('  note  amn-api introuvable localement — contrôle du serveur sauté.');
} else {
  const SOURCE_SERVEUR = 'src/lib/links.js';

  const source = fs.readFileSync(path.join(apiRoot, SOURCE_SERVEUR), 'utf-8');
  if (!/export function productNameForOrg\(orgId\)/.test(source)) {
    failures.push(
      "`productNameForOrg` a disparu d'amn-api/src/lib/links.js. C'est le seul " +
        "endroit qui sait quel produit porte quel nom côté serveur — sans lui, " +
        'chaque texte le réinvente, et se trompe.',
    );
  } else {
    // Les deux noms doivent correspondre à ceux d'electron-builder, croisés.
    const rendus = /return orgId === AMN_ORG_ID \? '([^']+)' : '([^']+)'/.exec(source);
    if (!rendus) {
      failures.push('`productNameForOrg` n’a plus la forme attendue : le croisement est impossible.');
    } else {
      const [, nomInterne, nomCliente] = rendus;
      if (nomInterne !== interne.productName) {
        failures.push(
          `amn-api nomme l'interne « ${nomInterne} » et l'installeur « ${interne.productName} ». ` +
            `La notification d'un appel dirait donc un nom que l'application n'affiche nulle part.`,
        );
      }
      if (nomCliente !== cliente.productName) {
        failures.push(
          `amn-api nomme le produit CLIENT « ${nomCliente} » et l'installeur ` +
            `« ${cliente.productName} ». C'est le nom qu'une cliente lit dans ses ` +
            `notifications : il doit être celui de l'application qu'elle a installée.`,
        );
      }
    }
  }

  /*
    Aucun nom de produit dans une CHAÎNE ailleurs. On retire commentaires et
    apostrophes typographiques avant de lire — ces fichiers sont commentés en
    français, et « l'échange des noms » citerait le nom sans qu'il soit dans
    une chaîne.
  */
  const dossiers = ['src', 'src/routes', 'src/lib', 'src/ws', 'src/tracker', 'src/scanner', 'src/db', 'src/middleware'];
  for (const dossier of dossiers) {
    const dir = path.join(apiRoot, dossier);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.js')) continue;
      const rel = `${dossier}/${f}`;
      if (rel === SOURCE_SERVEUR) continue;
      const src = fs
        .readFileSync(path.join(dir, f), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const nom of NOMS) {
        /*
          Le nom NU, une fois les commentaires retirés — pas seulement
          `'AMN Desktop'`.

          Le premier jet cherchait les trois formes de délimiteur, et laissait
          donc passer exactement le défaut d'origine : le nom vivait DANS un
          gabarit interpolé, `\`${user} vous appelle sur AMN Desktop.\``. Un
          contrôle qui rate le cas pour lequel il a été écrit ne garde rien.

          Un nom de produit contient une espace : hors commentaire, il ne peut
          apparaître que dans une chaîne. La recherche nue est donc exacte, et
          non une approximation.
        */
        if (src.includes(nom)) {
          failures.push(
            `amn-api/${rel} écrit « ${nom} » dans une chaîne. Le serveur sert les DEUX ` +
              `produits : le nom doit venir de \`productNameForOrg(orgId)\`, qui le déduit ` +
              `de l'organisation du destinataire, jamais d'une constante.`,
          );
        }
      }
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

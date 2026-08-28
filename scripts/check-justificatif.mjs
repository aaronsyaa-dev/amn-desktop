#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * LE JUSTIFICATIF DES REQUÊTES ÉCRITES À LA MAIN
 * ══════════════════════════════════════════════
 *
 * Presque tout passe par `apiFetch`, qui pose l'en-tête `Authorization` à
 * partir de `credential()` — le justificatif VIVANT : jeton de support s'il y
 * en a un, sinon jeton de session, sinon le jeton de build.
 *
 * Les exceptions sont les documents qu'on va ouvrir dans une fenêtre — rapport
 * de scan, rapport mensuel. `window.open()` ne sait pas envoyer d'en-tête, il
 * faut donc composer la requête à la main, et c'est là qu'on peut se tromper
 * de jeton.
 *
 * ## Le défaut que ce contrôle empêche de revenir
 *
 * `scanReportUrl` envoyait `ctx.token`, le jeton de BUILD :
 *
 *   - sur un déploiement web sans `VITE_AMN_API_WEB_TOKEN`, il est vide. Le
 *     serveur répondait 401 et le bouton ne faisait visiblement rien ;
 *   - et dans le dossier d'une organisation cliente, c'était le jeton
 *     d'OPÉRATEUR qui partait — le document rendu était celui d'AMN DevSec
 *     pendant qu'on croyait lire celui de la cliente. C'est la version grave.
 *
 * Mesuré : `ctx.credential()` → le document s'ouvre ; `ctx.token` → 401, aucun
 * onglet. Le contrôle ci-dessous refuse la seconde forme.
 */

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');

const FICHIERS = [
  'src/edition/browserExclusive.internal.ts',
  'src/lib/bridge.ts',
];

/** Enlève commentaires de ligne et de bloc — un exemple cité n'est pas du code. */
function sansCommentaires(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Ce qu'un en-tête composé à la main a le droit de porter.
 *
 * Trois lectures du justificatif vivant, et UNE dispense nommée : `bearer` est
 * un paramètre de `publicPost`, donc un jeton qu'on vient de recevoir et qui
 * n'est pas encore une session — l'acceptation d'invitation et le second
 * facteur en dépendent. Il ne peut pas venir de `credential()`, qui ne le
 * connaît pas encore.
 */
const LICITES = new Set([
  'ctx.credential()',
  'credential()',
  'apiCredential()',
  'owner ? ownerCredential() : credential()',
  'bearer',
]);

const fautes = [];
let entetes = 0;

for (const relatif of FICHIERS) {
  const absolu = path.join(racine, relatif);
  if (!fs.existsSync(absolu)) {
    fautes.push(`${relatif} : introuvable — le contrôle ne surveille plus rien.`);
    continue;
  }
  const code = sansCommentaires(fs.readFileSync(absolu, 'utf8'));

  // Chaque en-tête Authorization écrit à la main, avec ce qu'il envoie.
  const motif = /Authorization:\s*`Bearer \$\{([^}]+)\}`/g;
  let m;
  while ((m = motif.exec(code))) {
    entetes++;
    const source = m[1].trim();
    const licite = LICITES.has(source);
    if (!licite) {
      const ligne = code.slice(0, m.index).split('\n').length;
      fautes.push(
        `${relatif}:${ligne} — « Bearer \${${source}} ».\n` +
          `      Un en-tête écrit à la main doit porter le justificatif VIVANT.\n` +
          `      Employez ctx.credential() : ${source} est figé au build, donc vide\n` +
          `      sur un déploiement web, et c'est le jeton d'OPÉRATEUR dans le\n` +
          `      dossier d'une cliente — le document rendu serait le nôtre.`,
      );
    }
  }
}

/*
  Et le pont doit RÉELLEMENT fournir `credential` au contexte : sans ça le
  contrôle ci-dessus passerait sur du code qui ne compile pas, ce qui ne serait
  pas faux mais ne prouverait rien.
*/
const pont = sansCommentaires(fs.readFileSync(path.join(racine, 'src/lib/bridge.ts'), 'utf8'));
const contexte = /const exclusiveContext = \{([\s\S]*?)\n  \};/.exec(pont);
if (!contexte) {
  fautes.push('src/lib/bridge.ts : `exclusiveContext` introuvable — forme inattendue.');
} else if (!/\bcredential\b/.test(contexte[1])) {
  fautes.push(
    'src/lib/bridge.ts : `exclusiveContext` ne fournit pas `credential`.\n' +
      "      Les requêtes écrites à la main n'auraient alors aucun justificatif vivant.",
  );
}

if (fautes.length > 0) {
  console.error('\nJustificatif des requêtes écrites à la main : NON\n');
  for (const f of fautes) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log('\nJustificatif : les requêtes écrites à la main portent le jeton vivant.');
console.log(`  ${entetes} en-tête(s) Authorization composé(s) à la main, tous conformes.`);

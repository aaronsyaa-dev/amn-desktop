#!/usr/bin/env node
/**
 * Contrôle d'hygiène du build livré à une organisation cliente.
 *
 * La promesse de l'édition Business n'est pas « les modules exclusifs sont
 * masqués », c'est « ils ne sont pas là ». Une promesse pareille se vérifie ou
 * ne vaut rien : ce script relit la sortie du build et cherche, en texte brut,
 * ce qui ne doit pas s'y trouver — noms de produits, adresses d'AMN DevSec,
 * empreintes de mots de passe de démonstration, clients de démonstration,
 * jetons partagés.
 *
 * Il a été écrit pour le build web, qui est le plus exposé des deux : un bundle
 * servi en HTTPS se lit avec le clic droit du navigateur, là où il faut au
 * moins ouvrir un `asar` côté Electron. La même liste s'applique aux deux, donc
 * `--dir` accepte n'importe quel dossier de sortie.
 *
 *   node scripts/check-business-bundle.mjs [--dir dist]
 *
 * Sortie 0 si le dossier est propre, 1 sinon — utilisable en CI comme à la main.
 * Le script échoue aussi si le dossier ne CONTIENT pas ce qu'on attend d'une
 * édition Business : un dossier vide passerait sinon tous les contrôles.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const OUT_DIR = path.resolve(dirArg >= 0 ? args[dirArg + 1] : 'dist');

/**
 * Ce qui ne doit apparaître nulle part.
 *
 * Chaque entrée porte sa raison : sans elle, le prochain à voir passer le
 * script devant une fausse alerte ne saura pas s'il peut retirer la ligne.
 * `pattern` est cherché tel quel, sans respect de la casse.
 */
const FORBIDDEN = [
  // --- Identité et comptes d'AMN DevSec ---
  { pattern: 'amn-devsec.com', why: 'nos adresses email' },
  { pattern: 'AMN DevSec', why: 'notre raison sociale' },
  { pattern: 'aaron@', why: 'compte opérateur' },
  { pattern: 'mohamed@', why: 'compte opérateur' },
  { pattern: 'AmnQG-2026', why: 'mot de passe de départ des comptes locaux' },
  { pattern: '$2b$10$', why: 'empreinte bcrypt d’un compte de démonstration' },

  // --- Produits de cybersécurité ---
  // Sensible à la casse : `react.memo_cache_sentinel`, dans React, n'est pas
  // notre produit. Le contrôle porte sur le nom propre, pas sur le mot.
  { pattern: 'Sentinel', why: 'catalogue Tracker', caseSensitive: true },
  { pattern: 'trackerCatalog', why: 'catalogue Tracker' },
  { pattern: 'security-monitor', why: 'le tracker installé chez nos clients' },
  { pattern: 'AMN Suite', why: 'palier du catalogue Tracker' },
  { pattern: 'SSL Monitor', why: 'produit exclusif' },
  { pattern: 'Comply', why: 'produit exclusif (RGPD)' },
  { pattern: 'Ajmani', why: 'assistant local, exclusif' },

  // --- Routes et canaux qui n'existent pas chez une cliente ---
  { pattern: '/v1/admin/', why: 'console inter-organisations' },
  { pattern: 'support-session', why: 'contexte client — n’existe que chez nous' },
  { pattern: '/v1/comply', why: 'route produit' },
  { pattern: '/v1/scans', why: 'route produit' },

  // --- Données de démonstration qui sont les nôtres ---
  { pattern: 'G20 Corvetto', why: 'client de démonstration' },
  { pattern: 'Atlas Retail', why: 'client de démonstration' },

  // --- Jetons ---
  { pattern: 'VITE_AMN_API_WEB_TOKEN', why: 'un build cliente n’embarque aucun jeton' },
  { pattern: 'VITE_AMN_API_OPERATOR_TOKEN', why: 'un build cliente n’embarque aucun jeton' },
];

/**
 * Ce qui DOIT s'y trouver.
 *
 * Le contrôle d'absence, seul, est trop facile à satisfaire : un build raté,
 * ou le mauvais dossier passé en argument, passerait au vert. Ces deux marqueurs
 * confirment qu'on a bien relu une édition Business construite.
 */
const REQUIRED = [
  { pattern: 'AMN Business', why: 'le nom produit de l’édition livrée' },
  { pattern: 'Agenda', why: 'le calendrier, module quotidien de l’édition Business' },
  { pattern: 'Coffre-fort', why: 'un module de l’édition Business' },
];

/** Fichiers texte du dossier de sortie, en profondeur. */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.webmanifest', '.map', '.txt']);

if (!fs.existsSync(OUT_DIR)) {
  console.error(`ÉCHEC  Dossier introuvable : ${OUT_DIR}`);
  console.error('       Construisez d’abord : npm run build:web:business');
  process.exit(1);
}

const files = walk(OUT_DIR).filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()));
if (files.length === 0) {
  console.error(`ÉCHEC  Aucun fichier texte dans ${OUT_DIR} — rien n’a été vérifié.`);
  process.exit(1);
}

const findings = [];
const seenRequired = new Set();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const lower = content.toLowerCase();
  for (const rule of FORBIDDEN) {
    const haystack = rule.caseSensitive ? content : lower;
    const needle = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      findings.push({
        file: path.relative(OUT_DIR, file),
        pattern: rule.pattern,
        why: rule.why,
        // Un extrait, pour savoir tout de suite s'il s'agit d'une vraie fuite
        // ou d'une coïncidence dans une dépendance.
        excerpt: content.slice(Math.max(0, index - 60), index + rule.pattern.length + 60).replace(/\s+/g, ' '),
      });
      index = haystack.indexOf(needle, index + 1);
      // Une occurrence par fichier et par motif suffit à faire échouer ; en
      // lister mille rendrait le rapport illisible.
      break;
    }
  }
  for (const rule of REQUIRED) {
    if (lower.includes(rule.pattern.toLowerCase())) seenRequired.add(rule.pattern);
  }
}

const missing = REQUIRED.filter((r) => !seenRequired.has(r.pattern));

console.log(`Contrôle du build Business — ${files.length} fichier(s) relus dans ${OUT_DIR}\n`);

if (findings.length > 0) {
  console.error(`ÉCHEC  ${findings.length} trace(s) d’AMN DevSec dans le build livré :\n`);
  for (const f of findings) {
    console.error(`  ${f.file}`);
    console.error(`    « ${f.pattern} » — ${f.why}`);
    console.error(`    …${f.excerpt}…\n`);
  }
}

if (missing.length > 0) {
  console.error('ÉCHEC  Marqueurs attendus absents — ce dossier n’est pas un build Business :\n');
  for (const m of missing) console.error(`  « ${m.pattern} » — ${m.why}`);
  console.error('');
}

if (findings.length > 0 || missing.length > 0) process.exit(1);

console.log('OK — aucune trace d’AMN DevSec, des produits, des comptes ou des jetons.');
console.log(`     ${FORBIDDEN.length} motifs interdits, ${REQUIRED.length} marqueurs attendus présents.`);

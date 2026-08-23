#!/usr/bin/env node
/**
 * Contrôle de ce qu'une URL SERT RÉELLEMENT — pas de ce qu'on a construit.
 *
 * `check-business-bundle.mjs` relit un `dist/` local, et c'est très bien tant
 * que le build est local. Il ne l'est plus : Vercel construit chez lui, à
 * partir de sa propre configuration. Une commande de build qui n'était pas
 * celle qu'on croyait a suffi pour livrer à une cliente un bundle contenant
 * tout le rail interne — et aucun contrôle local n'aurait pu le voir, puisque
 * le fichier fautif n'a jamais existé sur nos machines.
 *
 * Ce script ferme cette boucle : il télécharge la page, suit les scripts et
 * feuilles qu'elle référence, et applique exactement les mêmes règles.
 *
 *   node scripts/check-deployed-bundle.mjs --url https://mon-projet.vercel.app
 *
 * Sortie 0 si le déploiement est propre, 1 sinon.
 */

import { FORBIDDEN, REQUIRED, maskAllowed, createAllowanceBudget } from './business-bundle-rules.mjs';

const args = process.argv.slice(2);
const urlArg = args.indexOf('--url');
const BASE = urlArg >= 0 ? args[urlArg + 1] : '';

if (!BASE) {
  console.error('Usage : node scripts/check-deployed-bundle.mjs --url https://…');
  process.exit(2);
}

const base = BASE.replace(/\/$/, '');

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

let html;
try {
  html = await get(`${base}/`);
} catch (err) {
  console.error(`ÉCHEC  Page inaccessible : ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

/**
 * Tout ce que la page charge : les modules et styles qu'elle référence, plus
 * les deux fichiers copiés tels quels qui portent l'identité du produit.
 */
const referenced = new Set(['/manifest.webmanifest', '/sw.js']);
for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+\.(?:js|mjs|css))["']/gi)) {
  referenced.add(match[1]);
}

const documents = [{ name: 'index.html', content: html }];
for (const ref of referenced) {
  const url = ref.startsWith('http') ? ref : `${base}/${ref.replace(/^\.?\//, '')}`;
  try {
    documents.push({ name: ref, content: await get(url) });
  } catch {
    // Un fichier absent n'est pas une fuite ; il est simplement signalé, et
    // l'absence des marqueurs attendus fera de toute façon échouer le contrôle
    // si c'est la page principale qui n'a rien chargé.
    console.warn(`(ignoré, non servi : ${ref})`);
  }
}

const findings = [];
// Un seul budget de tolérance pour tout ce qui est servi : la signature de
// marque a droit à UNE occurrence au total, pas une par document.
const budget = createAllowanceBudget();
const seenRequired = new Set();

for (const doc of documents) {
  const lower = doc.content.toLowerCase();
  for (const rule of FORBIDDEN) {
    // Même tolérance qu'en local, et pour la même raison : une exception qui
    // n'existerait que d'un côté autoriserait en production ce qu'on refuse
    // avant publication, ou l'inverse.
    const scanne = maskAllowed(doc.content, rule, budget);
    const haystack = rule.caseSensitive ? scanne : scanne.toLowerCase();
    const needle = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
    const index = haystack.indexOf(needle);
    if (index === -1) continue;
    findings.push({
      file: doc.name,
      pattern: rule.pattern,
      why: rule.why,
      excerpt: doc.content
        .slice(Math.max(0, index - 60), index + rule.pattern.length + 60)
        .replace(/\s+/g, ' '),
    });
  }
  for (const rule of REQUIRED) {
    if (lower.includes(rule.pattern.toLowerCase())) seenRequired.add(rule.pattern);
  }
}

const missing = REQUIRED.filter((r) => !seenRequired.has(r.pattern));

console.log(`Contrôle du déploiement — ${documents.length} fichier(s) servis par ${base}\n`);

if (findings.length > 0) {
  console.error(`ÉCHEC  ${findings.length} trace(s) d’AMN DevSec dans ce qui est SERVI :\n`);
  for (const f of findings) {
    console.error(`  ${f.file}`);
    console.error(`    « ${f.pattern} » — ${f.why}`);
    console.error(`    …${f.excerpt}…\n`);
  }
}

if (missing.length > 0) {
  console.error('ÉCHEC  Marqueurs attendus absents — cette URL ne sert pas une édition Business :\n');
  for (const m of missing) console.error(`  « ${m.pattern} » — ${m.why}`);
  console.error('');
}

if (findings.length > 0 || missing.length > 0) process.exit(1);

console.log('OK — ce déploiement ne sert aucune trace interne, et porte bien les marqueurs Business.');

#!/usr/bin/env node
/**
 * LA PAROLE DE LA GARDE, CÔTÉ POSTE (Bloc 11) — `npm run check:parole`.
 *
 * Ce que l'interface dit au nom de la Garde et de son chef d'état-major suit
 * la même règle que le Lexique du serveur (amn-api, `check:parole`) : pas de
 * point d'exclamation, pas de servilité, pas de « (s) » de paresse, pas
 * d'apostrophe droite, typographie française. Sont relus :
 *
 *   · toutes les clés `garde.*`, `dossier.garde.*`, `palette.garde.*`,
 *     `biblio.jeton.*`, `biblio.prises.*`, `tour.exceptions.*`, `hist.tasks.parLaGarde`
 *     des deux dictionnaires (FR et EN) ;
 *   · les phrases en dur des écrans et composants de la Garde
 *     (src/screens/garde, src/components/garde, src/lib/garde.ts).
 *
 * `check:langue` garde déjà l'exclamation et l'apostrophe sur tout le
 * dictionnaire ; ici s'ajoutent la servilité et le « (s) », sur le périmètre
 * de la Garde, où la voix compte le plus.
 */
import fs from 'node:fs';
import path from 'node:path';

const fautes = [];
const faute = (ou, quoi, texte) => fautes.push(`${ou} — ${quoi} : « ${String(texte).slice(0, 120)} »`);
const normaliser = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ');
const SERVILES = { fr: ['mon roi', 'ma reine', 'majeste', 'votre altesse', 'maitre', 'a vos ordres', 'desole', 'navre', 'pardon', 'excusez', 'humble', 'avec plaisir', 'ravi de', 'enchante', 'n hesitez pas', 'bien sur', 'absolument', 'certainement', 'je vous en prie', 'a votre service', 'monsieur', 'madame', 'super', 'genial', 'parfait'], en: ['my king', 'my lord', 'master', 'at your service', 'sorry', 'apologies', 'my pleasure', 'happy to help', 'feel free', 'of course', 'absolutely', 'certainly', 'sir', 'madam', 'awesome', 'great job', 'perfect'] };
const PREFIXES = ['garde.', 'dossier.garde.', 'palette.garde.', 'biblio.jeton.', 'biblio.prises.', 'tour.exceptions.', 'hist.tasks.parLaGarde', 'rail.garde', 'profil.'];

function verifier(ou, texte, langue) {
  if (/!/.test(texte)) faute(ou, 'point d’exclamation', texte);
  if (/'/.test(texte)) faute(ou, 'apostrophe droite', texte);
  if (/\(s\)|\(e\)|\(es\)|\(ne\)/.test(texte)) faute(ou, '« (s) » de paresse', texte);
  if (langue === 'fr' && / [?!;:]/.test(texte)) faute(ou, 'espace simple avant ? ! ; :', texte);
  if (langue === 'fr' && /\u202f:|\u00a0[?!;]/.test(texte)) faute(ou, 'mauvaise espace insécable (fine avant ? ! ; — insécable avant :)', texte);
  const n = normaliser(texte);
  for (const m of SERVILES[langue]) if (new RegExp(`(^| )${m}( |$|[.,;:?])`).test(n)) faute(ou, `servilité (« ${m} »)`, texte);
}

/* 1. Les dictionnaires, sur le périmètre de la Garde. */
let cles = 0;
for (const langue of ['fr', 'en']) {
  const src = fs.readFileSync(path.resolve(`src/i18n/${langue}.ts`), 'utf8');
  for (const m of src.matchAll(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) {
    const [, cle, brut] = m;
    if (!PREFIXES.some((p) => cle.startsWith(p))) continue;
    cles += 1;
    const texte = brut.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\'/g, "'");
    verifier(`${langue}.ts ${cle}`, texte, langue);
  }
}

/* 2. Les phrases en dur des écrans de la Garde (JSX : texte entre balises, attributs title/placeholder/aria-label en dur). */
const fichiers = [];
for (const d of ['src/screens/garde', 'src/components/garde']) for (const f of fs.readdirSync(path.resolve(d))) if (/\.tsx?$/.test(f)) fichiers.push(path.join(d, f));
fichiers.push('src/lib/garde.ts');
let phrases = 0;
for (const f of fichiers) {
  const src = fs.readFileSync(path.resolve(f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/>([^<>{}]{8,})</g)) {
    const texte = m[1].trim();
    if (!texte || /^[\s·—–→|]*$/.test(texte)) continue;
    if (/[=(){};]|=>|\?\?|^[?:]/.test(texte) || /\n\s*[?:]/.test(texte)) continue; // du code JSX entre deux balises, pas une phrase
    phrases += 1;
    verifier(f, texte, 'fr');
  }
  for (const m of src.matchAll(/(?:title|placeholder|aria-label)="([^"{}]{8,})"/g)) { phrases += 1; verifier(f, m[1], 'fr'); }
}

if (fautes.length) {
  console.error(`check:parole — ${fautes.length} manquement(s) :`);
  for (const x of fautes) console.error(`  · ${x}`);
  process.exit(1);
}
console.log(`check:parole — ${cles} clés de la Garde (FR + EN) et ${phrases} phrases en dur dans ${fichiers.length} fichiers : aucun point d'exclamation, aucune servilité, aucun « (s) », apostrophes et espaces à la française.`);

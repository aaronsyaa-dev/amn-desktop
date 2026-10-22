/**
 * L'ORCHESTRATEUR — lance les familles de scénarios, relève tout, écrit le
 * rapport LOCAL (`docs/simulation/RAPPORT.md`, non poussé) et les mesures.
 *
 *   node simulation/run.mjs [usage|pannes|attaques|concurrence|durabilite|attaques-profond|echelle|base|profond|tout]
 *
 *   base    = usage + pannes + attaques          (≈ 30 s)
 *   profond = concurrence + durabilité + attaques approfondies + échelle 2000 comptes (≈ 8 min)
 *   tout    = base + profond
 *
 * Reproductible à la graine (SIM_GRAINE, défaut 424242). Aucune donnée réelle ;
 * le serveur ne parle qu'à la boucle locale (voir lib/isolement-reseau.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirBaseNeuve, demarrerServeur } from './lib/harness.mjs';
import { peupler } from './lib/seed.mjs';
import { scenariosUsage } from './scenarios/usage.mjs';
import { scenariosPannes } from './scenarios/pannes.mjs';
import { attaquesImmediates, attaquesGarde } from './scenarios/attaques.mjs';
import { scenariosConcurrence } from './scenarios/concurrence.mjs';
import { scenariosDurabilite } from './scenarios/durabilite.mjs';
// Scénarios de sécurité approfondis : gardés en local (dépôt public), donc chargés si présents seulement.
const scenariosAttaquesProfond = await import('./scenarios/attaques-profond.mjs').then((m) => m.scenariosAttaquesProfond).catch(() => null);
import { scenariosEchelle } from './scenarios/echelle.mjs';
import { scenariosContrat } from './scenarios/contrat.mjs';

const RACINE = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const GRAINE = Number(process.env.SIM_GRAINE) || 424242;
const quoi = (process.argv[2] || 'tout').toLowerCase();
const BASE = ['usage', 'pannes', 'attaques'];
const PROFOND = ['concurrence', 'contrat', 'durabilite', 'attaques-profond', 'echelle'];
const veutUne = (f) => quoi === f || quoi === 'tout' || (quoi === 'base' && BASE.includes(f)) || (quoi === 'profond' && PROFOND.includes(f));
const veut = (...familles) => familles.some(veutUne);

const icone = { tient: '🟢', partiel: '🟡', casse: '🔴' };
const sortantsParHote = {};
const surfacePublique = [];

/** Démarre un serveur et retient ce qu'il a voulu appeler dehors (refusé par le bac à sable). */
async function servir(opts) {
  const srv = await demarrerServeur(opts);
  const arreter = srv.arreter;
  srv.arreter = async () => {
    await arreter();
    for (const [hote, n] of Object.entries(srv.sortantsRefuses())) sortantsParHote[hote] = (sortantsParHote[hote] ?? 0) + n;
  };
  return srv;
}

async function executer(famille, liste, contexte) {
  const out = [];
  for (const scenario of liste) {
    process.stdout.write(`  … ${scenario.name}\n`);
    const t0 = Date.now();
    try {
      const r = await scenario(contexte);
      if (r.surfacePublique) { surfacePublique.push(...r.surfacePublique); delete r.surfacePublique; }
      out.push({ ...r, famille });
      console.log(`    ${icone[r.resultat] ?? '⚪'} ${r.resultat.toUpperCase()} (${((Date.now() - t0) / 1000).toFixed(0)} s) — ${r.preuve}`);
    } catch (e) {
      out.push({ nom: scenario.name, famille, resultat: 'casse', preuve: `exception : ${e.message}`, mesures: {} });
      console.log(`    🔴 EXCEPTION — ${e.message}`);
    }
  }
  return out;
}

/** Une base neuve peuplée, puis un serveur dessus. */
async function monter(nomBase, populationOpts, serveurOpts = {}) {
  const { db, chemin } = await ouvrirBaseNeuve(nomBase);
  const pop = await peupler(db, { graine: GRAINE, ...populationOpts });
  await db.close();
  const srv = await servir({ chemin, ...serveurOpts });
  return { srv, chemin, ...pop };
}

async function main() {
  const resultats = [];
  const t0 = Date.now();
  let tailleBase = null;

  if (veut('usage', 'attaques')) {
    const ctx = await monter('sim-principal.db', { nombrePersonnes: 400 });
    tailleBase = `${ctx.orgs.length} organisations, ${ctx.users.length} personnes, ${ctx.sites.length} sites`;
    console.log(`Population de base (graine ${GRAINE}) : ${tailleBase}.\n`);
    if (veut('usage')) {
      console.log('— USAGE —');
      resultats.push(...await executer('usage', scenariosUsage, ctx));
    }
    if (veut('attaques')) {
      console.log('— ATTAQUES (chaîne immédiate) —');
      resultats.push(...await executer('attaques', attaquesImmediates, ctx));
    }
    await ctx.srv.arreter();
  }

  if (veut('pannes')) {
    console.log('— PANNES —');
    const { db: dbp, chemin: cheminP } = await ouvrirBaseNeuve('sim-pannes.db');
    const popP = await peupler(dbp, { graine: GRAINE, nombrePersonnes: 20 });
    await dbp.close();
    resultats.push(...await executer('pannes', scenariosPannes, { demarrer: (o) => servir(o), chemin: cheminP, ...popP }));
  }

  if (veut('attaques')) {
    console.log('— ATTAQUES (chaîne Garde, base dédiée) —');
    const ctx = await monter('sim-garde.db', { nombrePersonnes: 20 }, { garde: true, monitors: true });
    resultats.push(...await executer('attaques', attaquesGarde, ctx));
    await ctx.srv.arreter();
  }

  if (veut('concurrence')) {
    console.log('— ÉCRASEMENT CONCURRENT (en profondeur) —');
    const ctx = await monter('sim-concurrence.db', { nombrePersonnes: 400 });
    resultats.push(...await executer('concurrence', scenariosConcurrence, ctx));
    await ctx.srv.arreter();
  }

  if (veut('contrat')) {
    console.log('— CONTRAT POSTE ↔ API —');
    resultats.push(...await executer('contrat', scenariosContrat, {}));
  }

  if (veut('durabilite')) {
    console.log('— DURABILITÉ (SIGKILL en pleine écriture) —');
    resultats.push(...await executer('durabilite', scenariosDurabilite, { graine: GRAINE }));
  }

  if (veut('attaques-profond') && !scenariosAttaquesProfond) {
    console.log('— ATTAQUES APPROFONDIES — absentes de ce poste (scénarios de sécurité gardés en local) : ignorées.');
  } else if (veut('attaques-profond')) {
    console.log('— ATTAQUES APPROFONDIES (qui est averti ?) —');
    const ctx = await monter('sim-attaques-profond.db', { nombrePersonnes: 400 }, { garde: true, monitors: true });
    resultats.push(...await executer('attaques-profond', scenariosAttaquesProfond, ctx));
    await ctx.srv.arreter();
  }

  if (veut('echelle')) {
    console.log('— MONTÉE À 2000 COMPTES —');
    const ctx = await monter('sim-echelle.db', { nombrePersonnes: 2000, nombreOrganisations: 60 });
    console.log(`  population : ${ctx.orgs.length} organisations, ${ctx.users.length} personnes`);
    const partage = {};
    const [tempete, sockets] = scenariosEchelle;
    resultats.push(...await executer('echelle', [tempete, sockets], { ...ctx, partage }));
    await ctx.srv.arreter();
    resultats.push(...await executer('echelle', scenariosEchelle.slice(2, 4), {}));
    resultats.push(...await executer('echelle', scenariosEchelle.slice(4), { chemin: ctx.chemin }));
  }

  const dureeMin = ((Date.now() - t0) / 60000).toFixed(1);
  // Une passe partielle ne doit pas effacer les autres familles : on fusionne avec la dernière passe connue.
  const fusion = fusionner(resultats, tailleBase);
  ecrireRapport(fusion.scenarios, fusion.tailleBase, dureeMin, fusion.sortants);
  ecrireMesures(fusion);
  console.log(`\nRapport : docs/simulation/RAPPORT.md (local, non poussé) — ${fusion.scenarios.length} scénarios au total. Durée de cette passe ${dureeMin} min.`);
}

const FICHIER_MESURES = path.join(RACINE, 'docs/simulation/mesures/derniere-passe.json');

function fusionner(nouveaux, tailleBase) {
  let ancien = { scenarios: [], sortants: {}, tailleBase: null };
  try { ancien = JSON.parse(fs.readFileSync(FICHIER_MESURES, 'utf8')); } catch { /* première passe */ }
  const familles = new Set(nouveaux.map((r) => r.famille));
  // On remet dans l'ordre des familles pour un rapport lisible.
  const ordre = ['usage', 'pannes', 'attaques', 'concurrence', 'contrat', 'durabilite', 'attaques-profond', 'echelle'];
  const scenarios = [...(ancien.scenarios ?? []).filter((r) => !familles.has(r.famille)), ...nouveaux].sort((a, b) => ordre.indexOf(a.famille) - ordre.indexOf(b.famille));
  return { scenarios, tailleBase: tailleBase ?? ancien.tailleBase ?? null, sortants: { ...(ancien.sortants ?? {}), ...sortantsParHote } };
}

const resumeMesures = (m = {}) => {
  const parts = [];
  for (const [k, v] of Object.entries(m)) {
    if (v && typeof v === 'object' && 'p50' in v) parts.push(`${k}: p50 ${v.p50} / p95 ${v.p95} ms (n=${v.n})`);
    else if (typeof v === 'number') parts.push(`${k}: ${v}`);
  }
  return parts.join(' ; ') || '—';
};
const ligne = (r) => `| ${r.nom} | ${icone[r.resultat] ?? '⚪'} ${r.resultat} | ${r.preuve.replace(/\|/g, '/')} | ${resumeMesures(r.mesures)} |`;

function ecrireRapport(resultats, tailleBase, dureeMin, sortantsConnus = sortantsParHote) {
  const dossier = path.join(RACINE, 'docs/simulation');
  fs.mkdirSync(dossier, { recursive: true });
  const casse = resultats.filter((r) => r.resultat === 'casse');
  const partiel = resultats.filter((r) => r.resultat === 'partiel');
  const tient = resultats.filter((r) => r.resultat === 'tient');
  const titres = { usage: 'Usage', pannes: 'Pannes volontaires', attaques: 'Attaques simulées', concurrence: 'Écrasement concurrent (profondeur)', contrat: 'Contrat poste ↔ API', durabilite: 'Durabilité (SIGKILL)', 'attaques-profond': 'Attaques approfondies (qui est averti ?)', echelle: 'Montée à 2000 comptes' };
  const blocs = Object.entries(titres).map(([k, t]) => {
    const l = resultats.filter((r) => r.famille === k);
    return l.length ? `\n### ${t}\n\n| Scénario | Résultat | Preuve | Mesures |\n|---|---|---|---|\n${l.map(ligne).join('\n')}\n` : '';
  }).join('');
  const detection = resultats.filter((r) => r.detection).map((r) => `- **${r.nom}** — ${r.detection.chaine} ; ${r.detection.delai}`).join('\n');
  const sortants = Object.entries(sortantsConnus);
  const md = `# Rapport de simulation — bac à sable amn-api

> LOCAL, non poussé (règle SIM ; ce dépôt est public). Rejouable : \`npm run sim\` (graine ${GRAINE}).
> Date : ${new Date().toISOString().slice(0, 10)}. Dernière passe lancée : ${dureeMin} min (le rapport fusionne les familles lancées successivement).
> Bac à sable isolé : amn-api en SQLite, population fictive (@exemple.test), 127.0.0.1, jamais la production.
> Isolement vérifié par le code : le serveur de simulation refuse toute connexion hors boucle locale (lib/isolement-reseau.mjs).

## En une ligne

- 🟢 Tient : **${tient.length}** · 🟡 Partiel : **${partiel.length}** · 🔴 Casse : **${casse.length}** (sur ${resultats.length} scénarios).${tailleBase ? `\n- Population de base : ${tailleBase}.` : ''}

## Ce qui casse

${casse.length ? casse.map((r) => `- 🔴 **${r.nom}** — ${r.preuve}`).join('\n') : '- Rien de rouge sur cette passe.'}

## Ce qui est partiel

${partiel.length ? partiel.map((r) => `- 🟡 **${r.nom}** — ${r.preuve}`).join('\n') : '- Rien.'}

## Détection : qui voit quoi, et quand

${detection || '- Aucun scénario de détection sur cette passe.'}

## Appels sortants que le serveur a tenté (refusés par le bac à sable)

${sortants.length ? sortants.map(([h, n]) => `- \`${h}\` ×${n}`).join('\n') : '- Aucun.'}
${blocs}
## Ce qui n'a pas été vérifié

- Postgres (Supabase) : la simulation tourne sur le repli SQLite. Verrous, pool de connexions et latence réseau de la base distante ne sont pas exercés.
- Une coupure de courant : SIGKILL arrête le processus, pas la machine (le réglage \`synchronous\` est relevé, pas éprouvé).
- Les seuils réels de la Garde (escalade à 15 min) : le bac à sable réduit le tick.
- Derrière l'infrastructure réelle (proxy, CPU partagé) : les comportements liés à l'adresse du client ne sont éprouvés que tels que le code les lit.
- Le vrai poste (amn-desktop) : on exerce l'API, pas l'interface ni la file d'envoi hors ligne réelle.
`;
  fs.writeFileSync(path.join(dossier, 'RAPPORT.md'), md);
}

function ecrireMesures(fusion) {
  const dossier = path.dirname(FICHIER_MESURES);
  fs.mkdirSync(dossier, { recursive: true });
  const data = { date: new Date().toISOString(), tailleBase: fusion.tailleBase, sortants: fusion.sortants, scenarios: fusion.scenarios.map((r) => ({ nom: r.nom, famille: r.famille, resultat: r.resultat, preuve: r.preuve, mesures: r.mesures ?? {}, detection: r.detection ?? null })) };
  fs.writeFileSync(FICHIER_MESURES, JSON.stringify(data, null, 2));
  if (surfacePublique.length) fs.writeFileSync(path.join(dossier, 'surface-publique.json'), JSON.stringify(surfacePublique, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

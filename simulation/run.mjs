/**
 * L'ORCHESTRATEUR — lance les familles de scénarios, relève tout, écrit le
 * rapport LOCAL (`docs/simulation/RAPPORT.md`, non poussé) et les mesures.
 *
 *   node simulation/run.mjs [usage|pannes|attaques|tout]
 *
 * Par défaut : tout. Reproductible à la graine (SIM_GRAINE, défaut 424242).
 * Aucune donnée réelle, aucun réseau sortant : serveur sur 127.0.0.1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirBaseNeuve, demarrerServeur } from './lib/harness.mjs';
import { peupler } from './lib/seed.mjs';
import { scenariosUsage } from './scenarios/usage.mjs';
import { scenariosPannes } from './scenarios/pannes.mjs';
import { attaquesImmediates, attaquesGarde } from './scenarios/attaques.mjs';

const RACINE = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const GRAINE = Number(process.env.SIM_GRAINE) || 424242;
const quoi = (process.argv[2] || 'tout').toLowerCase();

const icone = { tient: '🟢', partiel: '🟡', casse: '🔴' };

async function executer(liste, contexte) {
  const out = [];
  for (const scenario of liste) {
    process.stdout.write(`  … ${scenario.name}\n`);
    try {
      const r = await scenario(contexte);
      out.push(r);
      console.log(`    ${icone[r.resultat] ?? '⚪'} ${r.resultat.toUpperCase()} — ${r.preuve}`);
    } catch (e) {
      out.push({ nom: scenario.name, resultat: 'casse', preuve: `exception : ${e.message}`, mesures: {} });
      console.log(`    🔴 EXCEPTION — ${e.message}`);
    }
  }
  return out;
}

async function main() {
  const resultats = { usage: [], pannes: [], attaques: [] };
  const t0 = Date.now();

  // --- Peuplement (une base partagée pour usage + attaques immédiates) ---
  const { db, chemin } = await ouvrirBaseNeuve('sim-principal.db');
  console.log(`Peuplement (graine ${GRAINE})…`);
  const pop = await peupler(db, { graine: GRAINE, nombrePersonnes: 400 });
  await db.close();
  console.log(`  ${pop.orgs.length} organisations, ${pop.users.length} personnes, ${pop.sites.length} sites.\n`);

  if (quoi === 'usage' || quoi === 'tout') {
    console.log('— USAGE —');
    const srv = await demarrerServeur({ chemin });
    resultats.usage = await executer(scenariosUsage, { srv, ...pop });
    await srv.arreter();
  }

  if (quoi === 'pannes' || quoi === 'tout') {
    console.log('— PANNES —');
    // Chaque panne gère son propre serveur sur une base dédiée (on ne salit pas la principale).
    const { db: dbp, chemin: cheminP } = await ouvrirBaseNeuve('sim-pannes.db');
    const popP = await peupler(dbp, { graine: GRAINE, nombrePersonnes: 20 });
    await dbp.close();
    const demarrer = (opts) => demarrerServeur(opts);
    resultats.pannes = await executer(scenariosPannes, { demarrer, chemin: cheminP, ...popP });
  }

  if (quoi === 'attaques' || quoi === 'tout') {
    console.log('— ATTAQUES (chaîne immédiate) —');
    const srv = await demarrerServeur({ chemin });
    resultats.attaques = await executer(attaquesImmediates, { srv, ...pop });
    await srv.arreter();

    console.log('— ATTAQUES (chaîne Garde, base dédiée) —');
    const { db: dbg, chemin: cheminG } = await ouvrirBaseNeuve('sim-garde.db');
    const popG = await peupler(dbg, { graine: GRAINE, nombrePersonnes: 20 });
    await dbg.close();
    const srvG = await demarrerServeur({ chemin: cheminG, garde: true, monitors: true });
    const attG = await executer(attaquesGarde, { srv: srvG, ...popG });
    await srvG.arreter();
    resultats.attaques.push(...attG);
  }

  const dureeMin = ((Date.now() - t0) / 60000).toFixed(1);
  ecrireRapport(resultats, pop, dureeMin);
  ecrireMesures(resultats);
  console.log(`\nRapport : docs/simulation/RAPPORT.md (local, non poussé). Durée ${dureeMin} min.`);
}

function ligneTableau(r) {
  const mesures = resumeMesures(r.mesures);
  return `| ${r.nom} | ${icone[r.resultat] ?? '⚪'} ${r.resultat} | ${r.preuve.replace(/\|/g, '/')} | ${mesures} |`;
}

function resumeMesures(m = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(m)) {
    if (v && typeof v === 'object' && 'p50' in v) parts.push(`${k}: p50 ${v.p50} / p95 ${v.p95} ms (n=${v.n})`);
    else if (typeof v === 'number') parts.push(`${k}: ${v}`);
  }
  return parts.join(' ; ') || '—';
}

function ecrireRapport(resultats, pop, dureeMin) {
  const dossier = path.join(RACINE, 'docs/simulation');
  fs.mkdirSync(dossier, { recursive: true });
  const tout = [...resultats.usage, ...resultats.pannes, ...resultats.attaques];
  const casse = tout.filter((r) => r.resultat === 'casse');
  const partiel = tout.filter((r) => r.resultat === 'partiel');
  const tient = tout.filter((r) => r.resultat === 'tient');
  const date = new Date().toISOString().slice(0, 10);

  const bloc = (titre, liste) => liste.length
    ? `\n### ${titre}\n\n| Scénario | Résultat | Preuve | Mesures |\n|---|---|---|---|\n${liste.map(ligneTableau).join('\n')}\n`
    : '';
  const detection = resultats.attaques.filter((r) => r.detection).map((r) => `- **${r.nom}** — ${r.detection.chaine} ; détecté : ${r.detection.delai}`).join('\n');

  const md = `# Rapport de simulation — bac à sable amn-api

> Local, non poussé (REGLES de la session SIM). Rejouable : \`npm run sim\` (graine ${GRAINE}).
> Date : ${date}. Durée de la passe : ${dureeMin} min.
> Bac à sable isolé : amn-api en SQLite, population fictive (@exemple.test), 127.0.0.1, aucun réseau sortant, jamais la production.

## En une ligne

- 🟢 Tient : **${tient.length}** · 🟡 Partiel : **${partiel.length}** · 🔴 Casse : **${casse.length}** (sur ${tout.length} scénarios).
- Population : ${pop.orgs.length} organisations, ${pop.users.length} personnes, ${pop.sites.length} sites.

## Ce qui casse (à ouvrir en constat)

${casse.length ? casse.map((r) => `- 🔴 **${r.nom}** — ${r.preuve}`).join('\n') : '- Rien de rouge sur cette passe.'}

## Ce qui est partiel (à surveiller)

${partiel.length ? partiel.map((r) => `- 🟡 **${r.nom}** — ${r.preuve}`).join('\n') : '- Rien.'}

## Détection (Garde / Sentinelle)

${detection || '- Aucun scénario de détection sur cette passe.'}
${bloc('Usage', resultats.usage)}${bloc('Pannes volontaires', resultats.pannes)}${bloc('Attaques simulées', resultats.attaques)}
## Ce qui n'a pas été vérifié

- La détection DIFFÉRÉE de la Garde au seuil réel (escalade à 15 min) : le bac à sable réduit le tick ; le délai mesuré est celui de la chaîne, pas le seuil de production.
- Postgres (Supabase) : la simulation tourne sur le repli SQLite. La route de fusion et les verrous \`FOR UPDATE\` côté Postgres ne sont pas exercés ici.
- Le vrai poste (amn-desktop) : on exerce l'API, pas l'interface ni la file d'envoi hors ligne réelle du poste.
`;
  fs.writeFileSync(path.join(dossier, 'RAPPORT.md'), md);
}

function ecrireMesures(resultats) {
  const dossier = path.join(RACINE, 'docs/simulation/mesures');
  fs.mkdirSync(dossier, { recursive: true });
  const tout = [...resultats.usage, ...resultats.pannes, ...resultats.attaques];
  const data = { date: new Date().toISOString(), scenarios: tout.map((r) => ({ nom: r.nom, resultat: r.resultat, mesures: r.mesures ?? {}, detection: r.detection ?? null })) };
  fs.writeFileSync(path.join(dossier, 'derniere-passe.json'), JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

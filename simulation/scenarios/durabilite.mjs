/**
 * DURABILITÉ — on tue le serveur en pleine écriture, encore et encore, et on
 * compte ce qui manque.
 *
 * Limite à dire d'emblée : SIGKILL arrête le processus, pas la machine. Le
 * noyau garde ses tampons, donc ces essais prouvent « aucune écriture
 * accusée n'est perdue quand le PROCESSUS tombe » (redémarrage Render, plantage
 * Node, OOM), pas « survit à une coupure de courant ». Pour cette seconde
 * question, ce qui compte est le réglage `synchronous` de SQLite, que le
 * scénario relève.
 */
import { client, connexion, demarrerServeur, ouvrirBaseNeuve, ouvrirSqlite, pause } from '../lib/harness.mjs';
import { prng } from '../lib/prng.mjs';
import { peupler, SIM_MDP } from '../lib/seed.mjs';

/** Dix redémarrages brutaux sous six écrivains : toute écriture accusée doit être là au retour. */
export async function cyclesSigkill({ graine = 424242 } = {}) {
  const r = prng(graine);
  const { db, chemin } = await ouvrirBaseNeuve('sim-durabilite.db');
  const pop = await peupler(db, { graine, nombrePersonnes: 24, nombreOrganisations: 4 });
  await db.close();
  const equipe = pop.users.filter((u) => u.orgId === pop.users[0].orgId).slice(0, 6);

  // Les sessions vivent en base : on se connecte une fois, les jetons survivent aux redémarrages.
  let srv = await demarrerServeur({ chemin });
  const jetons = [];
  for (const u of equipe) jetons.push((await connexion(srv.base, u.email, SIM_MDP)).token);

  const CYCLES = 10;
  const accusees = new Set();
  let enVolPersistees = 0;
  let enVolTotal = 0;
  let manquantes = 0;
  let corruptions = 0;
  const presentes = new Set();

  for (let cycle = 0; cycle < CYCLES; cycle += 1) {
    const enVol = new Map(); // id → promesse non résolue au moment du kill
    let arret = false;
    const ecrivains = jetons.map((jeton, w) => (async () => {
      const c = client(srv.base, jeton);
      for (let n = 0; !arret; n += 1) {
        const id = `c${cycle}-w${w}-${n}`;
        enVol.set(id, true);
        const rep = await c.put(`/v1/collections/notes/${id}`, { data: { cycle, w, n, charge: 'x'.repeat(200) } });
        if (rep.statut === 200) { accusees.add(id); enVol.delete(id); } else if (rep.statut !== 0) enVol.delete(id);
        if (rep.statut === 0) return; // serveur tombé
      }
    })());
    await pause(150 + Math.floor(r.reel() * 700)); // moment du crash : tiré à la graine
    srv.tuerBrutal();
    arret = true;
    await Promise.all(ecrivains);
    await pause(150);

    // La base est rouverte « à froid » (récupération du WAL) avant le serveur : intégrité d'abord.
    const sq = await ouvrirSqlite(chemin);
    const ic = sq.pragma('integrity_check', { simple: true });
    if (ic !== 'ok') corruptions += 1;
    const ids = new Set(sq.prepare("SELECT record_id FROM shared_records WHERE collection = 'notes'").all().map((x) => x.record_id));
    sq.close();
    for (const id of accusees) if (!ids.has(id)) { manquantes += 1; accusees.delete(id); }
    for (const id of enVol.keys()) { enVolTotal += 1; if (ids.has(id)) enVolPersistees += 1; }
    for (const id of ids) presentes.add(id);

    srv = await demarrerServeur({ chemin });
  }
  await srv.arreter();

  const sq = await ouvrirSqlite(chemin);
  const wal = sq.pragma('journal_mode', { simple: true });
  const synchronous = sq.pragma('synchronous', { simple: true });
  sq.close();
  const libelle = { 0: 'OFF', 1: 'NORMAL', 2: 'FULL', 3: 'EXTRA' }[synchronous] ?? synchronous;
  return {
    nom: `Durabilité : ${CYCLES} SIGKILL en pleine écriture (6 écrivains)`,
    resultat: manquantes === 0 && corruptions === 0 ? 'tient' : 'casse',
    preuve: `${accusees.size + manquantes} écritures accusées (HTTP 200), ${manquantes} manquantes au retour, ${corruptions} base(s) non intègre(s) ; ${enVolPersistees}/${enVolTotal} écritures sans accusé étaient quand même persistées (le poste doit les rejouer sans doublon) ; journal ${wal}, synchronous=${libelle} (la perte de courant n'est pas testable par SIGKILL)`,
    mesures: { ecrituresAccusees: accusees.size + manquantes, manquantes, enVolPersistees, enVolTotal, notesPresentes: presentes.size },
  };
}

/** Un lot de 200 événements coupé en route : la base garde un morceau de lot, sans transaction. */
export async function lotCoupeEnRoute({ graine = 424242 } = {}) {
  const r = prng(graine + 1);
  const { db, chemin } = await ouvrirBaseNeuve('sim-lot.db');
  const pop = await peupler(db, { graine, nombrePersonnes: 8, nombreOrganisations: 2 });
  await db.close();
  const site = pop.sites[0];
  const cle = `sim-cle-${site.orgId}`;
  const essais = [];
  for (let t = 0; t < 5; t += 1) {
    const srv = await demarrerServeur({ chemin });
    const etiquette = `lot-coupe-${t}`;
    const lot = { events: Array.from({ length: 200 }, (_, i) => ({ type: 'request', severity: 'info', message: `${etiquette}:${i}`, payload: { path: `/p/${i}`, status: 200 } })) };
    const envoi = client(srv.base, null).post('/v1/events', lot, { headers: { 'X-API-Key': cle } });
    await pause(10 + Math.floor(r.reel() * 120));
    srv.tuerBrutal();
    await envoi;
    await pause(150);
    const sq = await ouvrirSqlite(chemin);
    const n = sq.prepare('SELECT COUNT(*) AS n FROM events WHERE message LIKE ?').get(`${etiquette}:%`).n;
    sq.close();
    essais.push(n);
  }
  const partiels = essais.filter((n) => n > 0 && n < 200).length;
  return {
    nom: 'Lot de 200 événements coupé en route (atomicité du lot)',
    resultat: partiels === 0 ? 'tient' : 'casse',
    preuve: `événements stockés après coupure, sur 5 essais : [${essais.join(', ')}] sur 200 — ${partiels} lot(s) à moitié écrit(s) (insertion événement par événement, sans transaction) ; le renvoi du lot complet duplique ces ${essais.filter((n) => n > 0).length ? 'événements' : '—'}`,
    mesures: { lotsPartiels: partiels },
  };
}

/** Ce qui doit survivre à un redémarrage (freinage de connexion, sessions) et ce qui ne le fait pas (freins en mémoire). */
export async function etatApresRedemarrage({ graine = 424242 } = {}) {
  const { db, chemin } = await ouvrirBaseNeuve('sim-etat.db');
  const pop = await peupler(db, { graine, nombrePersonnes: 12, nombreOrganisations: 2 });
  await db.close();
  const [cible, autre] = pop.users;
  let srv = await demarrerServeur({ chemin });
  const anon = client(srv.base, null);
  for (let i = 0; i < 6; i += 1) await anon.post('/v1/auth/login', { email: cible.email, password: `faux-${i}` });
  const bloqueAvant = (await anon.post('/v1/auth/login', { email: cible.email, password: SIM_MDP })).statut === 429;
  const session = (await connexion(srv.base, autre.email, SIM_MDP)).token;
  // Frein en mémoire : on épuise le budget d'écriture de `autre`.
  const c = client(srv.base, session);
  let freine = false;
  for (let i = 0; i < 620 && !freine; i += 1) freine = (await c.put(`/v1/collections/notes/budget-${i}`, { data: { i } })).statut === 429;
  await srv.arreter();

  srv = await demarrerServeur({ chemin });
  const bloqueApres = (await client(srv.base, null).post('/v1/auth/login', { email: cible.email, password: SIM_MDP })).statut === 429;
  const sessionVit = (await client(srv.base, session).get('/v1/collections/notes')).statut === 200;
  const budgetRendu = (await client(srv.base, session).put('/v1/collections/notes/apres', { data: {} })).statut === 200;
  await srv.arreter();

  const ok = bloqueAvant && bloqueApres && sessionVit;
  return {
    nom: 'État après redémarrage (freinage de connexion, sessions, freins en mémoire)',
    resultat: ok ? (budgetRendu && freine ? 'partiel' : 'tient') : 'casse',
    preuve: `freinage de connexion : bloqué avant ${bloqueAvant ? 'oui' : 'non'} / après redémarrage ${bloqueApres ? 'oui (persisté en base)' : 'NON (perdu)'} ; session valide après redémarrage : ${sessionVit ? 'oui' : 'NON'} ; frein d'écriture en mémoire ${freine ? (budgetRendu ? 'remis à zéro par le redémarrage (un redémarrage vaut 600 écritures de plus)' : 'conservé') : 'non atteint'}`,
    mesures: {},
  };
}

/**
 * La Garde tuée en pleine ronde. On force des rondes en rafale (API
 * d'exploitation, jeton d'opérateur du bac à sable) et on tue le serveur au
 * hasard : il faut qu'une ronde interrompue (a) soit rejouée au redémarrage
 * (`prochaine_ronde_at` n'avance qu'à la fin d'une ronde) et (b) ne laisse
 * pas un état « en ronde » qui bloquerait l'agent.
 */
export async function gardeTueeEnRonde({ graine = 424242 } = {}) {
  const r = prng(graine + 2);
  const { db, chemin } = await ouvrirBaseNeuve('sim-garde-kill.db');
  await peupler(db, { graine, nombrePersonnes: 60, nombreOrganisations: 8 });
  await db.close();
  const ESSAIS = 10;
  let orphelines = 0;
  let agentsBloques = 0;
  let rejouees = 0;
  let interrompues = 0;
  for (let t = 0; t < ESSAIS; t += 1) {
    let srv = await demarrerServeur({ chemin, garde: true, monitors: true });
    const op = client(srv.base);
    await pause(1500); // laisser le premier battement passer
    let sq = await ouvrirSqlite(chemin, { readonly: true });
    const cles = sq.prepare('SELECT key FROM garde_agents ORDER BY key').all().map((x) => x.key);
    sq.close();
    let arret = false;
    const rafale = (async () => {
      for (let k = 0; !arret; k += 1) await op.post(`/v1/garde/agents/${cles[k % cles.length]}/ronde`, {});
    })();
    await pause(100 + Math.floor(r.reel() * 600));
    srv.tuerBrutal();
    arret = true;
    await rafale;
    await pause(200);
    sq = await ouvrirSqlite(chemin, { readonly: true });
    const sansFin = sq.prepare('SELECT agent FROM garde_rondes WHERE fin IS NULL').all();
    const enRonde = sq.prepare("SELECT key, derniere_ronde_at FROM garde_agents WHERE etat = 'ronde'").all();
    sq.close();
    orphelines += sansFin.length;
    if (enRonde.length) interrompues += 1;
    srv = await demarrerServeur({ chemin, garde: true, monitors: true });
    await pause(5000); // quelques battements (tick 2 s)
    sq = await ouvrirSqlite(chemin, { readonly: true });
    const encoreEnRonde = sq.prepare("SELECT COUNT(*) AS n FROM garde_agents WHERE etat = 'ronde'").get().n;
    sq.close();
    if (enRonde.length && encoreEnRonde === 0) rejouees += 1;
    agentsBloques += encoreEnRonde;
    await srv.arreter();
  }
  // Lecture du code (capitaine.js:366, :356) : la sélection des rondes dues ignore `etat`, et `prochaine_ronde_at`
  // n'avance qu'à la fin d'une ronde. Une ronde PLANIFIÉE tuée en route reste due et est rejouée au redémarrage ;
  // une ronde FORCÉE (comme ici) n'est pas rejouée, et son agent garde « en ronde » jusqu'à sa période suivante.
  // Le défaut est donc cosmétique (état périmé, lignes orphelines), pas une perte de surveillance.
  return {
    nom: `Garde tuée en pleine ronde (${ESSAIS} SIGKILL pendant des rondes forcées)`,
    resultat: agentsBloques === 0 && orphelines === 0 ? 'tient' : 'partiel',
    preuve: `${interrompues}/${ESSAIS} crashs ont laissé un agent « en ronde » ; ${rejouees} rejoué(s) au redémarrage, ${agentsBloques} resté(s) « en ronde » jusqu'à sa période suivante (ronde forcée : non rejouée ; une ronde planifiée l'est, d'après capitaine.js:366) ; ${orphelines} ligne(s) de ronde sans fin laissée(s) en base, jamais refermées avant la purge par l'âge`,
    mesures: { rondesOrphelines: orphelines, agentsBloques, crashsEnRonde: interrompues },
  };
}

export const scenariosDurabilite = [cyclesSigkill, lotCoupeEnRoute, etatApresRedemarrage, gardeTueeEnRonde];

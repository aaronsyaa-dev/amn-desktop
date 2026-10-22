/**
 * MONTÉE À 2000 COMPTES.
 *
 * Quatre questions, quatre scénarios : la tempête de connexions (CPU du
 * hachage, et surtout : les autres utilisateurs en pâtissent-ils ?), les
 * sockets temps réel (une grosse cliente qui ouvre l'application à 9 h),
 * l'espace volumineux (lire 10 000 fiches d'un coup), la Garde à 2000 comptes.
 *
 * Mesure de contention : une « sonde » déjà connectée émet un appel léger
 * toutes les 25 ms pendant la tempête. Si l'appel léger ralentit, c'est que la
 * boucle d'événements du serveur est occupée par autre chose.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AMN_API_DIR, client, connexion, demarrerServeur, enVagues, memoireKo, ouvrirBaseNeuve, pause, stats } from '../lib/harness.mjs';
import { peupler, SIM_MDP } from '../lib/seed.mjs';

/** Lance `f` en boucle toutes les `pasMs` jusqu'à `arreter()`, et rend les latences relevées. */
function sonde(f, pasMs = 25) {
  const durees = [];
  let fini = false;
  const boucle = (async () => {
    while (!fini) {
      const t0 = performance.now();
      const r = await f();
      durees.push(r?.ms ?? performance.now() - t0);
      await pause(pasMs);
    }
  })();
  return { arreter: async () => { fini = true; await boucle; return durees; } };
}

/** Deux mille connexions : 200 de front, puis les 2000 d'un seul coup. */
export async function tempeteDeConnexions({ srv, users, partage }) {
  const temoin = users[0];
  const tem = await connexion(srv.base, temoin.email, SIM_MDP);
  const cTemoin = client(srv.base, tem.token);
  const ram0 = memoireKo(srv.pid);

  const phase = async (nom, concurrence) => {
    const s = sonde(() => cTemoin.get('/v1/collections/notes'));
    const sHealth = sonde(() => client(srv.base, null).get('/v1/health'));
    const t0 = performance.now();
    const rep = await enVagues(users.map((u) => () => connexion(srv.base, u.email, SIM_MDP)), concurrence);
    const sec = (performance.now() - t0) / 1000;
    const lectures = await s.arreter();
    const sante = await sHealth.arreter();
    const ok = rep.filter((r) => r.ok);
    partage.sessions = rep.map((r, i) => ({ ...users[i], token: r.token })).filter((x) => x.token);
    return { nom, concurrence, sec, ok: ok.length, erreurs: rep.filter((r) => r.statut === 0).length, login: stats(rep.map((r) => r.ms)), lecturesPendant: stats(lectures), santePendant: stats(sante) };
  };
  const a = await phase('200 de front', 200);
  const b = await phase('2000 d’un seul coup', users.length);
  const ram1 = memoireKo(srv.pid);
  const toutOk = a.ok === users.length && b.ok === users.length;
  const gele = Math.max(a.lecturesPendant.p95, b.lecturesPendant.p95) > 1000;
  return {
    nom: `Tempête de connexions (${users.length} comptes)`,
    resultat: toutOk && !gele ? (b.login.p95 > 15000 ? 'partiel' : 'tient') : 'casse',
    preuve: `200 de front : ${a.ok}/${users.length} en ${a.sec.toFixed(1)} s (${(users.length / a.sec).toFixed(0)}/s), connexion p95 ${a.login.p95} ms ; 2000 d'un coup : ${b.ok}/${users.length} en ${b.sec.toFixed(1)} s, ${b.erreurs} erreurs réseau, connexion p95 ${b.login.p95} ms, max ${b.login.max} ms ; pour un utilisateur DÉJÀ connecté pendant ces tempêtes, une lecture p95 ${a.lecturesPendant.p95} ms puis ${b.lecturesPendant.p95} ms, et /v1/health p95 ${a.santePendant.p95} / ${b.santePendant.p95} ms ; mémoire serveur ${(ram0.rss / 1024).toFixed(0)} → ${(ram1.pic / 1024).toFixed(0)} Mo (pic)`,
    mesures: { loginDeFront: a.login, loginUnCoup: b.login, lectureTemoinPendantTempete: b.lecturesPendant, santePendantTempete: b.santePendant, debitConnexionsParSeconde: +(users.length / a.sec).toFixed(0), memoirePicMo: Math.round(ram1.pic / 1024) },
  };
}

/** 2000 sockets temps réel répartis sur 60 organisations : ouverture, présence, diffusion d'une fiche. */
export async function socketsTempsReel({ srv, partage }) {
  const { default: WebSocket } = await import(pathToFileURL(path.join(AMN_API_DIR, 'node_modules/ws/wrapper.mjs')).href);
  const sessions = partage.sessions ?? [];
  if (sessions.length < 100) return { nom: 'Sockets temps réel', resultat: 'partiel', preuve: 'sessions indisponibles (la tempête de connexions doit passer avant)', mesures: {} };
  const ws = `ws://127.0.0.1:${srv.port}`;
  const ouvertes = [];
  const delais = [];
  const echecs = [];
  const t0 = performance.now();
  await enVagues(sessions.map((s) => () => new Promise((resolve) => {
    const debut = performance.now();
    const sock = new WebSocket(`${ws}/v1/stream?token=${encodeURIComponent(s.token)}&user=${encodeURIComponent(s.email)}`);
    sock.__org = s.orgId;
    sock.__recus = 0;
    sock.on('message', (m) => { try { const j = JSON.parse(String(m)); sock.__recus += 1; if (j.type === 'record') sock.__record?.(j); } catch { /* trame illisible */ } });
    sock.once('open', () => { delais.push(performance.now() - debut); ouvertes.push({ sock, s }); resolve(); });
    sock.once('error', (e) => { echecs.push(e.message); resolve(); });
    sock.once('close', () => resolve());
  })), 200);
  const secOuverture = (performance.now() - t0) / 1000;
  await pause(1500);
  const ram = memoireKo(srv.pid);

  // Diffusion : une personne d'une organisation écrit une fiche ; combien de temps avant que ses collègues la reçoivent ?
  const parOrg = new Map();
  for (const o of ouvertes) parOrg.set(o.s.orgId, [...(parOrg.get(o.s.orgId) ?? []), o]);
  const [orgId, membres] = [...parOrg.entries()].sort((x, y) => y[1].length - x[1].length)[0];
  const auteur = membres[0].s;
  const recus = [];
  const tEcriture = performance.now();
  for (const m of membres) m.sock.__record = () => recus.push(performance.now() - tEcriture);
  await client(srv.base, auteur.token).put('/v1/collections/notes/diffusion-1', { data: { texte: 'bonjour à toute l’équipe' } });
  await pause(1500);
  const diffusion = stats(recus);
  const totalTrames = ouvertes.reduce((n, o) => n + o.sock.__recus, 0);
  for (const o of ouvertes) o.sock.terminate();
  await pause(500);
  return {
    nom: `Sockets temps réel (${ouvertes.length} ouvertes sur ${parOrg.size} organisations)`,
    resultat: ouvertes.length === sessions.length && recus.length === membres.length ? 'tient' : 'partiel',
    preuve: `${ouvertes.length}/${sessions.length} ouvertes en ${secOuverture.toFixed(1)} s (ouverture p95 ${stats(delais).p95} ms), ${echecs.length} échecs ; ${totalTrames} trames reçues au total à l'ouverture (présence) ; diffusion d'une fiche dans une organisation de ${membres.length} : ${recus.length}/${membres.length} reçues, p95 ${diffusion.p95} ms ; mémoire ${(ram.rss / 1024).toFixed(0)} Mo avec ${ouvertes.length} sockets`,
    mesures: { ouvertureSockets: stats(delais), diffusionFiche: diffusion, tramesPresenceTotal: totalTrames, memoireMoAvecSockets: Math.round(ram.rss / 1024) },
  };
}

/** Une SEULE grosse cliente dont tout le monde ouvre l'application à 9 h : la présence est rediffusée à chaque arrivée. */
async function passeGrosseCliente(N) {
  const { db, chemin } = await ouvrirBaseNeuve(`sim-grosse-cliente-${N}.db`);
  const pop = await peupler(db, { graine: 424242, nombrePersonnes: N, nombreOrganisations: 1 });
  await db.close();
  const srv = await demarrerServeur({ chemin });
  const { default: WebSocket } = await import(pathToFileURL(path.join(AMN_API_DIR, 'node_modules/ws/wrapper.mjs')).href);
  const sessions = (await enVagues(pop.users.map((u) => () => connexion(srv.base, u.email, SIM_MDP).then((r) => ({ ...u, token: r.token }))), 60)).filter((s) => s.token);
  const sante = sonde(() => client(srv.base, null).get('/v1/health'));
  const cTemoin = client(srv.base, sessions[0].token);
  const lecture = sonde(() => cTemoin.get('/v1/collections/notes'));
  const socks = [];
  let octets = 0;
  const t0 = performance.now();
  await enVagues(sessions.map((s) => () => new Promise((resolve) => {
    const sock = new WebSocket(`ws://127.0.0.1:${srv.port}/v1/stream?token=${encodeURIComponent(s.token)}&user=${encodeURIComponent(s.email)}`);
    sock.on('message', (m) => { octets += m.length; });
    sock.once('open', () => { socks.push(sock); resolve(); });
    sock.once('error', () => resolve());
  })), 100); // 100 postes qui s'ouvrent ensemble
  const sec = (performance.now() - t0) / 1000;
  await pause(1500);
  const latSante = stats(await sante.arreter());
  const latLecture = stats(await lecture.arreter());
  const ram = memoireKo(srv.pid);
  const ouvertes = socks.length;
  for (const s of socks) s.terminate();
  await srv.arreter();
  return { N, ouvertes, attendues: sessions.length, sec, octets, latSante, latLecture, ramMo: ram.pic / 1024 };
}

export async function grosseCliente9h() {
  const petite = await passeGrosseCliente(300);
  const grande = await passeGrosseCliente(600);
  const ratio = grande.octets / petite.octets; // 4 si le coût est en N², 8 s'il est en N³
  const exposant = Math.log2(ratio); // pour un doublement exact (300 → 600)
  const extrapole2000 = (grande.octets / 1e6) * (2000 / 600) ** exposant;
  const toutOuvert = petite.ouvertes === petite.attendues && grande.ouvertes === grande.attendues;
  return {
    nom: 'Grosse cliente : tout le monde ouvre l’application à 9 h (1 organisation, 300 puis 600 personnes)',
    resultat: toutOuvert && grande.latLecture.p95 < 1000 ? (grande.octets > 500e6 ? 'partiel' : 'tient') : 'casse',
    preuve: `${petite.N} personnes : ${(petite.octets / 1e6).toFixed(0)} Mo de trames de présence reçus par les postes ; ${grande.N} personnes : ${(grande.octets / 1e6).toFixed(0)} Mo (×${ratio.toFixed(1)} pour 2× plus de monde : croissance en N^${exposant.toFixed(1)} ; chaque arrivée rediffuse la liste complète de présence à tous les présents) ; extrapolé à 2000 avec cet exposant : ≈ ${(extrapole2000 / 1000).toFixed(0)} Go (estimation, non mesurée) ; pendant les ${grande.N} arrivées : lecture d'un collègue déjà connecté p95 ${grande.latLecture.p95} ms (max ${grande.latLecture.max} ms), /v1/health p95 ${grande.latSante.p95} ms ; ${grande.ouvertes}/${grande.attendues} sockets ouvertes en ${grande.sec.toFixed(1)} s ; mémoire ${grande.ramMo.toFixed(0)} Mo`,
    mesures: { megaoctetsPresence300: Math.round(petite.octets / 1e6), megaoctetsPresence600: Math.round(grande.octets / 1e6), ratioPour2xPlusDeMonde: +ratio.toFixed(1), exposantMesure: +exposant.toFixed(1), lecturePendant600: grande.latLecture, santePendant600: grande.latSante },
  };
}

/** Un espace de 10 000 fiches lu d'un coup (aucune pagination côté serveur), par plusieurs postes. */
export async function espaceVolumineux() {
  const { db, chemin } = await ouvrirBaseNeuve('sim-volumineux.db');
  const pop = await peupler(db, { graine: 424242, nombrePersonnes: 12, nombreOrganisations: 1 });
  const orgId = pop.orgs[0].id;
  const t0 = Date.now();
  for (let i = 0; i < 10_000; i += 1) {
    const collection = i % 2 ? 'tasks' : i % 3 ? 'notes' : 'invoices';
    await db.upsertRecord(orgId, collection, `gros-${i}`, { titre: `Fiche ${i}`, detail: 'lorem ipsum '.repeat(30), statut: 'todo', montant: i * 1.5 });
  }
  await db.close();
  const srv = await demarrerServeur({ chemin });
  const cx = await connexion(srv.base, pop.users[1].email, SIM_MDP);
  const c = client(srv.base, cx.token);
  const un = await c.get('/v1/collections/_bulk?names=tasks,notes,invoices');
  const octets = JSON.stringify(un.json).length;
  const sante = sonde(() => client(srv.base, null).get('/v1/health'));
  const t1 = performance.now();
  const dix = await Promise.all(Array.from({ length: 10 }, () => c.get('/v1/collections/_bulk?names=tasks,notes,invoices')));
  const sec = (performance.now() - t1) / 1000;
  const latSante = stats(await sante.arreter());
  const ram = memoireKo(srv.pid);
  await srv.arreter();
  return {
    nom: 'Espace volumineux (10 000 fiches, lecture groupée sans pagination)',
    resultat: un.ok && latSante.p95 < 500 ? 'tient' : latSante.p95 < 2000 ? 'partiel' : 'casse',
    preuve: `une lecture : ${un.ms.toFixed(0)} ms pour ${(octets / 1e6).toFixed(1)} Mo ; 10 postes en même temps : ${sec.toFixed(1)} s, lecture p95 ${stats(dix.map((r) => r.ms)).p95} ms ; pendant ce temps, /v1/health p95 ${latSante.p95} ms, max ${latSante.max} ms (boucle d'événements occupée) ; mémoire ${(ram.pic / 1024).toFixed(0)} Mo (pic) ; peuplement ${((Date.now() - t0) / 1000).toFixed(0)} s`,
    mesures: { lecture1: { ms: +un.ms.toFixed(0), megaoctets: +(octets / 1e6).toFixed(1) }, dixPostes: stats(dix.map((r) => r.ms)), santePendant: latSante, memoirePicMo: Math.round(ram.pic / 1024) },
  };
}

/** La Garde sur 2000 comptes / 60 organisations : durée des rondes, retard, budget de 15 s par battement. */
export async function gardeADeuxMilleComptes({ chemin }) {
  const srv = await demarrerServeur({ chemin, garde: true, monitors: true });
  await pause(25_000); // plusieurs battements (tick de 2 s dans le bac à sable)
  const op = client(srv.base);
  const rondes = (await op.get('/v1/garde/rondes?limit=500')).json?.rondes ?? [];
  const sante = (await op.get('/v1/health')).json;
  const durees = rondes.filter((r) => typeof r.dureeMs === 'number').map((r) => r.dureeMs);
  const pires = [...rondes].sort((a, b) => (b.dureeMs ?? 0) - (a.dureeMs ?? 0)).slice(0, 3).map((r) => `${r.agent} ${r.dureeMs} ms`);
  const sansFin = rondes.filter((r) => !r.fin).length;
  const ram = memoireKo(srv.pid);
  const sortants = srv.sortantsRefuses();
  await srv.arreter();
  const st = stats(durees);
  const b = sante?.garde ?? {};
  return {
    nom: 'Garde sur 2000 comptes / 60 organisations (25 s de battements)',
    resultat: (b.enRetard ?? 0) === 0 && st.max < 15_000 ? 'tient' : 'partiel',
    preuve: `${rondes.length} rondes en 25 s, durée p50 ${st.p50} ms / p95 ${st.p95} ms / max ${st.max} ms (plus longues : ${pires.join(', ')}) ; rondes en retard ${b.enRetard ?? '?'} ; ${sansFin} sans fin ; mémoire ${(ram.pic / 1024).toFixed(0)} Mo ; appels sortants refusés par le bac à sable : ${Object.keys(sortants).length ? Object.entries(sortants).map(([h, n]) => `${h}×${n}`).join(', ') : 'aucun'}`,
    mesures: { rondes: st, rondesEnRetard: b.enRetard ?? null, memoirePicMo: Math.round(ram.pic / 1024) },
  };
}

export const scenariosEchelle = [tempeteDeConnexions, socketsTempsReel, grosseCliente9h, espaceVolumineux, gardeADeuxMilleComptes];

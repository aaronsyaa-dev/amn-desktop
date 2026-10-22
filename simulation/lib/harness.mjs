/**
 * LE HARNAIS — démarre amn-api en local, peuple, mesure, arrête.
 *
 * Tout le monde part d'ici. Une base SQLite neuve par simulation (fichier
 * supprimé puis recréé), un serveur enfant sur un port libre, un jeton
 * d'opérateur de test. Aucune donnée réelle, aucun réseau sortant : le serveur
 * tourne sur 127.0.0.1 et ne parle à personne d'autre.
 *
 * Variables : AMN_API_DIR (dossier d'amn-api, défaut /home/user/amn-api),
 * SIM_DB_DIR (où poser les bases jetables, défaut /tmp/sim).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Un port TCP libre, demandé à l'OS (bind sur :0). Évite les ports empoisonnés par un socket résiduel. */
export function portLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

export const AMN_API_DIR = process.env.AMN_API_DIR || '/home/user/amn-api';
export const DB_DIR = process.env.SIM_DB_DIR || '/tmp/sim';
export const JETON_OPERATEUR = 'sim-operateur-token';

/** Ouvre une base SQLite neuve par la couche données d'amn-api (pour peupler hors HTTP). */
export async function ouvrirBaseNeuve(nom = 'sim.db') {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const chemin = path.join(DB_DIR, nom);
  for (const suffixe of ['', '-wal', '-shm']) fs.rmSync(chemin + suffixe, { force: true });
  const { createSqliteDb } = await import(path.join(AMN_API_DIR, 'src/db/sqlite.js'));
  const db = createSqliteDb(chemin);
  await db.init();
  return { db, chemin };
}

/**
 * Démarre amn-api sur une base donnée. `garde` et `monitors` sont éteints par
 * défaut (un scénario d'usage n'a pas besoin des rondes) ; un scénario de
 * détection les rallume explicitement.
 */
export async function demarrerServeur({ chemin, port, garde = false, monitors = false, env = {} } = {}) {
  if (!port) port = await portLibre();
  fs.mkdirSync(DB_DIR, { recursive: true });
  const journalSortant = path.join(DB_DIR, `sortant-${port}-${Date.now()}.log`);
  const isolement = new URL('./isolement-reseau.mjs', import.meta.url).href; // aucun tiers : tout appel hors boucle locale est refusé et noté
  const proc = spawn(process.execPath, ['--import', isolement, 'src/server.js'], {
    cwd: AMN_API_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'sim',
      SQLITE_PATH: chemin,
      PORT: String(port),
      OPERATOR_TOKEN: JETON_OPERATEUR,
      CORS_ORIGIN: '*',
      GARDE: garde ? 'on' : 'off',
      TRACKER_MONITORS: monitors ? 'on' : 'off',
      GARDE_TICK_MS: '2000',
      SIM_SORTANT_LOG: journalSortant,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  proc.stdout.on('data', (d) => logs.push(String(d)));
  proc.stderr.on('data', (d) => logs.push(String(d)));
  let sorti = null;
  proc.on('exit', (code) => { sorti = code; });
  const base = `http://127.0.0.1:${port}`;
  try {
    await attendre(async () => {
      if (sorti !== null) throw new Error(`le serveur a quitté au démarrage (code ${sorti}) :\n${logs.join('')}`);
      try {
        const r = await fetch(`${base}/v1/health`);
        return r.ok;
      } catch {
        return false;
      }
    }, 15000, 100);
  } catch (e) {
    proc.kill('SIGKILL');
    throw e;
  }
  return {
    base,
    port,
    pid: proc.pid,
    logs,
    /** Les hôtes que le serveur a voulu appeler (et qu'on a refusés), avec leur nombre de tentatives. */
    sortantsRefuses: () => {
      try {
        const n = {};
        for (const l of fs.readFileSync(journalSortant, 'utf8').split('\n').filter(Boolean)) n[l] = (n[l] ?? 0) + 1;
        return n;
      } catch { return {}; }
    },
    arreter: () => new Promise((resolve) => {
      if (proc.exitCode !== null) return resolve();
      proc.once('exit', () => resolve());
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 2000);
    }),
    tuerBrutal: () => proc.kill('SIGKILL'), // pour « redémarrage pendant une écriture »
  };
}

/** Attend qu'une condition devienne vraie, ou lève après `limiteMs`. */
export async function attendre(condition, limiteMs = 10000, pasMs = 100) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (await condition()) return true;
    await pause(pasMs);
  }
  throw new Error(`attendre: condition non remplie en ${limiteMs} ms`);
}

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un client HTTP minimal avec jeton et chronométrage. */
export function client(base, jeton = JETON_OPERATEUR) {
  const appel = async (methode, chemin, { body, headers = {}, jetonAutre } = {}) => {
    const t0 = performance.now();
    const h = { ...headers };
    const auth = jetonAutre ?? jeton;
    if (auth) h.Authorization = `Bearer ${auth}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    let res;
    let erreur = null;
    try {
      res = await fetch(base + chemin, { method: methode, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      erreur = e;
    }
    const ms = performance.now() - t0;
    if (erreur) return { ok: false, statut: 0, ms, erreur: String(erreur.message || erreur) };
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* corps non-JSON */
    }
    return { ok: res.ok, statut: res.status, ms, json, headers: res.headers };
  };
  return {
    get: (c, o) => appel('GET', c, o),
    post: (c, body, o) => appel('POST', c, { ...o, body }),
    put: (c, body, o) => appel('PUT', c, { ...o, body }),
    del: (c, o) => appel('DELETE', c, o),
    brut: appel,
  };
}

/** Connexion d'un compte de la population → jeton de session. */
export async function connexion(base, email, mdp) {
  const c = client(base, null);
  const r = await c.post('/v1/auth/login', { email, password: mdp });
  return { ok: r.ok, statut: r.statut, ms: r.ms, token: r.json?.token ?? null, code: r.json?.code ?? null };
}

/** Statistiques de latence sur un tableau de durées (ms). */
export function stats(durees) {
  if (durees.length === 0) return { n: 0 };
  const t = [...durees].sort((a, b) => a - b);
  const q = (p) => t[Math.min(t.length - 1, Math.floor((p / 100) * t.length))];
  const somme = t.reduce((a, b) => a + b, 0);
  return {
    n: t.length,
    min: +t[0].toFixed(1),
    p50: +q(50).toFixed(1),
    p95: +q(95).toFixed(1),
    p99: +q(99).toFixed(1),
    max: +t[t.length - 1].toFixed(1),
    moyenne: +(somme / t.length).toFixed(1),
  };
}

/** Lance `taches` par vagues de `concurrence` ; renvoie tous les résultats. */
export async function enVagues(taches, concurrence) {
  const resultats = [];
  for (let i = 0; i < taches.length; i += concurrence) {
    const lot = taches.slice(i, i + concurrence).map((t) => t());
    resultats.push(...(await Promise.all(lot)));
  }
  return resultats;
}

/** Ouvre une base SQLite avec le better-sqlite3 d'amn-api (lecture d'une base de simulation, jamais autre chose). */
export async function ouvrirSqlite(chemin, options = {}) {
  const { default: Database } = await import(pathToFileURL(path.join(AMN_API_DIR, 'node_modules/better-sqlite3/lib/index.js')).href);
  return new Database(chemin, options);
}

/** Ce que le SOC (Tour de contrôle, incidents, Garde) a « vu » : un compteur par tableau de signaux. */
export async function signauxSOC(chemin) {
  const sq = await ouvrirSqlite(chemin, { readonly: true });
  const n = (sql) => sq.prepare(sql).get().n;
  const signaux = {
    alertesEntree: n('SELECT COUNT(*) AS n FROM input_alerts'),
    incidents: n('SELECT COUNT(*) AS n FROM incidents'),
    evenementsSecurite: n("SELECT COUNT(*) AS n FROM events WHERE type = 'security_alert'"),
    remonteesSecurite: n("SELECT COUNT(*) AS n FROM garde_remontees WHERE equipe = 'securite'"),
  };
  sq.close();
  return signaux;
}

/** Mémoire résidente d'un processus (Ko), lue dans /proc — Linux seulement. */
export function memoireKo(pid) {
  try {
    const t = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const lire = (cle) => Number((t.match(new RegExp(`${cle}:\\s+(\\d+)`)) ?? [])[1] ?? 0);
    return { rss: lire('VmRSS'), pic: lire('VmHWM') };
  } catch {
    return { rss: 0, pic: 0 };
  }
}

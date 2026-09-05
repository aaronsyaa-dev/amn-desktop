/**
 * Toute la base, table par table, ligne par ligne — la référence de ce qui
 * doit survivre à une mise à jour. Les tables techniques (sessions, défis
 * MFA, compteurs de connexion) ne sont pas des données à conserver.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

export const TABLES_TECHNIQUES = new Set(['sessions', 'mfa_challenges', 'login_attempts', 'monitor_runs', 'sqlite_sequence']);

export function dumper(fichier) {
  const db = new Database(fichier, { readonly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  const resultat = {};
  for (const t of tables) {
    if (TABLES_TECHNIQUES.has(t)) continue;
    const rows = db.prepare(`SELECT * FROM "${t}"`).all().map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Buffer.isBuffer(v) ? `base64:${v.toString('base64')}` : v])));
    resultat[t] = rows;
  }
  db.close();
  return resultat;
}

/** La clé d'une ligne : ses colonnes d'identité si on les reconnaît, sinon la ligne entière. */
export function cleLigne(table, row) {
  const candidates = ['id', 'token_hash', 'endpoint', 'bucket', 'site_id', 'org_id', 'record_id', 'collection', 'user_id', 'key', 'tag', 'module', 'created_at', 'occurred_at'];
  const cles = candidates.filter((c) => c in row);
  if (cles.length === 0) return JSON.stringify(row);
  return JSON.stringify(cles.map((c) => [c, row[c]]));
}

/**
 * Compare une base d'hier et la même base après la mise à jour :
 * chaque ligne d'hier doit être là, chaque valeur non nulle identique.
 * Une valeur nulle hier peut être remplie aujourd'hui (un rattrapage),
 * jamais l'inverse. Les tables et colonnes nouvelles sont libres.
 */
export function comparer(avant, apres) {
  const pertes = [];
  for (const [table, lignes] of Object.entries(avant)) {
    if (!(table in apres)) {
      if (lignes.length > 0) pertes.push(`table ${table} : disparue avec ses ${lignes.length} ligne(s)`);
      continue;
    }
    const index = new Map(apres[table].map((r) => [cleLigne(table, r), r]));
    for (const ligne of lignes) {
      const cle = cleLigne(table, ligne);
      const nouvelle = index.get(cle);
      if (!nouvelle) { pertes.push(`${table} : ligne ${cle.slice(0, 120)} disparue`); continue; }
      for (const [col, val] of Object.entries(ligne)) {
        if (val === null || val === undefined) continue;
        if (!(col in nouvelle)) { pertes.push(`${table}.${col} : colonne disparue (ligne ${cle.slice(0, 80)})`); continue; }
        const a = typeof val === 'number' ? String(val) : val;
        const b = typeof nouvelle[col] === 'number' ? String(nouvelle[col]) : nouvelle[col];
        if (a !== b) pertes.push(`${table}.${col} : ${JSON.stringify(String(val).slice(0, 60))} → ${JSON.stringify(String(nouvelle[col]).slice(0, 60))} (ligne ${cle.slice(0, 80)})`);
      }
    }
  }
  return pertes;
}

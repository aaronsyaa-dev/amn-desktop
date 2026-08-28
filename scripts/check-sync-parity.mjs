#!/usr/bin/env node
/**
 * Guard against the regression that keeps coming back: a collection that syncs
 * on one platform and not the other.
 *
 * It has returned on every chantier that touched shared data, because nothing
 * failed when it broke. A collection can stop syncing in four silent ways, and
 * this script fails on each of them:
 *
 *   1. It is declared in the `SyncedCollection` type but missing from
 *      `SYNCED_COLLECTIONS` in SyncContext — writes reach amn-api, reads never
 *      come back, and the data "disappears on reload".
 *   2. It is in `SYNCED_COLLECTIONS` but not in amn-api's ALLOWED set — every
 *      read and write 404s, and the app carries on with only its local mirror,
 *      which looks like it works until a second machine opens the app.
 *   3. It still has a per-platform store in `src/lib/bridge.ts` (an
 *      `amn.fallback.*` localStorage key), which means the web build reads a
 *      different database from Electron — the Clients bug, exactly.
 *   4. It is rejected at runtime by the live API (checked when one is
 *      reachable): the only test that catches an amn-api deployed without the
 *      matching allow-list.
 *
 * Checks 1–3 are static and always run. Check 4 needs a running amn-api and is
 * skipped, loudly, when there is none.
 *
 * Usage:
 *   node scripts/check-sync-parity.mjs
 *   AMN_API_URL=http://localhost:8810 AMN_API_OPERATOR_TOKEN=… node scripts/check-sync-parity.mjs
 *   AMN_API_URL=… AMN_API_EMAIL=… AMN_API_PASSWORD=… node scripts/check-sync-parity.mjs
 *
 * La sonde runtime accepte deux justificatifs, et les exerce tous les deux
 * quand ils sont fournis :
 *   - le jeton opérateur, qui résout vers AMN DevSec ;
 *   - un compte nominatif (email/mot de passe), qui résout vers SON
 *     organisation.
 *
 * Les deux comptent. Une collection peut très bien passer pour AMN DevSec et
 * échouer pour une organisation cliente — c'est le cas si amn-api a été
 * déployée avec la bonne liste ALLOWED mais que le compte est suspendu, ou si
 * une règle d'isolation refuse une écriture. Vérifier une seule organisation,
 * c'est vérifier la moitié de ce qui est livré.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/* ---------------------------------------------------------------- sources -- */

/**
 * Collections declared in the shared type union.
 *
 * Le point-virgule cherché est celui qui TERMINE UNE LIGNE, et pas n'importe
 * lequel : les commentaires de ce type sont rédigés en français, où le
 * point-virgule est une ponctuation courante. Un `;` au milieu d'une phrase
 * arrêtait la lecture au beau milieu de l'union, et les collections déclarées
 * APRÈS ce commentaire étaient signalées comme « absentes du type » alors
 * qu'elles y étaient — une fausse alerte qui envoie chercher au mauvais
 * endroit, ce qui est pire qu'un contrôle absent.
 */
function declaredCollections() {
  const src = read('src/shared/api.ts');
  const block = /export type SyncedCollection =([\s\S]*?);[\r\n]/.exec(src);
  if (!block) throw new Error('SyncedCollection introuvable dans src/shared/api.ts');
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
}

/** Collections actually pulled and mirrored by SyncContext. */
function pulledCollections() {
  const src = read('src/state/SyncContext.tsx');
  const block = /const SYNCED_COLLECTIONS: SyncedCollection\[\] = \[([\s\S]*?)\];/.exec(src);
  if (!block) throw new Error('SYNCED_COLLECTIONS introuvable dans src/state/SyncContext.tsx');
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
}

/**
 * Collections amn-api accepts. Read from the sibling checkout when present —
 * a static cross-repo check is worth having even though the runtime probe below
 * is the authoritative one.
 */
function apiAllowedCollections() {
  // `AMN_API_ROOT` d'abord : en CI, `actions/checkout` ne sait écrire que
  // dans l'espace de travail, donc le dépôt voisin ne peut pas atterrir à
  // `../amn-api`. Voir scripts/api-root.mjs.
  for (const candidate of [process.env.AMN_API_ROOT, '/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].filter(Boolean)) {
    const file = path.join(candidate, 'src/routes/collections.js');
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf-8');
    const block = /const ALLOWED = new Set\(\[([\s\S]*?)\]\);/.exec(src);
    if (block) return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
  }
  return null;
}

/** Per-platform localStorage stores still declared in the browser bridge. */
function fallbackStores() {
  const src = read('src/lib/bridge.ts');
  return [...src.matchAll(/'amn\.fallback\.([a-zA-Z]+)'/g)].map((m) => m[1]);
}

/**
 * Legacy stores the bridge explicitly declares as read-only migration sources.
 * Being on this list is a deliberate, reviewable exception — a NEW per-platform
 * store for a synced collection is not on it, and fails.
 */
function declaredLegacyStores() {
  const src = read('src/lib/bridge.ts');
  const block = /export const LEGACY_MIGRATION_ONLY_STORES = \[([\s\S]*?)\] as const;/.exec(src);
  return block ? [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]) : [];
}

/* ----------------------------------------------------------------- checks -- */

const declared = declaredCollections();
const pulled = pulledCollections();
const allowed = apiAllowedCollections();
const fallbacks = fallbackStores();

console.log(`Collections déclarées : ${declared.length} — ${declared.join(', ')}`);

// 1. Declared but never pulled back.
for (const c of declared) {
  if (!pulled.includes(c)) {
    failures.push(
      `« ${c} » est dans le type SyncedCollection mais absente de SYNCED_COLLECTIONS ` +
        `(src/state/SyncContext.tsx) : ses écritures partent, ses lectures ne reviennent jamais.`,
    );
  }
}
// And the reverse, which is just as broken (a typo in the list).
for (const c of pulled) {
  if (!declared.includes(c)) {
    failures.push(`« ${c} » est dans SYNCED_COLLECTIONS mais pas dans le type SyncedCollection.`);
  }
}

// 2. Pulled but refused by amn-api.
if (allowed) {
  for (const c of pulled) {
    if (!allowed.includes(c)) {
      failures.push(
        `« ${c} » est synchronisée côté app mais absente de ALLOWED dans ` +
          `amn-api/src/routes/collections.js : l'API répondra 404 sur chaque lecture et écriture.`,
      );
    }
  }
} else {
  notes.push('amn-api introuvable localement — contrôle statique de la liste ALLOWED sauté.');
}

// 3. A synced collection that still has a per-platform store, without being
//    declared as a read-only migration source.
const legacyAllowed = declaredLegacyStores();
for (const c of pulled) {
  if (fallbacks.includes(c) && !legacyAllowed.includes(c)) {
    failures.push(
      `« ${c} » est synchronisée ET garde un magasin local par plateforme ` +
        `(amn.fallback.${c} dans src/lib/bridge.ts) sans figurer dans ` +
        `LEGACY_MIGRATION_ONLY_STORES : le web et Electron liraient deux bases ` +
        `différentes. C'est exactement le bug Clients.`,
    );
  }
}
if (legacyAllowed.length > 0) {
  notes.push(
    `${legacyAllowed.length} magasin(s) hérité(s) conservés en lecture seule pour la migration : ` +
      `${legacyAllowed.join(', ')}. À supprimer une fois les postes migrés.`,
  );
}

/* --------------------------------------------------- runtime probe (opt.) -- */

const apiUrl = (process.env.AMN_API_URL || '').replace(/\/$/, '');
const token = process.env.AMN_API_OPERATOR_TOKEN || '';
const email = process.env.AMN_API_EMAIL || '';
const password = process.env.AMN_API_PASSWORD || '';

/** Échange email/mot de passe contre un jeton de session nominatif. */
async function signIn() {
  const res = await fetch(`${apiUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `${res.status} ${res.statusText}`);
  return body;
}

/** Exerce chaque collection avec UN justificatif : écriture, lecture, effacement. */
async function probeWith(label, credential) {
  console.log(`\nSonde runtime sur ${apiUrl} — ${label} :`);
  const id = `__parity-${Date.now()}`;
  for (const c of pulled) {
    const base = `${apiUrl}/v1/collections/${c}`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` };
    try {
      const put = await fetch(`${base}/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: { __parityProbe: true } }),
      });
      const get = await fetch(base, { headers });
      await fetch(`${base}/${id}`, { method: 'DELETE', headers }).catch(() => {});
      if (!put.ok || !get.ok) {
        failures.push(
          `« ${c} » refusée par l'API en conditions réelles pour ${label} ` +
            `(PUT ${put.status}, GET ${get.status}).`,
        );
        console.log(`  KO  ${c} — PUT ${put.status}, GET ${get.status}`);
      } else {
        console.log(`  OK  ${c}`);
      }
    } catch (err) {
      failures.push(`« ${c} » : sonde impossible pour ${label} (${err?.message ?? err}).`);
      console.log(`  KO  ${c} — ${err?.message ?? err}`);
    }
  }
}

async function probeRuntime() {
  if (!apiUrl) {
    notes.push(
      'AMN_API_URL non définie — sonde runtime sautée. ' +
        "C'est la seule vérification qui attrape une amn-api déployée sans la bonne liste.",
    );
    return;
  }

  let probed = false;
  if (token) {
    await probeWith('jeton opérateur (AMN DevSec)', token);
    probed = true;
  }
  if (email && password) {
    try {
      const session = await signIn();
      const orgName = session?.org?.name ?? 'organisation inconnue';
      await probeWith(`session ${email} (${orgName})`, session.token);
      probed = true;
      await fetch(`${apiUrl}/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
    } catch (err) {
      failures.push(`Connexion impossible pour ${email} : ${err?.message ?? err}.`);
      console.log(`  KO  connexion ${email} — ${err?.message ?? err}`);
    }
  }

  if (!probed) {
    notes.push(
      'Aucun justificatif fourni (AMN_API_OPERATOR_TOKEN, ou AMN_API_EMAIL + ' +
        'AMN_API_PASSWORD) — sonde runtime sautée.',
    );
  }
}

await probeRuntime();

/* ----------------------------------------------------------------- report -- */

console.log('');
for (const n of notes) console.log(`NOTE  ${n}`);
if (failures.length === 0) {
  console.log('OK — chaque collection synchronisée est lue, écrite et acceptée de la même façon sur les deux plateformes.');
  process.exit(0);
}
console.error(`\n${failures.length} problème(s) de parité de synchronisation :`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);

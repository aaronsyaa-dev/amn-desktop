/**
 * Contrôle de la RELÈVE — une cérémonie déterministe, ou pas de cérémonie.
 *
 * La Relève raconte « ce qui s'est passé pendant votre absence » sans IA :
 * chaque phrase sort d'une grammaire fixe sur des comptes réels. Ce contrôle
 * épingle ce que la grammaire promet :
 *
 *   · elle se TAIT sous quatre heures d'absence, et sans repère de passage ;
 *   · trois lignes au plus, la dernière est TOUJOURS un verdict ;
 *   · les petits nombres en lettres, jamais de point d'exclamation ;
 *   · l'absence porte son vrai nom (nuit, week-end, hier, date) ;
 *   · zéro nouveauté ne fait pas zéro relève — après un week-end, « rien de
 *     nouveau, tout va bien » est exactement ce qu'on veut lire.
 *
 *   npm run check:releve
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

interface Obs {
  nombre: number;
  un: string;
  plusieurs: string;
}
interface Releve {
  entete: string;
  lignes: string[];
}

const { construireReleve, nommeLAbsence, ABSENCE_MIN_MS } = await loadFromSrc<{
  construireReleve: (a: {
    depuis: Date | null;
    maintenant: Date;
    observations: Obs[];
    attentions: number;
    ton: 'majordome' | 'soc';
  }) => Releve | null;
  nommeLAbsence: (d: Date, m: Date) => string;
  ABSENCE_MIN_MS: number;
}>('src/lib/releve.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

const obs = (nombre: number, un: string, plusieurs: string): Obs => ({ nombre, un, plusieurs });
/* Lundi 16 mars 2026, 9 h. */
const LUNDI_9H = new Date(2026, 2, 16, 9, 0);

/* ─── Quand elle se tait ───────────────────────────────────────────────────── */

dit('sans repère de dernier passage, pas de relève', () => {
  assert.equal(
    construireReleve({ depuis: null, maintenant: LUNDI_9H, observations: [], attentions: 0, ton: 'majordome' }),
    null,
  );
});

dit('LA RÈGLE : sous quatre heures d’absence, pas de relève', () => {
  // Rouvrir après le déjeuner n'est pas une relève de poste. Une cérémonie
  // rejouée dix fois par jour cesse d'en être une.
  const dejeuner = new Date(LUNDI_9H.getTime() - ABSENCE_MIN_MS + 60_000);
  assert.equal(
    construireReleve({
      depuis: dejeuner,
      maintenant: LUNDI_9H,
      observations: [obs(3, 'une commande', 'commandes')],
      attentions: 2,
      ton: 'majordome',
    }),
    null,
  );
});

/* ─── La forme ─────────────────────────────────────────────────────────────── */

const vendrediSoir = new Date(2026, 2, 13, 19, 0);

dit('trois lignes au plus, la dernière est TOUJOURS le verdict', () => {
  const r = construireReleve({
    depuis: vendrediSoir,
    maintenant: LUNDI_9H,
    observations: [
      obs(3, 'une nouvelle commande', 'nouvelles commandes'),
      obs(2, 'un rendez-vous posé', 'rendez-vous posés'),
      obs(5, 'une note', 'notes'),
    ],
    attentions: 0,
    ton: 'majordome',
  });
  assert.ok(r);
  assert.equal(r.lignes.length, 3, 'deux observations + le verdict — la troisième obs. saute');
  assert.equal(r.lignes[2], 'Tout va bien.');
});

dit('les petits nombres en toutes lettres, l’ordre des observations fait foi', () => {
  const r = construireReleve({
    depuis: vendrediSoir,
    maintenant: LUNDI_9H,
    observations: [obs(3, 'une nouvelle commande', 'nouvelles commandes')],
    attentions: 0,
    ton: 'majordome',
  });
  assert.ok(r);
  assert.equal(r.lignes[0], 'trois nouvelles commandes');
});

dit('une seule occurrence prend sa forme singulière, telle quelle', () => {
  const r = construireReleve({
    depuis: vendrediSoir,
    maintenant: LUNDI_9H,
    observations: [obs(1, 'une nouvelle commande', 'nouvelles commandes')],
    attentions: 0,
    ton: 'majordome',
  });
  assert.ok(r);
  assert.equal(r.lignes[0], 'une nouvelle commande');
});

dit('LA RÈGLE : zéro nouveauté ne fait pas zéro relève', () => {
  // Après un week-end, « rien de nouveau, tout va bien » est exactement ce
  // qu'on veut lire — le silence total, lui, ressemble à une panne.
  const r = construireReleve({
    depuis: vendrediSoir,
    maintenant: LUNDI_9H,
    observations: [obs(0, 'une commande', 'commandes')],
    attentions: 0,
    ton: 'majordome',
  });
  assert.ok(r);
  assert.equal(r.lignes.length, 2);
  assert.match(r.lignes[0], /Rien de nouveau/);
  assert.equal(r.lignes[1], 'Tout va bien.');
});

dit('jamais de point d’exclamation, dans aucun ton', () => {
  for (const ton of ['majordome', 'soc'] as const) {
    const r = construireReleve({
      depuis: vendrediSoir,
      maintenant: LUNDI_9H,
      observations: [obs(12, 'une commande', 'commandes')],
      attentions: 3,
      ton,
    });
    assert.ok(r);
    for (const l of [r.entete, ...r.lignes]) assert.ok(!l.includes('!'), l);
  }
});

dit('le verdict compte ses points à voir, en lettres', () => {
  const r = construireReleve({
    depuis: vendrediSoir,
    maintenant: LUNDI_9H,
    observations: [],
    attentions: 2,
    ton: 'soc',
  });
  assert.ok(r);
  assert.equal(r.lignes[r.lignes.length - 1], 'Deux points à voir.');
});

dit('les deux tons diffèrent sur le calme, pas sur la structure', () => {
  const calme = (ton: 'majordome' | 'soc') =>
    construireReleve({
      depuis: vendrediSoir,
      maintenant: LUNDI_9H,
      observations: [],
      attentions: 0,
      ton,
    });
  assert.equal(calme('majordome')?.lignes.at(-1), 'Tout va bien.');
  assert.equal(calme('soc')?.lignes.at(-1), 'Rien d’autre à savoir.');
});

/* ─── Le nom de l'absence ──────────────────────────────────────────────────── */

dit('parti vendredi soir, revenu lundi : le week-end', () => {
  assert.equal(nommeLAbsence(vendrediSoir, LUNDI_9H), 'Pendant le week-end');
});

dit('parti hier 19 h, revenu ce matin : la nuit', () => {
  const hierSoir = new Date(2026, 2, 15, 19, 0);
  assert.equal(nommeLAbsence(hierSoir, LUNDI_9H), 'Pendant la nuit');
});

dit('parti hier midi, revenu ce soir : depuis hier', () => {
  const hierMidi = new Date(2026, 2, 15, 12, 0);
  const ceSoir = new Date(2026, 2, 16, 20, 0);
  assert.equal(nommeLAbsence(hierMidi, ceSoir), 'Depuis hier');
});

dit('parti mardi, revenu vendredi : la date, en français', () => {
  const mardi = new Date(2026, 2, 10, 15, 0);
  const vendredi = new Date(2026, 2, 13, 9, 0);
  assert.equal(nommeLAbsence(mardi, vendredi), 'Depuis le 10 mars');
});

dit('même journée : ces dernières heures', () => {
  const matin = new Date(2026, 2, 16, 4, 0);
  assert.equal(nommeLAbsence(matin, LUNDI_9H), 'Ces dernières heures');
});

console.log(`\nOK — ${vus} contrôles.\n`);

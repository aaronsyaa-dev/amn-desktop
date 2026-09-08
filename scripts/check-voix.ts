/**
 * Contrôle de LA COMMANDE VOCALE, mécaniquement — correctif du bogue « micro indisponible »
 * (Ajmani partout, Bloc 2 puis correctif du 2026-09-08 : voir docs/voix-micro-2026-09-08.md).
 *
 * Ce contrôle ne peut PAS prouver qu'un vrai microphone Windows livre des données lisibles à
 * MediaRecorder — aucune machine de CI n'a de micro. Ce qu'il prouve à la place, avec un
 * `AdaptateurVocal` entièrement simulé (un faux flux, un faux enregistreur, une fausse
 * transcription) : que le CHEMIN MÉCANIQUE getUserMedia → enregistreur → base64 → transcription
 * fonctionne de bout en bout, et que CHAQUE branche d'échec (permission refusée, aucun
 * périphérique, enregistreur impossible, serveur de transcription absent, serveur en erreur,
 * transcription vide, prise trop courte) rend une `RaisonEchecVocal` distincte et jamais un
 * « indisponible » générique — c'est exactement le bogue que ce chantier corrige : un serveur de
 * transcription absent (une situation attendue, jamais testée avec un vrai micro) s'affichait
 * comme si le micro lui-même était en cause.
 *
 *   npm run check:voix
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
    // Le pont (`lib/bridge`) n'est utilisé que dans l'adaptateur RÉEL (`adaptateurNavigateur`),
    // jamais construit ici : ce contrôle injecte son propre `AdaptateurVocal` simulé. Le
    // remplacer par une coquille vide évite d'entraîner tout le pont (localStorage, fetch,
    // Electron) dans un test qui n'en a besoin d'aucune ligne.
    plugins: [
      {
        name: 'stub-bridge',
        setup(build) {
          build.onResolve({ filter: /^\.\.\/lib\/bridge$/ }, (args) => ({
            path: args.path,
            namespace: 'stub-bridge',
          }));
          build.onLoad({ filter: /.*/, namespace: 'stub-bridge' }, () => ({
            contents: 'export function bridge() { throw new Error("pont non simulé dans ce contrôle"); }',
            loader: 'js',
          }));
        },
      },
    ],
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

interface FluxAudioTest {
  getTracks(): { stop(): void }[];
}
interface EnregistreurTest {
  readonly mimeType: string;
  start(): void;
  stop(): void;
  addEventListener(type: 'dataavailable', cb: (e: { data: { size: number } }) => void): void;
  addEventListener(type: 'stop', cb: () => void, opts?: { once?: boolean }): void;
}
type WhisperTranscrireResultat =
  | { ok: true; texte: string }
  | { ok: false; kind: 'unreachable' | 'server-error' | 'inconnue'; message: string };
interface AdaptateurVocalTest {
  getUserMedia(): Promise<FluxAudioTest>;
  creerEnregistreur(flux: FluxAudioTest): EnregistreurTest;
  assembler(morceaux: unknown[], mimeType: string): { encoderBase64(): Promise<string>; type: string };
  transcrire(input: { base64Audio: string; mimeType: string; langue?: string }): Promise<WhisperTranscrireResultat>;
  suivreNiveau?(flux: FluxAudioTest, onNiveau: (n: number) => void): () => void;
  maintenant(): number;
}

const { SessionVocale } = await loadFromSrc<{
  SessionVocale: new (adaptateur: AdaptateurVocalTest) => {
    demarrer(onNiveau?: (n: number) => void): Promise<{ ok: true } | { ok: false; raison: string; detail: string }>;
    arreter(langue?: 'fr' | 'en'): Promise<{ texte: string } | { texte: null; raison: string; detail: string }>;
  };
}>('src/assistant/voix.ts');

let vus = 0;
const dit = async (nom: string, fn: () => Promise<void> | void) => {
  await fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

/** Un flux simulé : deux pistes, dont on peut vérifier qu'elles sont bien arrêtées. */
function fluxSimule() {
  const arretees: boolean[] = [false, false];
  const flux: FluxAudioTest = {
    getTracks: () => arretees.map((_, i) => ({ stop: () => (arretees[i] = true) })),
  };
  return { flux, arretees };
}

/** Un enregistreur simulé : `start`/`stop` pilotent le même cycle qu'un vrai MediaRecorder. */
function enregistreurSimule(mimeType = 'audio/webm;codecs=opus') {
  let onData: ((e: { data: { size: number } }) => void) | null = null;
  let onStop: (() => void) | null = null;
  const enregistreur: EnregistreurTest = {
    mimeType,
    start: () => {
      onData?.({ data: { size: 42 } });
    },
    stop: () => {
      onStop?.();
    },
    addEventListener: (type, cb) => {
      if (type === 'dataavailable') onData = cb as typeof onData;
      if (type === 'stop') onStop = cb as typeof onStop;
    },
  };
  return enregistreur;
}

/** Une horloge simulée, pour distinguer une prise « trop courte » sans dépendre d'un vrai délai. */
function horloge(depart: number) {
  let t = depart;
  return { maintenant: () => t, avancer: (ms: number) => (t += ms) };
}

/* ─── Le chemin mécanique complet, une fois tout va bien ────────────────────── */

await dit('getUserMedia → enregistreur → base64 → transcription : le texte revient', async () => {
  const { flux, arretees } = fluxSimule();
  const h = horloge(1000);
  let niveauRecu: number | null = null;
  const adaptateur: AdaptateurVocalTest = {
    getUserMedia: async () => flux,
    creerEnregistreur: () => enregistreurSimule(),
    assembler: (morceaux, mimeType) => {
      assert.equal(morceaux.length, 1); // le seul chunk émis par `start()` du faux enregistreur
      assert.equal(mimeType, 'audio/webm;codecs=opus');
      return { type: mimeType, encoderBase64: async () => 'QUFB' };
    },
    transcrire: async (input) => {
      assert.equal(input.base64Audio, 'QUFB');
      assert.equal(input.langue, 'fr');
      return { ok: true, texte: 'bonjour Ajmani' };
    },
    suivreNiveau: (_flux, onNiveau) => {
      onNiveau(0.6);
      return () => undefined;
    },
    maintenant: h.maintenant,
  };
  const session = new SessionVocale(adaptateur);
  const d = await session.demarrer((n) => (niveauRecu = n));
  assert.equal(d.ok, true);
  assert.equal(niveauRecu, 0.6);
  h.avancer(1500); // largement au-delà du seuil « trop court » (300 ms)
  const r = await session.arreter('fr');
  assert.deepEqual(r, { texte: 'bonjour Ajmani' });
  assert.deepEqual(arretees, [true, true]); // le micro physique est bien relâché
});

/* ─── Chaque échec de démarrage rend SA raison, jamais une générique ─────────── */

await dit('permission refusée (DOMException NotAllowedError) → raison "permission-refusee"', async () => {
  const err = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
  const adaptateur = adaptateurQuiEchoueAuDemarrage(() => {
    throw err;
  });
  const d = await new SessionVocale(adaptateur).demarrer();
  assert.deepEqual(d, { ok: false, raison: 'permission-refusee', detail: 'NotAllowedError : Permission denied' });
});

await dit('aucun périphérique (NotFoundError) → raison "aucun-peripherique"', async () => {
  const err = Object.assign(new Error('no mic'), { name: 'NotFoundError' });
  const adaptateur = adaptateurQuiEchoueAuDemarrage(() => {
    throw err;
  });
  const d = await new SessionVocale(adaptateur).demarrer();
  assert.equal((d as { raison: string }).raison, 'aucun-peripherique');
});

await dit('une erreur non classée au micro → raison "inconnue", jamais confondue avec les deux précédentes', async () => {
  const adaptateur = adaptateurQuiEchoueAuDemarrage(() => {
    throw new Error('bizarre');
  });
  const d = await new SessionVocale(adaptateur).demarrer();
  assert.equal((d as { raison: string }).raison, 'inconnue');
});

await dit('MediaRecorder refuse de se construire → raison "enregistrement-impossible", et le flux est relâché', async () => {
  const { flux, arretees } = fluxSimule();
  const adaptateur: AdaptateurVocalTest = {
    getUserMedia: async () => flux,
    creerEnregistreur: () => {
      throw new Error('mimeType non supporté');
    },
    assembler: () => {
      throw new Error('jamais atteint');
    },
    transcrire: async () => {
      throw new Error('jamais atteint');
    },
    maintenant: () => 0,
  };
  const d = await new SessionVocale(adaptateur).demarrer();
  assert.deepEqual(d, { ok: false, raison: 'enregistrement-impossible', detail: 'Error : mimeType non supporté' });
  assert.deepEqual(arretees, [true, true]);
});

function adaptateurQuiEchoueAuDemarrage(getUserMedia: () => never): AdaptateurVocalTest {
  return {
    getUserMedia: async () => getUserMedia(),
    creerEnregistreur: () => {
      throw new Error('jamais atteint');
    },
    assembler: () => {
      throw new Error('jamais atteint');
    },
    transcrire: async () => {
      throw new Error('jamais atteint');
    },
    maintenant: () => 0,
  };
}

/* ─── LE CŒUR DU CORRECTIF : un micro qui capte très bien, mais rien pour transcrire ────────── */

await dit(
  'LE BOGUE CORRIGÉ : micro capté avec succès, aucun serveur de transcription → "aucun-serveur-transcription" (jamais un problème de micro)',
  async () => {
    const { flux } = fluxSimule();
    const h = horloge(0);
    const adaptateur: AdaptateurVocalTest = {
      getUserMedia: async () => flux, // le micro a fonctionné, sans la moindre erreur
      creerEnregistreur: () => enregistreurSimule(),
      assembler: (_m, mimeType) => ({ type: mimeType, encoderBase64: async () => 'QUFB' }),
      transcrire: async () => ({ ok: false, kind: 'unreachable', message: 'injoignable sur http://127.0.0.1:8000' }),
      maintenant: h.maintenant,
    };
    const session = new SessionVocale(adaptateur);
    const d = await session.demarrer();
    assert.equal(d.ok, true); // preuve mécanique : le micro, lui, a marché
    h.avancer(1000);
    const r = await session.arreter('fr');
    assert.deepEqual(r, {
      texte: null,
      raison: 'aucun-serveur-transcription',
      detail: 'injoignable sur http://127.0.0.1:8000',
    });
  },
);

await dit('serveur de transcription en erreur (HTTP 500) → "serveur-transcription-en-erreur"', async () => {
  const { flux } = fluxSimule();
  const h = horloge(0);
  const adaptateur: AdaptateurVocalTest = {
    getUserMedia: async () => flux,
    creerEnregistreur: () => enregistreurSimule(),
    assembler: (_m, mimeType) => ({ type: mimeType, encoderBase64: async () => 'QUFB' }),
    transcrire: async () => ({ ok: false, kind: 'server-error', message: 'a répondu 500.' }),
    maintenant: h.maintenant,
  };
  const session = new SessionVocale(adaptateur);
  await session.demarrer();
  h.avancer(1000);
  const r = await session.arreter('fr');
  assert.deepEqual(r, { texte: null, raison: 'serveur-transcription-en-erreur', detail: 'a répondu 500.' });
});

await dit('transcription réussie mais vide (silence) → "transcription-vide"', async () => {
  const { flux } = fluxSimule();
  const h = horloge(0);
  const adaptateur: AdaptateurVocalTest = {
    getUserMedia: async () => flux,
    creerEnregistreur: () => enregistreurSimule(),
    assembler: (_m, mimeType) => ({ type: mimeType, encoderBase64: async () => 'QUFB' }),
    transcrire: async () => ({ ok: true, texte: '   ' }),
    maintenant: h.maintenant,
  };
  const session = new SessionVocale(adaptateur);
  await session.demarrer();
  h.avancer(1000);
  const r = await session.arreter('fr');
  assert.deepEqual(r, { texte: null, raison: 'transcription-vide', detail: '' });
});

await dit('prise trop courte (bruit d’appui) → "trop-court", sans jamais appeler le serveur de transcription', async () => {
  const { flux } = fluxSimule();
  const h = horloge(0);
  let transcrireAppele = false;
  const adaptateur: AdaptateurVocalTest = {
    getUserMedia: async () => flux,
    creerEnregistreur: () => enregistreurSimule(),
    assembler: () => {
      throw new Error('jamais atteint : coupé avant assemblage');
    },
    transcrire: async () => {
      transcrireAppele = true;
      return { ok: true, texte: 'ne devrait jamais arriver' };
    },
    maintenant: h.maintenant,
  };
  const session = new SessionVocale(adaptateur);
  await session.demarrer();
  h.avancer(120); // sous le seuil de 300 ms
  const r = await session.arreter('fr');
  assert.equal((r as { raison: string }).raison, 'trop-court');
  assert.equal(transcrireAppele, false);
});

console.log(`\nOK — ${vus} contrôles.\n`);

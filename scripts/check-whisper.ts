/**
 * Contrôle du SERVEUR DE TRANSCRIPTION LOCAL (Ajmani partout, Bloc 2 ; correctif du
 * chantier « bulle Ajmani, Whisper, modules ultra premium ») — la brique qui manquait quand un
 * vrai `whisper-server.exe` tournait sur `http://127.0.0.1:8080` et que l'app disait quand même
 * « aucun serveur configuré » : le port par défaut sondé n'était pas 8080, et le chemin de sonde
 * (`/v1/models`) n'existe pas chez whisper.cpp — un serveur bien vivant répondait 404 et se
 * faisait donc prendre pour une absence.
 *
 * Ce contrôle simule `fetch` (aucun vrai serveur dans cet environnement) pour vérifier :
 *   · 8080 est bien le premier port essayé par défaut ;
 *   · un whisper.cpp réel (silencieux sur `/v1/models`, HTML sur `/`) est reconnu comme PRÉSENT,
 *     pas absent, et l'appel de transcription part sur `/inference`, pas `/v1/audio/transcriptions` ;
 *   · un serveur compatible OpenAI est reconnu comme tel et appelé sur son propre chemin ;
 *   · injoignable / répond en erreur / répond sans texte exploitable rendent trois `WhisperError`
 *     distinctes, jamais confondues.
 *
 *   npm run check:whisper
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
    platform: 'node',
    target: 'node22',
    charset: 'utf8',
    external: ['electron'],
    plugins: [
      {
        name: 'stub-electron',
        setup(build) {
          build.onResolve({ filter: /^electron$/ }, (args) => ({ path: args.path, namespace: 'stub-electron' }));
          build.onLoad({ filter: /.*/, namespace: 'stub-electron' }, () => ({
            // `app.getPath('userData')` n'est appelé que par `lireUrlPersistee`/`ecrireUrlPersistee`,
            // jamais exercées ici (aucun test de ce fichier ne touche le disque) : un dossier
            // temporaire fixe suffit à satisfaire l'import sans jamais être lu.
            contents: `export const app = { getPath: () => '/tmp/amn-check-whisper' };`,
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

interface WhisperStatusTest {
  available: boolean;
  baseUrl?: string;
  flavor?: 'whispercpp' | 'openai-compatible';
}
interface WhisperErrorTest extends Error {
  kind: 'unreachable' | 'server-error' | 'unexpected-format';
}

const mod = await loadFromSrc<{
  whisperStatus: () => Promise<WhisperStatusTest>;
  whisperTranscrire: (input: { base64Audio: string; mimeType: string; langue?: string }) => Promise<{ texte: string }>;
  WhisperError: new (message: string, kind: string) => WhisperErrorTest;
  _resetWhisperResolvedBase: () => void;
}>('src/main/whisper.ts');
const { whisperStatus, whisperTranscrire, WhisperError, _resetWhisperResolvedBase } = mod;

let vus = 0;
const dit = async (nom: string, fn: () => Promise<void> | void) => {
  await fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

type FakeRoute = (url: string, init?: { method?: string }) => { status: number; contentType?: string; json?: unknown } | null;

/** Remplace `fetch` global pour la durée d'un contrôle, puis le restitue — jamais de fuite entre contrôles. */
async function avecFetchSimule(route: FakeRoute, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  const appels: string[] = [];
  (avecFetchSimule as unknown as { appels?: string[] }).appels = appels;
  // @ts-expect-error -- fetch minimal, suffisant pour ce que whisper.ts en lit réellement.
  globalThis.fetch = async (url: string, init?: { method?: string; signal?: AbortSignal }) => {
    appels.push(`${init?.method ?? 'GET'} ${url}`);
    const r = route(url, init);
    if (!r) throw new Error(`connexion refusée : ${url}`);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => {
        if (r.json === undefined) throw new Error('pas de corps JSON');
        return r.json;
      },
    } as Response;
  };
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}
function dernierAppels(): string[] {
  return (avecFetchSimule as unknown as { appels: string[] }).appels;
}

await dit('LE BOGUE CORRIGÉ : 8080 (whisper.cpp) est le premier port essayé, avant les ports OpenAI', async () => {
  _resetWhisperResolvedBase();
  await avecFetchSimule(
    (url) => {
      if (url === 'http://127.0.0.1:8080/v1/models') return { status: 404 };
      if (url === 'http://127.0.0.1:8080/') return { status: 200 };
      return null; // rien d'autre ne doit être appelé avant que 8080 ait répondu
    },
    async () => {
      const s = await whisperStatus();
      assert.deepEqual(s, { available: true, baseUrl: 'http://127.0.0.1:8080', flavor: 'whispercpp' });
    },
  );
});

await dit('whisper.cpp identifié par sa page racine (200, whisper.cpp n’a pas /v1/models) → jamais pris pour une absence', async () => {
  _resetWhisperResolvedBase();
  await avecFetchSimule(
    (url) => {
      if (url.endsWith('/v1/models')) return { status: 404 }; // whisper.cpp n'a pas ce chemin
      if (url.endsWith('/')) return { status: 200 }; // sa page de test HTML
      return null;
    },
    async () => {
      const s = await whisperStatus();
      assert.equal(s.available, true);
      assert.equal(s.flavor, 'whispercpp');
    },
  );
});

await dit('un serveur compatible OpenAI (/v1/models répond) est identifié comme tel, pas comme whisper.cpp', async () => {
  _resetWhisperResolvedBase();
  process.env.AMN_WHISPER_URL = 'http://127.0.0.1:1234';
  try {
    await avecFetchSimule(
      (url) => (url === 'http://127.0.0.1:1234/v1/models' ? { status: 200 } : null),
      async () => {
        const s = await whisperStatus();
        assert.deepEqual(s, { available: true, baseUrl: 'http://127.0.0.1:1234', flavor: 'openai-compatible' });
      },
    );
  } finally {
    delete process.env.AMN_WHISPER_URL;
  }
});

await dit('whisper.cpp détecté → la transcription part sur /inference, jamais /v1/audio/transcriptions', async () => {
  _resetWhisperResolvedBase();
  process.env.AMN_WHISPER_URL = 'http://127.0.0.1:9001';
  try {
    await avecFetchSimule(
      (url) => {
        if (url === 'http://127.0.0.1:9001/v1/models') return { status: 404 };
        if (url === 'http://127.0.0.1:9001/') return { status: 200 };
        if (url === 'http://127.0.0.1:9001/inference') return { status: 200, json: { text: '  bonjour  ' } };
        return null;
      },
      async () => {
        const r = await whisperTranscrire({ base64Audio: 'QUFB', mimeType: 'audio/webm' });
        assert.deepEqual(r, { texte: 'bonjour' }); // recadré (trim), jamais renvoyé brut
        assert.ok(dernierAppels().some((a) => a === 'POST http://127.0.0.1:9001/inference'));
        assert.ok(!dernierAppels().some((a) => a.includes('/v1/audio/transcriptions')));
      },
    );
  } finally {
    delete process.env.AMN_WHISPER_URL;
  }
});

await dit('serveur compatible OpenAI → la transcription part sur /v1/audio/transcriptions', async () => {
  _resetWhisperResolvedBase();
  process.env.AMN_WHISPER_URL = 'http://127.0.0.1:9002';
  try {
    await avecFetchSimule(
      (url) => {
        if (url === 'http://127.0.0.1:9002/v1/models') return { status: 200 };
        if (url === 'http://127.0.0.1:9002/v1/audio/transcriptions') return { status: 200, json: { text: 'salut' } };
        return null;
      },
      async () => {
        const r = await whisperTranscrire({ base64Audio: 'QUFB', mimeType: 'audio/webm' });
        assert.deepEqual(r, { texte: 'salut' });
      },
    );
  } finally {
    delete process.env.AMN_WHISPER_URL;
  }
});

await dit('personne n’écoute (aucun port ne répond) → WhisperError "unreachable", jamais "aucun serveur configuré"', async () => {
  _resetWhisperResolvedBase();
  await avecFetchSimule(
    () => null,
    async () => {
      const s = await whisperStatus();
      assert.equal(s.available, false);
      await assert.rejects(
        () => whisperTranscrire({ base64Audio: 'QUFB', mimeType: 'audio/webm' }),
        (err: unknown) => err instanceof WhisperError && err.kind === 'unreachable',
      );
    },
  );
});

await dit('AMN_WHISPER_URL=off → désactivé explicitement, jamais confondu avec un serveur injoignable', async () => {
  _resetWhisperResolvedBase();
  process.env.AMN_WHISPER_URL = 'off';
  try {
    const s = await whisperStatus();
    assert.deepEqual(s, { available: false });
  } finally {
    delete process.env.AMN_WHISPER_URL;
  }
});

await dit('le serveur configuré répond en erreur HTTP → WhisperError "server-error"', async () => {
  _resetWhisperResolvedBase();
  process.env.AMN_WHISPER_URL = 'http://127.0.0.1:9003';
  try {
    await avecFetchSimule(
      (url) => {
        if (url === 'http://127.0.0.1:9003/v1/models') return { status: 404 };
        if (url === 'http://127.0.0.1:9003/') return { status: 200 };
        if (url === 'http://127.0.0.1:9003/inference') return { status: 500 };
        return null;
      },
      async () => {
        await assert.rejects(
          () => whisperTranscrire({ base64Audio: 'QUFB', mimeType: 'audio/webm' }),
          (err: unknown) => err instanceof WhisperError && err.kind === 'server-error',
        );
      },
    );
  } finally {
    delete process.env.AMN_WHISPER_URL;
  }
});

await dit('le serveur répond 200 sans champ « text » exploitable → WhisperError "unexpected-format", jamais confondu avec les deux précédentes', async () => {
  _resetWhisperResolvedBase();
  process.env.AMN_WHISPER_URL = 'http://127.0.0.1:9004';
  try {
    await avecFetchSimule(
      (url) => {
        if (url === 'http://127.0.0.1:9004/v1/models') return { status: 404 };
        if (url === 'http://127.0.0.1:9004/') return { status: 200 };
        if (url === 'http://127.0.0.1:9004/inference') return { status: 200, json: { erreur: 'modèle non chargé' } };
        return null;
      },
      async () => {
        await assert.rejects(
          () => whisperTranscrire({ base64Audio: 'QUFB', mimeType: 'audio/webm' }),
          (err: unknown) => err instanceof WhisperError && err.kind === 'unexpected-format',
        );
      },
    );
  } finally {
    delete process.env.AMN_WHISPER_URL;
  }
});

console.log(`\nOK — ${vus} contrôles.\n`);

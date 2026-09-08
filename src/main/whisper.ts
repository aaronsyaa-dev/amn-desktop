/**
 * LA TRANSCRIPTION VOCALE, EN LOCAL (Ajmani partout, Bloc 2 de L'Automatique ; réécrit au
 * correctif du 2026-09-08 puis à celui-ci, contre un vrai `whisper.cpp` cette fois) — même
 * discipline que `ollama.ts` : un serveur qu'Aaron installe et fait tourner lui-même sur sa
 * machine, jamais un serveur d'AMN DevSec, jamais un envoi vers un tiers. Sans lui, la commande
 * vocale garde son repli : le texte tapé.
 *
 * LA CAUSE DU PREMIER CORRECTIF, QUI A SURVÉCU AU SECOND : un vrai `whisper-server.exe`
 * (whisper.cpp) tournait sur `http://127.0.0.1:8080`, et l'app disait quand même « aucun serveur
 * configuré ». Deux défauts distincts :
 *
 *   1. `candidateBases()` ne sondait jamais 8080 — les ports par défaut visaient des serveurs
 *      compatibles OpenAI (LM Studio, faster-whisper-server), pas whisper.cpp lui-même, dont le
 *      port par défaut (`--port 8080`) n'était nulle part dans la liste.
 *   2. La sonde interrogeait `/v1/models` — un chemin OpenAI que whisper.cpp n'expose PAS. Un
 *      whisper.cpp bien vivant sur le bon port aurait quand même répondu 404, et la sonde l'aurait
 *      pris pour une absence.
 *
 * `whisper-server.exe` (l'exemple `server` de whisper.cpp) parle un contrat DIFFÉRENT de l'API
 * OpenAI : `POST /inference` en multipart (`file`, `response_format`, `language`), et répond
 * `{"text": "…"}`. Certains autres serveurs compatibles (`faster-whisper-server`, LM Studio)
 * exposent, eux, le contrat OpenAI (`POST /v1/audio/transcriptions`, `GET /v1/models`). Ce module
 * détecte lequel des deux répond, et parle sa langue — jamais une seule hypothèse imposée aux deux.
 */

import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

export type WhisperFlavor = 'whispercpp' | 'openai-compatible';

export interface WhisperStatus {
  available: boolean;
  baseUrl?: string;
  flavor?: WhisperFlavor;
}

/** `off`/vide en configuration explicite désactive la fonctionnalité — jamais une valeur au hasard. */
const DESACTIVE = new Set(['off', 'disabled', 'none']);

const configFile = () => path.join(app.getPath('userData'), 'whisper-config.json');

/**
 * Le réglage posé depuis les Réglages de l'app — au-dessus d'`AMN_WHISPER_URL` (une préférence
 * explicite dans l'interface l'emporte sur une variable d'environnement qu'on a pu oublier avoir
 * posée), au-dessus des ports par défaut. `null` = pas de préférence enregistrée.
 */
export function lireUrlPersistee(): string | null {
  try {
    const raw = fs.readFileSync(configFile(), 'utf8');
    const url = (JSON.parse(raw) as { url?: string }).url;
    return typeof url === 'string' && url.trim() ? url.trim().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

/** `null` efface la préférence (retour à `AMN_WHISPER_URL`/au défaut). */
export function ecrireUrlPersistee(url: string | null): void {
  resolved = null; // un changement d'adresse invalide toute résolution précédente
  if (url === null) {
    try {
      fs.rmSync(configFile(), { force: true });
    } catch {
      /* rien à effacer */
    }
    return;
  }
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify({ url: url.trim() }), 'utf8');
}

/**
 * Où chercher, dans l'ordre. La préférence enregistrée dans les Réglages gagne, puis
 * `AMN_WHISPER_URL` — un poste qui le fixe le pense. Sinon, 8080 (port par défaut de
 * `whisper-server.exe`) est tenté avant les ports des serveurs compatibles OpenAI, parce que
 * c'est whisper.cpp qu'Aaron installe en premier lieu.
 */
function candidateBases(): { bases: string[]; desactive: boolean } {
  const configured = (lireUrlPersistee() ?? (process.env.AMN_WHISPER_URL || '').trim()).replace(/\/$/, '');
  if (configured) {
    if (DESACTIVE.has(configured.toLowerCase())) return { bases: [], desactive: true };
    return { bases: [configured], desactive: false };
  }
  return {
    bases: ['http://127.0.0.1:8080', 'http://127.0.0.1:8000', 'http://127.0.0.1:1234', 'http://localhost:8080'],
    desactive: false,
  };
}

interface Resolved {
  base: string;
  flavor: WhisperFlavor;
}
let resolved: Resolved | null = null;
const STATUS_TIMEOUT_MS = 4000;

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await p(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sonde une base et dit CE QUI y répond, pas seulement SI quelque chose y répond — la sonde
 * précédente (`/v1/models` seul) prenait un whisper.cpp bien vivant pour une absence.
 */
async function probe(base: string, timeoutMs: number): Promise<WhisperFlavor | null> {
  try {
    return await withTimeout(async (signal) => {
      // Le contrat OpenAI d'abord : `/v1/models` répond 200 chez les serveurs compatibles,
      // et whisper.cpp n'a rien à ce chemin (404), donc aucune confusion possible dans ce sens.
      const openai = await fetch(`${base}/v1/models`, { signal }).catch(() => null);
      if (openai?.ok) return 'openai-compatible';
      // whisper.cpp sert sa page de test sur `/` (200, HTML) — c'est le seul signe de vie
      // documenté de `whisper-server.exe`, qui n'a pas de point de santé dédié.
      const racine = await fetch(`${base}/`, { signal }).catch(() => null);
      if (racine?.ok) return 'whispercpp';
      return null;
    }, timeoutMs);
  } catch {
    return null;
  }
}

/** Détecte un serveur de transcription local — jamais d'exception, jamais d'appel réseau non sollicité ailleurs. */
export async function whisperStatus(): Promise<WhisperStatus> {
  const { bases, desactive } = candidateBases();
  if (desactive) return { available: false };
  if (resolved) {
    const flavor = await probe(resolved.base, STATUS_TIMEOUT_MS);
    if (flavor) return { available: true, baseUrl: resolved.base, flavor };
    resolved = null;
  }
  const per = Math.max(1500, Math.floor(STATUS_TIMEOUT_MS / Math.max(1, bases.length)));
  for (const base of bases) {
    const flavor = await probe(base, per);
    if (flavor) {
      resolved = { base, flavor };
      return { available: true, baseUrl: base, flavor };
    }
  }
  return { available: false };
}

export class WhisperError extends Error {
  constructor(
    message: string,
    readonly kind: 'unreachable' | 'server-error' | 'unexpected-format',
  ) {
    super(message);
    this.name = 'WhisperError';
  }
}

export interface WhisperTranscrireInput {
  /** L'enregistrement, en base64 — transporté par IPC, jamais écrit sur disque. */
  base64Audio: string;
  mimeType: string;
  langue?: string;
}

function nomFichierPour(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ajmani-vocal.ogg';
  if (mimeType.includes('mp4')) return 'ajmani-vocal.mp4';
  return 'ajmani-vocal.webm';
}

/**
 * Une transcription. Lève une `WhisperError` distinguant trois causes, jamais confondues :
 * `unreachable` (personne n'écoute), `server-error` (le serveur a refusé), `unexpected-format`
 * (il a répondu, mais pas avec un texte exploitable — un serveur mal identifié, par exemple).
 */
export async function whisperTranscrire({ base64Audio, mimeType, langue = 'fr' }: WhisperTranscrireInput): Promise<{ texte: string }> {
  const { desactive } = candidateBases();
  if (desactive) throw new WhisperError('La transcription vocale est désactivée (AMN_WHISPER_URL=off).', 'unreachable');
  if (!resolved) await whisperStatus();
  if (!resolved) {
    const { bases } = candidateBases();
    throw new WhisperError(
      `Aucun serveur de transcription n'a répondu (essayé : ${bases.join(', ') || 'aucune adresse configurée'}).`,
      'unreachable',
    );
  }
  const { base, flavor } = resolved;

  return withTimeout(async (signal) => {
    const buffer = Buffer.from(base64Audio, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), nomFichierPour(mimeType));
    // Les deux contrats se recoupent sur `file` et `language` ; chacun a son propre champ pour
    // dire « rends du texte », et whisper.cpp ignore silencieusement un champ `model` qu'il ne lit jamais.
    if (flavor === 'whispercpp') {
      form.append('response_format', 'json');
      form.append('language', langue);
    } else {
      form.append('model', 'whisper-1');
      form.append('language', langue);
    }
    const endpoint = flavor === 'whispercpp' ? '/inference' : '/v1/audio/transcriptions';

    let res: Response;
    try {
      res = await fetch(`${base}${endpoint}`, { method: 'POST', body: form, signal });
    } catch (err) {
      resolved = null;
      throw new WhisperError(
        `Le serveur de transcription est injoignable sur ${base} (${err instanceof Error ? err.message : 'erreur réseau'}).`,
        'unreachable',
      );
    }
    if (!res.ok) throw new WhisperError(`Le serveur de transcription a répondu ${res.status} sur ${base}${endpoint}.`, 'server-error');
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new WhisperError(`Le serveur de transcription (${base}${endpoint}) n'a pas répondu en JSON.`, 'unexpected-format');
    }
    const texte = (json as { text?: unknown })?.text;
    if (typeof texte !== 'string') {
      throw new WhisperError(
        `Le serveur de transcription (${base}${endpoint}) a répondu sans champ « text » exploitable.`,
        'unexpected-format',
      );
    }
    return { texte: texte.trim() };
  }, 60_000);
}

/** Test seam : oublie l'adresse déjà trouvée. */
export function _resetWhisperResolvedBase(): void {
  resolved = null;
}

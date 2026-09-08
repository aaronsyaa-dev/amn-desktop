/**
 * LA TRANSCRIPTION VOCALE, EN LOCAL (Ajmani partout, Bloc 2 de L'Automatique) — même discipline
 * que `ollama.ts` : un service qu'Aaron installe et fait tourner lui-même sur sa machine, jamais
 * un serveur d'AMN DevSec, jamais un envoi vers un tiers. Sans lui, la commande vocale garde son
 * repli : le texte tapé.
 *
 * Le contrat est celui, déjà répandu, de l'API OpenAI de transcription
 * (`POST /v1/audio/transcriptions`, un champ `file` en options multipart) : `faster-whisper-server`,
 * `whisper.cpp` en mode serveur (`--convert`) et LM Studio l'exposent tel quel. Pointer
 * `AMN_WHISPER_URL` vers n'importe lequel suffit ; rien ici ne suppose un moteur précis.
 *
 * Ce module n'a jamais été exercé avec un vrai microphone ni un vrai serveur de transcription
 * dans l'environnement où il a été écrit (aucun périphérique audio, réseau restreint) : la
 * plomberie (détection, appel, repli, erreurs distinguées) suit exactement le contrat documenté
 * et le patron éprouvé d'`ollama.ts`, mais seule une machine avec un micro et un serveur installés
 * peut prouver le dernier maillon. Voir le rapport de ce chantier pour ce qui reste à vérifier.
 */

export interface WhisperStatus {
  available: boolean;
  baseUrl?: string;
}

function candidateBases(): string[] {
  const configured = (process.env.AMN_WHISPER_URL || '').trim().replace(/\/$/, '');
  if (configured) return [configured];
  // Les ports par défaut des serveurs compatibles les plus courants (faster-whisper-server, LM Studio).
  return ['http://127.0.0.1:8000', 'http://127.0.0.1:1234', 'http://localhost:8000'];
}

let resolvedBase: string | null = null;
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

async function probe(base: string, timeoutMs: number): Promise<boolean> {
  try {
    return await withTimeout(async (signal) => {
      // `/v1/models` : le même chemin que l'API OpenAI expose pour lister ce qui est chargé — un
      // serveur de transcription compatible y répond, qu'il porte ou non un vrai modèle Whisper.
      const res = await fetch(`${base}/v1/models`, { signal });
      return res.ok;
    }, timeoutMs);
  } catch {
    return false;
  }
}

/** Détecte un serveur de transcription local — jamais d'exception, jamais d'appel réseau non sollicité ailleurs. */
export async function whisperStatus(): Promise<WhisperStatus> {
  if (resolvedBase) {
    if (await probe(resolvedBase, STATUS_TIMEOUT_MS)) return { available: true, baseUrl: resolvedBase };
    resolvedBase = null;
  }
  const bases = candidateBases();
  const per = Math.max(1500, Math.floor(STATUS_TIMEOUT_MS / bases.length));
  for (const base of bases) {
    if (await probe(base, per)) {
      resolvedBase = base;
      return { available: true, baseUrl: base };
    }
  }
  return { available: false };
}

export class WhisperError extends Error {
  constructor(
    message: string,
    readonly kind: 'unreachable' | 'server-error',
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

/**
 * Une transcription. Lève une `WhisperError` distinguant « rien n'écoute » de « le serveur a
 * refusé » — le même principe que `OllamaError`, pour que l'appelant sache honnêtement pourquoi.
 */
export async function whisperTranscrire({ base64Audio, mimeType, langue = 'fr' }: WhisperTranscrireInput): Promise<{ texte: string }> {
  if (!resolvedBase) await whisperStatus();
  const base = resolvedBase ?? candidateBases()[0];

  return withTimeout(async (signal) => {
    const buffer = Buffer.from(base64Audio, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), 'ajmani-vocal.webm');
    form.append('model', 'whisper-1');
    form.append('language', langue);

    let res: Response;
    try {
      res = await fetch(`${base}/v1/audio/transcriptions`, { method: 'POST', body: form, signal });
    } catch (err) {
      resolvedBase = null;
      throw new WhisperError(
        `Le serveur de transcription est injoignable sur ${base} (${err instanceof Error ? err.message : 'erreur réseau'}).`,
        'unreachable',
      );
    }
    if (!res.ok) throw new WhisperError(`Le serveur de transcription a répondu ${res.status}.`, 'server-error');
    const json = (await res.json().catch(() => ({}))) as { text?: string };
    return { texte: (json.text ?? '').trim() };
  }, 60_000);
}

/** Test seam : oublie l'adresse déjà trouvée. */
export function _resetWhisperResolvedBase(): void {
  resolvedBase = null;
}

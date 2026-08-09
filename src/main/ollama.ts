/**
 * Local Ollama integration (A6). Talks to a user-run Ollama instance from the
 * MAIN process (so it works regardless of the renderer's origin/CORS, and each
 * machine uses its own local model — no shared server). If Ollama isn't
 * running, everything degrades cleanly; nothing here ever throws on absence.
 *
 * Three things this module learned the hard way, each of which produced the
 * same misleading symptom — "Ajmani says Ollama isn't running" while it is:
 *
 *  1. **Detection was allowed 2.5 s.** A live Ollama answering `/api/tags` in
 *     3 s — routine just after boot, or while it loads a model — was reported
 *     as absent. Reproduced: a server replying 200 after 3 s came back
 *     `{available:false}`. The probe now gets a budget that matches a machine
 *     waking up, not one that is already warm.
 *
 *  2. **One fixed host string.** `localhost` does not resolve to the same
 *     address family everywhere; on Windows it commonly resolves to `::1`
 *     first, while Ollama binds `127.0.0.1`. A single candidate turns that into
 *     "not installed". Several candidates are tried and the one that answered
 *     is remembered, so the cost is paid once.
 *
 *  3. **A missing model looked like a missing server.** Asking for a model
 *     absent from `ollama list` returns 404; the UI then told the operator to
 *     start Ollama, which was already running. Errors now carry what actually
 *     happened.
 */

export interface OllamaStatus {
  available: boolean;
  models: string[];
  /** Base URL that answered, for diagnostics in the UI. */
  baseUrl?: string;
}

/**
 * Where to look, in order. An explicit `AMN_OLLAMA_URL` always wins — a
 * deployment that sets it means it. The IPv4 literal comes before `localhost`
 * because it is the address Ollama actually binds by default.
 */
function candidateBases(): string[] {
  const configured = (process.env.AMN_OLLAMA_URL || '').trim().replace(/\/$/, '');
  if (configured) return [configured];
  return ['http://127.0.0.1:11434', 'http://localhost:11434', 'http://[::1]:11434'];
}

/**
 * The candidate that last answered. Probing three addresses on every call
 * would add a full timeout to each miss; remembering the winner keeps the
 * steady state at exactly one request.
 */
let resolvedBase: string | null = null;

/**
 * Detection budget. Generous on purpose: the failure this replaces was a probe
 * that gave up before a healthy-but-busy instance could answer. It is still
 * bounded, so a genuinely absent Ollama is reported as absent rather than
 * leaving the UI spinning.
 */
const STATUS_TIMEOUT_MS = 12_000;

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await p(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function probe(base: string, timeoutMs: number): Promise<OllamaStatus | null> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${base}/api/tags`, { signal });
      if (!res.ok) return null;
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      const models = (json.models ?? []).map((m) => m.name).sort();
      return { available: true, models, baseUrl: base };
    }, timeoutMs);
  } catch {
    return null;
  }
}

/** Detects whether Ollama is up and which models are installed locally. */
export async function ollamaStatus(): Promise<OllamaStatus> {
  // Try the known-good address first and give it the full budget.
  if (resolvedBase) {
    const hit = await probe(resolvedBase, STATUS_TIMEOUT_MS);
    if (hit) return hit;
    resolvedBase = null; // it moved or stopped — fall through and re-discover
  }

  const bases = candidateBases();
  // Discovery splits the budget so trying three addresses cannot take three
  // times as long as the one that matters.
  const per = Math.max(3000, Math.floor(STATUS_TIMEOUT_MS / bases.length));
  for (const base of bases) {
    const hit = await probe(base, per);
    if (hit) {
      resolvedBase = base;
      return hit;
    }
  }
  return { available: false, models: [] };
}

export interface OllamaChatInput {
  model: string;
  system: string;
  prompt: string;
}

/** Distinguishes "the model isn't installed" from "the server is unreachable". */
export class OllamaError extends Error {
  constructor(
    message: string,
    readonly kind: 'unreachable' | 'model-missing' | 'server-error',
    readonly model?: string,
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

/**
 * Non-streaming chat completion. Throws on failure so the renderer can react;
 * the caller is expected to catch.
 *
 * Timeout is generous (5 min) because the FIRST call to a given model forces
 * Ollama to load it into memory before it generates a single token — this can
 * take 10s to well over a minute depending on model size and hardware, on top
 * of the generation time itself. A short timeout here previously aborted that
 * load every time, surfacing as a confusing AbortError even with Ollama
 * healthy and the model correctly selected. Subsequent calls are fast because
 * the model stays warm in memory (Ollama's default `keep_alive`).
 */
export async function ollamaChat({ model, system, prompt }: OllamaChatInput): Promise<{ text: string }> {
  // Make sure we know where Ollama actually is before spending five minutes
  // failing against the wrong address.
  if (!resolvedBase) await ollamaStatus();
  const base = resolvedBase ?? candidateBases()[0];

  return withTimeout(async (signal) => {
    let res: Response;
    try {
      res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          options: { temperature: 0.4 },
        }),
      });
    } catch (err) {
      resolvedBase = null; // it may have moved — re-discover on the next probe
      throw new OllamaError(
        `Ollama injoignable sur ${base} (${err instanceof Error ? err.message : 'erreur réseau'}).`,
        'unreachable',
      );
    }

    if (res.status === 404) {
      throw new OllamaError(
        `Le modèle « ${model} » n'est pas installé sur ce poste. Installez-le (ollama pull ${model}) ou choisissez-en un autre dans Paramètres → Ajmani.`,
        'model-missing',
        model,
      );
    }
    if (!res.ok) {
      throw new OllamaError(`Ollama a répondu ${res.status}.`, 'server-error');
    }

    const json = (await res.json()) as { message?: { content?: string } };
    return { text: (json.message?.content ?? '').trim() };
  }, 300_000);
}

/** Test seam: forgets the discovered address. */
export function _resetResolvedBase(): void {
  resolvedBase = null;
}

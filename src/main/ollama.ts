/**
 * Local Ollama integration (A6). Talks to a user-run Ollama instance on
 * http://localhost:11434 from the MAIN process (so it works regardless of the
 * renderer's origin/CORS, and each machine uses its own local model — no shared
 * server). If Ollama isn't running, everything degrades cleanly to the built-in
 * mock engine; nothing here ever throws into the UI on absence.
 */

const BASE = process.env.AMN_OLLAMA_URL || 'http://localhost:11434';

export interface OllamaStatus {
  available: boolean;
  models: string[];
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await p(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Detects whether Ollama is up and which models are installed locally. */
export async function ollamaStatus(): Promise<OllamaStatus> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${BASE}/api/tags`, { signal });
      if (!res.ok) return { available: false, models: [] };
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      const models = (json.models ?? []).map((m) => m.name).sort();
      return { available: true, models };
    }, 2500);
  } catch {
    return { available: false, models: [] };
  }
}

export interface OllamaChatInput {
  model: string;
  system: string;
  prompt: string;
}

/**
 * Non-streaming chat completion. Throws on failure so the renderer can fall
 * back to the mock; the caller is expected to catch.
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
  return withTimeout(async (signal) => {
    const res = await fetch(`${BASE}/api/chat`, {
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
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const json = (await res.json()) as { message?: { content?: string } };
    return { text: (json.message?.content ?? '').trim() };
  }, 300_000);
}

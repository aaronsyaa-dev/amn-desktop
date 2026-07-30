/**
 * === AI assistant engine — MOCK implementation ===
 *
 * This module is the ONLY integration boundary for the assistant. Every piece
 * of generated content flows through the functions below. Today they synthesise
 * responses from real amn-api data (sites + event history, passed in by the
 * caller — see AssistantContext.tsx, which sources them from
 * RemoteSitesContext) with a small simulated latency so the UX matches a real
 * network call.
 *
 * To go live with Claude, replace the bodies of `generateReport` and
 * `runAssistant` with a call to the Anthropic Messages API:
 *
 *   POST https://api.anthropic.com/v1/messages
 *   model: 'claude-...'
 *   system: <role prompt: "tu es l'assistant de supervision AMN DevSec ...">
 *   messages: [{ role: 'user', content: buildPrompt(prompt, context) }]
 *   // ask the model to return the ReportBlock[] JSON shape we already use
 *
 * The context we would send is assembled by `buildContext()` below. Because the
 * return types (`AssistantReport`, `AssistantTurn`) never change, no UI code
 * needs to be touched when the swap happens — and no API key or network call is
 * present at this stage by design.
 */

import type { RemoteEvent } from '../shared/api';
import type { DerivedSite } from '../state/RemoteSitesContext';
import type {
  AssistantReport,
  AssistantTurn,
  ReportBlock,
  ReportRequest,
} from './types';
import { buildGlobalReport, buildSiteReport } from './reportContent';

export {
  getDailyBrief,
  getDailySummary,
  getInsights,
  getSuggestions,
} from './mockData';

type EventsMap = Record<string, RemoteEvent[]>;

/** Simulated model latency so the UI exercises its loading states. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Snapshot of the data a real model call would receive as context. Kept here to
 * make the future integration obvious and to keep the mock grounded in the same
 * inputs the live version will use.
 */
export function buildContext(
  request: ReportRequest,
  sites: DerivedSite[],
  eventsBySite: EventsMap,
) {
  if (request.scope === 'site' && request.siteId) {
    const site = sites.find((s) => s.id === request.siteId);
    return { scope: 'site' as const, site, events: eventsBySite[request.siteId] ?? [] };
  }
  return { scope: 'global' as const, sites, eventsBySite };
}

/**
 * Generates a structured report. MOCK: builds from real site/event data.
 * LIVE: send `buildContext(request, sites, eventsBySite)` + a system prompt to
 * the Messages API and parse the returned blocks.
 *
 * Callers must ensure the relevant event history is already loaded (via
 * RemoteSitesContext's `loadEvents`) before calling this — it does not fetch.
 */
export async function generateReport(
  request: ReportRequest,
  sites: DerivedSite[],
  eventsBySite: EventsMap,
): Promise<AssistantReport> {
  await delay(750);

  const site = request.siteId ? sites.find((s) => s.id === request.siteId) : undefined;
  const draft =
    request.scope === 'site' && site
      ? buildSiteReport(site, eventsBySite[site.id] ?? [], request.mode)
      : buildGlobalReport(sites, eventsBySite, request.mode);

  return {
    id: uid('report'),
    scope: request.scope,
    siteId: request.siteId,
    mode: request.mode,
    title: draft.title,
    subtitle: draft.subtitle,
    generatedAt: new Date().toISOString(),
    blocks: draft.blocks,
  };
}

interface Intent {
  kind: 'report' | 'question';
  siteId?: string;
}

/** Lightweight intent detection. LIVE: this becomes the model's job. */
export function parseIntent(prompt: string, sites: DerivedSite[]): Intent {
  const lower = prompt.toLowerCase();
  const wantsReport = /\brapport\b|\bbilan\b|g[eé]n[eè]re|generate|report/.test(
    lower,
  );

  const matchedSite = sites.find((site) => {
    const name = site.name.toLowerCase();
    if (lower.includes(name)) return true;
    return name
      .split(/\s+/)
      .filter((tok) => tok.length >= 4)
      .some((tok) => lower.includes(tok));
  });

  return {
    kind: wantsReport ? 'report' : 'question',
    siteId: matchedSite?.id,
  };
}

/**
 * Runs one assistant turn from a free-text prompt.
 * MOCK: routes to a report or a data-grounded answer.
 * LIVE: forward `prompt` (+ context) to the Messages API.
 *
 * Like generateReport, this assumes the necessary event history is already
 * loaded in `eventsBySite` — the caller is responsible for that (a report
 * about a specific site needs that site's events; a global report/question
 * benefits from all sites' events being loaded).
 */
/** A local-LLM text generator (Ollama), injected by the caller when available. */
export type Generate = (system: string, prompt: string) => Promise<string>;

export async function runAssistant(
  prompt: string,
  sites: DerivedSite[],
  eventsBySite: EventsMap,
  opts: { generate?: Generate } = {},
): Promise<AssistantTurn> {
  const intent = parseIntent(prompt, sites);

  if (intent.kind === 'report') {
    const request: ReportRequest = intent.siteId
      ? { scope: 'site', siteId: intent.siteId, mode: 'internal' }
      : { scope: 'global', mode: 'internal' };
    const report = await generateReport(request, sites, eventsBySite);
    return { kind: 'report', request, report };
  }

  // Free-text question: use the local model when present, grounded in real
  // parc data; otherwise the built-in data-grounded mock answer.
  if (opts.generate) {
    try {
      const text = await opts.generate(assistantSystemPrompt(sites, eventsBySite), prompt);
      if (text.trim()) return { kind: 'answer', blocks: textToBlocks(text) };
    } catch {
      /* Ollama failed mid-call — fall through to the mock. */
    }
  }

  await delay(600);
  return { kind: 'answer', blocks: buildAnswer(prompt, sites, eventsBySite) };
}

/** Splits a model's plain-text reply into paragraph/heading blocks. */
function textToBlocks(text: string): ReportBlock[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((para) =>
      /^#{1,3}\s/.test(para)
        ? ({ type: 'heading', text: para.replace(/^#{1,3}\s/, '') } as ReportBlock)
        : ({ type: 'paragraph', text: para.replace(/\n/g, ' ') } as ReportBlock),
    );
}

/** System prompt grounding the local model in the operator's real parc. */
export function assistantSystemPrompt(sites: DerivedSite[], eventsBySite: EventsMap): string {
  const lines = sites.slice(0, 40).map((s) => {
    const alerts = (eventsBySite[s.id] ?? []).filter((e) => e.type === 'security_alert').length;
    const visitors = s.state?.activeVisitors ?? 0;
    return `- ${s.name} : ${s.status}, ${visitors} visiteur(s) actif(s), ${alerts} alerte(s) enregistrée(s)`;
  });
  const parc = sites.length
    ? `Parc supervisé (${sites.length} site(s)) :\n${lines.join('\n')}`
    : "Aucun site n'est encore enregistré dans le parc.";

  return [
    "Tu es l'assistant IA d'AMN DevSec, une équipe de cybersécurité qui supervise les sites de ses clients.",
    'Réponds en français, de façon concise, professionnelle et actionnable.',
    "Appuie-toi UNIQUEMENT sur les données du parc ci-dessous : n'invente jamais de site, de chiffre ou d'incident.",
    "Si l'information n'est pas dans le contexte, dis-le clairement.",
    '',
    parc,
  ].join('\n');
}

/** Data-grounded free-text answers for common questions (mock). */
function buildAnswer(prompt: string, sites: DerivedSite[], eventsBySite: EventsMap): ReportBlock[] {
  const lower = prompt.toLowerCase();

  if (sites.length === 0) {
    return [
      {
        type: 'paragraph',
        text: 'Aucun site n’est encore enregistré. Rendez-vous dans l’onglet Sites pour en enregistrer un, puis installez le tracker (onglet Tracker) pour que je puisse commencer à analyser des données réelles.',
      },
    ];
  }

  if (/hors ligne|offline|down|indisponible/.test(lower)) {
    const offline = sites.filter((s) => s.status !== 'online');
    return [
      {
        type: 'paragraph',
        text: offline.length
          ? `${offline.length} site(s) ne sont pas pleinement opérationnels actuellement :`
          : 'Tous vos sites sont en ligne. Rien à signaler.',
      },
      ...(offline.length
        ? ([
            {
              type: 'list',
              items: offline.map((s) => `${s.name} — ${s.status}`),
            },
          ] as ReportBlock[])
        : []),
    ];
  }

  if (/vuln[eé]rabilit|cve|faille|alerte/.test(lower)) {
    const withAlerts = sites
      .map((s) => ({
        site: s,
        count: (eventsBySite[s.id] ?? []).filter((e) => e.type === 'security_alert').length,
      }))
      .filter((x) => x.count > 0);
    const total = withAlerts.reduce((n, x) => n + x.count, 0);
    return [
      {
        type: 'paragraph',
        text:
          total > 0
            ? `${total} alerte(s) de sécurité dans l’historique chargé, sur ${withAlerts.length} site(s). Détail :`
            : 'Aucune alerte de sécurité dans l’historique actuellement chargé.',
      },
      ...(withAlerts.length > 0
        ? ([
            {
              type: 'list',
              items: withAlerts.map((x) => `${x.site.name} — ${x.count} alerte(s)`),
            },
          ] as ReportBlock[])
        : []),
    ];
  }

  if (/visiteur|trafic|audience/.test(lower)) {
    const totalActive = sites.reduce((n, s) => n + (s.state?.activeVisitors ?? 0), 0);
    return [
      {
        type: 'paragraph',
        text: `Vos sites comptabilisent actuellement ${totalActive.toLocaleString('fr-FR')} visiteurs actifs, tous sites confondus.`,
      },
    ];
  }

  // Generic, contextual fallback.
  const online = sites.filter((s) => s.status === 'online').length;
  return [
    {
      type: 'paragraph',
      text: `Je supervise vos ${sites.length} sites (${online} en ligne). Je peux générer un rapport (« génère un rapport sur ${sites[0]?.name ?? 'un site'} », ou un rapport global), répondre à vos questions sur l’état du parc, ou vous préparer un résumé. Que souhaitez-vous ?`,
    },
  ];
}

/**
 * === AI assistant engine — MOCK implementation ===
 *
 * This module is the ONLY integration boundary for the assistant. Every piece
 * of generated content flows through the functions below. Today they synthesise
 * responses from local mock data (see `reportContent.ts` / `mockData.ts`) with a
 * small simulated latency so the UX matches a real network call.
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

import { getSiteById, mockSites } from '../data/mockSites';
import type { Site } from '../types/site';
import type {
  AssistantReport,
  AssistantTurn,
  ReportBlock,
  ReportRequest,
} from './types';
import { buildGlobalReport, buildSiteReport } from './reportContent';

export { getDailySummary, getSuggestions, getWatchItems } from './mockData';

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
export function buildContext(request: ReportRequest) {
  if (request.scope === 'site' && request.siteId) {
    const site = getSiteById(request.siteId);
    return { scope: 'site' as const, site };
  }
  return { scope: 'global' as const, sites: mockSites };
}

/**
 * Generates a structured report. MOCK: builds from local data.
 * LIVE: send `buildContext(request)` + a system prompt to the Messages API and
 * parse the returned blocks.
 */
export async function generateReport(
  request: ReportRequest,
): Promise<AssistantReport> {
  await delay(750);

  const draft =
    request.scope === 'site' && request.siteId
      ? buildSiteReport(getSiteById(request.siteId) as Site, request.mode)
      : buildGlobalReport(request.mode);

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
export function parseIntent(prompt: string): Intent {
  const lower = prompt.toLowerCase();
  const wantsReport = /\brapport\b|\bbilan\b|g[eé]n[eè]re|generate|report/.test(
    lower,
  );

  const matchedSite = mockSites.find((site) => {
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
 */
export async function runAssistant(prompt: string): Promise<AssistantTurn> {
  const intent = parseIntent(prompt);

  if (intent.kind === 'report') {
    const request: ReportRequest = intent.siteId
      ? { scope: 'site', siteId: intent.siteId, mode: 'internal' }
      : { scope: 'global', mode: 'internal' };
    const report = await generateReport(request);
    return { kind: 'report', request, report };
  }

  await delay(600);
  return { kind: 'answer', blocks: buildAnswer(prompt) };
}

/** Data-grounded free-text answers for common questions (mock). */
function buildAnswer(prompt: string): ReportBlock[] {
  const lower = prompt.toLowerCase();

  if (/hors ligne|offline|down|indisponible/.test(lower)) {
    const offline = mockSites.filter((s) => s.status !== 'online');
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
              items: offline.map(
                (s) =>
                  `${s.name} — ${s.status === 'offline' ? 'hors ligne' : 'dégradé'} (${s.uptimePercentage} % de dispo)`,
              ),
            },
          ] as ReportBlock[])
        : []),
    ];
  }

  if (/vuln[eé]rabilit|cve|faille/.test(lower)) {
    const withVulns = mockSites.filter((s) => s.openVulnerabilities > 0);
    const total = withVulns.reduce((n, s) => n + s.openVulnerabilities, 0);
    return [
      {
        type: 'paragraph',
        text: `${total} vulnérabilité(s) ouverte(s) sur ${withVulns.length} site(s). Détail :`,
      },
      {
        type: 'list',
        items: withVulns.map(
          (s) => `${s.name} — ${s.openVulnerabilities} vulnérabilité(s)`,
        ),
      },
    ];
  }

  if (/visiteur|trafic|audience/.test(lower)) {
    const totalActive = mockSites.reduce(
      (n, s) => n + s.analytics.activeVisitors,
      0,
    );
    return [
      {
        type: 'paragraph',
        text: `Vos sites comptabilisent actuellement ${totalActive.toLocaleString('fr-FR')} visiteurs actifs, tous sites confondus.`,
      },
    ];
  }

  // Generic, contextual fallback.
  const online = mockSites.filter((s) => s.status === 'online').length;
  return [
    {
      type: 'paragraph',
      text: `Je supervise vos ${mockSites.length} sites (${online} en ligne). Je peux générer un rapport (« génère un rapport sur Ledger Pay API », ou un rapport global), répondre à vos questions sur l’état du parc, ou vous préparer un résumé. Que souhaitez-vous ?`,
    },
  ];
}

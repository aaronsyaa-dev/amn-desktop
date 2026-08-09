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
import {
  EMPTY_WORKSPACE,
  looksLikeWorkspaceQuestion,
  renderSupervisionContext,
  renderWorkspaceContext,
  type WorkspaceData,
} from './workspaceContext';

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
  opts: {
    generate?: Generate;
    /** The operator's own synced data (BLOC 3). Never leaves the machine. */
    workspace?: WorkspaceData;
    /** Public URL per site id, used to match scanner/comply runs to a site. */
    siteUrlById?: Record<string, string>;
  } = {},
): Promise<AssistantTurn> {
  const workspace = opts.workspace ?? EMPTY_WORKSPACE;
  const siteUrlById = opts.siteUrlById ?? {};
  const intent = parseIntent(prompt, sites);

  if (intent.kind === 'report') {
    const request: ReportRequest = intent.siteId
      ? { scope: 'site', siteId: intent.siteId, mode: 'internal' }
      : { scope: 'global', mode: 'internal' };
    const report = await generateReport(request, sites, eventsBySite);
    return { kind: 'report', request, report };
  }

  // Free-text question → Ajmani, a general assistant backed by the local model,
  // with the real parc data available as OPTIONAL context (not a straitjacket).
  if (opts.generate) {
    const text = await opts.generate(
      assistantSystemPrompt(sites, eventsBySite, workspace, siteUrlById),
      prompt,
    );
    if (text.trim()) return { kind: 'answer', blocks: textToBlocks(text) };
    // Empty model reply → fall through to the data-grounded fallback below.
  }

  await delay(300);
  return { kind: 'answer', blocks: buildAnswer(prompt, sites, eventsBySite, workspace) };
}

/**
 * Splits a model's markdown-ish reply into blocks. Handles fenced code
 * (```lang … ```), ATX headings (# …) and paragraphs. Bullet runs (-, *, •)
 * become a single list block so they render as bullets, not glued text.
 */
export function textToBlocks(text: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  // Split on fenced code first so code interiors are never reflowed.
  const segments = text.split(/(```[\s\S]*?```)/g);

  for (const segment of segments) {
    if (!segment.trim()) continue;

    const fence = segment.match(/^```([\w+-]*)\n?([\s\S]*?)```$/);
    if (fence) {
      blocks.push({ type: 'code', lang: fence[1] || undefined, text: fence[2].replace(/\n$/, '') });
      continue;
    }

    for (const para of segment.split(/\n{2,}/)) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n').map((l) => l.trim());
      const isBulleted = lines.length > 0 && lines.every((l) => /^([-*•]|\d+[.)])\s+/.test(l));
      if (isBulleted) {
        blocks.push({ type: 'list', items: lines.map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, '')) });
      } else if (/^#{1,3}\s/.test(trimmed)) {
        blocks.push({ type: 'heading', text: trimmed.replace(/^#{1,3}\s/, '') });
      } else {
        blocks.push({ type: 'paragraph', text: trimmed.replace(/\n/g, ' ') });
      }
    }
  }

  return blocks.length ? blocks : [{ type: 'paragraph', text: text.trim() }];
}

/**
 * System prompt for Ajmani. It is a GENERAL assistant first — it may answer any
 * question (culture, pratique, code, etc.) — and it happens to also supervise a
 * security parc, whose live data is provided below as context to use only when
 * the question calls for it. It must not force-fit the parc onto unrelated
 * questions, and must not invent parc facts.
 */
export function assistantSystemPrompt(
  sites: DerivedSite[],
  eventsBySite: EventsMap,
  workspace: WorkspaceData = EMPTY_WORKSPACE,
  siteUrlById: Record<string, string> = {},
): string {
  const supervision = renderSupervisionContext(sites, eventsBySite, workspace, siteUrlById);
  const workspaceText = renderWorkspaceContext(workspace);

  return [
    "Tu es Ajmani, l'assistant IA intégré à AMN Desktop, un logiciel utilisé par une petite équipe de cybersécurité (AMN DevSec).",
    'Tu es un assistant GÉNÉRALISTE : réponds à TOUTE question, professionnelle ou de la vie courante (culture générale, questions pratiques, code, rédaction, etc.), de façon claire, juste et utile.',
    'Réponds en français par défaut (ou dans la langue de la question), de manière concise et directe.',
    'Quand tu écris du code, utilise des blocs de code Markdown avec des triples backticks et le langage.',
    '',
    "Tu as aussi accès, ci-dessous, aux DONNÉES RÉELLES de cette équipe : son espace de travail (tâches, clients, notes, décisions, connaissances) et son parc supervisé (statuts, alertes, scores sécurité et RGPD).",
    'Trois règles absolues sur ces données :',
    "1. N'invente JAMAIS. Si la réponse n'est pas dans le contexte ci-dessous, dis explicitement que tu ne l'as pas dans les données — ne devine pas, ne complète pas, n'extrapole pas un nom, un chiffre ou une date.",
    "2. CITE TA SOURCE. Chaque ligne du contexte porte un identifiant entre crochets, par exemple [tasks/task-1] ou [site/site-g20]. Quand tu t'appuies sur une donnée, rappelle cet identifiant entre crochets dans ta réponse.",
    "3. Le contexte est PARTIEL : il ne contient que les entrées les plus récentes de chaque collection. Si une question porte manifestement sur autre chose, dis-le plutôt que de conclure à tort qu'il n'y a rien.",
    "Pour une question sans aucun rapport avec l'équipe ou le parc, ignore complètement ce contexte et réponds normalement.",
    '',
    '=== ESPACE DE TRAVAIL ===',
    workspaceText,
    '',
    '=== SUPERVISION ===',
    supervision,
  ].join('\n');
}

/**
 * Answers a question about the operator's own data WITHOUT a language model.
 *
 * This is the path taken when Ollama isn't running, and it is deliberately
 * extractive rather than generative: it selects the matching records and lists
 * them with their identifiers. It can be incomplete, but it can never be wrong
 * — which is the right trade for a fallback, since a plausible-sounding
 * invented answer is exactly what BLOC 3 forbids.
 *
 * Returns null when the question isn't about the workspace, so the caller can
 * fall through to the parc answers below.
 */
function answerFromWorkspace(lower: string, w: WorkspaceData): ReportBlock[] | null {
  if (!looksLikeWorkspaceQuestion(lower)) return null;

  const source = (collection: string, id: string) => `[${collection}/${id}]`;

  if (/\bt[âa]ches?\b/.test(lower)) {
    const wantsOpen = /ouverte|en cours|à faire|a faire|reste|todo/.test(lower);
    const rows = w.tasks.filter((t) => (wantsOpen ? t.status !== 'done' : true));
    if (w.tasks.length === 0) {
      return [{ type: 'paragraph', text: 'Aucune tâche dans les données synchronisées.' }];
    }
    return [
      {
        type: 'paragraph',
        text: `${rows.length} tâche(s)${wantsOpen ? ' non terminées' : ''} sur ${w.tasks.length} au total :`,
      },
      {
        type: 'list',
        items: rows
          .slice(0, 15)
          .map(
            (t) =>
              `${String(t.title ?? 'sans titre')} — ${String(t.status ?? '?')} — ${
                String(t.assigneeEmail ?? '') || 'non attribuée'
              } ${source('tasks', t.id)}`,
          ),
      },
    ];
  }

  if (/\bclients?\b/.test(lower)) {
    if (w.clients.length === 0) {
      return [{ type: 'paragraph', text: 'Aucun client dans les données synchronisées.' }];
    }
    return [
      { type: 'paragraph', text: `${w.clients.length} client(s) enregistré(s) :` },
      {
        type: 'list',
        items: w.clients
          .slice(0, 15)
          .map(
            (c) =>
              `${String(c.name ?? 'sans nom')}${c.company ? ` — ${String(c.company)}` : ''} ${source(
                'clients',
                c.id,
              )}`,
          ),
      },
    ];
  }

  if (/\bnotes?\b/.test(lower)) {
    if (w.notes.length === 0) {
      return [{ type: 'paragraph', text: 'Aucune note dans les données synchronisées.' }];
    }
    return [
      { type: 'paragraph', text: `${w.notes.length} note(s), les plus récentes :` },
      {
        type: 'list',
        items: w.notes
          .slice(0, 10)
          .map((n) => `${String(n.title ?? '(sans titre)')} ${source('notes', n.id)}`),
      },
    ];
  }

  if (/\bd[ée]cisions?\b/.test(lower)) {
    if (w.decisions.length === 0) {
      return [{ type: 'paragraph', text: 'Aucune décision consignée.' }];
    }
    return [
      { type: 'paragraph', text: `${w.decisions.length} décision(s) au journal :` },
      {
        type: 'list',
        items: w.decisions
          .slice(0, 10)
          .map(
            (d) =>
              `${String(d.title ?? 'sans titre')} — ${String(d.authorName ?? d.authorEmail ?? '?')} ${source(
                'decisions',
                d.id,
              )}`,
          ),
      },
    ];
  }

  if (/connaissance|documentation|proc[ée]dure/.test(lower)) {
    if (w.knowledge.length === 0) {
      return [{ type: 'paragraph', text: 'La base de connaissances est vide.' }];
    }
    return [
      { type: 'paragraph', text: `${w.knowledge.length} fiche(s) de connaissance :` },
      {
        type: 'list',
        items: w.knowledge
          .slice(0, 10)
          .map((k) => `${String(k.title ?? 'sans titre')} ${source('knowledge', k.id)}`),
      },
    ];
  }

  if (/\bscores?\b|\brgpd\b|comply|scan/.test(lower)) {
    const scans = w.scans.filter((s) => s.status === 'done');
    const checks = w.complyChecks.filter((c) => c.status === 'done');
    if (scans.length === 0 && checks.length === 0) {
      return [
        {
          type: 'paragraph',
          text: 'Aucun scan de sécurité ni contrôle RGPD terminé dans les données.',
        },
      ];
    }
    return [
      { type: 'paragraph', text: 'Derniers résultats enregistrés :' },
      {
        type: 'list',
        items: [
          ...scans.slice(0, 8).map((s) => `Sécurité — ${s.url} : ${s.score ?? '—'}/100 [scan/${s.id}]`),
          ...checks.slice(0, 8).map((c) => `RGPD — ${c.url} : ${c.score ?? '—'}/100 [comply/${c.id}]`),
        ],
      },
    ];
  }

  return null;
}

/** Data-grounded free-text answers for common questions (mock). */
function buildAnswer(
  prompt: string,
  sites: DerivedSite[],
  eventsBySite: EventsMap,
  workspace: WorkspaceData,
): ReportBlock[] {
  const lower = prompt.toLowerCase();

  // Without a local model there is no summarising, so the honest fallback for a
  // question about the operator's own data is to hand back the matching records
  // verbatim rather than a canned sentence that reads like an answer.
  const workspaceAnswer = answerFromWorkspace(lower, workspace);
  if (workspaceAnswer) return workspaceAnswer;

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

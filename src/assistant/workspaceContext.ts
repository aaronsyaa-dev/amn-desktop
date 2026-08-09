import type { ComplyCheck, RemoteEvent, Scan } from '../shared/api';
import type { DerivedSite } from '../state/RemoteSitesContext';

/**
 * Builds the factual snapshot of the operator's own workspace that Ajmani reads
 * before answering (BLOC 3).
 *
 * Two constraints shape everything here:
 *
 *  - **It never leaves the machine.** The snapshot is assembled in the renderer
 *    and handed to the local Ollama model through the existing IPC path. No
 *    third party ever sees a note, a client name or a task.
 *
 *  - **Every line is a fact with a source.** Each entry is prefixed with the
 *    collection and record it came from, so the model can cite it and the
 *    operator can go check. Anything the snapshot doesn't contain, Ajmani is
 *    told to refuse rather than guess — an invented client is worse than "je ne
 *    sais pas".
 *
 * The snapshot is deliberately bounded: a local 7-13B model has a modest
 * context window, and a thousand notes pasted in full would push the actual
 * question out of it.
 */

/** Per-collection cap. Enough to answer real questions, small enough to fit. */
const MAX_ITEMS = 25;
/** Free-text fields are summarised, never dumped whole. */
const MAX_CHARS = 220;

export interface WorkspaceRecord {
  id: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface WorkspaceData {
  notes: WorkspaceRecord[];
  clients: WorkspaceRecord[];
  tasks: WorkspaceRecord[];
  decisions: WorkspaceRecord[];
  knowledge: WorkspaceRecord[];
  /** Scanner runs, most recent first. */
  scans: Scan[];
  /** Comply (RGPD) checks, most recent first. */
  complyChecks: ComplyCheck[];
}

export const EMPTY_WORKSPACE: WorkspaceData = {
  notes: [],
  clients: [],
  tasks: [],
  decisions: [],
  knowledge: [],
  scans: [],
  complyChecks: [],
};

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function clip(value: unknown, max = MAX_CHARS): string {
  const s = str(value).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function day(iso: unknown): string {
  const s = str(iso);
  return s ? s.slice(0, 10) : '—';
}

/** Most-recently-touched first, so the cap keeps what matters. */
function recent<T extends WorkspaceRecord>(rows: T[]): T[] {
  return [...rows]
    .sort((a, b) => str(b.updatedAt).localeCompare(str(a.updatedAt)))
    .slice(0, MAX_ITEMS);
}

function section(title: string, total: number, lines: string[]): string {
  if (total === 0) return `${title} : aucune donnée.`;
  const shown = lines.length < total ? ` (${lines.length} plus récentes sur ${total})` : '';
  return `${title}${shown} :\n${lines.join('\n')}`;
}

const STATUS_FR: Record<string, string> = {
  todo: 'à faire',
  doing: 'en cours',
  done: 'terminée',
};

/**
 * Renders the workspace as the plain-text context block handed to the model.
 * Every line carries `[collection/id]` so an answer can be traced back.
 */
export function renderWorkspaceContext(data: WorkspaceData): string {
  const parts: string[] = [];

  parts.push(
    section(
      'TÂCHES',
      data.tasks.length,
      recent(data.tasks).map((t) => {
        const status = STATUS_FR[str(t.status)] ?? (str(t.status) || 'sans statut');
        const who = str(t.assigneeEmail) || 'non attribuée';
        const detail = clip(t.detail, 120);
        return `- [tasks/${t.id}] « ${clip(t.title, 100)} » — ${status}, assignée à ${who}${
          detail ? ` — ${detail}` : ''
        }`;
      }),
    ),
  );

  parts.push(
    section(
      'CLIENTS',
      data.clients.length,
      recent(data.clients).map(
        (c) =>
          `- [clients/${c.id}] ${clip(c.name, 80) || 'sans nom'}${
            str(c.company) ? ` — ${clip(c.company, 80)}` : ''
          }${str(c.email) ? ` — ${str(c.email)}` : ''}${
            str(c.status) ? ` — statut : ${str(c.status)}` : ''
          }`,
      ),
    ),
  );

  parts.push(
    section(
      'NOTES',
      data.notes.length,
      recent(data.notes).map(
        (n) =>
          `- [notes/${n.id}] ${day(n.updatedAt)} — ${clip(n.title, 80) || '(sans titre)'} : ${clip(
            n.body,
          )}`,
      ),
    ),
  );

  parts.push(
    section(
      'DÉCISIONS',
      data.decisions.length,
      recent(data.decisions).map(
        (d) =>
          `- [decisions/${d.id}] ${day(d.createdAt)} — « ${clip(d.title, 100)} » (${
            str(d.authorName) || str(d.authorEmail) || 'auteur inconnu'
          }) : ${clip(d.detail)}`,
      ),
    ),
  );

  parts.push(
    section(
      'CONNAISSANCES',
      data.knowledge.length,
      recent(data.knowledge).map(
        (k) => `- [knowledge/${k.id}] « ${clip(k.title, 100)} » : ${clip(k.body)}`,
      ),
    ),
  );

  return parts.join('\n\n');
}

/**
 * Renders the supervision side: per-site status, activity, latest security
 * score and latest RGPD score, plus the alerts actually recorded.
 */
export function renderSupervisionContext(
  sites: DerivedSite[],
  eventsBySite: Record<string, RemoteEvent[]>,
  data: WorkspaceData,
  siteUrlById: Record<string, string> = {},
): string {
  if (sites.length === 0) return "PARC SUPERVISÉ : aucun site n'est enregistré.";

  /** Latest finished run for a URL, whichever product it belongs to. */
  const latestFor = <T extends { url: string; status: string; score?: number | null; finishedAt?: string | null }>(
    runs: T[],
    url: string,
  ): T | undefined => {
    if (!url) return undefined;
    const host = (u: string) => {
      try {
        return new URL(u).host.replace(/^www\./, '');
      } catch {
        return u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      }
    };
    const wanted = host(url);
    return runs
      .filter((r) => r.status === 'done' && host(r.url) === wanted)
      .sort((a, b) => str(b.finishedAt).localeCompare(str(a.finishedAt)))[0];
  };

  const lines = sites.slice(0, 40).map((s) => {
    const events = eventsBySite[s.id] ?? [];
    const alerts = events.filter((e) => e.type === 'security_alert');
    const critical = alerts.filter((e) => e.severity === 'critical').length;
    const url = siteUrlById[s.id] ?? '';
    const scan = latestFor(data.scans, url);
    const comply = latestFor(data.complyChecks, url);

    const bits = [
      `statut ${s.status}`,
      `${s.state?.activeVisitors ?? 0} visiteur(s) actif(s)`,
      `${alerts.length} alerte(s) dont ${critical} critique(s)`,
      scan?.score != null ? `score sécurité ${scan.score}/100 (scan du ${day(scan.finishedAt)})` : 'aucun scan de sécurité',
      comply?.score != null
        ? `score RGPD ${comply.score}/100 (contrôle du ${day(comply.finishedAt)})`
        : 'aucun contrôle RGPD',
    ];
    return `- [site/${s.id}] ${s.name}${url ? ` (${url})` : ''} : ${bits.join(', ')}`;
  });

  // The most recent alerts verbatim: "quelles alertes ?" is the question this
  // whole block exists to answer, and a count alone can't.
  const recentAlerts = sites
    .flatMap((s) =>
      (eventsBySite[s.id] ?? [])
        .filter((e) => e.type === 'security_alert')
        .map((e) => ({ site: s.name, e })),
    )
    .sort((a, b) => str(b.e.occurredAt).localeCompare(str(a.e.occurredAt)))
    .slice(0, 15)
    .map(
      ({ site, e }) =>
        `- [alerte/${e.id}] ${day(e.occurredAt)} — ${site} — ${e.severity ?? 'sans gravité'} — ${clip(
          e.message,
          120,
        ) || 'sans message'}`,
    );

  return [
    `PARC SUPERVISÉ (${sites.length} site(s)) :\n${lines.join('\n')}`,
    recentAlerts.length
      ? `ALERTES RÉCENTES :\n${recentAlerts.join('\n')}`
      : 'ALERTES RÉCENTES : aucune dans l’historique chargé.',
  ].join('\n\n');
}

/**
 * True when the question is about the operator's own data or parc, rather than
 * a general-knowledge question. Used only to decide whether the *fallback*
 * (no local model available) should try to answer from the workspace.
 */
export function looksLikeWorkspaceQuestion(prompt: string): boolean {
  return /\b(t[âa]che|tâches|client|note|d[ée]cision|connaissance|site|alerte|scan|score|rgpd|comply|parc|visiteur|vuln[ée]rabilit)/i.test(
    prompt,
  );
}

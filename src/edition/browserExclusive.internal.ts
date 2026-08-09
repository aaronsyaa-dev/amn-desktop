import type {
  AmnBridge,
  CallSignal,
  ComplyProgress,
  ProductRegression,
  RemoteEventPush,
  ScanProgress,
  ComplyCheck,
  CreateScheduleInput,
  OrgOverview,
  ProductSchedule,
  RegisterSiteResult,
  RemoteEvent,
  RemoteSite,
  Scan,
  ScanTier,
  SiteBadge,
  SiteDigest,
  SiteSummary,
  SslStatus,
  TrackerTier,
} from '../shared/api';

/**
 * Part exclusive du pont NAVIGATEUR — édition interne.
 *
 * Pendant, côté renderer hors Electron, de `src/preload.exclusive.internal.ts` :
 * les appels amn-api du parc de sites, du Scanner, de Comply, de SSL Monitor,
 * des analyses récurrentes, du bureau SOC et de la signalisation d'appel.
 *
 * Extrait de `bridge.ts` pour une seule raison, mais elle est décisive : tant
 * que ces méthodes vivaient dans le pont commun, leurs routes (`/v1/scans`,
 * `/v1/ssl`, `/v1/sites`…) se retrouvaient en clair dans le bundle livré à une
 * organisation cliente, alors même qu'aucun écran ne pouvait les appeler.
 */
export interface BrowserExclusiveContext {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  apiUrl: string;
  token: string;
  ensureStarted: () => void;
  socket: () => WebSocket | null;
  eventListeners: Set<(push: RemoteEventPush) => void>;
  scanListeners: Set<(progress: ScanProgress) => void>;
  complyListeners: Set<(progress: ComplyProgress) => void>;
  signalListeners: Set<(signal: CallSignal) => void>;
  regressionListeners: Set<(r: ProductRegression) => void>;
}

type ExclusiveRemote = Pick<
  AmnBridge['remote'],
  | 'listSites'
  | 'getSiteEvents'
  | 'registerSite'
  | 'updateSite'
  | 'deleteSite'
  | 'configureSite'
  | 'getSiteSummary'
  | 'getSiteDigest'
  | 'onEvent'
  | 'listSslStatus'
  | 'checkSsl'
  | 'listSchedules'
  | 'createSchedule'
  | 'deleteSchedule'
  | 'onProductRegression'
  | 'getOrgOverview'
  | 'getSiteBadge'
  | 'sendCallSignal'
  | 'onCallSignal'
  | 'startScan'
  | 'listScans'
  | 'getScan'
  | 'scanReportUrl'
  | 'onScanProgress'
  | 'startComply'
  | 'listComplyChecks'
  | 'getComplyCheck'
  | 'onComplyProgress'
>;

export function createBrowserExclusive(ctx: BrowserExclusiveContext): ExclusiveRemote {
  return {
  async listSites(): Promise<RemoteSite[]> {
    const { sites } = await ctx.apiFetch<{ sites: RemoteSite[] }>('/v1/sites');
    return sites;
  },
  async getSiteEvents(siteId, opts = {}): Promise<RemoteEvent[]> {
    const params = new URLSearchParams();
    if (opts.since) params.set('since', opts.since);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const { events } = await ctx.apiFetch<{ events: RemoteEvent[] }>(
      `/v1/sites/${siteId}/events${qs ? `?${qs}` : ''}`,
    );
    return events;
  },
  async registerSite(name: string): Promise<RegisterSiteResult> {
    return ctx.apiFetch<RegisterSiteResult>('/v1/sites', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  async updateSite(id: string, name: string): Promise<RemoteSite> {
    const { site } = await ctx.apiFetch<{ site: RemoteSite }>(`/v1/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    return site;
  },
  async deleteSite(id: string): Promise<void> {
    await ctx.apiFetch<{ ok: boolean }>(`/v1/sites/${id}`, { method: 'DELETE' });
  },
  async configureSite(id: string, patch: { tier?: TrackerTier; url?: string | null }): Promise<RemoteSite> {
    // amn-api applies a partial patch, so omitting `name` leaves it untouched.
    const { site } = await ctx.apiFetch<{ site: RemoteSite }>(`/v1/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return site;
  },
  async getSiteSummary(id: string, hours = 24): Promise<SiteSummary> {
    return ctx.apiFetch<SiteSummary>(`/v1/sites/${id}/summary?hours=${hours}`);
  },
  async getSiteDigest(id: string): Promise<SiteDigest> {
    const { digest } = await ctx.apiFetch<{ digest: SiteDigest }>(`/v1/sites/${id}/digest`);
    return digest;
  },
  onEvent(callback) {
    ctx.eventListeners.add(callback);
    ctx.ensureStarted();
    return () => ctx.eventListeners.delete(callback);
  },
  async listSslStatus() {
    const { statuses } = await ctx.apiFetch<{ statuses: SslStatus[] }>('/v1/ssl');
    return statuses;
  },
  async checkSsl(host: string) {
    const { status } = await ctx.apiFetch<{ status: SslStatus }>('/v1/ssl/check', {
      method: 'POST',
      body: JSON.stringify({ host }),
    });
    return status;
  },
  async listSchedules() {
    const { schedules } = await ctx.apiFetch<{ schedules: ProductSchedule[] }>('/v1/schedules');
    return schedules;
  },
  async createSchedule(input: CreateScheduleInput) {
    const { schedule } = await ctx.apiFetch<{ schedule: ProductSchedule }>('/v1/schedules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return schedule;
  },
  async deleteSchedule(id: string) {
    await ctx.apiFetch<{ ok: boolean }>(`/v1/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  onProductRegression(callback) {
    ctx.regressionListeners.add(callback);
    ctx.ensureStarted();
    return () => ctx.regressionListeners.delete(callback);
  },
  async getOrgOverview(days: number) {
    return ctx.apiFetch<OrgOverview>(`/v1/sites/overview?days=${encodeURIComponent(String(days))}`);
  },
  async getSiteBadge(siteId: string) {
    return ctx.apiFetch<SiteBadge>(`/v1/sites/${siteId}/badge`);
  },
  async sendCallSignal(signal) {
    ctx.ensureStarted();
    const socket = ctx.socket();
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(
      JSON.stringify({
        type: 'signal',
        to: signal.to,
        kind: signal.kind,
        callId: signal.callId,
        payload: signal.payload ?? null,
      }),
    );
    return true;
  },
  onCallSignal(callback) {
    ctx.signalListeners.add(callback);
    ctx.ensureStarted();
    return () => ctx.signalListeners.delete(callback);
  },
  async startScan(url: string, tier: ScanTier): Promise<Scan> {
    const { scan } = await ctx.apiFetch<{ scan: Scan }>('/v1/scan', {
      method: 'POST',
      body: JSON.stringify({ url, tier }),
    });
    return scan;
  },
  async listScans(): Promise<Scan[]> {
    const { scans } = await ctx.apiFetch<{ scans: Scan[] }>('/v1/scans');
    return scans;
  },
  async getScan(id: string): Promise<Scan> {
    const { scan } = await ctx.apiFetch<{ scan: Scan }>(`/v1/scans/${encodeURIComponent(id)}`);
    return scan;
  },
  async scanReportUrl(id: string): Promise<string> {
    // The report is behind the operator ctx.token, which a plain window.open()
    // can't send. Fetch it here (with the header) and hand back a blob: URL.
    const res = await fetch(`${ctx.apiUrl}/v1/scans/${encodeURIComponent(id)}/pdf`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    if (!res.ok) throw new Error(`amn-api ${res.status} ${res.statusText}`);
    return URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
  },
  onScanProgress(callback) {
    ctx.scanListeners.add(callback);
    ctx.ensureStarted();
    return () => ctx.scanListeners.delete(callback);
  },
  async startComply(url: string): Promise<ComplyCheck> {
    const { check } = await ctx.apiFetch<{ check: ComplyCheck }>('/v1/comply', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    return check;
  },
  async listComplyChecks(): Promise<ComplyCheck[]> {
    const { checks } = await ctx.apiFetch<{ checks: ComplyCheck[] }>('/v1/comply-checks');
    return checks;
  },
  async getComplyCheck(id: string): Promise<ComplyCheck> {
    const { check } = await ctx.apiFetch<{ check: ComplyCheck }>(
      `/v1/comply-checks/${encodeURIComponent(id)}`,
    );
    return check;
  },
  onComplyProgress(callback) {
    ctx.complyListeners.add(callback);
    ctx.ensureStarted();
    return () => ctx.complyListeners.delete(callback);
  },
  };
}

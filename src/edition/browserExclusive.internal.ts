import type {
  Incident,
  IncidentEscalation,
  IncidentDetail,
  IncidentMetrics,
  MonthlyReport,
  AlertSuppression,
  IncidentResolution,
  IncidentStatus,
  AdminOrganization,
  AdminOrgUser,
  CreateOrganizationInput,
  CreateOrganizationResult,
  OrgAccessEntry,
  OrgIdentity,
  OrgInvitationResult,
  OrgStatus,
  SupportContext,
  SupportSession,
  TempPasswordResult,
  AmnBridge,
  CallSignal,
  ComplyProgress,
  ProductRegression,
  RemoteEventPush,
  ScanProgress,
  ComplyCheck,
  ComplyReferentialCatalog,
  CreateScheduleInput,
  OrgOverview,
  ProductSchedule,
  RegisterSiteResult,
  RemoteEvent,
  RemoteSite,
  Scan,
  ScanTier,
  SiteBadge,
  SiteStatusPage,
  SiteDigest,
  SiteSummary,
  SslStatus,
  TrackerTier,
  ModuleRequestForOperator,
  OrgPulse,
  DownloadLink,
  BusinessRelease,
  SupervisionState,
  ParcInsights,
  OrgPlan,
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
  apiFetch: <T>(path: string, init?: RequestInit & { owner?: boolean }) => Promise<T>;
  apiUrl: string;
  /**
   * Le jeton de BUILD (`VITE_AMN_API_WEB_TOKEN`), et rien d'autre. Il est vide
   * dans la plupart des déploiements, et il est vide PAR CONSTRUCTION dans
   * l'édition Business.
   *
   * Ne l'employez pas pour authentifier une requête : utilisez `credential()`.
   * Voir le commentaire de `credential` juste en dessous.
   */
  token: string;
  /**
   * LE JUSTIFICATIF VIVANT — celui qu'`apiFetch` emploie réellement.
   *
   * `supportToken || sessionToken || token`, relu à CHAQUE appel. Les rares
   * endroits qui composent une requête à la main (les documents qu'on va
   * ouvrir dans une fenêtre : rapport de scan, rapport mensuel) doivent passer
   * par ici et jamais par `token`.
   *
   * Le défaut qui a mené à cette fonction : ces requêtes envoyaient `token`,
   * donc rien du tout sur un déploiement web sans jeton de build — le document
   * répondait 401 et le bouton ne faisait visiblement rien. Et dans le dossier
   * d'une organisation cliente, elles envoyaient le jeton d'OPÉRATEUR : le
   * document rendu était celui d'AMN DevSec, pendant qu'on croyait lire celui
   * de la cliente. C'est la version grave du même oubli.
   */
  credential: () => string;
  ensureStarted: () => void;
  socket: () => WebSocket | null;
  eventListeners: Set<(push: RemoteEventPush) => void>;
  /** Abonnement à un type de trame WebSocket. Renvoie une fonction de désabonnement. */
  onFrame: (type: string, listener: (frame: Record<string, unknown>) => void) => () => void;
  /**
   * Bascule le justificatif du pont sur une organisation cliente (ou le rend).
   * Reconnecte la WebSocket, comme côté Electron : le flux temps réel doit
   * suivre la même organisation que les requêtes.
   */
  applySupportToken: (token: string | null) => void;
  /** Lit le jeton de support courant, pour le restaurer en cas d'échec. */
  supportToken: () => string;
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
  | 'listIncidents'
  | 'getIncident'
  | 'incidentMetrics'
  | 'acknowledgeIncident'
  | 'resolveIncident'
  | 'reopenIncident'
  | 'listSuppressions'
  | 'revokeSuppression'
  | 'monthlyReport'
  | 'monthlyReportUrl'
  | 'listSchedules'
  | 'createSchedule'
  | 'deleteSchedule'
  | 'onProductRegression'
  | 'onIncidentEscalation'
  | 'getOrgOverview'
  | 'getSiteBadge'
  | 'getSiteStatusPage'
  | 'publishSiteStatusPage'
  | 'revokeSiteStatusPage'
  | 'sendCallSignal'
  | 'onCallSignal'
  | 'startScan'
  | 'listScans'
  | 'getScan'
  | 'scanReportUrl'
  | 'onScanProgress'
  | 'startComply'
  | 'listComplyChecks'
  | 'listComplyReferentials'
  | 'getComplyCheck'
  | 'onComplyProgress'
  | 'admin'
  | 'support'
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
/* --- Incidents : la file de travail de la supervision --- */

  async listIncidents(
    options: {
      status?: 'open' | 'all' | IncidentStatus;
      siteId?: string;
      suppressed?: 'exclus' | 'seuls' | 'tous';
    } = {},
  ) {
    const params = new URLSearchParams();
    params.set('status', options.status ?? 'open');
    if (options.siteId) params.set('site_id', options.siteId);
    if (options.suppressed) params.set('suppressed', options.suppressed);
    const { incidents } = await ctx.apiFetch<{ incidents: Incident[] }>(
      `/v1/incidents?${params.toString()}`,
    );
    return incidents;
  },

  async getIncident(id: string) {
    return await ctx.apiFetch<IncidentDetail>(`/v1/incidents/${encodeURIComponent(id)}`);
  },

  async incidentMetrics(days = 30) {
    return await ctx.apiFetch<IncidentMetrics>(`/v1/incidents/metrics?days=${days}`);
  },

  async acknowledgeIncident(id: string) {
    const { incident } = await ctx.apiFetch<{ incident: Incident }>(
      `/v1/incidents/${encodeURIComponent(id)}/acknowledge`,
      { method: 'POST' },
    );
    return incident;
  },

  async resolveIncident(
    id: string,
    resolution: IncidentResolution,
    note?: string,
    suppress?: { kind: string },
  ) {
    return ctx.apiFetch<{ incident: Incident; suppression: AlertSuppression | null }>(
      `/v1/incidents/${encodeURIComponent(id)}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({
          resolution,
          note,
          ...(suppress ? { suppress: true, suppressKind: suppress.kind } : {}),
        }),
      },
    );
  },

  async listSuppressions(includeInactive = false) {
    const { suppressions } = await ctx.apiFetch<{ suppressions: AlertSuppression[] }>(
      `/v1/incidents/suppressions${includeInactive ? '?all=1' : ''}`,
    );
    return suppressions;
  },

  async revokeSuppression(id: string) {
    const { suppression } = await ctx.apiFetch<{ suppression: AlertSuppression }>(
      `/v1/incidents/suppressions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    return suppression;
  },

  async reopenIncident(id: string) {
    const { incident } = await ctx.apiFetch<{ incident: Incident }>(
      `/v1/incidents/${encodeURIComponent(id)}/reopen`,
      { method: 'POST' },
    );
    return incident;
  },

  async monthlyReport(month?: string) {
    const { report } = await ctx.apiFetch<{ report: MonthlyReport }>(
      `/v1/reports/monthly${month ? `?month=${encodeURIComponent(month)}` : ''}`,
    );
    return report;
  },

  async monthlyReportUrl(month?: string) {
    // Le document est derrière le jeton, qu'un `window.open()` nu ne sait pas
    // envoyer : on le récupère ici avec l'en-tête, et on rend un `blob:`.
    const res = await fetch(
      `${ctx.apiUrl}/v1/reports/monthly.html${month ? `?month=${encodeURIComponent(month)}` : ''}`,
      { headers: { Authorization: `Bearer ${ctx.credential()}` } },
    );
    if (!res.ok) throw new Error(`amn-api ${res.status} ${res.statusText}`);
    return URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
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
    ctx.ensureStarted();
    return ctx.onFrame('product:regression', (frame) => callback(frame as unknown as ProductRegression));
  },
  onIncidentEscalation(callback) {
    ctx.ensureStarted();
    return ctx.onFrame('incident:escalated', (frame) => callback(frame as unknown as IncidentEscalation));
  },
  async getOrgOverview(days: number) {
    return ctx.apiFetch<OrgOverview>(`/v1/sites/overview?days=${encodeURIComponent(String(days))}`);
  },
  async getSiteBadge(siteId: string) {
    return ctx.apiFetch<SiteBadge>(`/v1/sites/${siteId}/badge`);
  },
  async getSiteStatusPage(siteId: string) {
    return ctx.apiFetch<SiteStatusPage>(`/v1/sites/${siteId}/status-page`);
  },
  async publishSiteStatusPage(siteId: string) {
    return ctx.apiFetch<SiteStatusPage>(`/v1/sites/${siteId}/status-page`, { method: 'POST' });
  },
  async revokeSiteStatusPage(siteId: string) {
    return ctx.apiFetch<SiteStatusPage>(`/v1/sites/${siteId}/status-page`, { method: 'DELETE' });
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
    ctx.ensureStarted();
    const offSignal = ctx.onFrame('signal', (frame) => callback(frame as unknown as CallSignal));
    // « Personne n'écoutait » devient sa propre nature de signal, comme côté
    // Electron : l'appelant peut conclure « hors ligne » au lieu d'attendre.
    const offUndelivered = ctx.onFrame('signal:undelivered', (frame) =>
      callback({
        type: 'signal',
        kind: 'undelivered',
        callId: String(frame.callId ?? ''),
        from: String(frame.to ?? ''),
        payload: { kind: String(frame.kind ?? '') },
      }),
    );
    return () => {
      offSignal();
      offUndelivered();
    };
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
    // Le rapport est derrière le justificatif, qu'un `window.open()` nu ne
    // sait pas envoyer : on le récupère ici avec l'en-tête, et on rend un
    // `blob:`. `ctx.credential()` et non `ctx.token` — voir son commentaire :
    // dans le dossier d'une cliente, `token` rendait NOTRE rapport.
    const res = await fetch(`${ctx.apiUrl}/v1/scans/${encodeURIComponent(id)}/pdf`, {
      headers: { Authorization: `Bearer ${ctx.credential()}` },
    });
    if (!res.ok) throw new Error(`amn-api ${res.status} ${res.statusText}`);
    return URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
  },
  onScanProgress(callback) {
    ctx.ensureStarted();
    return ctx.onFrame('scan:progress', (frame) => callback(frame.progress as ScanProgress));
  },
  admin: {
    async listOrganizations(): Promise<AdminOrganization[]> {
      const { organizations } = await ctx.apiFetch<{ organizations: AdminOrganization[] }>(
        '/v1/admin/organizations',
        { owner: true },
      );
      return organizations;
    },
    async createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResult> {
      return ctx.apiFetch<CreateOrganizationResult>('/v1/admin/organizations', {
        owner: true,
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          plan: input.plan,
          ownerEmail: input.ownerEmail,
          logoDataUrl: input.logoDataUrl || undefined,
        }),
      });
    },
    async updateOrganization(
      id: string,
      patch: {
        name?: string;
        logoDataUrl?: string | null;
        modules?: string[] | null;
        guestDailyMinutes?: number | null;
        timezone?: string | null;
        accent?: string | null;
      },
    ) {
      const { organization } = await ctx.apiFetch<{ organization: AdminOrganization }>(
        `/v1/admin/organizations/${encodeURIComponent(id)}`,
        { owner: true, method: 'PUT', body: JSON.stringify(patch) },
      );
      return organization;
    },
    async deleteOrganization(id: string, confirm: string) {
      return ctx.apiFetch<{
        organization: AdminOrganization;
        removed: { users: number; records: number; sites: number };
      }>(`/v1/admin/organizations/${encodeURIComponent(id)}`, {
        owner: true,
        method: 'DELETE',
        body: JSON.stringify({ confirm }),
      });
    },
    async deleteUser(orgId: string, userId: string) {
      const { user } = await ctx.apiFetch<{ user: { id: string; email: string } }>(
        `/v1/admin/organizations/${encodeURIComponent(orgId)}/users/${encodeURIComponent(userId)}`,
        { owner: true, method: 'DELETE' },
      );
      return user;
    },
    async createUser(orgId: string, input: { email: string; role: 'owner' | 'admin' | 'member' }) {
      return ctx.apiFetch<{
        user: AdminOrgUser;
        invitation: { token: string; url: string | null; expiresAt: string };
      }>(`/v1/admin/organizations/${encodeURIComponent(orgId)}/users`, {
        owner: true,
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    async setOrganizationPlan(id: string, plan: OrgPlan) {
      const { organization } = await ctx.apiFetch<{ organization: AdminOrganization }>(
        `/v1/admin/organizations/${encodeURIComponent(id)}/plan`,
        { owner: true, method: 'PUT', body: JSON.stringify({ plan }) },
      );
      return organization;
    },
    async setOrganizationStatus(id: string, status: OrgStatus) {
      const { organization } = await ctx.apiFetch<{ organization: AdminOrganization }>(
        `/v1/admin/organizations/${encodeURIComponent(id)}/status`,
        { owner: true, method: 'PUT', body: JSON.stringify({ status }) },
      );
      return organization;
    },
    async listUsers(orgId: string): Promise<AdminOrgUser[]> {
      const { users } = await ctx.apiFetch<{ users: AdminOrgUser[] }>(
        `/v1/admin/organizations/${encodeURIComponent(orgId)}/users`,
        { owner: true },
      );
      return users;
    },
    async reissueInvitation(orgId: string, email: string): Promise<OrgInvitationResult> {
      return ctx.apiFetch<OrgInvitationResult>(
        `/v1/admin/organizations/${encodeURIComponent(orgId)}/invitations`,
        { owner: true, method: 'POST', body: JSON.stringify({ email }) },
      );
    },
    async resetPassword(orgId: string, userId: string): Promise<TempPasswordResult> {
      return ctx.apiFetch<TempPasswordResult>(
        `/v1/admin/organizations/${encodeURIComponent(orgId)}/users/${encodeURIComponent(userId)}/temp-password`,
        { owner: true, method: 'POST' },
      );
    },
    async accessLog(opts: { orgId?: string; limit?: number } = {}): Promise<OrgAccessEntry[]> {
      const params = new URLSearchParams();
      if (opts.orgId) params.set('org', opts.orgId);
      if (opts.limit) params.set('limit', String(opts.limit));
      const qs = params.toString();
      const { entries } = await ctx.apiFetch<{ entries: OrgAccessEntry[] }>(
        `/v1/admin/access-log${qs ? `?${qs}` : ''}`,
        { owner: true },
      );
      return entries;
    },
    async organizationPulse(orgId: string): Promise<OrgPulse> {
      const { pulse } = await ctx.apiFetch<{ pulse: OrgPulse }>(
        `/v1/admin/organizations/${encodeURIComponent(orgId)}/pulse`,
        { owner: true },
      );
      return pulse;
    },
    async moduleRequests(status?: string): Promise<ModuleRequestForOperator[]> {
      const suffixe = status ? `?status=${encodeURIComponent(status)}` : '';
      const { requests } = await ctx.apiFetch<{ requests: ModuleRequestForOperator[] }>(
        `/v1/admin/module-requests${suffixe}`,
        { owner: true },
      );
      return requests ?? [];
    },
    async resolveModuleRequest(
      id: string,
      input: { status: 'done' | 'declined'; note?: string },
    ): Promise<ModuleRequestForOperator> {
      const { request } = await ctx.apiFetch<{ request: ModuleRequestForOperator }>(
        `/v1/admin/module-requests/${encodeURIComponent(id)}`,
        { owner: true, method: 'PUT', body: JSON.stringify({ status: input.status, note: input.note ?? '' }) },
      );
      return request;
    },
    async supervision(): Promise<SupervisionState> {
      return ctx.apiFetch<SupervisionState>('/v1/admin/supervision', { owner: true });
    },

    async insights(): Promise<ParcInsights> {
      return ctx.apiFetch<ParcInsights>('/v1/admin/insights', { owner: true });
    },
    async downloadLink(orgId?: string): Promise<DownloadLink> {
      return ctx.apiFetch<DownloadLink>('/v1/admin/download-links', {
        owner: true,
        method: 'POST',
        body: JSON.stringify(orgId ? { orgId } : {}),
      });
    },
    async releases(): Promise<{ releases: BusinessRelease[]; current: BusinessRelease | null }> {
      return ctx.apiFetch<{ releases: BusinessRelease[]; current: BusinessRelease | null }>(
        '/v1/admin/releases',
        { owner: true },
      );
    },
  },

  support: {
    async enter(orgId: string): Promise<SupportSession> {
      const created = await ctx.apiFetch<{
        token: string;
        expiresAt: string;
        organization: AdminOrganization;
      }>(`/v1/admin/organizations/${encodeURIComponent(orgId)}/support-session`, {
        owner: true,
        method: 'POST',
      });
      ctx.applySupportToken(created.token);
      const me = await ctx.apiFetch<{ support: { actorEmail: string } | null }>('/v1/auth/me');
      return {
        token: created.token,
        context: {
          orgId: created.organization.id,
          orgName: created.organization.name,
          plan: created.organization.plan,
          status: created.organization.status,
          logoDataUrl: created.organization.logoDataUrl ?? null,
          // Voir la note du pilote Electron : sans ces deux champs, un
          // contexte de support ne reflète jamais les réglages réels de
          // l'organisation cliente.
          modules: created.organization.modules ?? null,
          accent: created.organization.accent ?? null,
          actorEmail: me.support?.actorEmail ?? '',
          expiresAt: created.expiresAt,
        },
      };
    },
    async restore(token: string): Promise<SupportContext | null> {
      if (!token) return null;
      const previous = ctx.supportToken();
      ctx.applySupportToken(token);
      try {
        const me = await ctx.apiFetch<{
          org: (OrgIdentity & { status?: OrgStatus }) | null;
          support: { orgId: string; orgName: string; actorEmail: string } | null;
        }>('/v1/auth/me');
        if (!me.support || !me.org) throw new Error('jeton hors contexte client');
        return {
          orgId: me.org.id,
          orgName: me.org.name,
          plan: me.org.plan,
          status: me.org.status ?? 'active',
          logoDataUrl: me.org.logoDataUrl ?? null,
          modules: me.org.modules ?? null,
          accent: me.org.accent ?? null,
          actorEmail: me.support.actorEmail,
          expiresAt: '',
        };
      } catch {
        ctx.applySupportToken(previous || null);
        return null;
      }
    },
    async leave(token: string): Promise<void> {
      await ctx
        .apiFetch<{ ok: boolean }>('/v1/admin/support-session', {
          owner: true,
          method: 'DELETE',
          body: JSON.stringify({ token }),
        })
        .catch(() => undefined);
      ctx.applySupportToken(null);
    },
  },

  async startComply(url: string, referential?: string): Promise<ComplyCheck> {
    const { check } = await ctx.apiFetch<{ check: ComplyCheck }>('/v1/comply', {
      method: 'POST',
      body: JSON.stringify(referential ? { url, referential } : { url }),
    });
    return check;
  },
  async listComplyReferentials(): Promise<ComplyReferentialCatalog> {
    return ctx.apiFetch<ComplyReferentialCatalog>('/v1/comply-referentials');
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
    ctx.ensureStarted();
    return ctx.onFrame('comply:progress', (frame) => callback(frame.progress as ComplyProgress));
  },
  };
}

/**
 * Part exclusive du pont navigateur hors `remote` : veille RSS et modèle local.
 *
 * Les deux ont besoin du process main (requête cross-origin pour les flux,
 * serveur local pour Ollama). Le repli navigateur répond honnêtement « pas
 * disponible ici » plutôt que d'échouer en silence.
 */
export const browserExclusiveBridge: Pick<AmnBridge, 'watch' | 'ollama'> = {
  watch: {
    async list() {
      return { items: [], fetchedAt: null, degraded: true };
    },
    async refresh() {
      return { items: [], fetchedAt: null, degraded: true };
    },
  },
  ollama: {
    async status() {
      return { available: false, models: [] };
    },
    async chat() {
      throw new Error('Modèle local indisponible dans le navigateur.');
    },
  },
};

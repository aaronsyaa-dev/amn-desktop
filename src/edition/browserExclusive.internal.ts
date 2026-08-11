import type {
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
  apiFetch: <T>(path: string, init?: RequestInit & { owner?: boolean }) => Promise<T>;
  apiUrl: string;
  token: string;
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
    // The report is behind the operator ctx.token, which a plain window.open()
    // can't send. Fetch it here (with the header) and hand back a blob: URL.
    const res = await fetch(`${ctx.apiUrl}/v1/scans/${encodeURIComponent(id)}/pdf`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
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
      },
    ) {
      const { organization } = await ctx.apiFetch<{ organization: AdminOrganization }>(
        `/v1/admin/organizations/${encodeURIComponent(id)}`,
        { owner: true, method: 'PUT', body: JSON.stringify(patch) },
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

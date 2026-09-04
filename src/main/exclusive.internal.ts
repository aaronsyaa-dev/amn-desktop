import {
  IPC,
  type Incident,
  type IncidentEscalation,
  type IncidentDetail,
  type IncidentMetrics,
  type MonthlyReport,
  type AlertSuppression,
  type MaintenanceWindow,
  type IncidentResolution,
  type IncidentStatus,
  type AdminOrganization,
  type AdminOrgUser,
  type CreateOrganizationInput,
  type CreateOrganizationResult,
  type OrgAccessEntry,
  type OrgPulse,
  type ModuleRequestForOperator,
  type DownloadLink,
  type BusinessRelease,
  type SupervisionState,
  type ParcInsights,
  type OrgIdentity,
  type OrgInvitationResult,
  type OrgStatus,
  type OrgPlan,
  type SupportContext,
  type SupportSession,
  type TempPasswordResult,
  type ComplyCheck,
  type ComplyReferentialCatalog,
  type ComplyProgress,
  type CreateScheduleInput,
  type OrgOverview,
  type ProductRegression,
  type ProductSchedule,
  type RegisterSiteResult,
  type RemoteEvent,
  type RemoteSite,
  type ScanProgress,
  type ScanTier,
  type SiteBadge,
  type SiteStatusPage,
  type SiteDigest,
  type SiteSummary,
  type SslStatus,
  type Scan,
  type TrackerTier,
  OrgChange,
  type ParcPageQuery,
  type ParcPage,
  type ParcSummary,
  type ModuleLock,
  type BulkInput,
  type BulkResult,
  type FleetIncidentsQuery,
  type FleetIncidentsPage,
  type SocSummary,
} from '../shared/api';
import { apiCredential, remoteConfig } from './remoteConfig';
import { apiFetch, type RemoteApiClient } from './remoteApi';
import { writeScanReportFile } from './scanReports';
import { getWatch, warmWatch } from './watch';
import { ollamaChat, ollamaStatus } from './ollama';
import type { SupportRequestForOperator, WelcomeLinkIssued, AdminWelcomeLink, InputAlert } from '../shared/api';

/**
 * Tout ce qu'amn-api expose et qui n'appartient qu'à AMN DevSec : le parc de
 * sites supervisés, le Scanner, Comply, SSL Monitor, les analyses récurrentes,
 * le bureau SOC, et la signalisation des appels audio.
 *
 * Ce module est le pendant, côté process main, de `src/edition/exclusive.*` :
 * l'édition Business le résout vers `exclusive.business.ts`, qui ne contient
 * rien. Conséquence concrète et vérifiable — dans l'app livrée à une cliente,
 * ces routes n'existent pas dans le bundle ET aucun canal IPC ne les expose,
 * donc même du code renderer malveillant n'aurait rien à appeler.
 */

const exclusiveApi = {
  async listSites(): Promise<RemoteSite[]> {
    const { sites } = await apiFetch<{ sites: RemoteSite[] }>('/v1/sites');
    return sites;
  },

  async getSiteEvents(
    siteId: string,
    opts: { since?: string; limit?: number } = {},
  ): Promise<RemoteEvent[]> {
    const params = new URLSearchParams();
    if (opts.since) params.set('since', opts.since);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const { events } = await apiFetch<{ events: RemoteEvent[] }>(
      `/v1/sites/${siteId}/events${qs ? `?${qs}` : ''}`,
    );
    return events;
  },

  async listSslStatus(): Promise<SslStatus[]> {
    const { statuses } = await apiFetch<{ statuses: SslStatus[] }>('/v1/ssl');
    return statuses;
  },

  async checkSsl(host: string): Promise<SslStatus> {
    const { status } = await apiFetch<{ status: SslStatus }>('/v1/ssl/check', {
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
    const { incidents } = await apiFetch<{ incidents: Incident[] }>(
      `/v1/incidents?${params.toString()}`,
    );
    return incidents;
  },

  async getIncident(id: string): Promise<IncidentDetail> {
    return await apiFetch<IncidentDetail>(`/v1/incidents/${encodeURIComponent(id)}`);
  },

  async incidentMetrics(days = 30): Promise<IncidentMetrics> {
    return await apiFetch<IncidentMetrics>(`/v1/incidents/metrics?days=${days}`);
  },

  async acknowledgeIncident(id: string): Promise<Incident> {
    const { incident } = await apiFetch<{ incident: Incident }>(
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
  ): Promise<{ incident: Incident; suppression: AlertSuppression | null }> {
    return apiFetch<{ incident: Incident; suppression: AlertSuppression | null }>(
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

  async listSuppressions(includeInactive = false): Promise<AlertSuppression[]> {
    const { suppressions } = await apiFetch<{ suppressions: AlertSuppression[] }>(
      `/v1/incidents/suppressions${includeInactive ? '?all=1' : ''}`,
    );
    return suppressions;
  },

  async revokeSuppression(id: string): Promise<AlertSuppression> {
    const { suppression } = await apiFetch<{ suppression: AlertSuppression }>(
      `/v1/incidents/suppressions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    return suppression;
  },

  async listMaintenance(includePast = false): Promise<MaintenanceWindow[]> {
    const { maintenance } = await apiFetch<{ maintenance: MaintenanceWindow[] }>(
      `/v1/incidents/maintenance${includePast ? '?all=1' : ''}`,
    );
    return maintenance;
  },

  async declareMaintenance(input: {
    siteId: string;
    startsAt: string;
    endsAt: string;
    reason: string;
  }): Promise<MaintenanceWindow> {
    const { maintenance } = await apiFetch<{ maintenance: MaintenanceWindow }>(
      '/v1/incidents/maintenance',
      { method: 'POST', body: JSON.stringify(input) },
    );
    return maintenance;
  },

  async cancelMaintenance(id: string): Promise<MaintenanceWindow> {
    const { maintenance } = await apiFetch<{ maintenance: MaintenanceWindow }>(
      `/v1/incidents/maintenance/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    return maintenance;
  },

  async reopenIncident(id: string): Promise<Incident> {
    const { incident } = await apiFetch<{ incident: Incident }>(
      `/v1/incidents/${encodeURIComponent(id)}/reopen`,
      { method: 'POST' },
    );
    return incident;
  },

  /*
    LE RAPPORT MENSUEL.

    Le mois est passé tel quel quand il est fourni, et OMIS sinon — le défaut
    (« le dernier mois complet ») est calculé par le serveur, pas ici. Deux
    calendriers qui décideraient chacun de leur côté quel est « le mois
    dernier » finiraient par se contredire une nuit de changement d'heure ou
    à cheval sur un fuseau, et c'est le document imprimé qui aurait tort.
  */
  async monthlyReport(month?: string): Promise<MonthlyReport> {
    const { report } = await apiFetch<{ report: MonthlyReport }>(
      `/v1/reports/monthly${month ? `?month=${encodeURIComponent(month)}` : ''}`,
    );
    return report;
  },

  async monthlyReportUrl(month?: string): Promise<string> {
    const res = await fetch(
      `${remoteConfig.apiUrl}/v1/reports/monthly.html${month ? `?month=${encodeURIComponent(month)}` : ''}`,
      { headers: { Authorization: `Bearer ${apiCredential()}` } },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`amn-api ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    // Même écriture que le rapport de scan : Electron refuse d'ouvrir une URL
    // `data:`, il faut un fichier dans le répertoire déjà autorisé.
    return writeScanReportFile(await res.text());
  },

  async listSchedules(): Promise<ProductSchedule[]> {
    const { schedules } = await apiFetch<{ schedules: ProductSchedule[] }>('/v1/schedules');
    return schedules;
  },

  async createSchedule(input: CreateScheduleInput): Promise<ProductSchedule> {
    const { schedule } = await apiFetch<{ schedule: ProductSchedule }>('/v1/schedules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return schedule;
  },

  async deleteSchedule(id: string): Promise<void> {
    await apiFetch<{ ok: boolean }>(`/v1/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getOrgOverview(days: number): Promise<OrgOverview> {
    return apiFetch<OrgOverview>(`/v1/sites/overview?days=${encodeURIComponent(String(days))}`);
  },

  async getSiteBadge(siteId: string): Promise<SiteBadge> {
    return apiFetch<SiteBadge>(`/v1/sites/${siteId}/badge`);
  },

  async getSiteStatusPage(siteId: string): Promise<SiteStatusPage> {
    return apiFetch<SiteStatusPage>(`/v1/sites/${siteId}/status-page`);
  },

  async publishSiteStatusPage(siteId: string): Promise<SiteStatusPage> {
    return apiFetch<SiteStatusPage>(`/v1/sites/${siteId}/status-page`, { method: 'POST' });
  },

  async revokeSiteStatusPage(siteId: string): Promise<SiteStatusPage> {
    return apiFetch<SiteStatusPage>(`/v1/sites/${siteId}/status-page`, { method: 'DELETE' });
  },

  async registerSite(name: string): Promise<RegisterSiteResult> {
    return apiFetch<RegisterSiteResult>('/v1/sites', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async updateSite(id: string, name: string): Promise<RemoteSite> {
    const { site } = await apiFetch<{ site: RemoteSite }>(`/v1/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    return site;
  },

  async configureSite(id: string, patch: { tier?: TrackerTier; url?: string | null }): Promise<RemoteSite> {
    const { site } = await apiFetch<{ site: RemoteSite }>(`/v1/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return site;
  },

  async getSiteSummary(id: string, hours = 24): Promise<SiteSummary> {
    return apiFetch<SiteSummary>(`/v1/sites/${id}/summary?hours=${hours}`);
  },

  async getSiteDigest(id: string): Promise<SiteDigest> {
    const { digest } = await apiFetch<{ digest: SiteDigest }>(`/v1/sites/${id}/digest`);
    return digest;
  },

  async deleteSite(id: string): Promise<void> {
    await apiFetch<{ ok: boolean }>(`/v1/sites/${id}`, { method: 'DELETE' });
  },

  async startScan(url: string, tier: ScanTier): Promise<Scan> {
    const { scan } = await apiFetch<{ scan: Scan }>('/v1/scan', {
      method: 'POST',
      body: JSON.stringify({ url, tier }),
    });
    return scan;
  },

  async listScans(): Promise<Scan[]> {
    const { scans } = await apiFetch<{ scans: Scan[] }>('/v1/scans');
    return scans;
  },

  async getScan(id: string): Promise<Scan> {
    const { scan } = await apiFetch<{ scan: Scan }>(`/v1/scans/${encodeURIComponent(id)}`);
    return scan;
  },

  async scanReportUrl(id: string): Promise<string> {
    const res = await fetch(`${remoteConfig.apiUrl}/v1/scans/${encodeURIComponent(id)}/pdf`, {
      headers: { Authorization: `Bearer ${apiCredential()}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`amn-api ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    const html = await res.text();
    return writeScanReportFile(html);
  },

  async startComply(url: string, referential?: string): Promise<ComplyCheck> {
    const { check } = await apiFetch<{ check: ComplyCheck }>('/v1/comply', {
      method: 'POST',
      body: JSON.stringify(referential ? { url, referential } : { url }),
    });
    return check;
  },

  async listComplyReferentials(): Promise<ComplyReferentialCatalog> {
    return apiFetch<ComplyReferentialCatalog>('/v1/comply-referentials');
  },

  async listComplyChecks(): Promise<ComplyCheck[]> {
    const { checks } = await apiFetch<{ checks: ComplyCheck[] }>('/v1/comply-checks');
    return checks;
  },

  async getComplyCheck(id: string): Promise<ComplyCheck> {
    const { check } = await apiFetch<{ check: ComplyCheck }>(
      `/v1/comply-checks/${encodeURIComponent(id)}`,
    );
    return check;
  },
};

/**
 * La console inter-organisations et le contexte client.
 *
 * Chaque appel porte `owner: true` : ces routes sont celles d'AMN DevSec, et
 * elles doivent répondre même quand l'app travaille dans le dossier d'une
 * cliente — c'est depuis ce dossier qu'on suspend, qu'on réémet un accès ou
 * qu'on ressort. amn-api refuse d'ailleurs un jeton de support sur la console,
 * donc oublier ce drapeau se verrait tout de suite : pas de dérive silencieuse.
 */
const adminApi = {
  async listOrganizations(): Promise<AdminOrganization[]> {
    const { organizations } = await apiFetch<{ organizations: AdminOrganization[] }>(
      '/v1/admin/organizations',
      { owner: true },
    );
    return organizations;
  },

  async createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResult> {
    return apiFetch<CreateOrganizationResult>('/v1/admin/organizations', {
      owner: true,
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        plan: input.plan,
        ownerEmail: input.ownerEmail,
        logoDataUrl: input.logoDataUrl || undefined,
        // Le métier et la langue voyagent DÈS la création : les omettre ici
        // les faisait silencieusement disparaître entre l'atelier et l'API.
        trade: input.trade || undefined,
        language: input.language || undefined,
        seats: input.seats || undefined,
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
      trade?: string | null;
      language?: string | null;
      seats?: number | null;
    },
  ): Promise<AdminOrganization> {
    const { organization } = await apiFetch<{ organization: AdminOrganization }>(
      `/v1/admin/organizations/${encodeURIComponent(id)}`,
      { owner: true, method: 'PUT', body: JSON.stringify(patch) },
    );
    return organization;
  },

  async deleteOrganization(id: string, confirm: string) {
    return apiFetch<{
      organization: AdminOrganization;
      removed: { users: number; records: number; sites: number };
    }>(`/v1/admin/organizations/${encodeURIComponent(id)}`, {
      owner: true,
      method: 'DELETE',
      body: JSON.stringify({ confirm }),
    });
  },

  async deleteUser(orgId: string, userId: string): Promise<{ id: string; email: string }> {
    const { user } = await apiFetch<{ user: { id: string; email: string } }>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/users/${encodeURIComponent(userId)}`,
      { owner: true, method: 'DELETE' },
    );
    return user;
  },

  async createUser(orgId: string, input: { email: string; role: 'owner' | 'admin' | 'member' }) {
    return apiFetch<{
      user: AdminOrgUser;
      invitation: { token: string; url: string | null; expiresAt: string };
    }>(`/v1/admin/organizations/${encodeURIComponent(orgId)}/users`, {
      owner: true,
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async setOrganizationPlan(id: string, plan: OrgPlan): Promise<AdminOrganization> {
    const { organization } = await apiFetch<{ organization: AdminOrganization }>(
      `/v1/admin/organizations/${encodeURIComponent(id)}/plan`,
      { owner: true, method: 'PUT', body: JSON.stringify({ plan }) },
    );
    return organization;
  },

  async setOrganizationModule(id: string, key: string, open: boolean): Promise<AdminOrganization> {
    const { organization } = await apiFetch<{ organization: AdminOrganization }>(
      `/v1/admin/organizations/${encodeURIComponent(id)}/modules/${encodeURIComponent(key)}`,
      { owner: true, method: 'PUT', body: JSON.stringify({ open }) },
    );
    return organization;
  },

  async organizationsPage(query: ParcPageQuery): Promise<ParcPage> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    return apiFetch<ParcPage>(`/v1/admin/organizations/page?${params.toString()}`, { owner: true });
  },
  async organizationsSummary(): Promise<ParcSummary> {
    const { summary } = await apiFetch<{ summary: ParcSummary }>('/v1/admin/organizations/summary', { owner: true });
    return summary;
  },
  async organizationDossier(id: string) {
    return apiFetch<{ organization: AdminOrganization; tags: string[]; locks: ModuleLock[] }>(
      `/v1/admin/organizations/${encodeURIComponent(id)}/dossier`,
      { owner: true },
    );
  },
  async setOrganizationTags(id: string, tags: string[]): Promise<string[]> {
    const res = await apiFetch<{ tags: string[] }>(`/v1/admin/organizations/${encodeURIComponent(id)}/tags`, {
      owner: true,
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
    return res.tags;
  },

  async incidentsQueue(query: FleetIncidentsQuery): Promise<FleetIncidentsPage> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    return apiFetch<FleetIncidentsPage>(`/v1/admin/incidents/queue?${params.toString()}`, { owner: true });
  },
  async incidentsSummary(): Promise<SocSummary> {
    const { summary } = await apiFetch<{ summary: SocSummary }>('/v1/admin/incidents/summary', { owner: true });
    return summary;
  },

  async bulk(input: BulkInput): Promise<BulkResult> {
    return apiFetch<BulkResult>('/v1/admin/organizations/bulk', { owner: true, method: 'POST', body: JSON.stringify(input) });
  },

  async resetOrganizationModules(id: string): Promise<AdminOrganization> {
    const { organization } = await apiFetch<{ organization: AdminOrganization }>(
      `/v1/admin/organizations/${encodeURIComponent(id)}/modules`,
      { owner: true, method: 'DELETE' },
    );
    return organization;
  },

  async setOrganizationStatus(id: string, status: OrgStatus): Promise<AdminOrganization> {
    const { organization } = await apiFetch<{ organization: AdminOrganization }>(
      `/v1/admin/organizations/${encodeURIComponent(id)}/status`,
      { owner: true, method: 'PUT', body: JSON.stringify({ status }) },
    );
    return organization;
  },

  async listUsers(orgId: string): Promise<AdminOrgUser[]> {
    const { users } = await apiFetch<{ users: AdminOrgUser[] }>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/users`,
      { owner: true },
    );
    return users;
  },

  async reissueInvitation(orgId: string, email: string): Promise<OrgInvitationResult> {
    return apiFetch<OrgInvitationResult>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/invitations`,
      { owner: true, method: 'POST', body: JSON.stringify({ email }) },
    );
  },

  async resetPassword(orgId: string, userId: string): Promise<TempPasswordResult> {
    return apiFetch<TempPasswordResult>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/users/${encodeURIComponent(userId)}/temp-password`,
      { owner: true, method: 'POST' },
    );
  },

  async accessLog(opts: { orgId?: string; limit?: number } = {}): Promise<OrgAccessEntry[]> {
    const params = new URLSearchParams();
    if (opts.orgId) params.set('org', opts.orgId);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const { entries } = await apiFetch<{ entries: OrgAccessEntry[] }>(
      `/v1/admin/access-log${qs ? `?${qs}` : ''}`,
      { owner: true },
    );
    return entries;
  },

  /**
   * Le pouls d'une cliente — voir OrgPulse dans shared/api.ts.
   *
   * Un appel par organisation affichée : la banderole ne le demande qu'au
   * DÉPLIEMENT, pas au montage de la liste. Précharger le pouls de vingt
   * organisations pour n'en ouvrir qu'une ferait vingt requêtes pour une
   * réponse lue.
   */
  async organizationPulse(orgId: string): Promise<OrgPulse> {
    const { pulse } = await apiFetch<{ pulse: OrgPulse }>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/pulse`,
      { owner: true },
    );
    return pulse;
  },

  /** Les demandes de module des clientes (BLOC 4). */
  async moduleRequests(status?: string): Promise<ModuleRequestForOperator[]> {
    const suffixe = status ? `?status=${encodeURIComponent(status)}` : '';
    const { requests } = await apiFetch<{ requests: ModuleRequestForOperator[] }>(
      `/v1/admin/module-requests${suffixe}`,
      { owner: true },
    );
    return requests ?? [];
  },

  /** Marque une demande traitée. N'ouvre PAS le module — voir le contrat. */
  async resolveModuleRequest(
    id: string,
    input: { status: 'done' | 'declined'; note?: string },
  ): Promise<ModuleRequestForOperator> {
    const { request } = await apiFetch<{ request: ModuleRequestForOperator }>(
      `/v1/admin/module-requests/${encodeURIComponent(id)}`,
      { owner: true, method: 'PUT', body: JSON.stringify({ status: input.status, note: input.note ?? '' }) },
    );
    return request;
  },

  /** La file des demandes des clientes (Blocs 1, 3, 4). */
  async supportRequests(status?: string): Promise<SupportRequestForOperator[]> {
    const suffixe = status ? `?status=${encodeURIComponent(status)}` : '';
    const { requests } = await apiFetch<{ requests: SupportRequestForOperator[] }>(
      `/v1/admin/support-requests${suffixe}`,
      { owner: true },
    );
    return requests ?? [];
  },

  async answerSupportRequest(
    id: string,
    input: { status: 'answered' | 'closed'; reply?: string },
  ): Promise<SupportRequestForOperator> {
    const { request } = await apiFetch<{ request: SupportRequestForOperator }>(
      `/v1/admin/support-requests/${encodeURIComponent(id)}`,
      { owner: true, method: 'PUT', body: JSON.stringify(input) },
    );
    return request;
  },

  async inputAlerts(opts: { limit?: number; orgId?: string } = {}): Promise<InputAlert[]> {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.orgId) params.set('org', opts.orgId);
    const qs = params.toString();
    const { alerts } = await apiFetch<{ alerts: InputAlert[] }>(`/v1/admin/input-alerts${qs ? `?${qs}` : ''}`, { owner: true });
    return alerts ?? [];
  },

  async createWelcomeLink(orgId: string, userId: string): Promise<WelcomeLinkIssued> {
    return apiFetch<WelcomeLinkIssued>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/welcome-links`,
      { owner: true, method: 'POST', body: JSON.stringify({ userId }) },
    );
  },

  async listWelcomeLinks(orgId: string): Promise<AdminWelcomeLink[]> {
    const { links } = await apiFetch<{ links: AdminWelcomeLink[] }>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/welcome-links`,
      { owner: true },
    );
    return links ?? [];
  },

  async revokeWelcomeLink(orgId: string, linkId: string): Promise<void> {
    await apiFetch<{ ok: boolean }>(
      `/v1/admin/organizations/${encodeURIComponent(orgId)}/welcome-links/${encodeURIComponent(linkId)}`,
      { owner: true, method: 'DELETE' },
    );
  },

  /** L'état réel des rondes de supervision de fond (BLOC F). */
  async supervision(): Promise<SupervisionState> {
    return apiFetch<SupervisionState>('/v1/admin/supervision', { owner: true });
  },

  /** Le relevé du parc : activité réelle et connexions ouvertes (BLOCS E, F). */
  async insights(): Promise<ParcInsights> {
    return apiFetch<ParcInsights>('/v1/admin/insights', { owner: true });
  },

  async downloadLink(orgId?: string): Promise<DownloadLink> {
    return apiFetch<DownloadLink>('/v1/admin/download-links', {
      owner: true,
      method: 'POST',
      body: JSON.stringify(orgId ? { orgId } : {}),
    });
  },

  async releases(): Promise<{ releases: BusinessRelease[]; current: BusinessRelease | null }> {
    return apiFetch<{ releases: BusinessRelease[]; current: BusinessRelease | null }>(
      '/v1/admin/releases',
      { owner: true },
    );
  },
};

/** Le contexte décrit par amn-api lui-même, pas par l'app. */
function contextFrom(
  organization: AdminOrganization | (OrgIdentity & { status?: OrgStatus }),
  actorEmail: string,
  expiresAt: string,
  locks: string[] = [],
): SupportContext {
  return {
    locks,
    orgId: organization.id,
    orgName: organization.name,
    plan: organization.plan,
    status: (organization as AdminOrganization).status ?? 'active',
    logoDataUrl: organization.logoDataUrl ?? null,
    // Modules et accent de l'organisation : oubliés à l'origine, ce qui
    // faisait retomber tout contexte de support sur « tous les modules » et
    // sur la couleur par défaut, quel que soit le réglage réel de la
    // cliente — voir le correctif du bug d'accent qui n'apparaissait pas.
    modules: organization.modules ?? null,
    accent: organization.accent ?? null,
    actorEmail,
    expiresAt,
  };
}

function supportApi(remote: RemoteApiClient) {
  return {
    async enter(orgId: string): Promise<SupportSession> {
      const created = await apiFetch<{
        token: string;
        expiresAt: string;
        organization: AdminOrganization;
        locks?: ModuleLock[];
      }>(`/v1/admin/organizations/${encodeURIComponent(orgId)}/support-session`, {
        owner: true,
        method: 'POST',
      });
      remote.applySupportToken(created.token);
      // L'identité du porteur vient d'amn-api, pas de ce qu'on croit savoir :
      // c'est la même source que celle qui alimentera le bandeau au prochain
      // démarrage, donc les deux chemins ne peuvent pas diverger.
      const me = await apiFetch<{ support: { actorEmail: string } | null }>('/v1/auth/me');
      return {
        token: created.token,
        context: contextFrom(created.organization, me.support?.actorEmail ?? '', created.expiresAt, (created.locks ?? []).map((l) => l.module)),
      };
    },

    /**
     * Revalide un jeton conservé au démarrage. C'est LE chemin qui fait tenir la
     * promesse du bandeau : après un redémarrage, l'app doit soit rouvrir le
     * contexte client tel quel, soit revenir franchement à AMN DevSec — jamais
     * afficher des écrans clients sans le bandeau qui les explique.
     */
    async restore(token: string): Promise<SupportContext | null> {
      if (!token) return null;
      const previous = remoteConfig.supportToken;
      remoteConfig.supportToken = token;
      try {
        const me = await apiFetch<{
          org: (OrgIdentity & { status?: OrgStatus }) | null;
          support: { orgId: string; orgName: string; actorEmail: string } | null;
          locks?: ModuleLock[];
        }>('/v1/auth/me');
        if (!me.support || !me.org) throw new Error('jeton hors contexte client');
        remote.applySupportToken(token);
        // `expiresAt` n'est pas rendu par /v1/auth/me : amn-api tranche de
        // toute façon à chaque appel, et une date approximative affichée dans
        // le bandeau vaudrait moins que pas de date du tout.
        return contextFrom(me.org, me.support.actorEmail, '', (me.locks ?? []).map((l) => l.module));
      } catch {
        remoteConfig.supportToken = previous;
        return null;
      }
    },

    async leave(token: string): Promise<void> {
      // On referme côté serveur AVANT de revenir : si l'appel échoue, le jeton
      // expirera de lui-même dans l'heure, mais l'app, elle, doit sortir dans
      // tous les cas — rester coincée dans le dossier d'une cliente parce que
      // le réseau a hoqueté serait le pire des deux mondes.
      await apiFetch<{ ok: boolean }>('/v1/admin/support-session', {
        owner: true,
        method: 'DELETE',
        body: JSON.stringify({ token }),
      }).catch(() => undefined);
      remote.applySupportToken(null);
    },
  };
}

/**
 * Enregistre les canaux IPC des produits exclusifs et relaie leurs poussées
 * temps réel. Appelé par `registerIpcHandlers` — et remplacé par une fonction
 * vide dans l'édition Business.
 */
export function registerExclusiveIpc(
  ipcMain: Electron.IpcMain,
  remote: RemoteApiClient,
  broadcastToAll: (channel: string, payload: unknown) => void,
): void {
  ipcMain.handle(IPC.remoteListSites, () => exclusiveApi.listSites());
  ipcMain.handle(
    IPC.remoteSiteEvents,
    (_event, payload: { siteId: string; opts?: { since?: string; limit?: number } }) =>
      exclusiveApi.getSiteEvents(payload.siteId, payload.opts),
  );
  ipcMain.handle(IPC.remoteRegisterSite, (_event, name: string) => exclusiveApi.registerSite(name));
  ipcMain.handle(IPC.remoteUpdateSite, (_event, { id, name }: { id: string; name: string }) =>
    exclusiveApi.updateSite(id, name),
  );
  ipcMain.handle(IPC.remoteDeleteSite, (_event, id: string) => exclusiveApi.deleteSite(id));
  ipcMain.handle(
    IPC.remoteConfigureSite,
    (_event, payload: { id: string; patch: { tier?: TrackerTier; url?: string | null } }) =>
      exclusiveApi.configureSite(payload.id, payload.patch),
  );
  ipcMain.handle(
    IPC.remoteSiteSummary,
    (_event, payload: { id: string; hours?: number }) =>
      exclusiveApi.getSiteSummary(payload.id, payload.hours),
  );
  ipcMain.handle(IPC.remoteSiteDigest, (_event, id: string) => exclusiveApi.getSiteDigest(id));
  ipcMain.handle(IPC.remoteListIncidents, (_e, options) => exclusiveApi.listIncidents(options ?? {}));
  ipcMain.handle(IPC.remoteGetIncident, (_e, id: string) => exclusiveApi.getIncident(id));
  ipcMain.handle(IPC.remoteIncidentMetrics, (_e, days?: number) => exclusiveApi.incidentMetrics(days));
  ipcMain.handle(IPC.remoteAcknowledgeIncident, (_e, id: string) => exclusiveApi.acknowledgeIncident(id));
  ipcMain.handle(IPC.remoteResolveIncident, (_e, id: string, resolution, note?: string, suppress?: { kind: string }) =>
    exclusiveApi.resolveIncident(id, resolution, note, suppress));
  ipcMain.handle(IPC.remoteListMaintenance, (_e, tout?: boolean) => exclusiveApi.listMaintenance(tout));
  ipcMain.handle(IPC.remoteDeclareMaintenance, (_e, input: Parameters<typeof exclusiveApi.declareMaintenance>[0]) =>
    exclusiveApi.declareMaintenance(input));
  ipcMain.handle(IPC.remoteCancelMaintenance, (_e, id: string) => exclusiveApi.cancelMaintenance(id));
  ipcMain.handle(IPC.remoteListSuppressions, (_e, tout?: boolean) => exclusiveApi.listSuppressions(tout));
  ipcMain.handle(IPC.remoteRevokeSuppression, (_e, id: string) => exclusiveApi.revokeSuppression(id));
  ipcMain.handle(IPC.remoteReopenIncident, (_e, id: string) => exclusiveApi.reopenIncident(id));
  ipcMain.handle(IPC.remoteMonthlyReport, (_e, month?: string) => exclusiveApi.monthlyReport(month));
  ipcMain.handle(IPC.remoteMonthlyReportUrl, (_e, month?: string) => exclusiveApi.monthlyReportUrl(month));
  ipcMain.handle(IPC.remoteListSslStatus, () => exclusiveApi.listSslStatus());
  ipcMain.handle(IPC.remoteCheckSsl, (_event, host: string) => exclusiveApi.checkSsl(host));
  ipcMain.handle(IPC.remoteListSchedules, () => exclusiveApi.listSchedules());
  ipcMain.handle(IPC.remoteCreateSchedule, (_event, input: CreateScheduleInput) =>
    exclusiveApi.createSchedule(input),
  );
  ipcMain.handle(IPC.remoteDeleteSchedule, (_event, id: string) => exclusiveApi.deleteSchedule(id));
  ipcMain.handle(IPC.remoteGetOrgOverview, (_event, days: number) => exclusiveApi.getOrgOverview(days));
  ipcMain.handle(IPC.remoteGetSiteBadge, (_event, siteId: string) => exclusiveApi.getSiteBadge(siteId));
  ipcMain.handle(IPC.remoteGetSiteStatusPage, (_e, siteId: string) => exclusiveApi.getSiteStatusPage(siteId));
  ipcMain.handle(IPC.remotePublishSiteStatusPage, (_e, siteId: string) => exclusiveApi.publishSiteStatusPage(siteId));
  ipcMain.handle(IPC.remoteRevokeSiteStatusPage, (_e, siteId: string) => exclusiveApi.revokeSiteStatusPage(siteId));
  ipcMain.handle(IPC.remoteStartScan, (_event, payload: { url: string; tier: ScanTier }) =>
    exclusiveApi.startScan(payload.url, payload.tier),
  );
  ipcMain.handle(IPC.remoteListScans, () => exclusiveApi.listScans());
  ipcMain.handle(IPC.remoteGetScan, (_event, id: string) => exclusiveApi.getScan(id));
  ipcMain.handle(IPC.remoteScanReportUrl, (_event, id: string) => exclusiveApi.scanReportUrl(id));
  // Console AMN DevSec + contexte client. Absents de l'édition Business : une
  // cliente n'a pas de console d'organisations, et surtout pas de moyen d'en
  // ouvrir une — ces canaux n'existent tout simplement pas chez elle.
  const support = supportApi(remote);
  ipcMain.handle(IPC.remoteAdminListOrgs, () => adminApi.listOrganizations());
  ipcMain.handle(IPC.remoteAdminCreateOrg, (_event, input: CreateOrganizationInput) =>
    adminApi.createOrganization(input),
  );
  ipcMain.handle(
    IPC.remoteAdminUpdateOrg,
    (_event, payload: { id: string; patch: { name?: string; logoDataUrl?: string | null } }) =>
      adminApi.updateOrganization(payload.id, payload.patch),
  );
  ipcMain.handle(
    IPC.remoteAdminSetOrgPlan,
    (_event, payload: { id: string; plan: OrgPlan }) =>
      adminApi.setOrganizationPlan(payload.id, payload.plan),
  );
  ipcMain.handle(
    IPC.remoteAdminSetOrgModule,
    (_event, payload: { id: string; key: string; open: boolean }) =>
      adminApi.setOrganizationModule(payload.id, payload.key, payload.open),
  );
  ipcMain.handle(IPC.remoteAdminResetOrgModules, (_event, id: string) => adminApi.resetOrganizationModules(id));
  ipcMain.handle(IPC.remoteAdminOrgsPage, (_event, query: ParcPageQuery) => adminApi.organizationsPage(query));
  ipcMain.handle(IPC.remoteAdminOrgsSummary, () => adminApi.organizationsSummary());
  ipcMain.handle(IPC.remoteAdminOrgDossier, (_event, id: string) => adminApi.organizationDossier(id));
  ipcMain.handle(IPC.remoteAdminBulk, (_event, input: BulkInput) => adminApi.bulk(input));
  ipcMain.handle(IPC.remoteAdminIncidentsQueue, (_event, query: FleetIncidentsQuery) => adminApi.incidentsQueue(query));
  ipcMain.handle(IPC.remoteAdminIncidentsSummary, () => adminApi.incidentsSummary());
  ipcMain.handle(IPC.remoteAdminSetOrgTags, (_event, payload: { id: string; tags: string[] }) => adminApi.setOrganizationTags(payload.id, payload.tags));
  ipcMain.handle(
    IPC.remoteAdminSetOrgStatus,
    (_event, payload: { id: string; status: OrgStatus }) =>
      adminApi.setOrganizationStatus(payload.id, payload.status),
  );
  ipcMain.handle(
    IPC.remoteAdminDeleteOrg,
    (_event, payload: { id: string; confirm: string }) =>
      adminApi.deleteOrganization(payload.id, payload.confirm),
  );
  ipcMain.handle(IPC.remoteAdminListUsers, (_event, orgId: string) => adminApi.listUsers(orgId));
  ipcMain.handle(
    IPC.remoteAdminCreateUser,
    (_event, payload: { orgId: string; input: { email: string; role: 'owner' | 'admin' | 'member' } }) =>
      adminApi.createUser(payload.orgId, payload.input),
  );
  ipcMain.handle(
    IPC.remoteAdminDeleteUser,
    (_event, payload: { orgId: string; userId: string }) =>
      adminApi.deleteUser(payload.orgId, payload.userId),
  );
  ipcMain.handle(
    IPC.remoteAdminReissueInvitation,
    (_event, payload: { orgId: string; email: string }) =>
      adminApi.reissueInvitation(payload.orgId, payload.email),
  );
  ipcMain.handle(
    IPC.remoteAdminResetPassword,
    (_event, payload: { orgId: string; userId: string }) =>
      adminApi.resetPassword(payload.orgId, payload.userId),
  );
  ipcMain.handle(IPC.remoteAdminAccessLog, (_event, opts: { orgId?: string; limit?: number }) =>
    adminApi.accessLog(opts ?? {}),
  );
  ipcMain.handle(IPC.remoteAdminModuleRequests, (_event, status?: string) =>
    adminApi.moduleRequests(status),
  );
  ipcMain.handle(
    IPC.remoteAdminResolveModuleRequest,
    (_event, payload: { id: string; input: { status: 'done' | 'declined'; note?: string } }) =>
      adminApi.resolveModuleRequest(payload.id, payload.input),
  );
  ipcMain.handle(IPC.remoteAdminOrgPulse, (_event, orgId: string) =>
    adminApi.organizationPulse(orgId),
  );
  ipcMain.handle(IPC.remoteAdminSupportRequests, (_event, status?: string) =>
    adminApi.supportRequests(status),
  );
  ipcMain.handle(
    IPC.remoteAdminAnswerSupportRequest,
    (_event, payload: { id: string; input: { status: 'answered' | 'closed'; reply?: string } }) =>
      adminApi.answerSupportRequest(payload.id, payload.input),
  );
  ipcMain.handle(IPC.remoteAdminWelcomeLinkCreate, (_event, payload: { orgId: string; userId: string }) =>
    adminApi.createWelcomeLink(payload.orgId, payload.userId),
  );
  ipcMain.handle(IPC.remoteAdminInputAlerts, (_event, opts?: { limit?: number; orgId?: string }) =>
    adminApi.inputAlerts(opts ?? {}),
  );
  ipcMain.handle(IPC.remoteAdminWelcomeLinkList, (_event, orgId: string) => adminApi.listWelcomeLinks(orgId));
  ipcMain.handle(IPC.remoteAdminWelcomeLinkRevoke, (_event, payload: { orgId: string; linkId: string }) =>
    adminApi.revokeWelcomeLink(payload.orgId, payload.linkId),
  );
  ipcMain.handle(IPC.remoteAdminSupervision, () => adminApi.supervision());
  ipcMain.handle(IPC.remoteAdminInsights, () => adminApi.insights());
  ipcMain.handle(IPC.remoteAdminDownloadLink, (_event, orgId?: string) =>
    adminApi.downloadLink(orgId),
  );
  ipcMain.handle(IPC.remoteAdminReleases, () => adminApi.releases());
  ipcMain.handle(IPC.remoteSupportEnter, (_event, orgId: string) => support.enter(orgId));
  ipcMain.handle(IPC.remoteSupportRestore, (_event, token: string) => support.restore(token));
  ipcMain.handle(IPC.remoteSupportLeave, (_event, token: string) => support.leave(token));

  ipcMain.handle(IPC.remoteStartComply, (_event, url: string, referential?: string) =>
    exclusiveApi.startComply(url, referential),
  );
  ipcMain.handle(IPC.remoteListComplyReferentials, () => exclusiveApi.listComplyReferentials());
  ipcMain.handle(IPC.remoteListComplyChecks, () => exclusiveApi.listComplyChecks());
  ipcMain.handle(IPC.remoteGetComplyCheck, (_event, id: string) => exclusiveApi.getComplyCheck(id));

  // Veille RSS et modèle local Ollama : les deux n'alimentent que l'assistant
  // Ajmani et le bandeau de veille, qui n'existent pas dans l'édition Business.
  // Préchauffe le cache de veille en arrière-plan. Appelé ici plutôt que dans
  // main.ts : c'est le seul endroit qui sait que la veille existe dans cette
  // édition, et main.ts n'a donc plus de raison d'importer le module.
  warmWatch();
  ipcMain.handle(IPC.watchList, () => getWatch());
  ipcMain.handle(IPC.watchRefresh, () => getWatch(true));
  ipcMain.handle(IPC.ollamaStatus, () => ollamaStatus());
  ipcMain.handle(
    IPC.ollamaChat,
    (_event, input: { model: string; system: string; prompt: string }) => ollamaChat(input),
  );

  // Trames temps réel des produits exclusifs. Leurs NOMS sont déclarés ici, et
  // pas dans le client de transport : c'est ce qui les fait disparaître du
  // bundle Business en même temps que le reste.
  remote.onEvent((push) => broadcastToAll(IPC.remoteEventPush, push));
  remote.onFrame('scan:progress', (frame) =>
    broadcastToAll(IPC.remoteScanProgressPush, frame.progress as ScanProgress),
  );
  remote.onFrame('comply:progress', (frame) =>
    broadcastToAll(IPC.remoteComplyProgressPush, frame.progress as ComplyProgress),
  );
  // L'escalade d'un incident : « personne n'a regardé depuis dix minutes ».
  remote.onFrame('incident:escalated', (frame) =>
    broadcastToAll(IPC.remoteIncidentEscalationPush, frame as unknown as IncidentEscalation),
  );
  remote.onFrame('security:input', (frame) =>
    broadcastToAll(IPC.remoteInputAlertPush, frame.alert as unknown as InputAlert),
  );
  remote.onFrame('support:request', (frame) =>
    broadcastToAll(IPC.remoteSupportRequestPush, frame.request as unknown as SupportRequestForOperator),
  );
  remote.onFrame('org:changed', (frame) => broadcastToAll(IPC.remoteOrgChangedPush, frame as unknown as OrgChange));
  remote.onFrame('product:regression', (frame) =>
    broadcastToAll(IPC.remoteProductRegressionPush, frame as unknown as ProductRegression),
  );
}

import {
  IPC,
  type AdminOrganization,
  type AdminOrgUser,
  type CreateOrganizationInput,
  type CreateOrganizationResult,
  type OrgAccessEntry,
  type OrgIdentity,
  type OrgInvitationResult,
  type OrgStatus,
  type SupportContext,
  type SupportSession,
  type TempPasswordResult,
  type CallSignal,
  type ComplyCheck,
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
  type SiteDigest,
  type SiteSummary,
  type SslStatus,
  type Scan,
  type OutgoingCallSignal,
  type TrackerTier,
} from '../shared/api';
import { apiCredential, remoteConfig } from './remoteConfig';
import { apiFetch, type RemoteApiClient } from './remoteApi';
import { writeScanReportFile } from './scanReports';
import { getWatch, warmWatch } from './watch';
import { ollamaChat, ollamaStatus } from './ollama';

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

  async startComply(url: string): Promise<ComplyCheck> {
    const { check } = await apiFetch<{ check: ComplyCheck }>('/v1/comply', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    return check;
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
  ): Promise<AdminOrganization> {
    const { organization } = await apiFetch<{ organization: AdminOrganization }>(
      `/v1/admin/organizations/${encodeURIComponent(id)}`,
      { owner: true, method: 'PUT', body: JSON.stringify(patch) },
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
};

/** Le contexte décrit par amn-api lui-même, pas par l'app. */
function contextFrom(
  organization: AdminOrganization | (OrgIdentity & { status?: OrgStatus }),
  actorEmail: string,
  expiresAt: string,
): SupportContext {
  return {
    orgId: organization.id,
    orgName: organization.name,
    plan: organization.plan,
    status: (organization as AdminOrganization).status ?? 'active',
    logoDataUrl: organization.logoDataUrl ?? null,
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
        context: contextFrom(created.organization, me.support?.actorEmail ?? '', created.expiresAt),
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
        }>('/v1/auth/me');
        if (!me.support || !me.org) throw new Error('jeton hors contexte client');
        remote.applySupportToken(token);
        // `expiresAt` n'est pas rendu par /v1/auth/me : amn-api tranche de
        // toute façon à chaque appel, et une date approximative affichée dans
        // le bandeau vaudrait moins que pas de date du tout.
        return contextFrom(me.org, me.support.actorEmail, '');
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
  ipcMain.handle(IPC.remoteListSslStatus, () => exclusiveApi.listSslStatus());
  ipcMain.handle(IPC.remoteCheckSsl, (_event, host: string) => exclusiveApi.checkSsl(host));
  ipcMain.handle(IPC.remoteListSchedules, () => exclusiveApi.listSchedules());
  ipcMain.handle(IPC.remoteCreateSchedule, (_event, input: CreateScheduleInput) =>
    exclusiveApi.createSchedule(input),
  );
  ipcMain.handle(IPC.remoteDeleteSchedule, (_event, id: string) => exclusiveApi.deleteSchedule(id));
  ipcMain.handle(IPC.remoteGetOrgOverview, (_event, days: number) => exclusiveApi.getOrgOverview(days));
  ipcMain.handle(IPC.remoteGetSiteBadge, (_event, siteId: string) => exclusiveApi.getSiteBadge(siteId));
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
    IPC.remoteAdminSetOrgStatus,
    (_event, payload: { id: string; status: OrgStatus }) =>
      adminApi.setOrganizationStatus(payload.id, payload.status),
  );
  ipcMain.handle(IPC.remoteAdminListUsers, (_event, orgId: string) => adminApi.listUsers(orgId));
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
  ipcMain.handle(IPC.remoteSupportEnter, (_event, orgId: string) => support.enter(orgId));
  ipcMain.handle(IPC.remoteSupportRestore, (_event, token: string) => support.restore(token));
  ipcMain.handle(IPC.remoteSupportLeave, (_event, token: string) => support.leave(token));

  ipcMain.handle(IPC.remoteStartComply, (_event, url: string) => exclusiveApi.startComply(url));
  ipcMain.handle(IPC.remoteListComplyChecks, () => exclusiveApi.listComplyChecks());
  ipcMain.handle(IPC.remoteGetComplyCheck, (_event, id: string) => exclusiveApi.getComplyCheck(id));
  // Appels audio : la signalisation ne vaut qu'à plusieurs dans une même
  // organisation, donc elle part avec le reste dans l'édition Business.
  ipcMain.handle(IPC.remoteSendCallSignal, (_event, signal: OutgoingCallSignal) =>
    remote.sendFrame({
      type: 'signal',
      to: signal.to,
      kind: signal.kind,
      callId: signal.callId,
      payload: signal.payload ?? null,
    }),
  );

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
  remote.onFrame('product:regression', (frame) =>
    broadcastToAll(IPC.remoteProductRegressionPush, frame as unknown as ProductRegression),
  );
  remote.onFrame('signal', (frame) =>
    broadcastToAll(IPC.remoteCallSignalPush, frame as unknown as CallSignal),
  );
  // « Personne n'écoutait » est sa propre nature de signal côté renderer : il
  // permet de terminer l'appel sur « hors ligne » plutôt que d'attendre le
  // délai de garde.
  remote.onFrame('signal:undelivered', (frame) =>
    broadcastToAll(IPC.remoteCallSignalPush, {
      type: 'signal',
      kind: 'undelivered',
      callId: String(frame.callId ?? ''),
      from: String(frame.to ?? ''),
      payload: { kind: String(frame.kind ?? '') },
    } satisfies CallSignal),
  );
}

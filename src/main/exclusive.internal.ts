import {
  IPC,
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
  ipcMain.handle(IPC.remoteStartComply, (_event, url: string) => exclusiveApi.startComply(url));
  ipcMain.handle(IPC.remoteListComplyChecks, () => exclusiveApi.listComplyChecks());
  ipcMain.handle(IPC.remoteGetComplyCheck, (_event, id: string) => exclusiveApi.getComplyCheck(id));
  // Appels audio : la signalisation ne vaut qu'à plusieurs dans une même
  // organisation, donc elle part avec le reste dans l'édition Business.
  ipcMain.handle(IPC.remoteSendCallSignal, (_event, signal: OutgoingCallSignal) =>
    remote.sendSignal(signal),
  );

  remote.onEvent((push) => broadcastToAll(IPC.remoteEventPush, push));
  remote.onSignal((signal: unknown) => broadcastToAll(IPC.remoteCallSignalPush, signal));
  remote.onProductRegression((r: ProductRegression) =>
    broadcastToAll(IPC.remoteProductRegressionPush, r),
  );
  remote.onScanProgress((progress: ScanProgress) =>
    broadcastToAll(IPC.remoteScanProgressPush, progress),
  );
  remote.onComplyProgress((progress: ComplyProgress) =>
    broadcastToAll(IPC.remoteComplyProgressPush, progress),
  );
}

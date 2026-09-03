import { ipcRenderer } from 'electron';
import {
  IPC,
  type IncidentEscalation,
  type IncidentResolution,
  type IncidentStatus,
  type AmnBridge,
  type ComplyProgress,
  type CreateScheduleInput,
  type ProductRegression,
  type RemoteEventPush,
  type ScanProgress,
  type ScanTier,
  type TrackerTier,
  OrgChange,
} from './shared/api';
import type { SupportRequestForOperator, InputAlert } from './shared/api';

/**
 * La part exclusive du pont : les canaux IPC des produits d'AMN DevSec (parc
 * de sites, Scanner, Comply, SSL Monitor, analyses récurrentes, bureau SOC) et
 * la signalisation des appels audio.
 *
 * Étalée dans `bridge.remote` par `src/preload.ts`. L'édition Business résout
 * `@edition/preloadExclusive` vers la variante vide : `window.amn.remote` n'y
 * expose alors aucune de ces méthodes — le pont lui-même ne les connaît pas.
 */
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
  | 'listMaintenance'
  | 'declareMaintenance'
  | 'cancelMaintenance'
  | 'monthlyReport'
  | 'monthlyReportUrl'
  | 'onIncidentEscalation'
  | 'listSchedules'
  | 'createSchedule'
  | 'deleteSchedule'
  | 'onProductRegression'
  | 'onSupportRequest'
  | 'onOrgChanged'
  | 'onInputAlert'
  | 'getOrgOverview'
  | 'getSiteBadge'
  | 'getSiteStatusPage'
  | 'publishSiteStatusPage'
  | 'revokeSiteStatusPage'
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
  // Console des organisations clientes et contexte client : hors de l'édition
  // Business par construction — une cliente n'a pas d'organisations à gérer, et
  // ne doit surtout pas disposer du canal qui en ouvrirait une.
  | 'admin'
  | 'support'
>;

/** Part exclusive du pont hors `remote` : veille RSS et modèle local. */
export const exclusiveBridge: Pick<AmnBridge, 'watch' | 'ollama'> = {
  watch: {
    list: () => ipcRenderer.invoke(IPC.watchList),
    refresh: () => ipcRenderer.invoke(IPC.watchRefresh),
  },
  ollama: {
    status: () => ipcRenderer.invoke(IPC.ollamaStatus),
    chat: (input: { model: string; system: string; prompt: string }) =>
      ipcRenderer.invoke(IPC.ollamaChat, input),
  },
};

export const exclusivePreload: ExclusiveRemote = {
  listSites: () => ipcRenderer.invoke(IPC.remoteListSites),
  getSiteEvents: (siteId, opts) =>
    ipcRenderer.invoke(IPC.remoteSiteEvents, { siteId, opts }),
  registerSite: (name: string) => ipcRenderer.invoke(IPC.remoteRegisterSite, name),
  updateSite: (id: string, name: string) => ipcRenderer.invoke(IPC.remoteUpdateSite, { id, name }),
  deleteSite: (id: string) => ipcRenderer.invoke(IPC.remoteDeleteSite, id),
  configureSite: (id: string, patch: { tier?: TrackerTier; url?: string | null }) =>
    ipcRenderer.invoke(IPC.remoteConfigureSite, { id, patch }),
  getSiteSummary: (id: string, hours?: number) =>
    ipcRenderer.invoke(IPC.remoteSiteSummary, { id, hours }),
  getSiteDigest: (id: string) => ipcRenderer.invoke(IPC.remoteSiteDigest, id),
  onEvent: (callback: (push: RemoteEventPush) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, push: RemoteEventPush) =>
      callback(push);
    ipcRenderer.on(IPC.remoteEventPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteEventPush, listener);
  },
  listIncidents: (options?: {
    status?: 'open' | 'all' | IncidentStatus;
    siteId?: string;
    suppressed?: 'exclus' | 'seuls' | 'tous';
  }) =>
    ipcRenderer.invoke(IPC.remoteListIncidents, options ?? {}),
  getIncident: (id: string) => ipcRenderer.invoke(IPC.remoteGetIncident, id),
  incidentMetrics: (days?: number) => ipcRenderer.invoke(IPC.remoteIncidentMetrics, days),
  acknowledgeIncident: (id: string) => ipcRenderer.invoke(IPC.remoteAcknowledgeIncident, id),
  resolveIncident: (id: string, resolution: IncidentResolution, note?: string, suppress?: { kind: string }) =>
    ipcRenderer.invoke(IPC.remoteResolveIncident, id, resolution, note, suppress),
  listMaintenance: (tout?: boolean) => ipcRenderer.invoke(IPC.remoteListMaintenance, tout),
  declareMaintenance: (input: { siteId: string; startsAt: string; endsAt: string; reason: string }) =>
    ipcRenderer.invoke(IPC.remoteDeclareMaintenance, input),
  cancelMaintenance: (id: string) => ipcRenderer.invoke(IPC.remoteCancelMaintenance, id),
  listSuppressions: (tout?: boolean) => ipcRenderer.invoke(IPC.remoteListSuppressions, tout),
  revokeSuppression: (id: string) => ipcRenderer.invoke(IPC.remoteRevokeSuppression, id),
  reopenIncident: (id: string) => ipcRenderer.invoke(IPC.remoteReopenIncident, id),
  monthlyReport: (month?: string) => ipcRenderer.invoke(IPC.remoteMonthlyReport, month),
  monthlyReportUrl: (month?: string) => ipcRenderer.invoke(IPC.remoteMonthlyReportUrl, month),
  onIncidentEscalation: (callback: (escalation: IncidentEscalation) => void) => {
    const listener = (_e: unknown, payload: IncidentEscalation) => callback(payload);
    ipcRenderer.on(IPC.remoteIncidentEscalationPush, listener);
    // Le désabonnement rend `void` : `removeListener` rend l'émetteur, ce qui
    // ne correspond pas au contrat et ferait fuir un détail d'Electron
    // jusqu'au renderer.
    return () => {
      ipcRenderer.removeListener(IPC.remoteIncidentEscalationPush, listener);
    };
  },
  listSslStatus: () => ipcRenderer.invoke(IPC.remoteListSslStatus),
  checkSsl: (host: string) => ipcRenderer.invoke(IPC.remoteCheckSsl, host),
  listSchedules: () => ipcRenderer.invoke(IPC.remoteListSchedules),
  createSchedule: (input: CreateScheduleInput) =>
    ipcRenderer.invoke(IPC.remoteCreateSchedule, input),
  deleteSchedule: (id: string) => ipcRenderer.invoke(IPC.remoteDeleteSchedule, id),
  onInputAlert: (callback: (a: InputAlert) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, a: InputAlert) => callback(a);
    ipcRenderer.on(IPC.remoteInputAlertPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteInputAlertPush, listener);
  },
  onSupportRequest: (callback: (r: SupportRequestForOperator) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, r: SupportRequestForOperator) => callback(r);
    ipcRenderer.on(IPC.remoteSupportRequestPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteSupportRequestPush, listener);
  },
  onOrgChanged: (callback: (c: OrgChange) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, c: OrgChange) => callback(c);
    ipcRenderer.on(IPC.remoteOrgChangedPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteOrgChangedPush, listener);
  },
  onProductRegression: (callback: (r: ProductRegression) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, r: ProductRegression) => callback(r);
    ipcRenderer.on(IPC.remoteProductRegressionPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteProductRegressionPush, listener);
  },
  getOrgOverview: (days: number) => ipcRenderer.invoke(IPC.remoteGetOrgOverview, days),
  getSiteBadge: (siteId: string) => ipcRenderer.invoke(IPC.remoteGetSiteBadge, siteId),
  getSiteStatusPage: (siteId: string) => ipcRenderer.invoke(IPC.remoteGetSiteStatusPage, siteId),
  publishSiteStatusPage: (siteId: string) => ipcRenderer.invoke(IPC.remotePublishSiteStatusPage, siteId),
  revokeSiteStatusPage: (siteId: string) => ipcRenderer.invoke(IPC.remoteRevokeSiteStatusPage, siteId),
  startScan: (url: string, tier: ScanTier) => ipcRenderer.invoke(IPC.remoteStartScan, { url, tier }),
  listScans: () => ipcRenderer.invoke(IPC.remoteListScans),
  getScan: (id: string) => ipcRenderer.invoke(IPC.remoteGetScan, id),
  scanReportUrl: (id: string) => ipcRenderer.invoke(IPC.remoteScanReportUrl, id),
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => callback(progress);
    ipcRenderer.on(IPC.remoteScanProgressPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteScanProgressPush, listener);
  },
  admin: {
    listOrganizations: () => ipcRenderer.invoke(IPC.remoteAdminListOrgs),
    createOrganization: (input) => ipcRenderer.invoke(IPC.remoteAdminCreateOrg, input),
    updateOrganization: (id, patch) => ipcRenderer.invoke(IPC.remoteAdminUpdateOrg, { id, patch }),
    setOrganizationStatus: (id, status) =>
      ipcRenderer.invoke(IPC.remoteAdminSetOrgStatus, { id, status }),
    setOrganizationPlan: (id, plan) => ipcRenderer.invoke(IPC.remoteAdminSetOrgPlan, { id, plan }),
    setOrganizationModule: (id, key, open) => ipcRenderer.invoke(IPC.remoteAdminSetOrgModule, { id, key, open }),
    resetOrganizationModules: (id) => ipcRenderer.invoke(IPC.remoteAdminResetOrgModules, id),
    deleteOrganization: (id, confirm) => ipcRenderer.invoke(IPC.remoteAdminDeleteOrg, { id, confirm }),
    listUsers: (orgId) => ipcRenderer.invoke(IPC.remoteAdminListUsers, orgId),
    deleteUser: (orgId, userId) => ipcRenderer.invoke(IPC.remoteAdminDeleteUser, { orgId, userId }),
    createUser: (orgId, input) => ipcRenderer.invoke(IPC.remoteAdminCreateUser, { orgId, input }),
    reissueInvitation: (orgId, email) =>
      ipcRenderer.invoke(IPC.remoteAdminReissueInvitation, { orgId, email }),
    resetPassword: (orgId, userId) =>
      ipcRenderer.invoke(IPC.remoteAdminResetPassword, { orgId, userId }),
    accessLog: (opts) => ipcRenderer.invoke(IPC.remoteAdminAccessLog, opts ?? {}),
    organizationPulse: (orgId) => ipcRenderer.invoke(IPC.remoteAdminOrgPulse, orgId),
    moduleRequests: (status) => ipcRenderer.invoke(IPC.remoteAdminModuleRequests, status),
    resolveModuleRequest: (id, input) =>
      ipcRenderer.invoke(IPC.remoteAdminResolveModuleRequest, { id, input }),
    supportRequests: (status) => ipcRenderer.invoke(IPC.remoteAdminSupportRequests, status),
    answerSupportRequest: (id, input) =>
      ipcRenderer.invoke(IPC.remoteAdminAnswerSupportRequest, { id, input }),
    createWelcomeLink: (orgId, userId) =>
      ipcRenderer.invoke(IPC.remoteAdminWelcomeLinkCreate, { orgId, userId }),
    inputAlerts: (opts) => ipcRenderer.invoke(IPC.remoteAdminInputAlerts, opts ?? {}),
    listWelcomeLinks: (orgId) => ipcRenderer.invoke(IPC.remoteAdminWelcomeLinkList, orgId),
    revokeWelcomeLink: (orgId, linkId) =>
      ipcRenderer.invoke(IPC.remoteAdminWelcomeLinkRevoke, { orgId, linkId }),
    supervision: () => ipcRenderer.invoke(IPC.remoteAdminSupervision),
    insights: () => ipcRenderer.invoke(IPC.remoteAdminInsights),
    downloadLink: (orgId) => ipcRenderer.invoke(IPC.remoteAdminDownloadLink, orgId),
    releases: () => ipcRenderer.invoke(IPC.remoteAdminReleases),
  },
  support: {
    enter: (orgId) => ipcRenderer.invoke(IPC.remoteSupportEnter, orgId),
    restore: (token) => ipcRenderer.invoke(IPC.remoteSupportRestore, token),
    leave: (token) => ipcRenderer.invoke(IPC.remoteSupportLeave, token),
  },
  startComply: (url: string, referential?: string) =>
    ipcRenderer.invoke(IPC.remoteStartComply, url, referential),
  listComplyReferentials: () => ipcRenderer.invoke(IPC.remoteListComplyReferentials),
  listComplyChecks: () => ipcRenderer.invoke(IPC.remoteListComplyChecks),
  getComplyCheck: (id: string) => ipcRenderer.invoke(IPC.remoteGetComplyCheck, id),
  onComplyProgress: (callback: (progress: ComplyProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ComplyProgress) => callback(progress);
    ipcRenderer.on(IPC.remoteComplyProgressPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteComplyProgressPush, listener);
  },
};

import { ipcRenderer } from 'electron';
import {
  IPC,
  type AmnBridge,
  type CallSignal,
  type ComplyProgress,
  type CreateScheduleInput,
  type OutgoingCallSignal,
  type ProductRegression,
  type RemoteEventPush,
  type ScanProgress,
  type ScanTier,
  type TrackerTier,
} from './shared/api';

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
  listSslStatus: () => ipcRenderer.invoke(IPC.remoteListSslStatus),
  checkSsl: (host: string) => ipcRenderer.invoke(IPC.remoteCheckSsl, host),
  listSchedules: () => ipcRenderer.invoke(IPC.remoteListSchedules),
  createSchedule: (input: CreateScheduleInput) =>
    ipcRenderer.invoke(IPC.remoteCreateSchedule, input),
  deleteSchedule: (id: string) => ipcRenderer.invoke(IPC.remoteDeleteSchedule, id),
  onProductRegression: (callback: (r: ProductRegression) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, r: ProductRegression) => callback(r);
    ipcRenderer.on(IPC.remoteProductRegressionPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteProductRegressionPush, listener);
  },
  getOrgOverview: (days: number) => ipcRenderer.invoke(IPC.remoteGetOrgOverview, days),
  getSiteBadge: (siteId: string) => ipcRenderer.invoke(IPC.remoteGetSiteBadge, siteId),
  sendCallSignal: (signal: OutgoingCallSignal) =>
    ipcRenderer.invoke(IPC.remoteSendCallSignal, signal),
  onCallSignal: (callback: (signal: CallSignal) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, signal: CallSignal) => callback(signal);
    ipcRenderer.on(IPC.remoteCallSignalPush, listener);
    return () => ipcRenderer.removeListener(IPC.remoteCallSignalPush, listener);
  },
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
    supervision: () => ipcRenderer.invoke(IPC.remoteAdminSupervision),
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

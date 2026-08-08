/**
 * Contract shared between the Electron main process and the renderer.
 *
 * The renderer never imports Electron or the database directly: it talks to a
 * `bridge` (see src/lib/bridge.ts) whose shape is {@link AmnBridge}. In Electron
 * that bridge is `window.amn` (exposed by the preload script over IPC, backed by
 * SQLite + bcrypt in the main process). In a plain browser — used for headless
 * verification and vanilla `vite` dev — the same interface is fulfilled by a
 * local fallback that still performs real bcrypt verification.
 *
 * This indirection is what lets the same UI run in both environments and makes
 * swapping the local backend for a central API later a one-file change.
 */

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: string;
}

/* ------------------------------ Profiles ------------------------------ */

/**
 * Per-user profile. Shared across both operators (see amn-api profiles
 * collection) so each sees the other's photo and presence text everywhere.
 */
export interface UserProfile {
  email: string;
  name: string;
  /** Data-URL of an uploaded avatar, or '' for initials fallback. */
  photoDataUrl: string;
  /** Short custom presence text, e.g. "en mission chez client". */
  presenceText: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  photoDataUrl?: string;
  presenceText?: string;
}

export interface ChangePasswordInput {
  email: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

/* --------------------------- Notification prefs --------------------------- */

export interface NotificationPrefs {
  siteOffline: boolean;
  criticalAlert: boolean;
  mention: boolean;
  taskAssigned: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  siteOffline: true,
  criticalAlert: true,
  mention: true,
  taskAssigned: true,
};

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isElectron: boolean;
}

/** Local Ollama availability + installed models. */
export interface OllamaStatus {
  available: boolean;
  models: string[];
}

/** A single cyber/tech watch entry, parsed from a public RSS/Atom source. */
export interface WatchItem {
  id: string;
  /** Free-text category (feed-derived), e.g. "Vulnérabilité", "Cybersécurité". */
  category: string;
  /** Top-level grouping used by the UI filter. Absent (old cache) means 'security'. */
  group?: 'security' | 'tech';
  title: string;
  summary: string;
  source: string;
  /** ISO date. */
  date: string;
  /** Canonical article URL, when available. */
  link?: string;
}

/** Result of a watch-feed fetch, with graceful-degradation metadata. */
export interface WatchFeedResult {
  items: WatchItem[];
  /** ISO timestamp of the last successful fetch, or null if never fetched. */
  fetchedAt: string | null;
  /** True when at least one source was unreachable on the last refresh. */
  degraded: boolean;
}

export interface MessageAttachment {
  /**
   * Data-URL of an inline media file. Images are client-side resized before
   * send; short videos and voice notes are embedded as-is (size-capped in the
   * composer). Kept inline so the existing `messages` sync path carries them
   * unchanged — see the composer's size guard.
   */
  dataUrl: string;
  name: string;
  /** Media kind. Absent means 'image' (backwards-compatible with old records). */
  kind?: 'image' | 'video' | 'audio';
  /** Original MIME type, used to pick the right <video>/<audio> source type. */
  mime?: string;
}

export interface MessageReaction {
  emoji: string;
  authorEmail: string;
}

export interface Message {
  id: number;
  authorEmail: string;
  authorName: string;
  body: string;
  /** ISO timestamp */
  createdAt: string;
  attachments: MessageAttachment[];
  /** Id of the message this one replies to, if any. */
  replyToId: number | null;
  reactions: MessageReaction[];
  pinned: boolean;
}

export interface SendMessageInput {
  authorEmail: string;
  body: string;
  attachments?: MessageAttachment[];
  replyToId?: number | null;
}

/** Reaction emoji set — deliberately small and fixed, no full picker. */
export const REACTION_EMOJIS = ['👍', '👀', '✅', '🔥', '❗'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ClientStatus = 'active' | 'paused' | 'prospect';

export interface ClientEvent {
  id: number;
  clientId: number;
  title: string;
  detail: string;
  /** ISO timestamp */
  date: string;
}

export interface Client {
  id: number;
  name: string;
  company: string;
  status: ClientStatus;
  email: string;
  phone: string;
  notes: string;
  /** Data-URL of an uploaded avatar, or empty. */
  imageDataUrl: string;
  /** amn-api site ids supervised for this client — feeds the health score. */
  linkedSiteIds: string[];
  createdAt: string;
  updatedAt: string;
  events: ClientEvent[];
}

export interface CreateClientInput {
  name: string;
  company?: string;
  status?: ClientStatus;
  email?: string;
  phone?: string;
}

export interface UpdateClientInput {
  name?: string;
  company?: string;
  status?: ClientStatus;
  email?: string;
  phone?: string;
  notes?: string;
  imageDataUrl?: string;
  linkedSiteIds?: string[];
}

export interface AddClientEventInput {
  clientId: number;
  title: string;
  detail?: string;
}

/* ------------------------------- Quotes ------------------------------- */

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'late';

export interface Quote {
  id: number;
  clientId: number;
  /** Short mission title, e.g. "Supervision annuelle + audit initial". */
  title: string;
  /** Longer mission description. */
  detail: string;
  /** Tracker catalog offer id (see src/data/trackerCatalog.ts), free text. */
  trackerTier: string;
  priceEuro: number;
  status: QuoteStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteInput {
  clientId: number;
  title: string;
  detail?: string;
  trackerTier: string;
  priceEuro: number;
}

export interface UpdateQuoteInput {
  title?: string;
  detail?: string;
  trackerTier?: string;
  priceEuro?: number;
  status?: QuoteStatus;
  paymentStatus?: PaymentStatus;
}

/* -------------------------------- Tasks -------------------------------- */

export type SharedTaskStatus = 'todo' | 'doing' | 'done';

export interface SharedTask {
  id: number;
  title: string;
  detail: string;
  assigneeEmail: string;
  status: SharedTaskStatus;
  siteId: string | null;
  clientId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSharedTaskInput {
  title: string;
  detail?: string;
  assigneeEmail: string;
  siteId?: string | null;
  clientId?: number | null;
}

export interface UpdateSharedTaskInput {
  title?: string;
  detail?: string;
  assigneeEmail?: string;
  status?: SharedTaskStatus;
  siteId?: string | null;
  clientId?: number | null;
}

/* ------------------------------ Decisions ------------------------------ */

export interface Decision {
  id: number;
  title: string;
  detail: string;
  authorEmail: string;
  authorName: string;
  createdAt: string;
}

export interface CreateDecisionInput {
  title: string;
  detail?: string;
  authorEmail: string;
}

/* --------------------------- Knowledge base ---------------------------- */

export interface KnowledgeDoc {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeDocInput {
  title: string;
  body?: string;
}

export interface UpdateKnowledgeDocInput {
  title?: string;
  body?: string;
}

/* ---------------------- Recurring checklists (mock) --------------------- */

export type ChecklistFrequency = 'weekly' | 'monthly';

/** Static catalog of recurring checks — content is hardcoded, not stored. */
export interface ChecklistItemDef {
  id: string;
  label: string;
  detail: string;
  frequency: ChecklistFrequency;
}

/** The only thing actually persisted per item: when it was last checked. */
export interface ChecklistStateEntry {
  itemId: string;
  lastCheckedAt: string | null;
}

/* ---------------------------- Learning goals ---------------------------- */

export interface LearningGoal {
  id: number;
  ownerEmail: string;
  title: string;
  platform: string;
  progressPct: number;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningGoalInput {
  ownerEmail: string;
  title: string;
  platform?: string;
  progressPct?: number;
  targetDate?: string | null;
}

export interface UpdateLearningGoalInput {
  title?: string;
  platform?: string;
  progressPct?: number;
  targetDate?: string | null;
}

/* ------------------------- Objectives (home) ------------------------- */

export interface Objective {
  id: number;
  label: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  periodLabel: string;
  updatedAt: string;
}

export interface UpdateObjectiveInput {
  label?: string;
  unit?: string;
  targetValue?: number;
  currentValue?: number;
  periodLabel?: string;
}

/* ------------------------- amn-api (real sites) ------------------------- */

/**
 * Shapes mirror exactly what amn-api actually returns — see
 * amn-api/src/db/schema.sql. Deliberately thinner than the old mock Site
 * model (no revenue, no visitor trends, no fixed vulnerability count): those
 * never had a real data source. Business analytics is an explicit future
 * tracker tier ("AMN Suite") rather than something faked here.
 */
export type RemoteEventType = 'connection' | 'request' | 'security_alert' | 'payment' | 'heartbeat';
export type RemoteSeverity = 'critical' | 'warning' | 'info';

export interface RemoteSiteState {
  siteId: string;
  /** Raw status as stored by amn-api ('online' on any event, 'unknown' before the first one). */
  status: string;
  activeVisitors: number;
  lastSeenAt: string | null;
  lastAlertAt: string | null;
  updatedAt: string;
}

export interface RemoteSite {
  id: string;
  name: string;
  createdAt: string;
  state: RemoteSiteState | null;
}

export interface RemoteEvent {
  id: number;
  siteId: string;
  type: RemoteEventType;
  severity: RemoteSeverity | null;
  message: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/** Message pushed from amn-api's WebSocket stream, relayed verbatim by main. */
export interface RemoteEventPush {
  type: 'event';
  siteId: string;
  siteName: string;
  event: RemoteEvent;
}

export interface RegisterSiteResult {
  id: string;
  name: string;
  createdAt: string;
  /** Plaintext API key — shown once, never retrievable again. */
  apiKey: string;
}

export type RemoteConnectionStatus = 'connecting' | 'online' | 'offline' | 'unconfigured';

/* --------------------- Shared collections (real sync) --------------------- */

/**
 * A generic synced record. `data` is the full domain object (a task, a
 * decision, a message, a profile…) as stored/merged; `id` is a stable string
 * id chosen by the client. `deleted` is a soft-delete tombstone so removals
 * propagate to the other operator too.
 */
export interface RemoteRecord {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deleted: boolean;
}

/** Collections synced through amn-api. */
export type SyncedCollection =
  | 'tasks'
  | 'decisions'
  | 'knowledge'
  | 'objectives'
  | 'messages'
  | 'profiles'
  | 'clients'
  | 'quotes'
  | 'trackers'
  | 'notes'
  | 'reports'
  /** Public URL of a site, keyed by site id (Sites registry). */
  | 'siteMeta'
  /** Internal discussion thread attached to a site. */
  | 'siteNotes';

export interface PresenceEntry {
  email: string;
  online: boolean;
}

/* ------------------------------ Scanner (Produits) ------------------------------ */

/** Scan depth. Each tier is a superset of the previous one. */
export type ScanTier = 'lite' | 'pro' | 'elite';

export type ScanStatus = 'pending' | 'running' | 'done' | 'error';

/** Ordered least → most serious; drives colour and sort everywhere. */
export type ScanSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** One detected weakness, with the concrete fix for it. */
export interface ScanFinding {
  id: string;
  title: string;
  severity: ScanSeverity;
  /** transport | headers | cookies | disclosure | cms | cve | injection | xss | ports */
  category: string;
  detail: string;
  recommendation: string;
  /** What was observed (header value, tested parameter…), when relevant. */
  evidence: string | null;
  /** OWASP Top 10 bucket, e.g. "A05:2021 – Security Misconfiguration". */
  owasp: string | null;
  cve: string | null;
}

export type ScanSeveritySummary = Record<ScanSeverity, number>;

/** Elite-only before/after delta against the previous scan of the same URL. */
export interface ScanComparison {
  previousScanId: string;
  previousScannedAt: string;
  previousScore: number | null;
  resolved: ScanFinding[];
  introduced: ScanFinding[];
  unchangedCount: number;
  summaryBefore: ScanSeveritySummary;
  summaryAfter: ScanSeveritySummary;
}

export interface ScanResults {
  target: { url: string; host: string; ip: string | null };
  cms: { name: string; version: string | null; ecosystem: string } | null;
  httpStatus: number;
  findings: ScanFinding[];
  summary: ScanSeveritySummary;
  scannedAt: string;
  comparison?: ScanComparison | null;
}

export interface Scan {
  id: string;
  url: string;
  tier: ScanTier;
  status: ScanStatus;
  score: number | null;
  results: ScanResults | Record<string, never>;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Live progress frame pushed over the WebSocket while a scan runs. */
export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  /** Human-readable step, e.g. "Analyse des en-têtes de sécurité…". */
  step: string;
  pct: number;
  score?: number;
  error?: string;
  /** Present on the terminal `done` frame: the finished scan row. */
  scan?: Scan;
}

/* ------------------------- Comply (conformité RGPD) ------------------------ */

/** One RGPD point that is missing or at risk, with its concrete fix. */
export interface ComplyFinding {
  id: string;
  title: string;
  severity: ScanSeverity;
  /** consent | transparency | security | trackers */
  category: string;
  detail: string;
  recommendation: string;
  evidence: string | null;
  /** Legal reference, e.g. "RGPD art. 7" — the Comply analogue of `owasp`. */
  article: string | null;
}

/** A pass/fail line per checked point, so the UI can show what *did* pass too. */
export interface ComplyCheckItem {
  key: string;
  label: string;
  passed: boolean;
}

export interface ComplyResults {
  target: { url: string; host: string; ip: string | null };
  httpStatus: number;
  checks: ComplyCheckItem[];
  findings: ComplyFinding[];
  /** Names of the third-party trackers detected in the page. */
  trackers: string[];
  summary: ScanSeveritySummary;
  checkedAt: string;
}

export interface ComplyCheck {
  id: string;
  url: string;
  status: ScanStatus;
  score: number | null;
  results: ComplyResults | Record<string, never>;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Live progress frame pushed over the WebSocket while a check runs. */
export interface ComplyProgress {
  checkId: string;
  status: ScanStatus;
  step: string;
  pct: number;
  score?: number;
  error?: string;
  /** Present on the terminal `done` frame: the finished check row. */
  check?: ComplyCheck;
}

export interface AmnBridge {
  auth: {
    login(email: string, password: string): Promise<AuthResult>;
    changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult>;
  };
  profiles: {
    /** All operator profiles, so avatars/presence text render everywhere. */
    list(): Promise<UserProfile[]>;
    get(email: string): Promise<UserProfile>;
    updateSelf(email: string, patch: UpdateProfileInput): Promise<UserProfile>;
  };
  prefs: {
    get(email: string): Promise<NotificationPrefs>;
    update(email: string, patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;
  };
  messages: {
    list(): Promise<Message[]>;
    send(input: SendMessageInput): Promise<Message>;
    /** Toggles the given emoji reaction from this author on/off. */
    react(id: number, emoji: string, authorEmail: string): Promise<Message>;
    setPinned(id: number, pinned: boolean): Promise<Message>;
  };
  clients: {
    list(): Promise<Client[]>;
    create(input: CreateClientInput): Promise<Client>;
    update(id: number, patch: UpdateClientInput): Promise<Client>;
    addEvent(input: AddClientEventInput): Promise<Client>;
    remove(id: number): Promise<void>;
  };
  quotes: {
    list(): Promise<Quote[]>;
    create(input: CreateQuoteInput): Promise<Quote>;
    update(id: number, patch: UpdateQuoteInput): Promise<Quote>;
    remove(id: number): Promise<void>;
  };
  tasks: {
    list(): Promise<SharedTask[]>;
    create(input: CreateSharedTaskInput): Promise<SharedTask>;
    update(id: number, patch: UpdateSharedTaskInput): Promise<SharedTask>;
    remove(id: number): Promise<void>;
  };
  decisions: {
    list(): Promise<Decision[]>;
    create(input: CreateDecisionInput): Promise<Decision>;
    remove(id: number): Promise<void>;
  };
  knowledge: {
    list(): Promise<KnowledgeDoc[]>;
    create(input: CreateKnowledgeDocInput): Promise<KnowledgeDoc>;
    update(id: number, patch: UpdateKnowledgeDocInput): Promise<KnowledgeDoc>;
    remove(id: number): Promise<void>;
  };
  checklist: {
    getState(): Promise<ChecklistStateEntry[]>;
    check(itemId: string): Promise<ChecklistStateEntry>;
  };
  learning: {
    list(): Promise<LearningGoal[]>;
    create(input: CreateLearningGoalInput): Promise<LearningGoal>;
    update(id: number, patch: UpdateLearningGoalInput): Promise<LearningGoal>;
    remove(id: number): Promise<void>;
  };
  objectives: {
    list(): Promise<Objective[]>;
    update(id: number, patch: UpdateObjectiveInput): Promise<Objective>;
  };
  /**
   * Talks to the central amn-api. In Electron, the operator token never
   * leaves the main process — the renderer only sees the results, over IPC.
   */
  remote: {
    listSites(): Promise<RemoteSite[]>;
    getSiteEvents(siteId: string, opts?: { since?: string; limit?: number }): Promise<RemoteEvent[]>;
    registerSite(name: string): Promise<RegisterSiteResult>;
    /** Renames a registered site. */
    updateSite(id: string, name: string): Promise<RemoteSite>;
    /** Deletes a registered site (cascades its state + events). */
    deleteSite(id: string): Promise<void>;
    /** Current live-connection status (WebSocket to amn-api). */
    getConnectionStatus(): Promise<RemoteConnectionStatus>;
    /** Subscribes to live event pushes. Returns an unsubscribe function. */
    onEvent(callback: (push: RemoteEventPush) => void): () => void;
    /** Subscribes to connection status changes. Returns an unsubscribe function. */
    onConnectionStatusChange(callback: (status: RemoteConnectionStatus) => void): () => void;

    /* --- Shared collections (tasks/decisions/… synced between operators) --- */
    listRecords(collection: SyncedCollection): Promise<RemoteRecord[]>;
    upsertRecord(
      collection: SyncedCollection,
      id: string,
      data: Record<string, unknown>,
    ): Promise<RemoteRecord>;
    deleteRecord(collection: SyncedCollection, id: string): Promise<RemoteRecord>;
    /** Live record changes pushed from amn-api. Returns an unsubscribe function. */
    onRecord(callback: (record: RemoteRecord) => void): () => void;

    /* --- Presence --- */
    /** Tells the main process which operator is signed in (for presence + attribution). */
    setIdentity(email: string | null): void;
    getPresence(): Promise<PresenceEntry[]>;
    onPresence(callback: (users: PresenceEntry[]) => void): () => void;

    /* --- Scanner --- */
    /**
     * Queues a passive security scan of `url` at `tier`. Resolves as soon as
     * amn-api has accepted it (status `pending`); follow the run through
     * {@link onScanProgress} and re-read the finished scan with {@link getScan}.
     * The scan itself runs on amn-api, never from this machine.
     */
    startScan(url: string, tier: ScanTier): Promise<Scan>;
    listScans(): Promise<Scan[]>;
    getScan(id: string): Promise<Scan>;
    /** URL of the printable Elite report (opened, then printed to PDF). */
    scanReportUrl(id: string): Promise<string>;
    /** Live scan progress pushed from amn-api. Returns an unsubscribe function. */
    onScanProgress(callback: (progress: ScanProgress) => void): () => void;

    /* --- Comply (RGPD) --- */
    /**
     * Queues an RGPD conformity check of `url`. Same shape as {@link startScan}:
     * resolves once amn-api accepted it, then follow it through
     * {@link onComplyProgress} and re-read it with {@link getComplyCheck}.
     */
    startComply(url: string): Promise<ComplyCheck>;
    listComplyChecks(): Promise<ComplyCheck[]>;
    getComplyCheck(id: string): Promise<ComplyCheck>;
    onComplyProgress(callback: (progress: ComplyProgress) => void): () => void;
  };
  /** Native OS / desktop integration (Electron main process). */
  system: {
    /** Native OS notification. Fire-and-forget. */
    notify(input: { title: string; body: string }): void;
    /** Whether the app is set to launch at OS login (Electron only). */
    getAutoLaunch(): Promise<boolean>;
    /** Enables/disables launch at OS login; resolves to the new value. */
    setAutoLaunch(enabled: boolean): Promise<boolean>;
    /** App name / version / platform for the About screen. */
    getAppInfo(): Promise<AppInfo>;
  };
  /** Cyber/tech watch feed, fetched from public RSS sources (Electron main). */
  watch: {
    /** Cached watch items (refreshed on a TTL in the main process). */
    list(): Promise<WatchFeedResult>;
    /** Force an immediate refresh from the sources, bypassing the TTL cache. */
    refresh(): Promise<WatchFeedResult>;
  };
  /** Local Ollama AI (per-machine, optional). Degrades to the mock if absent. */
  ollama: {
    /** Whether Ollama is running locally + the installed model names. */
    status(): Promise<OllamaStatus>;
    /** One non-streaming completion. Rejects on failure (caller falls back). */
    chat(input: { model: string; system: string; prompt: string }): Promise<{ text: string }>;
  };
  /** Auto-update (Electron main; Squirrel/autoUpdater). No-ops in the browser. */
  updates: {
    /** Fires when an update has been downloaded and is ready to install. */
    onDownloaded(cb: (info: { version: string; notes?: string }) => void): () => void;
    /** Quit and install the staged update (relaunches the app). */
    install(): void;
  };
  env: {
    /** true when backed by the Electron main process (SQLite), false in browser fallback. */
    isElectron: boolean;
  };
}

/** IPC channel names, kept in one place to avoid string drift. */
export const IPC = {
  authLogin: 'auth:login',
  authChangePassword: 'auth:changePassword',
  profilesList: 'profiles:list',
  profilesGet: 'profiles:get',
  profilesUpdateSelf: 'profiles:updateSelf',
  prefsGet: 'prefs:get',
  prefsUpdate: 'prefs:update',
  messagesList: 'messages:list',
  messagesSend: 'messages:send',
  messagesReact: 'messages:react',
  messagesSetPinned: 'messages:setPinned',
  clientsList: 'clients:list',
  clientsCreate: 'clients:create',
  clientsUpdate: 'clients:update',
  clientsAddEvent: 'clients:addEvent',
  clientsRemove: 'clients:remove',
  quotesList: 'quotes:list',
  quotesCreate: 'quotes:create',
  quotesUpdate: 'quotes:update',
  quotesRemove: 'quotes:remove',
  tasksList: 'tasks:list',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksRemove: 'tasks:remove',
  decisionsList: 'decisions:list',
  decisionsCreate: 'decisions:create',
  decisionsRemove: 'decisions:remove',
  knowledgeList: 'knowledge:list',
  knowledgeCreate: 'knowledge:create',
  knowledgeUpdate: 'knowledge:update',
  knowledgeRemove: 'knowledge:remove',
  checklistGetState: 'checklist:getState',
  checklistCheck: 'checklist:check',
  learningList: 'learning:list',
  learningCreate: 'learning:create',
  learningUpdate: 'learning:update',
  learningRemove: 'learning:remove',
  objectivesList: 'objectives:list',
  objectivesUpdate: 'objectives:update',
  remoteListSites: 'remote:listSites',
  remoteSiteEvents: 'remote:siteEvents',
  remoteRegisterSite: 'remote:registerSite',
  remoteUpdateSite: 'remote:updateSite',
  remoteDeleteSite: 'remote:deleteSite',
  remoteConnectionStatus: 'remote:connectionStatus',
  remoteListRecords: 'remote:listRecords',
  remoteUpsertRecord: 'remote:upsertRecord',
  remoteDeleteRecord: 'remote:deleteRecord',
  remoteSetIdentity: 'remote:setIdentity',
  remoteGetPresence: 'remote:getPresence',
  /** Push channels (main -> renderer via webContents.send, not invoke/handle). */
  remoteStartScan: 'remote:startScan',
  remoteListScans: 'remote:listScans',
  remoteGetScan: 'remote:getScan',
  remoteScanReportUrl: 'remote:scanReportUrl',
  remoteScanProgressPush: 'remote:scanProgressPush',
  remoteStartComply: 'remote:startComply',
  remoteListComplyChecks: 'remote:listComplyChecks',
  remoteGetComplyCheck: 'remote:getComplyCheck',
  remoteComplyProgressPush: 'remote:complyProgressPush',
  remoteEventPush: 'remote:eventPush',
  remoteConnectionStatusPush: 'remote:connectionStatusPush',
  remoteRecordPush: 'remote:recordPush',
  remotePresencePush: 'remote:presencePush',
  systemNotify: 'system:notify',
  systemGetAutoLaunch: 'system:getAutoLaunch',
  systemSetAutoLaunch: 'system:setAutoLaunch',
  systemGetAppInfo: 'system:getAppInfo',
  watchList: 'watch:list',
  watchRefresh: 'watch:refresh',
  ollamaStatus: 'ollama:status',
  ollamaChat: 'ollama:chat',
  updateDownloaded: 'update:downloaded',
  updateInstall: 'update:install',
} as const;

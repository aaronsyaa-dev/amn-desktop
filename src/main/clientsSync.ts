import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { RemoteApiClient } from './remoteApi';

/**
 * Clients/quotes durability backstop.
 *
 * Historically `clients` and `quotes` were pure per-machine SQLite data (see
 * db.ts) even though amn-api's generic collections endpoint already whitelists
 * both names — the desktop app just never pushed to them. That meant a wiped
 * or fresh local `amn.db` (e.g. after a reinstall, a corrupted file, or a new
 * machine) lost that operator's clients for good, with no copy anywhere else:
 * the exact "Clients vides après mise à jour" failure mode.
 *
 * This module fixes that WITHOUT touching the existing local-first SQLite
 * shape or the ClientsScreen IPC contract (low blast radius on an actively
 * used screen): every client/quote write is additionally mirrored to amn-api
 * best-effort (`pushClient`/`pushQuote`, fire-and-forget — offline never
 * blocks or breaks a save), and on startup any client/quote that exists on
 * amn-api but not locally is restored (`restoreFromRemote`) — additive only,
 * never overwrites or deletes an existing local row.
 *
 * Local rows keep their existing autoincrement `id` (quotes/client_events
 * foreign keys depend on it) but gain a globally-unique `sync_id` used as the
 * amn-api record key, so two operators' independently-numbered local
 * databases (both can have a client #1) never collide remotely.
 */

interface ClientRow {
  id: number;
  sync_id: string;
  name: string;
  company: string;
  status: string;
  email: string;
  phone: string;
  notes: string;
  image_data_url: string;
  linked_site_ids: string;
  created_at: string;
  updated_at: string;
}

interface ClientEventRow {
  id: number;
  client_id: number;
  title: string;
  detail: string;
  date: string;
}

interface QuoteRow {
  id: number;
  sync_id: string;
  client_id: number;
  title: string;
  detail: string;
  tracker_tier: string;
  price_euro: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

/** Assigns a `sync_id` to any client/quote row that doesn't have one yet. */
export function backfillSyncIds(db: Database.Database): void {
  const clientsMissing = db
    .prepare(`SELECT id FROM clients WHERE sync_id IS NULL OR sync_id = ''`)
    .all() as { id: number }[];
  const setClientSync = db.prepare('UPDATE clients SET sync_id = ? WHERE id = ?');
  for (const row of clientsMissing) setClientSync.run(`client-${randomUUID()}`, row.id);

  const quotesMissing = db
    .prepare(`SELECT id FROM quotes WHERE sync_id IS NULL OR sync_id = ''`)
    .all() as { id: number }[];
  const setQuoteSync = db.prepare('UPDATE quotes SET sync_id = ? WHERE id = ?');
  for (const row of quotesMissing) setQuoteSync.run(`quote-${randomUUID()}`, row.id);
}

/** Best-effort: pushes one client (with its events) to amn-api. Never throws. */
export async function pushClient(remote: RemoteApiClient, db: Database.Database, clientId: number): Promise<void> {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as ClientRow | undefined;
    if (!client || !client.sync_id) return;
    const events = db
      .prepare('SELECT * FROM client_events WHERE client_id = ? ORDER BY date ASC')
      .all(clientId) as ClientEventRow[];
    await remote.upsertRecord('clients', client.sync_id, {
      name: client.name,
      company: client.company,
      status: client.status,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
      imageDataUrl: client.image_data_url,
      linkedSiteIds: JSON.parse(client.linked_site_ids || '[]'),
      createdAt: client.created_at,
      events: events.map((e) => ({ title: e.title, detail: e.detail, date: e.date })),
    });
  } catch {
    /* offline / amn-api unavailable — local SQLite stays the source of truth for this session */
  }
}

/** Best-effort: pushes one quote to amn-api, referencing the client's sync_id. Never throws. */
export async function pushQuote(remote: RemoteApiClient, db: Database.Database, quoteId: number): Promise<void> {
  try {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as QuoteRow | undefined;
    if (!quote || !quote.sync_id) return;
    const client = db.prepare('SELECT sync_id FROM clients WHERE id = ?').get(quote.client_id) as
      | { sync_id: string }
      | undefined;
    if (!client) return;
    await remote.upsertRecord('quotes', quote.sync_id, {
      clientSyncId: client.sync_id,
      title: quote.title,
      detail: quote.detail,
      trackerTier: quote.tracker_tier,
      priceEuro: quote.price_euro,
      status: quote.status,
      paymentStatus: quote.payment_status,
      createdAt: quote.created_at,
    });
  } catch {
    /* offline / amn-api unavailable */
  }
}

/**
 * Restores clients/quotes that exist on amn-api but not in this machine's
 * local SQLite — the recovery half of the durability fix. Purely additive:
 * only inserts rows whose `sync_id` isn't already present locally, never
 * touches or removes an existing local row. Safe to call on every startup.
 */
export async function restoreFromRemote(remote: RemoteApiClient, db: Database.Database): Promise<void> {
  try {
    const remoteClients = await remote.listRecords('clients');
    const localSyncIds = new Set(
      (db.prepare('SELECT sync_id FROM clients').all() as { sync_id: string }[]).map((r) => r.sync_id),
    );

    const insertClient = db.prepare(
      `INSERT INTO clients (sync_id, name, company, status, email, phone, notes, image_data_url, linked_site_ids, created_at, updated_at)
       VALUES (@syncId, @name, @company, @status, @email, @phone, @notes, @imageDataUrl, @linkedSiteIds, @createdAt, @updatedAt)`,
    );
    const insertEvent = db.prepare(
      'INSERT INTO client_events (client_id, title, detail, date) VALUES (?, ?, ?, ?)',
    );

    for (const record of remoteClients) {
      if (record.deleted || localSyncIds.has(record.id)) continue;
      const data = record.data as Record<string, unknown>;
      const result = insertClient.run({
        syncId: record.id,
        name: typeof data.name === 'string' ? data.name : 'Client restauré',
        company: typeof data.company === 'string' ? data.company : '',
        status: typeof data.status === 'string' ? data.status : 'prospect',
        email: typeof data.email === 'string' ? data.email : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        notes: typeof data.notes === 'string' ? data.notes : '',
        imageDataUrl: typeof data.imageDataUrl === 'string' ? data.imageDataUrl : '',
        linkedSiteIds: JSON.stringify(Array.isArray(data.linkedSiteIds) ? data.linkedSiteIds : []),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : record.updatedAt,
        updatedAt: record.updatedAt,
      });
      const newClientId = Number(result.lastInsertRowid);
      const events = Array.isArray(data.events) ? (data.events as Record<string, unknown>[]) : [];
      for (const ev of events) {
        insertEvent.run(
          newClientId,
          typeof ev.title === 'string' ? ev.title : '',
          typeof ev.detail === 'string' ? ev.detail : '',
          typeof ev.date === 'string' ? ev.date : record.updatedAt,
        );
      }
    }

    // Quotes reference a client by sync_id remotely — only restorable once its
    // client exists locally (either it always did, or was just restored above).
    const remoteQuotes = await remote.listRecords('quotes');
    const localQuoteSyncIds = new Set(
      (db.prepare('SELECT sync_id FROM quotes').all() as { sync_id: string }[]).map((r) => r.sync_id),
    );
    const clientIdBySyncId = new Map(
      (db.prepare('SELECT id, sync_id FROM clients').all() as { id: number; sync_id: string }[]).map((r) => [
        r.sync_id,
        r.id,
      ]),
    );
    const insertQuote = db.prepare(
      `INSERT INTO quotes (sync_id, client_id, title, detail, tracker_tier, price_euro, status, payment_status, created_at, updated_at)
       VALUES (@syncId, @clientId, @title, @detail, @trackerTier, @priceEuro, @status, @paymentStatus, @createdAt, @updatedAt)`,
    );
    for (const record of remoteQuotes) {
      if (record.deleted || localQuoteSyncIds.has(record.id)) continue;
      const data = record.data as Record<string, unknown>;
      const clientSyncId = typeof data.clientSyncId === 'string' ? data.clientSyncId : '';
      const clientId = clientIdBySyncId.get(clientSyncId);
      if (!clientId) continue; // client not found locally (nor restorable) — skip, non-fatal
      insertQuote.run({
        syncId: record.id,
        clientId,
        title: typeof data.title === 'string' ? data.title : '',
        detail: typeof data.detail === 'string' ? data.detail : '',
        trackerTier: typeof data.trackerTier === 'string' ? data.trackerTier : 'sentinel',
        priceEuro: typeof data.priceEuro === 'number' ? data.priceEuro : 0,
        status: typeof data.status === 'string' ? data.status : 'draft',
        paymentStatus: typeof data.paymentStatus === 'string' ? data.paymentStatus : 'unpaid',
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : record.updatedAt,
        updatedAt: record.updatedAt,
      });
    }
  } catch {
    /* offline / amn-api unavailable at startup — local data stays as-is, will retry next launch */
  }
}

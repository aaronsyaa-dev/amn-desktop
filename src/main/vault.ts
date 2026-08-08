import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { VaultEntry } from '../shared/api';

/**
 * Local-only, per-machine password vault. Deliberately outside the amn-api
 * sync path (see VaultEntry in shared/api.ts) — this file talks to disk only,
 * never to remoteApi/fetch, so these secrets can never leave the machine
 * through this app.
 *
 * Encrypted at rest via Electron's `safeStorage`, backed by the OS keychain
 * (Keychain on macOS, DPAPI on Windows, Secret Service/libsecret on Linux)
 * when available. If the OS has no keychain backend (some minimal Linux
 * setups), `safeStorage.isEncryptionAvailable()` is false and the file falls
 * back to plaintext JSON — `isVaultEncryptionAvailable()` reports that
 * honestly to the renderer rather than silently pretending it's protected.
 */

const VAULT_FILE = () => path.join(app.getPath('userData'), 'vault.dat');

export function isVaultEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export async function loadVault(): Promise<VaultEntry[]> {
  let raw: Buffer;
  try {
    raw = await fs.readFile(VAULT_FILE());
  } catch {
    return []; // no vault file yet
  }
  if (raw.length === 0) return [];
  try {
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as VaultEntry[]) : [];
  } catch {
    // Corrupt file, or encrypted with a key the OS keychain no longer offers
    // (e.g. locked, or encryption availability changed since the last save):
    // fail closed to an empty vault rather than crashing the app or leaking
    // raw ciphertext into the UI.
    return [];
  }
}

export async function saveVault(entries: VaultEntry[]): Promise<void> {
  const json = JSON.stringify(entries);
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8');
  await fs.mkdir(path.dirname(VAULT_FILE()), { recursive: true });
  await fs.writeFile(VAULT_FILE(), data);
}

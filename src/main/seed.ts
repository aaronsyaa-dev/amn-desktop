/**
 * Fixed accounts seeded into the local database on first run.
 *
 * There is no open sign-up yet (per product decision): these two accounts are
 * created automatically. Passwords are defined here in plaintext ONLY as seed
 * input — they are immediately bcrypt-hashed and never stored in clear. Change
 * `DEFAULT_PASSWORD` (or the DB rows) before any real deployment.
 */
export const DEFAULT_PASSWORD = 'AmnQG-2026';

export interface SeedAccount {
  email: string;
  name: string;
  password: string;
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  { email: 'aaron@amn-devsec.com', name: 'Aaron', password: DEFAULT_PASSWORD },
  { email: 'mohamed@amn-devsec.com', name: 'Mohamed', password: DEFAULT_PASSWORD },
];

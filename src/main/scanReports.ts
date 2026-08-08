import { app } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Where Elite scan reports are written before being opened.
 *
 * The Scanner's PDF button ("Save as PDF" via print, like the other reports —
 * see src/lib/print.ts) needs the report open in an actual browser window so
 * window.print() works; a `data:text/html,...` URL looked like the simplest
 * way to hand the renderer-fetched HTML to window.open(), but Electron's
 * default window-open policy denies anything that isn't http(s) (see
 * main.ts's setWindowOpenHandler), so the button silently did nothing. Writing
 * to a file and opening a scoped file:// URL is what actually works, and
 * scoping the allowance to exactly this directory (see main.ts) keeps the
 * change from becoming a general "open any file:// URL" hole.
 */
export const SCAN_REPORTS_DIR = path.join(app.getPath('temp'), 'amn-scan-reports');

/** Writes one report's HTML to a fresh file and returns its file:// URL. */
export async function writeScanReportFile(html: string): Promise<string> {
  await fs.mkdir(SCAN_REPORTS_DIR, { recursive: true });
  const file = path.join(SCAN_REPORTS_DIR, `${crypto.randomUUID()}.html`);
  await fs.writeFile(file, html, 'utf8');
  return pathToFileURL(file).href;
}

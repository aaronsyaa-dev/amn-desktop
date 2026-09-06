/* Un serveur statique minuscule pour les sondes : `node scripts/sondes/_servir.mjs <dossier> <port>` — fichiers du dossier, index.html sinon (routes en dièse). */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [dossier, port] = [path.resolve(process.argv[2] ?? 'dist'), Number(process.argv[3] ?? 4181)];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = path.join(dossier, url);
  if (!f.startsWith(dossier) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dossier, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`servi : ${dossier} sur http://127.0.0.1:${port}`));

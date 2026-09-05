/** Un serveur statique minimal pour un build web (repli SPA sur index.html). `node servir.mjs <dossier> <port>` */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const [dossier, port] = [path.resolve(process.argv[2]), Number(process.argv[3])];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let fichier = path.join(dossier, url);
  if (!fichier.startsWith(dossier) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) fichier = path.join(dossier, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(fichier).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`servi : ${dossier} sur ${port}`));

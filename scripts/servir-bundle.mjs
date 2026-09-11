import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const racine = process.argv[2];
const port = Number(process.argv[3]);
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.woff2':'font/woff2', '.woff':'font/woff' };
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(racine, url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(racine, 'index.html');
  const buf = fs.readFileSync(f);
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' });
  res.end(buf);
}).listen(port, '127.0.0.1', () => console.log('servi sur', port));

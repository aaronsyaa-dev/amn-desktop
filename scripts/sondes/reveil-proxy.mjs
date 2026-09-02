/* Un mandataire qui imite l'instance qui dort : tant que /tmp/e2e/dormir existe, 502 ; sinon, il passe tout à amn-api (HTTP et WebSocket). */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 4172);
const CIBLE = { host: '127.0.0.1', port: 4171 };
const DORMIR = '/tmp/e2e/dormir';
const dort = () => fs.existsSync(DORMIR);
const serveur = http.createServer((req, res) => {
  if (dort()) {
    res.writeHead(502, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    res.end('<html><body><h1>502 Bad Gateway</h1></body></html>');
    return;
  }
  const relais = http.request({ ...CIBLE, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  relais.on('error', () => { res.writeHead(502); res.end('502'); });
  req.pipe(relais);
});
serveur.on('upgrade', (req, socket, head) => {
  if (dort()) { socket.destroy(); return; }
  const aval = net.connect(CIBLE.port, CIBLE.host, () => {
    const lignes = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) lignes.push(`${k}: ${v}`);
    aval.write(lignes.join('\r\n') + '\r\n\r\n');
    if (head.length) aval.write(head);
    socket.pipe(aval); aval.pipe(socket);
  });
  aval.on('error', () => socket.destroy());
  socket.on('error', () => aval.destroy());
});
serveur.listen(PORT, () => console.log(`réveil-proxy sur :${PORT} → 4171 (dort si ${DORMIR} existe)`));

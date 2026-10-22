/**
 * ISOLEMENT RÉSEAU — préchargé dans le serveur de simulation (`node --import`).
 *
 * Le cadre dit « aucun tiers ». Plutôt que de le supposer, on le fait tenir par
 * le code : toute connexion TCP/TLS vers autre chose que la boucle locale est
 * refusée avant même la résolution DNS, et chaque tentative est notée (hôte,
 * port) dans SIM_SORTANT_LOG. Le serveur croit simplement que « le réseau est
 * coupé » ; la simulation apprend ce qu'il aurait voulu appeler.
 */
import net from 'node:net';
import fs from 'node:fs';

const journal = process.env.SIM_SORTANT_LOG;
const boucleLocale = (h) => h === 'localhost' || h === '::1' || h === '[::1]' || h === '0.0.0.0' || /^127\./.test(h);
const origine = net.Socket.prototype.connect;

net.Socket.prototype.connect = function connecter(...args) {
  const a = args[0];
  let host;
  let port;
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    if (a.path) return origine.apply(this, args); // socket Unix
    host = a.host;
    port = a.port;
  } else if (typeof a === 'string' && Number.isNaN(Number(a))) {
    return origine.apply(this, args); // chemin Unix
  } else {
    port = a;
    host = typeof args[1] === 'string' ? args[1] : undefined;
  }
  if (host === undefined || boucleLocale(String(host))) return origine.apply(this, args);
  try { if (journal) fs.appendFileSync(journal, `${host}:${port}\n`); } catch { /* le journal est un témoin, pas une condition */ }
  process.nextTick(() => this.destroy(Object.assign(new Error(`bac à sable : connexion sortante refusée (${host}:${port})`), { code: 'ECONNREFUSED' })));
  return this;
};

import WebSocket from 'ws';
const url = 'ws://127.0.0.1:4172/v1/stream?token=audit-jeton&user=';
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const vivant = new WebSocket(url + 'vivant@exemple.test');            // répond aux pings (défaut)
const muet = new WebSocket(url + 'muet@exemple.test', { autoPong: false }); // ne répond jamais : simule une liaison morte
vivant.on('open', () => log('poste VIVANT connecté'));
muet.on('open', () => log('poste MUET connecté (ne répondra pas aux pings)'));
vivant.on('ping', () => log('poste VIVANT : ping reçu du serveur → pong automatique'));
muet.on('ping', () => log('poste MUET : ping reçu, ignoré volontairement'));
muet.on('close', (code) => log(`poste MUET : fermé par le serveur (code ${code})`));
vivant.on('close', (code) => log(`poste VIVANT : fermé (code ${code}) — NE DEVRAIT PAS ARRIVER`));
setTimeout(() => { log(`bilan : vivant=${vivant.readyState === 1 ? 'toujours ouvert' : 'fermé'} muet=${muet.readyState === 1 ? 'toujours ouvert (ÉCHEC)' : 'terminé'}`); process.exit(0); }, 75000);

/* Bloc 0 de la Garde — les logos du rail : disparus à la 1.2.44, rendus par lot, et changeables depuis le dossier. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/garde-2026-09-05';
const API = 'http://127.0.0.1:4171';
const WEB = process.env.WEB || 'http://127.0.0.1:4181';
const COMPTE = { email: 'essai.interne@exemple.test', password: 'Interne-2026-Essai' };
const ETIQUETTE = process.env.ETIQUETTE || 'apres';
const jeton = (await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(COMPTE) })).json()).token;
const admin = async (chemin, init = {}) => (await fetch(`${API}${chemin}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}`, ...(init.headers ?? {}) } })).json();

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
await p.goto(`${WEB}/`); await a(1800);
await p.locator('input[name="email"]').fill(COMPTE.email); await p.locator('input[name="password"]').fill(COMPTE.password);
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(3000); await p.mouse.click(720, 860); await a(1000);
const imagesRail = () => p.evaluate(() => [...document.querySelectorAll('img[src^="data:image"]')].filter((i) => !i.closest('main')).length);
const enBase = (await admin('/v1/admin/organizations/logos?ids=' + process.env.ORG_ID)).logos[process.env.ORG_ID];
console.log(`[${ETIQUETTE}] logo en base pour ${process.env.ORG_ID.slice(0, 8)} ? ${Boolean(enBase)} | images de logo dans le rail : ${await imagesRail()}`);
await p.screenshot({ path: `${OUT}/00-rail-logos-${ETIQUETTE}.png` });

if (ETIQUETTE === 'apres') {
  // Le dossier de l'organisation : « Changer le logo » existe, et il change vraiment.
  // Le dossier s'ouvre depuis le registre : le nom de l'organisation dans sa ligne.
  const nomOrg = (await admin(`/v1/admin/organizations/${process.env.ORG_ID}/dossier`)).organization.name;
  await p.goto(`${WEB}/#/tour/organisations`); await a(2500);
  await p.locator('input[aria-label="Chercher une organisation"]').fill(nomOrg); await a(1500);
  await p.locator('main button').filter({ hasText: nomOrg }).first().click(); await a(2000);
  console.log('dossier ouvert pour', JSON.stringify(nomOrg), '?', (await p.locator('button:has-text("Changer le logo")').count()) > 0 ? 'oui' : 'non');
  const bouton = p.locator('button:has-text("Changer le logo")').first();
  console.log('dossier : bouton « Changer le logo » ?', (await bouton.count()) > 0, '| bouton « Retirer » ?', (await p.locator('button:has-text("Retirer")').count()) > 0);
  // Un PNG réel (16 × 16, bleu), déposé par le sélecteur de fichier caché.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNk+M9AEmAaVTCqYCQpAACGcQEPz+nkSAAAAABJRU5ErkJggg==', 'base64');
  await p.locator('input[type="file"][aria-label="Changer le logo"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png }); await a(2500);
  const apres = (await admin('/v1/admin/organizations/logos?ids=' + process.env.ORG_ID)).logos[process.env.ORG_ID];
  console.log('après dépôt : le logo en base a changé ?', Boolean(apres) && apres !== enBase, '| PNG ?', String(apres).startsWith('data:image/png'), '| rail à jour (images) :', await imagesRail());
  await p.screenshot({ path: `${OUT}/01-dossier-changer-logo.png` });
}
console.log('erreurs de page :', erreurs.length, erreurs.slice(0, 2));
await nav.close();

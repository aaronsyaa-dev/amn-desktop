/**
 * LE CONTRAT DU POSTE — ce que le desktop candidat MONTRE de la base migrée.
 *
 *   WEB=http://127.0.0.1:4310 API=http://127.0.0.1:4311 REFERENCE=<json> node scripts/migration/contrat-poste.mjs
 *
 * La base peut être intacte et l'écran l'avoir perdue : c'est exactement ce
 * qui est arrivé aux logos à la 1.2.44 (la page du parc ne les portait pas,
 * le poste les mettait à null). Ici on ouvre le vrai build, on se connecte,
 * et on exige à l'écran ce que le jeu de données a écrit : les logos dans le
 * rail, chaque organisation dans le registre avec ses étiquettes, son
 * dossier avec son nombre de places et son geste de logo, et — en entrant
 * chez elle — chaque enregistrement vivant de chaque collection dans le
 * miroir de synchronisation du poste, tel quel.
 */
import fs from 'node:fs';
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const WEB = process.env.WEB;
const API = process.env.API;
const ref = JSON.parse(fs.readFileSync(process.env.REFERENCE, 'utf8'));
const CAPTURES = process.env.CAPTURES || '';
const pertes = [];
const ok = [];
const exiger = (condition, message) => (condition ? ok.push(message) : pertes.push(message));

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const exceptions = [];
p.on('pageerror', (e) => exceptions.push(String(e).slice(0, 160)));
await p.goto(`${WEB}/`); await a(1500);
await p.locator('input[name="email"]').fill(ref.proprietaire.email); await p.locator('input[name="password"]').fill(ref.motDePasse);
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 30 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(1500);
exiger(!(await p.content()).includes('name="password"'), 'connexion du propriétaire interne');

// 1. Le rail : autant d'images de logo que d'organisations qui en ont.
for (let i = 0; i < 20 && (await p.locator('img[src^="data:image"]').count()) < ref.organisations.filter((o) => o.logo).length; i += 1) await a(500);
const logosRail = await p.evaluate(() => [...document.querySelectorAll('img[src^="data:image"]')].filter((i) => !i.closest('main')).length);
exiger(logosRail >= ref.organisations.filter((o) => o.logo).length, `rail : ${logosRail} logo(s) affiché(s) pour ${ref.organisations.filter((o) => o.logo).length} attendu(s)`);
if (CAPTURES) await p.screenshot({ path: `${CAPTURES}/migration-rail.png` });

// 2. Le registre et le dossier de chaque organisation.
for (const org of ref.organisations) {
  await p.goto(`${WEB}/#/tour/organisations`); await a(2000);
  await p.locator('input[aria-label="Chercher une organisation"]').fill(org.name.slice(0, 24)); await a(1500);
  const ligne = p.locator('main button').filter({ hasText: org.name }).first();
  exiger((await ligne.count()) > 0, `registre : ${org.name} présente`);
  if ((await ligne.count()) === 0) continue;
  const texteLigne = await ligne.locator('xpath=ancestor::*[self::li or self::tr or self::article][1]').innerText().catch(() => '');
  for (const tag of org.tags) exiger(texteLigne.includes(tag) || (await p.locator('main').innerText()).includes(tag), `registre : étiquette « ${tag} » de ${org.name}`);
  await ligne.click(); await a(2000);
  const dossier = await p.locator('[role="dialog"], aside, main').last().innerText().catch(() => '');
  const page = await p.evaluate(() => document.body.innerText);
  exiger(page.includes(org.name), `dossier : ${org.name} ouvert`);
  for (const tag of org.tags) exiger(page.includes(tag), `dossier : étiquette « ${tag} »`);
  exiger((await p.locator('button:has-text("Changer le logo")').count()) > 0, `dossier : geste « Changer le logo » pour ${org.name}`);
  if (org.seats) exiger(new RegExp(`\\b${org.seats}\\b`).test(page), `dossier : ${org.seats} places`);
  if (org.logo) exiger((await p.locator('[role="dialog"] img[src^="data:image"], main img[src^="data:image"]').count()) > 0, `dossier : le logo de ${org.name} est affiché`);
  if (CAPTURES) await p.screenshot({ path: `${CAPTURES}/migration-dossier-${org.logo ? 'a' : 'b'}.png` });
  await p.keyboard.press('Escape'); await a(400);
  void dossier;
}

// 3. Chez la cliente : chaque enregistrement vivant de chaque collection, dans le miroir du poste.
const A = ref.organisations[0];
await p.goto(`${WEB}/#/`); await a(1500);
const bouton = p.locator(`button[aria-label="${A.name}"], button[title="${A.name}"]`).first();
if ((await bouton.count()) === 0) {
  const initiales = A.name.replace(/^Migration — /, '').split(/\s+/).map((m) => m[0]).join('').slice(0, 2).toUpperCase();
  await p.locator('aside button, [class*=rail] button').filter({ hasText: new RegExp(`^${initiales}$`) }).first().click();
} else await bouton.click();
await a(3500);
const banniere = await p.evaluate(() => document.body.innerText);
exiger(/session de support/i.test(banniere) && banniere.includes(A.name.slice(0, 20)), `entrée chez ${A.name} en session de support`);
for (let i = 0; i < 20; i += 1) { const n = await p.evaluate((id) => Object.keys(localStorage).filter((k) => k.startsWith(`amn.sync.ctx-${id}.`) && !k.endsWith('__envoi')).length, A.id); if (n >= Object.keys(ref.collections[A.id]).length) break; await a(500); }
const miroirs = await p.evaluate((id) => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith(`amn.sync.ctx-${id}.`) && !k.endsWith('__envoi')).map((k) => [k.slice(`amn.sync.ctx-${id}.`.length), JSON.parse(localStorage.getItem(k) || '[]')])), A.id);
let vivantsVus = 0, vivantsAttendus = 0;
const fermees = new Set(A.verrouillees ?? []);
let sautees = 0;
for (const [collection, { vivants, supprimes }] of Object.entries(ref.collections[A.id])) {
  if (fermees.has(collection)) { sautees += 1; continue; } // fermée à l'assistance par la cliente : vérifiée en base, pas ici
  const miroir = miroirs[collection];
  if (!miroir) { pertes.push(`miroir : collection ${collection} absente du poste (${vivants.length} enregistrement(s))`); vivantsAttendus += vivants.length; continue; }
  for (const { id, data } of vivants) {
    vivantsAttendus += 1;
    const r = miroir.find((x) => x.id === id && !x.deleted);
    if (!r) { pertes.push(`miroir : ${collection}/${id} absent ou supprimé`); continue; }
    const diff = Object.entries(data).filter(([k, v]) => JSON.stringify(r.data?.[k]) !== JSON.stringify(v)).map(([k]) => k);
    if (diff.length) pertes.push(`miroir : ${collection}/${id} champs altérés : ${diff.join(', ')}`);
    else vivantsVus += 1;
  }
  for (const id of supprimes) { const r = miroir.find((x) => x.id === id); if (r && !r.deleted) pertes.push(`miroir : ${collection}/${id} revenu à la vie`); }
}
ok.push(`miroir : ${vivantsVus}/${vivantsAttendus} enregistrements vivants retrouvés tels quels dans ${Object.keys(miroirs).length} collections${sautees ? ` (${sautees} fermée(s) par consentement, vérifiées en base)` : ''}`);
if (CAPTURES) await p.screenshot({ path: `${CAPTURES}/migration-cliente.png` });
await p.locator('button:has-text("Quitter")').first().click().catch(() => {}); await a(800);
await nav.close();

exiger(exceptions.length === 0, `aucune exception de page (${exceptions.length}${exceptions.length ? ' : ' + exceptions[0] : ''})`);
for (const l of ok) console.log(`  ✓ ${l}`);
for (const l of pertes) console.log(`  ✗ ${l}`);
console.log(JSON.stringify({ ok: ok.length, pertes: pertes.length }));
process.exit(pertes.length ? 1 : 0);

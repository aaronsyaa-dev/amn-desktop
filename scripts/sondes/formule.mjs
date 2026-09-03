/* Bloc 1 — la formule pilote : ajouter et retirer un module par-dessus la formule, journalisé ; le plancher des places ; l'épingle visible sur téléphone. */
import fs from 'node:fs';
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/supervision-2026-09-04';
const API = 'http://127.0.0.1:4171';
const TOKEN = fs.readFileSync('/tmp/e2e/aaron.token', 'utf8').trim();
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, base, email, mdp, clic = [720, 860]) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const texte = (p) => p.evaluate(() => document.body.innerText);
const ORG = 'Atelier London 0831';
const api = async (path) => (await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
const orgId = (await api('/v1/admin/organizations')).organizations.find((o) => o.name === ORG).id;

let t;
if (!process.env.SEULEMENT_TEL) {
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
await p.goto('http://127.0.0.1:4181/#/tour/organisations'); await a(2500);
const carte = p.locator('article, tr, li, div').filter({ hasText: ORG }).filter({ has: p.locator('button:has-text("Dossier")') }).last();
await carte.locator('button:has-text("Dossier")').first().click(); await a(2200);
t = await texte(p);
console.log('dossier ouvert :', t.includes(ORG), '| phrase de formule :', (t.match(/Business standard inclut \d+ modules et \d+ places\./) || ['—'])[0]);
const tuiles = await p.locator('button[aria-pressed]').count();
const verrous = await p.locator('button[aria-pressed][disabled]').count();
console.log('tuiles :', tuiles, '| toujours ouvert (verrouillées) :', verrous, '| réglables :', tuiles - verrous);
const ouverts = () => p.locator('button[aria-pressed="true"]:not([disabled])').count();
const avant = await ouverts();
console.log('ouverts avant :', avant, '| ligne d’ajustements :', (t.match(/.*(ajouté\(s\) hors formule|Aucun ajustement).*/) || ['—'])[0].trim());

// 1. AJOUTER un module hors formule : Messages privés
const dm = p.locator('button[aria-pressed]').filter({ hasText: 'Messages privés' }).first();
await dm.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(400);
console.log('Messages privés avant :', await dm.getAttribute('aria-pressed'), '|', (await dm.innerText()).replace(/\n/g, ' · '));
await dm.click(); await a(2200);
console.log('Messages privés après :', await dm.getAttribute('aria-pressed'), '|', (await dm.innerText()).replace(/\n/g, ' · '), '| ouverts :', await ouverts());
await p.screenshot({ path: `${OUT}/01-module-ajoute.png` });

// 2. RETIRER un module de la formule : le premier ouvert « Inclus dans la formule »
const inclus = p.locator('button[aria-pressed="true"]:not([disabled])').filter({ hasText: 'Inclus dans la formule' }).first();
const nomInclus = await inclus.locator('span.text-sm').first().innerText();
await inclus.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(400);
await inclus.click(); await a(2200);
const retire = p.locator('button[aria-pressed]').filter({ hasText: nomInclus }).first();
console.log(`« ${nomInclus} » après fermeture :`, await retire.getAttribute('aria-pressed'), '|', (await retire.innerText()).replace(/\n/g, ' · '), '| ouverts :', await ouverts());
t = await texte(p);
console.log('ligne d’ajustements :', (t.match(/.*ajouté\(s\) hors formule.*/) || ['—'])[0].trim(), '| bouton Revenir à la formule ?', (await p.locator('button:has-text("Revenir à la formule")').count()) > 0);
await p.screenshot({ path: `${OUT}/02-module-retire.png` });

// 3. Le journal, côté serveur
const journal = (await api(`/v1/admin/access-log?org=${orgId}&limit=5`)).entries.slice(0, 3).map((e) => `${e.action} — ${e.detail}`);
console.log('journal :', journal.join(' | '));

// 4. Le plancher des places : deux comptes chez elle → « 1 personne » grisée
const select = p.locator('select').filter({ has: p.locator('option[value="1"]') }).first();
await select.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(300);
const options = await select.locator('option').evaluateAll((os) => os.map((o) => `${o.textContent.trim()}${o.disabled ? ' (grisée)' : ''}`));
console.log('places :', options.join(' · '));
console.log('phrase des comptes :', (t.match(/\d+ compte\(s\) occupent une place aujourd’hui\./) || ['—'])[0]);
await p.screenshot({ path: `${OUT}/03-places-plancher.png` });

// 5. Retour à l'état de départ : les deux gestes inverses
await dm.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(300); await dm.click(); await a(2000);
await retire.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(300); await retire.click(); await a(2000);
t = await texte(p);
console.log('retour : ouverts =', await ouverts(), '(avant :', avant + ')', '| Messages privés :', await dm.getAttribute('aria-pressed'), '|', (t.match(/.*(ajouté\(s\) hors formule|Aucun ajustement).*/) || ['—'])[0].trim());

}

// 6. Téléphone : l'épingle se voit quand rien n'est épinglé
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
m.on('pageerror', (e) => console.log('ERREUR PAGE (tél):', String(e).slice(0, 160)));
await connecter(m, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai', [195, 420]);
await m.evaluate(() => localStorage.setItem('amn.nav.favorites', '[]')); await m.reload(); await a(2500); await m.mouse.click(195, 420); await a(500);
await m.locator('nav[aria-label="Navigation principale"] button').last().click(); await a(1200);
t = await texte(m);
const epingles = m.locator('[role="dialog"] button[aria-label^="Épingler"]');
const couleur = await epingles.first().evaluate((el) => getComputedStyle(el).color);
const boite = await epingles.first().boundingBox();
console.log('lanceur : phrase « Rien n’est épinglé » ?', /Rien n’est épinglé/.test(t), '| épingles :', await epingles.count(), '| couleur de la première :', couleur, '| taille :', boite && `${Math.round(boite.width)}×${Math.round(boite.height)}`);
await m.screenshot({ path: `${OUT}/04-telephone-epingle-visible.png` });
await epingles.first().tap(); await a(800);
const favoris = await m.evaluate(() => localStorage.getItem('amn.nav.favorites'));
console.log('après un tap : favoris =', favoris, '| phrase disparue ?', !/Rien n’est épinglé/.test(await texte(m)));
await m.locator('[role="dialog"] button[aria-label="Fermer"]').first().tap().catch(() => m.keyboard.press('Escape')); await a(800);
await m.screenshot({ path: `${OUT}/05-telephone-barre-epinglee.png` });
await nav.close();

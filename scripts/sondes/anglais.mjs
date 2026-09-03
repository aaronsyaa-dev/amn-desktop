/* Les écrans historiques en anglais (Bloc 3, gravité 2) : titre, résidus de français, deux captures. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/supervision-2026-09-04';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
await p.goto('http://127.0.0.1:4180/'); await a(1800);
await p.locator('input[name="email"]').fill('fleuriste.essai@exemple.test'); await p.locator('input[name="password"]').fill('Fleuriste-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(500);
await p.evaluate(() => localStorage.setItem('amn.langue.utilisateur', 'en')); await p.reload(); await a(2500); await p.mouse.click(720, 860); await a(500);
const FRANCAIS = /\b(le|la|les|des|une|un|et|pour|avec|vos|votre|aucun|aucune|ajouter|enregistrer|supprimer|nouveau|nouvelle|depuis|encore|rien)\b/gi;
const ROUTES = [['tasks','/tasks'],['clients','/clients'],['invoices','/facturation'],['projects','/projets'],['settings','/settings'],['notes','/notes'],['expenses','/depenses'],['time','/temps'],['evenements','/evenements'],['reports','/reports'],['vault','/vault'],['pages','/pages'],['media','/media'],['calculators','/calculateurs']];
let total = 0;
for (const [key, to] of ROUTES) {
  await p.goto(`http://127.0.0.1:4180/#${to}`); await a(1500);
  const h1 = await p.evaluate(() => document.querySelector('main h1, h1')?.innerText?.trim() ?? '');
  const texte = await p.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
  const lignes = texte.split('\n').map((s) => s.trim()).filter((s) => s && FRANCAIS.test(s) && !/Audit \w+ 0904/.test(s)); FRANCAIS.lastIndex = 0;
  total += lignes.length;
  console.log(`${key.padEnd(12)} h1=${JSON.stringify(h1)} résidus=${lignes.length} ${lignes.slice(0, 3).map((s) => s.slice(0, 60)).join(' / ')}`);
  if (key === 'tasks' || key === 'invoices') await p.screenshot({ path: `${OUT}/06-anglais-${key}.png` });
}
console.log('total résidus (dont contenu saisi en français) :', total);
await p.evaluate(() => localStorage.removeItem('amn.langue.utilisateur'));
await nav.close();

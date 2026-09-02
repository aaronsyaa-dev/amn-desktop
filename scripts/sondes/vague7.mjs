/* Vague 7 — Caisse du jour, Tournées, Matériel : vide (cliente) puis plein (interne), refus du chevauchement. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/nuit2';
const H = String(Date.now()).slice(-4);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, base, email, mdp) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(720, 860); await a(700);
};
const texte = (p) => p.evaluate(() => document.body.innerText);
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE cliente:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
for (const [chemin, nom] of [['caisse', 'caisse'], ['tournees', 'tournees'], ['materiel', 'materiel']]) {
  await c.goto(`http://127.0.0.1:4180/#/${chemin}`); await a(1800); const t = await texte(c);
  console.log(`vide ${nom} : écran là ?`, !/Accueil\n/.test(t.split('\n').slice(0, 3).join('\n')), '| point d’exclamation ?', /!/.test(t), '| premier geste ou constat ?', /Garder le comptage|Préparer|Ajouter|Aucune ressource/.test(t));
  await c.screenshot({ path: `${OUT}/v7-${nom}-vide.png` });
}
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE interne:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
let t;
// Caisse : fond 150, attendu 420, compté 565 → écart −5,00 €
await p.goto('http://127.0.0.1:4181/#/caisse'); await a(1500);
const champs = p.locator('input[inputmode="decimal"]'); await champs.nth(0).fill('150'); await champs.nth(1).fill('420'); await champs.nth(2).fill('565');
await p.locator('input[aria-label*="Un mot"]').fill('Un billet de 5 rendu en trop, sans doute.');
await p.locator('button:has-text("Garder le comptage")').click(); await a(1200); t = await texte(p);
console.log('caisse : écart −5,00 € calculé et gardé ?', /-5,00/.test(t) && /Comptage gardé/.test(t));
await p.screenshot({ path: `${OUT}/v7-caisse-plein.png` });
// Tournées : trois arrêts, un livré, l'ordre modifié
await p.goto('http://127.0.0.1:4181/#/tournees'); await a(1500);
await p.locator('button:has-text("Nouvelle tournée")').first().click(); await a(400);
await p.locator('input[aria-label*="tournée"]').fill(`Livraisons du matin ${H}`);
await p.locator('textarea').first().fill('Boulangerie Martin, 12 rue des Lilas, Nantes\nFleurs du Port, 3 quai de la Fosse, Nantes\nMme Bernard, 8 rue Crébillon, Nantes');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1000);
const tournee = p.locator('article').filter({ hasText: `Livraisons du matin ${H}` });
await tournee.locator('button[aria-label="À livrer"]').first().click(); await a(500);
await tournee.locator('button[aria-label="Avancer cet arrêt"]').nth(2).click(); await a(700);
t = await texte(p); const ordre = (await tournee.locator('ol li p').allInnerTexts()).filter((x) => !/rue|quai/.test(x));
console.log('tournées : 1/3 livré, Mme Bernard remontée en deuxième ?', /1\/3 arrêts/i.test(t), ordre[1] === 'Mme Bernard', '| lien carte OpenStreetMap ?', (await tournee.locator('a[href*="openstreetmap.org"]').count()) === 3);
await p.screenshot({ path: `${OUT}/v7-tournees-plein.png` });
// Matériel : une camionnette, une réservation, puis un chevauchement refusé
await p.goto('http://127.0.0.1:4181/#/materiel'); await a(1500);
await p.locator('input[aria-label*="ressource"]').fill(`Camionnette ${H}`); await p.locator('input[aria-label*="genre"]').fill('véhicule');
await p.locator('button:has-text("Ajouter")').first().click(); await a(900);
await p.locator('select').selectOption({ label: `Camionnette ${H}` });
const debut = p.locator('input[type="datetime-local"]').nth(0); const fin = p.locator('input[type="datetime-local"]').nth(1);
const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
const f = new Date(d.getTime() + 2 * 3_600_000);
await debut.fill(iso(d)); await fin.fill(iso(f)); await p.locator('input[aria-label*="Pour quoi"]').fill('Livraison Dupont');
await p.locator('button:has-text("Réserver")').click(); await a(1000); t = await texte(p);
console.log('matériel : réservation posée ?', /Livraison Dupont/.test(t));
const d2 = new Date(d.getTime() + 3_600_000); const f2 = new Date(d2.getTime() + 3_600_000);
await debut.fill(iso(d2)); await fin.fill(iso(f2)); await p.locator('input[aria-label*="Pour quoi"]').fill('Marché');
await p.locator('button:has-text("Réserver")').click(); await a(800); t = await texte(p);
console.log('matériel : chevauchement refusé, en nommant qui l’a ?', /Déjà réservé par essai\.interne/.test(t) && !/Marché/.test(t.replace(/Marché\b(?=.*Réserver)/, '')) );
await p.screenshot({ path: `${OUT}/v7-materiel-plein.png` });
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
for (const [chemin, nom] of [['tournees', 'tournees'], ['caisse', 'caisse']]) {
  await m.goto(`http://127.0.0.1:4181/#/${chemin}`); await a(1800); await m.mouse.click(195, 420); await a(600);
  const large = await m.evaluate(() => document.documentElement.scrollWidth);
  console.log(`téléphone ${nom} : largeur ≤ 390 ?`, large <= 390);
  await m.screenshot({ path: `${OUT}/v7-${nom}-telephone.png` });
}
await nav.close();

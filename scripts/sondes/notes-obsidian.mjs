/* Notes façon Obsidian : étiquettes, note du jour, mentions non liées → lien, voisinage dans le graphe. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/nuit2';
const H = String(Date.now()).slice(-4);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:4181/'); await a(1800);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test'); await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click(); await a(4000); await p.mouse.click(720, 860); await a(700);
const texte = () => p.evaluate(() => document.body.innerText);
const creerNote = async (titre, corps) => {
  await p.goto('http://127.0.0.1:4181/#/notes'); await a(1200);
  await p.locator('button:has-text("Nouvelle note")').click(); await a(500);
  const menu = p.locator('button:has-text("Note d’équipe")'); if (await menu.count()) { await menu.click(); await a(500); }
  const titreInput = p.locator('input[placeholder*="itre"], input[aria-label*="itre"]').first();
  await titreInput.fill(titre); await titreInput.press('Tab'); await a(400);
  await p.locator('textarea').first().fill(corps); await a(1200);
};
await creerNote(`Boulangerie Martin ${H}`, `Le client principal. #devis #boulangerie\nDevis en cours pour le site.`);
await creerNote(`Réunion du lundi ${H}`, `On a parlé de Boulangerie Martin ${H} et du planning. #devis`);
// La note B mentionne A en clair : ouvrir A → mention non liée → Lier
await p.goto('http://127.0.0.1:4181/#/notes'); await a(1200);
await p.locator('input[placeholder="Rechercher…"]').fill(`Boulangerie Martin ${H}`); await a(500);
await p.locator('button, li').filter({ hasText: `Boulangerie Martin ${H}` }).first().click(); await a(800);
let t = await texte(); console.log('mention non liée détectée ?', /mentionne ce titre sans lien/i.test(t));
await p.locator('button:has-text("Lier")').first().click(); await a(1200);
t = await texte(); console.log('après « Lier » : la note pointe ici ?', /pointe ici/i.test(t) && !/mentionne ce titre sans lien/i.test(t));
await p.screenshot({ path: `${OUT}/notes-mentions-liees.png` });
// Étiquettes : la puce #devis filtre à 2 notes
await p.locator('input[placeholder="Rechercher…"]').fill(''); await a(400);
await p.locator('button:has-text("#devis")').first().click(); await a(600);
const liste = await p.locator('input[placeholder="Rechercher…"]').inputValue();
t = await texte(); console.log('étiquette #devis : recherche = « #devis », les deux notes visibles ?', liste === '#devis', t.includes(`Boulangerie Martin ${H}`) && t.includes(`Réunion du lundi ${H}`));
await p.screenshot({ path: `${OUT}/notes-etiquettes.png` });
// Note du jour
await p.locator('input[placeholder="Rechercher…"]').fill(''); await a(300);
await p.locator('button:has-text("Note du jour")').click(); await a(1000);
const jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const titreOuvert = await p.locator('input[placeholder="Titre de la note"]').inputValue().catch(() => ''); console.log('note du jour créée et ouverte ?', titreOuvert === jour);
// Graphe : voisinage (la note A choisie : B nette, le reste effacé)
await p.locator('input[placeholder="Rechercher…"]').fill(`${H}`); await a(400);
await p.locator('button, li').filter({ hasText: `Boulangerie Martin ${H}` }).first().click(); await a(500);
await p.locator('button:has-text("Graphe")').click(); await a(1200);
const opacites = await p.evaluate((h) => { const b = [...document.querySelectorAll('button[title]')].filter((x) => x.style.opacity !== ''); return { nettes: b.filter((x) => x.title.includes(h) && x.style.opacity === '1').length, effacees: b.filter((x) => !x.title.includes(h) && x.style.opacity === '0.4').length, total: b.length }; }, H);
console.log('graphe : la note et sa voisine nettes, le reste effacé ?', opacites.nettes === 2 && opacites.effacees === opacites.total - 2, opacites);
await p.screenshot({ path: `${OUT}/notes-graphe-voisinage.png` });
await nav.close();

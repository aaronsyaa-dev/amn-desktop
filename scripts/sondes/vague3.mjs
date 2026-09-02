/* Vague 3 — Production : chaque module vide (cliente seule) puis plein (équipe interne), captures poste + téléphone. */
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
const MODULES = [['tableau-projets', 'tableau'], ['stock', 'stock'], ['fournisseurs', 'fournisseurs'], ['planning', 'planning'], ['controles', 'controles'], ['montage', 'montage'], ['sav', 'sav'], ['nomenclatures', 'nomenclatures']];

/* ── Vides : la cliente seule (Fleuriste) ── */
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE cliente:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
for (const [chemin, nom] of MODULES) {
  await c.goto(`http://127.0.0.1:4180/#/${chemin}`); await a(1800);
  const t = await texte(c);
  console.log(`vide ${nom} : écran là ?`, !/Accueil\n/.test(t.split('\n').slice(0, 3).join('\n')), '| point d’exclamation ?', /!/.test(t), '| premier geste nommé ?', /Suivre|Noter|Inviter|Écrire|Ouvrir|Décrire/.test(t));
  await c.screenshot({ path: `${OUT}/v3-${nom}-vide.png` });
}

/* ── Pleins : l'équipe interne ── */
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE interne:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
let t;
// Stock : un article sous le seuil, une sortie
await p.goto('http://127.0.0.1:4181/#/stock'); await a(1500);
await p.locator('button:has-text("Nouvel article")').first().click(); await a(400);
await p.locator('input[aria-label*="article"]').first().fill(`Farine T55 ${H}`);
await p.locator('input[aria-label*="unité"]').fill('kg');
await p.locator('input[aria-label="Quantité en stock"]').fill('6');
await p.locator('input[aria-label*="Seuil"]').fill('5');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
await p.locator('button[aria-label="Une sortie"]').first().click(); await a(900);
t = await texte(p); console.log('stock : article ajouté ?', t.includes(`Farine T55 ${H}`), '| passé sous le seuil après une sortie ?', /À commander\s*\n?\s*[1-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v3-stock-plein.png` });
// Fournisseurs : ajouter, commander aujourd'hui
await p.goto('http://127.0.0.1:4181/#/fournisseurs'); await a(1500);
await p.locator('button:has-text("Nouveau fournisseur")').first().click(); await a(400);
await p.locator('input[aria-label="Le fournisseur"]').fill(`Minoterie Lefranc ${H}`);
await p.locator('input[aria-label*="livre"]').fill('Farine, levure');
await p.locator('input[aria-label*="contact"]').fill('Paul');
await p.locator('input[aria-label="Téléphone"]').fill('06 12 34 56 78');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
await p.locator('button:has-text("Commandé aujourd’hui")').first().click(); await a(900);
t = await texte(p); console.log('fournisseurs : fiche + commande du jour ?', t.includes(`Minoterie Lefranc ${H}`) && /dernière commande/i.test(t));
await p.screenshot({ path: `${OUT}/v3-fournisseurs-plein.png` });
// Planning : poser trois cases
await p.goto('http://127.0.0.1:4181/#/planning'); await a(1500);
const cases = p.locator('table tbody button');
const n = await cases.count(); console.log('planning : cases dans la grille ?', n >= 7);
await cases.nth(0).click(); await a(400); await cases.nth(1).click(); await a(400); await cases.nth(1).click(); await a(400); await cases.nth(2).click(); await a(900);
t = await texte(p); console.log('planning : matin + après-midi posés ?', /Matin/.test(t) && /Après-midi/.test(t), '| cases posées ≥ 3 ?', /Cases posées\s*\n?\s*[3-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v3-planning-plein.png` });
// Contrôles : un modèle, un passage
await p.goto('http://127.0.0.1:4181/#/controles'); await a(1500);
await p.locator('button:has-text("Nouveau modèle")').first().click(); await a(400);
await p.locator('input[aria-label*="contrôle"]').fill(`Ouverture du magasin ${H}`);
await p.locator('textarea').first().fill('Rideau levé\nCaisse comptée\nVitrine propre\nTempérature du frigo notée');
await p.locator('button:has-text("Créer le modèle")').click(); await a(1200);
await p.locator('button:has-text("Faire un passage")').first().click(); await a(500);
const points = p.locator('button[aria-pressed]'); await points.nth(0).click(); await points.nth(1).click(); await points.nth(2).click(); await a(300);
await p.locator('button:has-text("Enregistrer le passage")').click(); await a(1200);
t = await texte(p); console.log('contrôles : passage 3/4 enregistré ?', t.includes(`Ouverture du magasin ${H}`) && /3\/4 conformes/.test(t));
await p.screenshot({ path: `${OUT}/v3-controles-plein.png` });
// Montage : un chantier, deux étapes faites
await p.goto('http://127.0.0.1:4181/#/montage'); await a(1500);
await p.locator('button:has-text("Nouveau chantier")').first().click(); await a(400);
await p.locator('input[aria-label*="chantier"]').fill(`Cuisine Dupont ${H}`);
await p.locator('input[aria-label="Pour qui"]').fill('M. Dupont');
await p.locator('textarea').first().fill('Dépose de l’ancienne cuisine\nPlomberie\nPose des meubles\nPlan de travail\nFinitions');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
const etapes = p.locator('article button[aria-pressed]'); await etapes.nth(0).click(); await a(300); await etapes.nth(1).click(); await a(900);
t = await texte(p); console.log('montage : 2/5 étapes ?', t.includes(`Cuisine Dupont ${H}`) && /2\/5 étapes/i.test(t));
await p.screenshot({ path: `${OUT}/v3-montage-plein.png` });
// SAV : une demande, prise en charge, résolue
await p.goto('http://127.0.0.1:4181/#/sav'); await a(1500);
await p.locator('button:has-text("Nouvelle demande")').first().click(); await a(400);
await p.locator('input[aria-label="Le client"]').fill('Mme Bernard');
await p.locator('input[aria-label*="problème"]').fill(`Porte qui ferme mal ${H}`);
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
await p.locator('button:has-text("Prendre en charge")').first().click(); await a(800);
t = await texte(p); console.log('sav : demande prise en charge ?', t.includes(`Porte qui ferme mal ${H}`) && /En cours\s*\n?\s*[1-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v3-sav-plein.png` });
// Nomenclatures : un produit, prix de revient et marge
await p.goto('http://127.0.0.1:4181/#/nomenclatures'); await a(1500);
await p.locator('button:has-text("Nouveau produit")').first().click(); await a(400);
await p.locator('input[aria-label*="produit"]').fill(`Tarte aux pommes ${H}`);
await p.locator('input[aria-label*="Prix de vente"]').fill('18');
await p.locator('textarea').first().fill('Pommes, 1, kg, 2,50\nPâte, 1, pièce, 1,20\nSucre, 0.1, kg, 1,80\nBeurre, 0.1, kg, 9');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
t = await texte(p); console.log('nomenclatures : coût 4,78 € et marge 13,22 € ?', /4,78/.test(t) && /13,22/.test(t), '| marge moyenne 73 % ?', /73 %/.test(t));
await p.screenshot({ path: `${OUT}/v3-nomenclatures-plein.png` });
// Tableau des projets : lu depuis Projets
await p.goto('http://127.0.0.1:4181/#/tableau-projets'); await a(1500); t = await texte(p);
console.log('tableau : colonnes de statuts ?', (await p.locator('section[aria-label]').count()) >= 3, '| projets ou état vide nommé ?', /Ouvrir un premier projet|Ouvrir Projets/.test(t));
await p.screenshot({ path: `${OUT}/v3-tableau-plein.png` });

/* ── Téléphone ── */
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
for (const [chemin, nom] of [['stock', 'stock'], ['planning', 'planning'], ['sav', 'sav']]) {
  await m.goto(`http://127.0.0.1:4181/#/${chemin}`); await a(1800); await m.mouse.click(195, 420); await a(600);
  const large = await m.evaluate(() => document.documentElement.scrollWidth);
  console.log(`téléphone ${nom} : largeur ≤ 390 ?`, large <= 390);
  await m.screenshot({ path: `${OUT}/v3-${nom}-telephone.png` });
}
await nav.close();

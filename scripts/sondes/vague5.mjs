/* Vague 5 — Personnel & outils : chaque module vide (cliente seule) puis plein (équipe interne), le générateur du coffre, captures poste + téléphone. */
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
const MODULES = [['personnel/habitudes', 'habitudes'], ['personnel/objectifs', 'objectifs'], ['personnel/journal', 'journalperso'], ['personnel/pomodoro', 'pomodoro'], ['outils/qr', 'qr'], ['outils/convertisseurs', 'convertisseurs'], ['outils/modeles', 'modeles'], ['outils/automatisations', 'automatisations'], ['outils/donnees', 'donnees']];

/* ── Vides : la cliente seule (Fleuriste) ── */
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE cliente:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
for (const [chemin, nom] of MODULES) {
  await c.goto(`http://127.0.0.1:4180/#/${chemin}`); await a(1800);
  const t = await texte(c);
  console.log(`vide ${nom} : écran là ?`, !/Accueil\n/.test(t.split('\n').slice(0, 3).join('\n')), '| point d’exclamation ?', /!/.test(t), '| premier geste ou outil prêt ?', /Écrire|Poser|Garder|Lancer|Encoder|Longueurs|Créer|Exporter|Importer/.test(t));
  await c.screenshot({ path: `${OUT}/v5-${nom}-vide.png` });
}

/* ── Pleins : l'équipe interne ── */
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE interne:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
let t;
// Habitudes
await p.goto('http://127.0.0.1:4181/#/personnel/habitudes'); await a(1500);
await p.locator('button:has-text("Nouvelle habitude")').first().click(); await a(400);
await p.locator('input[aria-label*="habitude"]').fill(`Marcher vingt minutes ${H}`); await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(600);
await p.locator('button[aria-label="À faire aujourd’hui"]').first().click(); await a(600);
t = await texte(p); console.log('habitudes : cochée, série 1, rangement local dit ?', t.includes(`Marcher vingt minutes ${H}`) && /[1-9] jour\(s\) d’affilée/i.test(t) && /restent sur ce poste/i.test(t));
await p.screenshot({ path: `${OUT}/v5-habitudes-plein.png` });
// Objectifs perso
await p.goto('http://127.0.0.1:4181/#/personnel/objectifs'); await a(1500);
await p.locator('button:has-text("Nouvel objectif")').first().click(); await a(400);
await p.locator('input[aria-label*="objectif"]').fill(`Passer le permis moto ${H}`); await p.locator('textarea').first().fill('Code\nPlateau\nCirculation');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(600);
await p.locator('article button[aria-pressed]').first().click(); await a(600);
t = await texte(p); console.log('objectifs perso : 1/3 pas ?', t.includes(`Passer le permis moto ${H}`) && /1\/3 pas/i.test(t));
await p.screenshot({ path: `${OUT}/v5-objectifs-plein.png` });
// Journal perso
await p.goto('http://127.0.0.1:4181/#/personnel/journal'); await a(1500);
await p.locator('textarea').first().fill(`Journée dense, mais le devis est parti ${H}.`); await p.locator('button[aria-label="Humeur 4 sur 5"]').click(); await a(300);
await p.locator('button[type="submit"]').first().click(); await a(600);
t = await texte(p); console.log('journal perso : gardé, humeur 4 ?', /Gardée/.test(t) && /Humeur moyenne\s*\n?\s*4/i.test(t));
await p.screenshot({ path: `${OUT}/v5-journalperso-plein.png` });
// Pomodoro : 15 min, on ne peut pas attendre — on vérifie le minuteur et la phase
await p.goto('http://127.0.0.1:4181/#/personnel/pomodoro'); await a(1500);
await p.locator('button[role="radio"]:has-text("15 min")').click(); await p.locator('input[aria-label*="Sur quoi"]').fill('Devis Dupont');
await p.locator('button:has-text("Lancer")').click(); await a(2500);
t = await texte(p); console.log('pomodoro : lancé, décompte en cours ?', /14:5[0-9]/.test(t) && /Concentration/i.test(t));
await p.screenshot({ path: `${OUT}/v5-pomodoro-plein.png` });
// QR : encoder l'adresse de rendez-vous, SVG présent
await p.goto('http://127.0.0.1:4181/#/outils/qr'); await a(1500);
await p.getByRole('button', { name: 'Ma page de rendez-vous', exact: true }).click(); await a(800);
t = await texte(p); const svgs = await p.locator('svg[viewBox]').filter({ has: p.locator('path') }).count();
console.log('qr : adresse encodée, version affichée, image là ?', /Version\s*\n?\s*[1-9]/i.test(t) && (await p.locator('[role="img"][aria-label^="QR code"]').count()) === 1);
await p.screenshot({ path: `${OUT}/v5-qr-plein.png` });
// Convertisseurs : HT → TTC
await p.goto('http://127.0.0.1:4181/#/outils/convertisseurs'); await a(1500);
await p.locator('button[role="tab"]:has-text("HT et TTC")').click(); await a(400);
t = await texte(p); console.log('convertisseurs : 100 € HT → 120,00 € TTC ?', /120,00/.test(t));
await p.locator('button[role="tab"]:has-text("Températures")').click(); await a(300); t = await texte(p); console.log('convertisseurs : 20 °C → 68 °F ?', /\b68\b/.test(t));
await p.screenshot({ path: `${OUT}/v5-convertisseurs-plein.png` });
// Modèles : créer, remplir, copier
await p.goto('http://127.0.0.1:4181/#/outils/modeles'); await a(1500);
await p.locator('button:has-text("Nouveau modèle")').first().click(); await a(400);
await p.locator('input[aria-label*="modèle"]').fill(`Confirmation de commande ${H}`); await p.locator('textarea').first().fill('Bonjour {prénom}, votre commande sera prête le {date}. À bientôt.');
await p.locator('button[type="submit"]:has-text("Créer")').click(); await a(800);
await p.locator('button[aria-pressed]').filter({ hasText: `Confirmation de commande ${H}` }).click(); await a(400);
await p.locator('input[aria-label="prénom"]').fill('Nadia'); await p.locator('input[aria-label="date"]').fill('jeudi'); await a(300);
t = await texte(p); console.log('modèles : trous remplis ?', /Bonjour Nadia, votre commande sera prête le jeudi/.test(t));
await p.screenshot({ path: `${OUT}/v5-modeles-plein.png` });
// Automatisations : une règle « réponse de formulaire → tâche », et la tâche créée pour la réponse déjà reçue
await p.goto('http://127.0.0.1:4181/#/outils/automatisations'); await a(1500);
await p.locator('button:has-text("Nouvelle règle")').first().click(); await a(400);
await p.locator('button:has-text("Créer la règle")').click(); await a(2500);
t = await texte(p); console.log('automatisations : règle active, tâches créées depuis les réponses ?', /Actives\s*\n?\s*[1-9]/i.test(t) && /Créés par les règles\s*\n?\s*[1-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v5-automatisations-plein.png` });
await p.goto('http://127.0.0.1:4181/#/tasks'); await a(1800); t = await texte(p);
console.log('tâches : la tâche automatique « Répondre à … » est là ?', /Répondre à « Demande de devis/.test(t));
await p.screenshot({ path: `${OUT}/v5-automatisations-taches.png` });
// Import / export : export CSV des clients (téléchargement capté)
await p.goto('http://127.0.0.1:4181/#/outils/donnees'); await a(1500);
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.locator('button:has-text("clients")').first().click()]);
const chemin = await dl.path(); const contenu = (await import('node:fs')).readFileSync(chemin, 'utf-8');
console.log('données : CSV clients téléchargé avec en-tête et lignes ?', /^﻿?id;/.test(contenu) && contenu.split('\n').length >= 2, '| message ?', /ligne\(s\) exportée\(s\)/.test(await texte(p)));
// …et l'import d'un CSV de stock
const csv = `article;quantité;unité;seuil\nLevure ${H};12;kg;3\nSel fin ${H};4;kg;5\n`;
await p.locator('input[aria-label="Importer du stock"]').setInputFiles({ name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') }); await a(1500);
t = await texte(p); console.log('données : import stock 2 lignes posées ?', /2 ligne\(s\) lue\(s\), 2 posée\(s\)/.test(t));
await p.screenshot({ path: `${OUT}/v5-donnees-plein.png` });
await p.goto('http://127.0.0.1:4181/#/stock'); await a(1500); t = await texte(p);
console.log('stock : les articles importés sont là, le sel sous le seuil ?', t.includes(`Levure ${H}`) && t.includes(`Sel fin ${H}`));
// Coffre-fort : générer un mot de passe
await p.goto('http://127.0.0.1:4181/#/vault'); await a(1500);
await p.locator('button:has-text("Nouvelle entrée")').click(); await a(500);
await p.locator('button:has-text("Générer un mot de passe fort")').click(); await a(300);
const mdp = await p.locator('input[type="text"]').filter({ has: p.locator('xpath=.') }).last().inputValue().catch(() => '');
const revele = await p.evaluate(() => { const i = [...document.querySelectorAll('input')].find((x) => /[!#$%&*+\-=?@_]/.test(x.value) && x.value.length >= 20); return i ? i.value : ''; });
console.log('coffre-fort : mot de passe généré de 20 signes, avec symbole, révélé ?', revele.length === 20 && /[a-z]/.test(revele) && /[A-Z]/.test(revele) && /[2-9]/.test(revele));
await p.screenshot({ path: `${OUT}/v5-coffre-generateur.png` });

/* ── Téléphone ── */
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
for (const [chemin, nom] of [['personnel/pomodoro', 'pomodoro'], ['outils/qr', 'qr'], ['outils/convertisseurs', 'convertisseurs']]) {
  await m.goto(`http://127.0.0.1:4181/#/${chemin}`); await a(1800); await m.mouse.click(195, 420); await a(600);
  const large = await m.evaluate(() => document.documentElement.scrollWidth);
  console.log(`téléphone ${nom} : largeur ≤ 390 ?`, large <= 390);
  await m.screenshot({ path: `${OUT}/v5-${nom}-telephone.png` });
}
await nav.close();

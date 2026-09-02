/* Vague 4 — Pilotage & livrables : chaque module vide (cliente seule) puis plein (équipe interne), la mini-page et le formulaire publics, captures poste + téléphone. */
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
const MODULES = [['objectifs-resultats', 'okr'], ['revue-hebdo', 'revue'], ['reunions', 'reunions'], ['priorites', 'priorites'], ['routines', 'routines'], ['journal-de-bord', 'journal'], ['formulaires', 'formulaires'], ['mini-page', 'minipage'], ['lettre', 'lettre'], ['signature', 'signature'], ['portfolio', 'portfolio']];

/* ── Vides : la cliente seule (Fleuriste) ── */
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE cliente:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
for (const [chemin, nom] of MODULES) {
  await c.goto(`http://127.0.0.1:4180/#/${chemin}`); await a(1800);
  const t = await texte(c);
  console.log(`vide ${nom} : écran là ?`, !/Accueil\n/.test(t.split('\n').slice(0, 3).join('\n')), '| point d’exclamation ?', /!/.test(t), '| premier geste nommé ?', /Poser|Écrire|Consigner|Noter|Ajouter|Composer|Ouvrir la page|Garder|Enregistrer/.test(t));
  await c.screenshot({ path: `${OUT}/v4-${nom}-vide.png` });
}

/* ── Pleins : l'équipe interne ── */
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE interne:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
let t;
// Priorités
await p.goto('http://127.0.0.1:4181/#/priorites'); await a(1500);
await p.locator('input[aria-label*="priorité"]').fill(`Rappeler Mme Bernard ${H}`); await p.locator('button:has-text("Poser")').click(); await a(1000);
await p.locator('button[aria-label="Faite"]').first().click(); await a(900);
t = await texte(p); console.log('priorités : posée puis faite ?', t.includes(`Rappeler Mme Bernard ${H}`) && /Faites aujourd’hui\s*\n?\s*[1-3]\/[1-3]/i.test(t));
await p.screenshot({ path: `${OUT}/v4-priorites-plein.png` });
// Routines
await p.goto('http://127.0.0.1:4181/#/routines'); await a(1500);
await p.locator('button:has-text("Nouvelle routine")').first().click(); await a(400);
await p.locator('input[aria-label*="routine"]').fill(`Relever la caisse ${H}`); await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1000);
await p.locator('button[aria-label="À faire aujourd’hui"]').first().click(); await a(900);
t = await texte(p); console.log('routines : cochée, série 1 ?', t.includes(`Relever la caisse ${H}`) && /1 jour\(s\) d’affilée/i.test(t));
await p.screenshot({ path: `${OUT}/v4-routines-plein.png` });
// Journal de bord
await p.goto('http://127.0.0.1:4181/#/journal-de-bord'); await a(1500);
await p.locator('textarea').first().fill(`Frigo en panne, réparateur appelé ${H}`); await p.locator('button[role="radio"]:has-text("Panne")').first().click(); await p.locator('button:has-text("Consigner")').click(); await a(1000);
t = await texte(p); console.log('journal : panne consignée ?', t.includes(`réparateur appelé ${H}`) && /Pannes et incidents\s*\n?\s*[1-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v4-journal-plein.png` });
// Revue hebdo
await p.goto('http://127.0.0.1:4181/#/revue-hebdo'); await a(1500);
const zones = p.locator('form textarea'); await zones.nth(0).fill(`Le site est en ligne ${H}`); await zones.nth(1).fill('Les photos manquent'); await zones.nth(4).fill('Livrer la boulangerie');
await p.locator('button:has-text("Garder cette revue")').click(); await a(1000);
t = await texte(p); console.log('revue : gardée, semaine faite ?', /Revue gardée/.test(t) && /Cette semaine\s*\n?\s*Faite/i.test(t));
await p.screenshot({ path: `${OUT}/v4-revue-plein.png` });
// OKR
await p.goto('http://127.0.0.1:4181/#/objectifs-resultats'); await a(1500);
await p.locator('button:has-text("Nouvel objectif")').first().click(); await a(400);
await p.locator('input[aria-label*="objectif"]').fill(`Doubler la vente en ligne ${H}`); await p.locator('input[aria-label*="saison"]').fill('Automne 2026');
await p.locator('textarea').first().fill('Commandes du site, 120, commandes\nAvis Google, 30, avis');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1000);
const actuel = p.locator('article').filter({ hasText: `Doubler la vente en ligne ${H}` }).locator('input[inputmode="decimal"]').first();
await actuel.fill('60'); await actuel.blur(); await a(900);
t = await texte(p); console.log('okr : 60/120 → 25 % de l’objectif ?', t.includes(`Doubler la vente en ligne ${H}`) && /25 %/.test(t));
await p.screenshot({ path: `${OUT}/v4-okr-plein.png` });
// Réunions
await p.goto('http://127.0.0.1:4181/#/reunions'); await a(1500);
await p.locator('button:has-text("Nouvelle réunion")').first().click(); await a(400);
await p.locator('input[aria-label*="objet"]').fill(`Point du lundi ${H}`); await p.locator('input[aria-label*="Qui"]').fill('Aaron, Mohamed');
await p.locator('textarea').first().fill('Stock de farine\nHoraires d’été');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1000);
const reunion = p.locator('article').filter({ hasText: `Point du lundi ${H}` });
await reunion.locator('input[aria-label="Une décision…"]').fill('Commander 50 kg par semaine'); await reunion.locator('input[aria-label="Une décision…"]').press('Enter'); await a(700);
await reunion.locator('input[aria-label="Une suite à donner…"]').fill('Appeler la minoterie'); await reunion.locator('input[aria-label="Une suite à donner…"]').press('Enter'); await a(700);
t = await texte(p); console.log('réunions : décision + suite ?', /Commander 50 kg/.test(t) && /Appeler la minoterie/.test(t) && /Suites ouvertes\s*\n?\s*[1-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v4-reunions-plein.png` });
// Portfolio
await p.goto('http://127.0.0.1:4181/#/portfolio'); await a(1500);
await p.locator('button:has-text("Nouvelle réalisation")').first().click(); await a(400);
await p.locator('input[aria-label*="réalisation"]').fill(`Cuisine en chêne, Nantes ${H}`); await p.locator('input[aria-label*="catégorie"]').fill('Cuisine');
await p.locator('textarea').first().fill('Un plan de travail massif, des façades sans poignées.'); await p.locator('input[type="url"]').fill('https://exemple.test/cuisine');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1000);
t = await texte(p); console.log('portfolio : réalisation visible ?', t.includes(`Cuisine en chêne, Nantes ${H}`) && /Visible sur la mini-page/.test(t));
await p.screenshot({ path: `${OUT}/v4-portfolio-plein.png` });
// Lettre
await p.goto('http://127.0.0.1:4181/#/lettre'); await a(1500);
await p.locator('button:has-text("Nouvelle lettre")').first().click(); await a(400);
await p.locator('input[aria-label="L’objet"]').fill(`Fermeture d’été ${H}`); await p.locator('textarea').first().fill('La boutique ferme du 4 au 18 août. Les commandes du site restent honorées.');
await p.locator('button:has-text("Garder le brouillon")').click(); await a(1000);
t = await texte(p); const destinataires = /Destinataires\s*\n?\s*([0-9]+)/i.exec(t)?.[1];
await p.locator('button:has-text("Marquer envoyée")').first().click(); await a(900);
t = await texte(p); console.log('lettre : destinataires lus depuis Clients ?', Number(destinataires) >= 1, '| marquée envoyée ?', /envoyée .* à [1-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v4-lettre-plein.png` });
// Signature
await p.goto('http://127.0.0.1:4181/#/signature'); await a(1500);
await p.locator('input[aria-label*="document"]').fill(`Devis n° 2026-${H}`); await p.locator('input[aria-label="Qui signe"]').fill('M. Dupont');
const zone = await p.locator('canvas').boundingBox();
await p.mouse.move(zone.x + 40, zone.y + 90); await p.mouse.down(); await p.mouse.move(zone.x + 120, zone.y + 40, { steps: 12 }); await p.mouse.move(zone.x + 200, zone.y + 120, { steps: 12 }); await p.mouse.move(zone.x + 300, zone.y + 60, { steps: 12 }); await p.mouse.up(); await a(300);
await p.locator('button:has-text("Enregistrer la signature")').click(); await a(1200);
await p.locator('button:has-text("Vérifier")').first().click(); await a(800);
t = await texte(p); console.log('signature : scellée et vérifiée intacte ?', t.includes(`Devis n° 2026-${H}`) && /Intacte/.test(t) && /Empreinte/.test(t));
await p.screenshot({ path: `${OUT}/v4-signature-plein.png` });
// Formulaires : composer, publier, répondre depuis un navigateur anonyme, voir la réponse
await p.goto('http://127.0.0.1:4181/#/formulaires'); await a(1500);
await p.locator('button:has-text("Nouveau formulaire")').first().click(); await a(400);
await p.locator('input[aria-label*="formulaire"]').fill(`Demande de devis ${H}`); await p.locator('input[aria-label*="accueil"]').fill('Dites-nous ce que vous voulez.');
await p.locator('textarea').first().fill('Votre nom | texte | requis\nVotre email | email | requis\nLe meuble | choix : Table, Étagère\nDes précisions | long');
await p.locator('input[aria-label*="mot de la fin"]').fill('Merci, on revient vers vous sous deux jours.');
await p.locator('button[type="submit"]:has-text("Créer")').click(); await a(1000);
const formulaire = p.locator('article').filter({ hasText: `Demande de devis ${H}` });
await formulaire.locator('button:has-text("Publier")').click(); await a(1000);
t = await texte(p); const adresseForm = (t.match(/http:\/\/127\.0\.0\.1:4181\/#\/f\?org=[^\s]+/) || [])[0];
console.log('formulaires : publié avec adresse ?', Boolean(adresseForm));
await p.screenshot({ path: `${OUT}/v4-formulaires-plein.png` });
if (adresseForm) {
  const v = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  v.on('pageerror', (e) => console.log('ERREUR PAGE formulaire public:', String(e).slice(0, 160)));
  await v.goto(adresseForm); await a(2200);
  await v.locator('input[type="text"]').first().fill(`Léa Visiteuse ${H}`); await v.locator('input[type="email"]').fill('lea@exemple.test');
  await v.locator('select').selectOption('Table'); await v.locator('textarea').fill('Deux mètres, chêne, livraison à Nantes.');
  await v.screenshot({ path: `${OUT}/v4-formulaire-public.png` });
  await v.locator('button:has-text("Envoyer")').click(); await a(2000);
  const tv = await texte(v); console.log('formulaire public : réponse reçue ?', /Reçu/i.test(tv) && /sous deux jours/.test(tv));
  await v.screenshot({ path: `${OUT}/v4-formulaire-public-recu.png` });
  await p.goto('http://127.0.0.1:4181/#/formulaires'); await a(1800);
  await p.locator('article').filter({ hasText: `Demande de devis ${H}` }).locator('button:has-text("Voir les réponses")').click(); await a(600);
  t = await texte(p); console.log('formulaires : la réponse est dans la liste ?', t.includes(`Léa Visiteuse ${H}`) && /Table/.test(t));
  await p.screenshot({ path: `${OUT}/v4-formulaires-reponses.png` });
}
// Mini-page : composer, ouvrir, lire en anonyme
await p.goto('http://127.0.0.1:4181/#/mini-page'); await a(1500);
await p.locator('input').filter({ hasNot: p.locator('[type="checkbox"]') }).first().fill('L’atelier du bois');
const zonesPage = p.locator('textarea'); await zonesPage.nth(0).fill('Bois massif, sur mesure, à Nantes depuis 2012.'); await zonesPage.nth(1).fill('Du mardi au samedi, 9 h – 19 h');
await p.locator('input[type="tel"]').fill('02 40 00 00 00'); await a(600);
t = await texte(p); if (/Ouvrir la page/.test(t)) { await p.locator('button:has-text("Ouvrir la page")').click(); await a(1000); }
t = await texte(p); const adressePage = (t.match(/http:\/\/127\.0\.0\.1:4181\/#\/p\?org=[^\s]+/) || [])[0];
console.log('mini-page : ouverte avec adresse ?', /La page est ouverte/.test(t) && Boolean(adressePage));
await p.screenshot({ path: `${OUT}/v4-minipage-plein.png` });
if (adressePage) {
  const v = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  v.on('pageerror', (e) => console.log('ERREUR PAGE publique:', String(e).slice(0, 160)));
  await v.goto(adressePage); await a(2200);
  const tv = await texte(v);
  console.log('page publique : titre, horaires, avis publiables, réalisations, rendez-vous ?', /L’atelier du bois/.test(tv), /Du mardi au samedi/.test(tv), /Ce qu’en disent les clients/i.test(tv), /Cuisine en chêne/.test(tv), /Prendre rendez-vous/.test(tv));
  await v.screenshot({ path: `${OUT}/v4-page-publique.png`, fullPage: true });
}

/* ── Téléphone ── */
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
for (const [chemin, nom] of [['priorites', 'priorites'], ['formulaires', 'formulaires'], ['signature', 'signature']]) {
  await m.goto(`http://127.0.0.1:4181/#/${chemin}`); await a(1800); await m.mouse.click(195, 420); await a(600);
  const large = await m.evaluate(() => document.documentElement.scrollWidth);
  console.log(`téléphone ${nom} : largeur ≤ 390 ?`, large <= 390);
  await m.screenshot({ path: `${OUT}/v4-${nom}-telephone.png` });
}
await nav.close();

/* Vague 2 — Clients & revenus : chaque module vide (cliente seule) puis plein (équipe interne), la page publique de rendez-vous, captures poste + téléphone. */
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
const MODULES = [['pipeline', 'pipeline'], ['relances', 'relances'], ['abonnements', 'abonnements'], ['contrats', 'contrats'], ['avis', 'avis'], ['fidelite', 'fidelite'], ['parrainage', 'parrainage'], ['rdv-en-ligne', 'rdv']];

/* ── Vides : la cliente seule (Fleuriste) ── */
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE cliente:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
for (const [chemin, nom] of MODULES) {
  await c.goto(`http://127.0.0.1:4180/#/${chemin}`); await a(1800);
  const t = await texte(c);
  console.log(`vide ${nom} : écran là ?`, !/Accueil\n/.test(t.split('\n').slice(0, 3).join('\n')), '| point d’exclamation ?', /!/.test(t), '| premier geste ou constat ?', /Ajouter|Noter|Enregistrer|Rien à relancer|Ouvrir la page|Nouvelle carte/.test(t));
  await c.screenshot({ path: `${OUT}/v2-${nom}-vide.png` });
}

/* ── Pleins : l'équipe interne ── */
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE interne:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
let t;
// Pipeline : ajouter, avancer d'une colonne
await p.goto('http://127.0.0.1:4181/#/pipeline'); await a(1500);
await p.locator('button:has-text("Nouveau prospect")').first().click(); await a(400);
await p.locator('input[placeholder="Nom de la personne"]').fill(`Claire Dubois ${H}`);
await p.locator('input[placeholder="Société, si besoin"]').fill('Pâtisserie du Port');
await p.locator('input[placeholder="Montant espéré, en euros"]').fill('1800');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
await p.locator(`text=Claire Dubois ${H}`).first().scrollIntoViewIfNeeded();
const carte = p.locator(`div:has(> * > span:text("Claire Dubois ${H}")), article:has-text("Claire Dubois ${H}"), li:has-text("Claire Dubois ${H}"), div:has-text("Claire Dubois ${H}")`).last();
await carte.locator('button').first().click().catch(() => undefined); await a(1000);
t = await texte(p); console.log('pipeline : prospect ajouté ?', t.includes(`Claire Dubois ${H}`), '| montant espéré affiché ?', /1\s?800/.test(t));
await p.screenshot({ path: `${OUT}/v2-pipeline-plein.png` });
// Relances : la facture échue semée est là, copier le message, noter la relance
await p.goto('http://127.0.0.1:4181/#/relances'); await a(1500);
t = await texte(p); console.log('relances : facture échue vue ?', /F-2026-0090/.test(t) && /En retard de \d+ jour/i.test(t), '| montant dû 1 440,00 € ?', /Montant dû\s*\n?\s*1\s?440,00/i.test(t));
await p.locator('button:has-text("Noter la relance")').first().click(); await a(1200);
t = await texte(p); console.log('relances : relance notée ?', /relancée/i.test(t));
await p.screenshot({ path: `${OUT}/v2-relances-plein.png` });
// Abonnements : ajouter, facturer
await p.goto('http://127.0.0.1:4181/#/abonnements'); await a(1500);
await p.locator('button:has-text("Nouvel abonnement")').first().click(); await a(400);
await p.locator('input[aria-label*="forfait"]').fill(`Maintenance du site ${H}`);
await p.locator('input[aria-label="Le client"]').fill('Boulangerie Martin');
await p.locator('input[aria-label*="ontant"]').fill('90');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
await p.locator('button:has-text("Facturer")').first().click(); await a(1500);
t = await texte(p); console.log('abonnements : ajouté ?', t.includes(`Maintenance du site ${H}`), '| par mois en euros ?', /Par mois\s*\n?\s*\d+,\d\d/i.test(t));
await p.screenshot({ path: `${OUT}/v2-abonnements-plein.png` });
// Contrats
await p.goto('http://127.0.0.1:4181/#/contrats'); await a(1500);
await p.locator('button:has-text("Nouveau contrat")').first().click(); await a(400);
await p.locator('input[aria-label*="objet"]').first().fill(`Infogérance annuelle ${H}`);
await p.locator('input[aria-label*="autre partie"]').first().fill('Boulangerie Martin');
await p.locator('input[aria-label*="ontant"]').fill('2400');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
t = await texte(p); console.log('contrats : ajouté ?', t.includes(`Infogérance annuelle ${H}`));
await p.screenshot({ path: `${OUT}/v2-contrats-plein.png` });
// Avis
await p.goto('http://127.0.0.1:4181/#/avis'); await a(1500);
await p.locator('button:has-text("Noter un avis")').first().click(); await a(400);
await p.locator('input[aria-label*="Qui l"]').first().fill(`Nadia B. ${H}`);
await p.locator('textarea').first().fill('Réactifs, clairs, et le site tourne. Je recommande.');
await p.locator('button[aria-label="Note : 5 sur 5"]').first().click().catch(() => undefined);
await p.locator('button:has-text("Garder cet avis")').click(); await a(1200);
await p.locator('button:has-text("Marquer publiable")').first().click(); await a(800);
t = await texte(p); console.log('avis : gardé et publiable ?', t.includes(`Nadia B. ${H}`) && /Publiable/.test(t));
await p.screenshot({ path: `${OUT}/v2-avis-plein.png` });
// Fidélité : créer une carte, deux tampons
await p.goto('http://127.0.0.1:4181/#/fidelite'); await a(1500);
await p.locator('input[placeholder="Le nom de la cliente"]').fill(`Sophie L. ${H}`);
await p.keyboard.press('Enter'); await a(1000);
await p.locator('button:has-text("Un tampon")').first().click(); await a(500);
await p.locator('button:has-text("Un tampon")').first().click(); await a(900);
t = await texte(p); console.log('fidélité : carte tamponnée ?', t.includes(`Sophie L. ${H}`) && /Tampons\s*\n?\s*[1-9]/i.test(t));
await p.screenshot({ path: `${OUT}/v2-fidelite-plein.png` });
// Parrainage
await p.goto('http://127.0.0.1:4181/#/parrainage'); await a(1500);
await p.locator('button:has-text("Nouveau parrainage")').first().click(); await a(400);
await p.locator('input[aria-label*="Qui parraine"]').first().fill(`Boulangerie Martin ${H}`);
await p.locator('input[aria-label*="Qui est amené"]').first().fill('Fleuriste du Port');
await p.locator('button[type="submit"]:has-text("Ajouter")').click(); await a(1200);
t = await texte(p); console.log('parrainage : noté ?', t.includes(`Boulangerie Martin ${H}`));
await p.screenshot({ path: `${OUT}/v2-parrainage-plein.png` });
// Rendez-vous en ligne : ouvrir la page, lire l'adresse, réserver depuis un navigateur anonyme
await p.goto('http://127.0.0.1:4181/#/rdv-en-ligne'); await a(1500);
t = await texte(p);
if (/Ouvrir la page/.test(t)) { await p.locator('button:has-text("Ouvrir la page")').first().click(); await a(1200); }
t = await texte(p);
const adresse = (t.match(/http:\/\/127\.0\.0\.1:4181\/#\/rdv\?org=[^\s]+/) || [])[0];
console.log('rdv : page ouverte ?', /La page est ouverte/.test(t), '| adresse publique ?', Boolean(adresse));
await p.screenshot({ path: `${OUT}/v2-rdv-plein.png` });
if (adresse) {
  const v = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  v.on('pageerror', (e) => console.log('ERREUR PAGE publique:', String(e).slice(0, 160)));
  await v.goto(adresse); await a(2500);
  const jours = v.locator('button[aria-pressed]');
  const n = await jours.count(); console.log('rdv public : jours proposés ?', n > 0);
  // premier jour ouvrable ayant des créneaux
  let pris = false;
  for (let i = 0; i < Math.min(n, 14) && !pris; i += 1) {
    await jours.nth(i).click(); await a(600);
    const creneaux = v.locator('button.font-mono[aria-pressed]');
    if ((await creneaux.count()) > 0) { await creneaux.first().click(); pris = true; }
  }
  await a(500);
  await v.screenshot({ path: `${OUT}/v2-rdv-public.png` });
  await v.locator('input[placeholder="Votre nom"]').fill(`Visiteur ${H}`);
  await v.locator('input[type="email"]').fill('visiteur@exemple.test');
  await v.locator('button:has-text("Confirmer ce rendez-vous")').click(); await a(2500);
  const tv = await texte(v); console.log('rdv public : confirmé ?', /C’est noté/i.test(tv) && /Rendez-vous .* à \d\d:\d\d/.test(tv));
  await v.screenshot({ path: `${OUT}/v2-rdv-public-confirme.png` });
  // …et il est dans l'Agenda de l'organisation
  await p.goto('http://127.0.0.1:4181/#/rdv-en-ligne'); await a(1800); t = await texte(p);
  console.log('rdv : pris en ligne compté ?', /Pris en ligne\s*\n?\s*[1-9]/i.test(t));
  await p.goto('http://127.0.0.1:4181/#/agenda'); await a(1800); t = await texte(p);
  console.log('agenda : le rendez-vous du visiteur y est ?', t.includes(`Visiteur ${H}`));
  await p.screenshot({ path: `${OUT}/v2-rdv-agenda.png` });
}

/* ── Téléphone ── */
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
for (const [chemin, nom] of [['pipeline', 'pipeline'], ['relances', 'relances'], ['fidelite', 'fidelite']]) {
  await m.goto(`http://127.0.0.1:4181/#/${chemin}`); await a(1800);
  const large = await m.evaluate(() => document.documentElement.scrollWidth);
  console.log(`téléphone ${nom} : largeur ≤ 390 ?`, large <= 390);
  await m.screenshot({ path: `${OUT}/v2-${nom}-telephone.png` });
}
await nav.close();

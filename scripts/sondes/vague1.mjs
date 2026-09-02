/* Vague 1 — Collectif : chaque module vide (cliente seule) puis plein (équipe interne), captures poste + téléphone. */
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
const MODULES = [['messages-prives', 'dm'], ['groupes', 'groupes'], ['annonces', 'annonces'], ['sondages', 'sondages'], ['absences', 'absences'], ['trombinoscope', 'trombi'], ['appels', 'appels']];

/* ── Vides : la cliente seule (Fleuriste) ── */
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE cliente:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
for (const [chemin, nom] of MODULES) {
  await c.goto(`http://127.0.0.1:4180/#/${chemin}`); await a(1800);
  const t = await texte(c);
  console.log(`vide ${nom} : écran là ?`, !/Accueil\n/.test(t.split('\n').slice(0, 3).join('\n')) , '| point d’exclamation ?', /!/.test(t), '| premier geste nommé ?', /Inviter|Publier|Poser|Déclarer|Créer/.test(t));
  await c.screenshot({ path: `${OUT}/v1-${nom}-vide.png` });
}

/* ── Pleins : l'équipe interne (AMN DevSec, plusieurs comptes) ── */
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE interne:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
// Annonces
await p.goto('http://127.0.0.1:4181/#/annonces'); await a(1500);
await p.locator('button:has-text("Publier")').first().click(); await a(400);
await p.locator('input[placeholder*="titre"]').fill(`Fermeture du magasin vendredi ${H}`);
await p.locator('textarea').first().fill('Inventaire toute la journée. Les commandes du site restent honorées le lundi.');
await p.locator('button:has-text("Publier l’annonce")').click(); await a(1500);
let t = await texte(p); console.log('annonces : publiée et lue par 1 ?', t.includes(`vendredi ${H}`) && /Lu par 1/.test(t));
await p.screenshot({ path: `${OUT}/v1-annonces-plein.png` });
// Sondages
await p.goto('http://127.0.0.1:4181/#/sondages'); await a(1500);
await p.locator('button:has-text("Poser une question")').first().click(); await a(400);
await p.locator('input[placeholder*="question"]').fill(`Quel jour pour la réunion d’équipe ${H} ?`);
await p.locator('textarea').first().fill('Lundi matin\nMardi après-midi\nJeudi matin');
await p.locator('button:has-text("Lancer le sondage")').click(); await a(1500);
await p.locator('button:has-text("Mardi après-midi")').first().click(); await a(1200);
t = await texte(p); console.log('sondages : créé, voté, 100 % ?', t.includes(`équipe ${H}`) && /1 · 100%/.test(t));
await p.screenshot({ path: `${OUT}/v1-sondages-plein.png` });
// Absences
await p.goto('http://127.0.0.1:4181/#/absences'); await a(1500);
await p.locator('button:has-text("Déclarer une absence")').first().click(); await a(400);
await p.locator('select').first().selectOption('teletravail');
await p.locator('input[placeholder*="mot"]').fill('Depuis la maison, joignable');
await p.locator('button:has-text("Enregistrer"), button:has-text("Envoyer la demande")').first().click(); await a(1500);
t = await texte(p); console.log('absences : ligne validée aujourd’hui ?', /Télétravail/.test(t) && /Absent\(e\)s aujourd’hui/.test(t));
await p.screenshot({ path: `${OUT}/v1-absences-plein.png` });
// Groupes
await p.goto('http://127.0.0.1:4181/#/groupes'); await a(1500);
await p.locator('button:has-text("Nouveau groupe")').first().click(); await a(400);
await p.locator('input[placeholder*="nom du groupe"]').fill(`La boutique ${H}`);
const membre = p.locator('button[aria-pressed="false"]').first(); if (await membre.count()) await membre.click();
await p.locator('button:has-text("Créer le groupe")').click(); await a(1500);
await p.locator('input[placeholder*="Écrire dans"]').fill('Qui ouvre demain matin ?');
await p.locator('button[aria-label="Envoyer"]').click(); await a(1200);
t = await texte(p); console.log('groupes : créé, message envoyé ?', t.includes(`La boutique ${H}`) && /Qui ouvre demain/.test(t));
await p.screenshot({ path: `${OUT}/v1-groupes-plein.png` });
// Messages privés
await p.goto('http://127.0.0.1:4181/#/messages-prives'); await a(1500);
const contact = p.locator('ul button').first();
if (await contact.count()) { await contact.click(); await a(600); await p.locator('input[placeholder*="Écrire à"]').fill(`Tu as vu la commande de ce matin ? ${H}`); await p.locator('button[aria-label="Envoyer"]').click(); await a(1200); }
t = await texte(p); console.log('dm : message dans le fil ?', t.includes(`ce matin ? ${H}`));
await p.screenshot({ path: `${OUT}/v1-dm-plein.png` });
// Trombinoscope et Appels
await p.goto('http://127.0.0.1:4181/#/trombinoscope'); await a(1500); t = await texte(p);
console.log('trombi : membres ?', (await p.locator('article').count()), '| point vert (soi) ?', (await p.locator('.bg-success').count()) > 0);
await p.screenshot({ path: `${OUT}/v1-trombi-plein.png` });
await p.goto('http://127.0.0.1:4181/#/appels'); await a(1500); t = await texte(p);
console.log('appels : liste des membres ?', /Les membres/i.test(t), '| bouton inviter par lien ?', /Inviter un visiteur/.test(t));
await p.screenshot({ path: `${OUT}/v1-appels-plein.png` });
// Téléphone : deux écrans
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
for (const [chemin, nom] of [['sondages', 'sondages'], ['messages-prives', 'dm']]) {
  await m.goto(`http://127.0.0.1:4181/#/${chemin}`); await a(1800);
  console.log(`téléphone ${nom} : largeur ≤ 390 ?`, (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await m.screenshot({ path: `${OUT}/v1-${nom}-telephone.png` });
}
await nav.close();

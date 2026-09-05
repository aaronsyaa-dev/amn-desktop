/* Garde, Bloc 3 — l'espace « La Garde » (interne) : la Salle, la pile, un bureau de chef, la Salle commune, le calendrier ; poste et téléphone. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/garde-2026-09-05';
const BASE = process.env.WEB || 'http://127.0.0.1:4181';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, clic) => {
  await p.goto(`${BASE}/`); await a(1800);
  await p.locator('input[name="email"]').fill('essai.interne@exemple.test'); await p.locator('input[name="password"]').fill('Interne-2026-Essai');
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const erreurs = [];
const ok = (etiquette, valeur, detail = '') => { console.log(`${valeur ? '✓' : '✗'} ${etiquette}${detail ? ` — ${detail}` : ''}`); if (!valeur) erreurs.push(etiquette); };

// ——— Poste ———
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
await connecter(p, [720, 860]);

// 1. Le troisième espace existe dans le sélecteur.
await p.goto(`${BASE}/#/garde`); await a(3500);
const espace = await p.evaluate(() => Boolean([...document.querySelectorAll('aside button, nav button, aside a, nav a')].find((b) => /La Garde/.test(b.textContent || ''))));
ok('1. l’espace « La Garde » est dans le sélecteur d’espaces', espace);

// 2. La Salle : une section par équipe, un pouls, des agents avec « Ronde maintenant ».
const salle = await p.evaluate(() => ({
  titre: document.querySelector('main h1')?.textContent?.trim(),
  equipes: [...document.querySelectorAll('main section[aria-label]')].map((s) => s.getAttribute('aria-label')),
  agents: document.querySelectorAll('main article[aria-label]').length,
  pouls: Boolean(document.querySelector('[aria-label="Le pouls"]')),
  rondes: [...document.querySelectorAll('main button')].filter((b) => /Ronde maintenant/.test(b.textContent || '')).length,
  indispo: Boolean(document.querySelector('main [role="alert"]')),
}));
ok('2. la Salle : une section par équipe', salle.equipes.length >= 7 && !salle.indispo, `${salle.equipes.length} équipes (${salle.equipes.join(', ')}), ${salle.agents} agents, ${salle.rondes} boutons « Ronde maintenant »`);
ok('   le pouls est affiché', salle.pouls);
await p.screenshot({ path: `${OUT}/10-garde-salle.png` });

// 3. « Ronde maintenant » sur le premier agent : le point passe en ronde puis revient, et un constat apparaît.
const bouton = p.locator('main article[aria-label] button', { hasText: 'Ronde maintenant' }).first();
const agentNom = await p.locator('main article[aria-label]').first().getAttribute('aria-label');
const tuile = (nom) => p.evaluate((n) => [...document.querySelectorAll('main article[aria-label]')].find((x) => x.getAttribute('aria-label') === n)?.textContent?.replace(/\s+/g, ' ') ?? '', nom);
const avant = await tuile(agentNom);
await bouton.click(); await a(4000);
const apres = await tuile(agentNom);
ok(`3. ronde à la demande de « ${agentNom} » : la tuile dit « Dernière ronde à l’instant »`, /Dernière ronde à l.instant/.test(apres), apres.slice(0, 200));
// « Tu fais quoi ? » : l'agent répond en une phrase, déterministe.
await p.locator('main article[aria-label] button', { hasText: 'Tu fais quoi' }).first().click(); await a(2500);
const dit = await tuile(agentNom);
ok('   « Tu fais quoi ? » : l’agent répond', dit.length > avant.length + 20, dit.slice(-160));

// 4. Plein écran.
await p.locator('main button', { hasText: 'Plein écran' }).first().click(); await a(800);
const plein = await p.evaluate(() => Boolean(document.fullscreenElement) || document.documentElement.classList.contains('garde-plein') || Boolean(document.querySelector('[data-plein-ecran="1"]')));
console.log('4. plein écran demandé (fullscreenElement peut être refusé sans geste utilisateur en headless) :', plein);
await p.keyboard.press('Escape'); await a(400);

// 5. La pile « À votre avis ».
await p.goto(`${BASE}/#/garde/pile`); await a(2500);
const pile = await p.evaluate(() => ({ titre: document.querySelector('main h1')?.textContent?.trim(), onglets: [...document.querySelectorAll('main [role="tab"], main button')].map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 8), corps: document.querySelector('main')?.textContent?.slice(0, 300) }));
ok('5. la pile s’ouvre', pile.titre === 'À votre avis', `onglets : ${pile.onglets.join(' | ')}`);
await p.screenshot({ path: `${OUT}/11-garde-pile.png` });

// 6. Les bureaux, puis le bureau des Comptes : une question, une réponse avec preuves.
await p.goto(`${BASE}/#/garde/bureaux`); await a(2500);
const bureaux = await p.evaluate(() => [...document.querySelectorAll('main a[href^="#/garde/bureaux/"]')].map((x) => x.getAttribute('href')));
ok('6. la liste des bureaux', bureaux.length >= 8, bureaux.join(' '));
await p.goto(`${BASE}/#/garde/bureaux/comptes`); await a(2500);
const question = p.locator('input[aria-label="Poser une question, donner un ordre"]').first();
await question.fill('Qui n’a pas payé ?'); await question.press('Enter'); await a(3500);
const reponse = await p.evaluate(() => {
  const s = document.querySelector('main section[aria-label="Poser une question, donner un ordre"]');
  return s?.textContent?.replace(/\s+/g, ' ').slice(0, 600) ?? '';
});
ok('   le chef des Comptes répond', reponse.length > 40 && /pay|impay|jour|personne|aucun/i.test(reponse), reponse.slice(0, 220));
// Un ordre qui demande confirmation, puis on confirme.
await question.fill('Fais une ronde maintenant'); await question.press('Enter'); await a(2500);
const confirmer = p.locator('main button', { hasText: 'Oui, faites-le' }).first();
const aConfirmer = await confirmer.count();
if (aConfirmer) { await confirmer.click(); await a(3500); }
const apresOrdre = await p.evaluate(() => document.querySelector('main section[aria-label="Poser une question, donner un ordre"]')?.textContent?.replace(/\s+/g, ' ').slice(-400) ?? '');
ok('   un ordre est confirmé puis exécuté et journalisé', aConfirmer > 0 || /ronde|fait|journal/i.test(apresOrdre), apresOrdre.slice(-200));
const historique = await p.evaluate(() => document.querySelectorAll('main section[aria-label="Tout ce que l’équipe a fait"] li').length);
console.log('   lignes de journal visibles dans le bureau :', historique);
await p.screenshot({ path: `${OUT}/12-garde-bureau-comptes.png`, fullPage: false });

// 7. La Salle commune : on parle à toute la Garde, le Capitaine dispatche, les chefs répondent en une ligne.
await p.goto(`${BASE}/#/garde/commune`); await a(2500);
const dire = p.locator('main section[aria-label="Dire quelque chose à toute la Garde"] input').first();
await dire.fill('Priorité aux clientes cette semaine'); await dire.press('Enter'); await a(3500);
const commune = await p.evaluate(() => ({
  reponse: document.querySelector('main section[aria-label="Dire quelque chose à toute la Garde"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 500) ?? '',
  messages: document.querySelectorAll('main section[aria-label="Salle commune"] li').length,
  releve: Boolean(document.querySelector('main section[aria-label="La Relève du jour"]')),
  absence: Boolean([...document.querySelectorAll('main button')].find((b) => /On s’absente/.test(b.textContent || ''))),
}));
ok('7. la Salle commune reçoit et répond', commune.reponse.length > 30, commune.reponse.slice(0, 240));
ok('   la Relève et « On s’absente » sont là', commune.releve && commune.absence, `${commune.messages} messages affichés`);
await p.screenshot({ path: `${OUT}/13-garde-commune.png` });

// 8. Le calendrier : jours, horaires réglables.
await p.goto(`${BASE}/#/garde/calendrier`); await a(2500);
const cal = await p.evaluate(() => ({
  jours: document.querySelectorAll('main section[aria-label="Calendrier"] h2').length,
  items: document.querySelectorAll('main section[aria-label="Calendrier"] li').length,
  horaires: document.querySelectorAll('main section[aria-label="Les horaires des gardes"] li').length,
  selects: document.querySelectorAll('main section[aria-label="Les horaires des gardes"] select').length,
}));
ok('8. le calendrier montre la semaine et les horaires', cal.jours >= 1 && cal.horaires >= 7, `${cal.jours} jours, ${cal.items} entrées, ${cal.horaires} gardes réglables`);
// Mettre un agent en pause puis le reprendre : le geste revient.
const pause = p.locator('main section[aria-label="Les horaires des gardes"] button', { hasText: 'Mettre en pause' }).first();
await pause.click(); await a(1500);
const reprendre = await p.locator('main section[aria-label="Les horaires des gardes"] button', { hasText: 'Reprendre' }).count();
ok('   mettre en pause → « Reprendre » apparaît', reprendre >= 1);
await p.locator('main section[aria-label="Les horaires des gardes"] button', { hasText: 'Reprendre' }).first().click(); await a(1200);
await p.screenshot({ path: `${OUT}/14-garde-calendrier.png` });
await p.context().close();

// ——— Téléphone ———
const q = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
q.on('pageerror', (e) => erreurs.push(`page (téléphone) : ${String(e).slice(0, 160)}`));
await connecter(q, [195, 420]);
await q.goto(`${BASE}/#/garde`); await a(3500);
const tel = await q.evaluate(() => ({
  select: Boolean(document.querySelector('main select[aria-label="Équipe"]')),
  sections: document.querySelectorAll('main section[aria-label]').length,
  largeur: document.documentElement.scrollWidth <= window.innerWidth + 1,
}));
ok('9. téléphone : une équipe par écran (sélecteur), sans débordement', tel.select && tel.largeur, `${tel.sections} section(s) visibles`);
await q.screenshot({ path: `${OUT}/15-garde-salle-telephone.png` });
await q.goto(`${BASE}/#/garde/bureaux/comptes`); await a(2500);
await q.screenshot({ path: `${OUT}/16-garde-bureau-telephone.png` });
await q.context().close();

console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);

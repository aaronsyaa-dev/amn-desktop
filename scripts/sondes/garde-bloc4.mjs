/* Garde, Bloc 4 — Ajmani, chef d'état-major : il parle en premier, la pile en dossiers, le mandat, le guide, « je ne sais pas », et le panneau Ajmani qui devient la voix du Capitaine dans la Garde. */
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
const texte = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? '', sel);

const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
await connecter(p, [720, 860]);

// 0. On repart sans mandat : la sonde doit pouvoir rejouer.
await p.goto(`${BASE}/#/garde/ajmani`); await a(3500);
for (let i = 0; i < 6; i += 1) { const r = p.locator('main section[aria-label="Le mandat"] button', { hasText: 'Retirer' }).first(); if (!(await r.count())) break; await r.click(); await a(1200); }

// 1. Ajmani parle en premier : une proposition, ses gestes.
await p.goto(`${BASE}/#/garde/ajmani`); await a(3500);
const parole = await p.evaluate(() => {
  const s = document.querySelector('main section[aria-label="Il parle en premier"]');
  const prop = s?.querySelector('[data-proposition]');
  return { cle: prop?.getAttribute('data-proposition'), texte: prop?.textContent?.trim(), gestes: [...(s?.querySelectorAll('a, button') ?? [])].map((b) => b.textContent?.trim()).filter(Boolean), aveux: s?.textContent?.includes('Ce qu’il ne sait pas') };
});
ok('1. Ajmani parle en premier, d’une seule proposition', Boolean(parole.cle) && parole.texte.length > 20, `[${parole.cle}] ${parole.texte.slice(0, 120)} · gestes : ${parole.gestes.join(' | ')}`);
console.log('   dit ce qu’il ne sait pas ?', parole.aveux);
await p.screenshot({ path: `${OUT}/20-garde-ajmani.png` });

// 2. Le guide « Que voulez-vous faire ? » : trois familles, dérivées du Lexique ; une chip envoie son exemple.
const guide = await p.evaluate(() => {
  const s = document.querySelector('main section[aria-label="Que voulez-vous faire ?"]');
  return { familles: [...(s?.querySelectorAll('h3') ?? [])].map((h) => h.textContent?.trim()), entrees: s?.querySelectorAll('li').length ?? 0, chips: [...(s?.querySelectorAll('button[title]') ?? [])].length };
});
ok('2. le guide dérivé du Lexique', guide.familles.length === 3 && guide.entrees >= 20 && guide.chips >= 20, `${guide.familles.join(' / ')} · ${guide.entrees} entrées · ${guide.chips} chips`);
await p.locator('main section[aria-label="Que voulez-vous faire ?"] button[title]', { hasText: 'Qui n’a pas payé' }).first().click(); await a(3000);
const fil1 = await texte(p, 'main section[aria-label="Que voulez-vous faire ?"] ol');
ok('   la chip envoie l’exemple et le Capitaine répond', /pay|jour|retard/i.test(fil1), fil1.slice(0, 160));
// 3. « Je ne sais pas faire cela » : un ordre hors Lexique.
const champ = p.locator('main section[aria-label="Que voulez-vous faire ?"] input[aria-label="Poser une question, donner un ordre"]');
await champ.fill('Chante-moi une chanson'); await champ.press('Enter'); await a(3000);
const fil2 = await texte(p, 'main section[aria-label="Que voulez-vous faire ?"] ol');
ok('3. hors Lexique, il dit qu’il ne sait pas', /pas compris|ne sais pas faire/i.test(fil2), fil2.slice(-200));

// 4. La pile en dossiers : moins de dossiers que de situations ; le plus grave mène.
await p.goto(`${BASE}/#/garde/pile`); await a(3500);
const pile = await p.evaluate(() => {
  const stats = [...document.querySelectorAll('main dl, main [class*="stat"]')];
  const dossiers = [...document.querySelectorAll('main ol[aria-label="Dossiers"] > li')];
  return {
    entete: document.querySelector('main')?.textContent?.replace(/\s+/g, ' ') ?? '',
    n: dossiers.length,
    premier: dossiers[0]?.textContent?.replace(/\s+/g, ' ').slice(0, 260) ?? '',
    derriere: dossiers.filter((d) => /derrière le dossier qui mène/.test(d.textContent || '')).length,
    familles: dossiers.map((d) => d.getAttribute('data-dossier')),
    stats: stats.length,
  };
});
const m = (() => { const o = pile.entete.match(/Ouvertes\s*(\d+)/i); const d = pile.entete.match(/Dossiers\s*(\d+)/i); return o && d ? [null, o[1], d[1]] : null; })();
ok('4. la pile se lit en dossiers, moins nombreux que les situations', Boolean(m) && Number(m[2]) < Number(m[1]) && pile.n > 0, `${m ? `${m[1]} ouvertes → ${m[2]} dossiers` : pile.entete.slice(0, 120)} · familles : ${[...new Set(pile.familles)].join(', ')} · ${pile.derriere} derrière un chef de file`);
console.log('   premier dossier :', pile.premier.slice(0, 200));
await p.screenshot({ path: `${OUT}/21-garde-pile-dossiers.png` });

// 5. « Décidez seul, désormais » sur un dossier non critique avec recommandation → le mandat apparaît chez Ajmani.
const confier = p.locator('main ol[aria-label="Dossiers"] button', { hasText: 'Décidez seul, désormais' }).first();
const aConfier = await confier.count();
if (aConfier) { await confier.click(); await a(2500); }
const ditMandat = await p.evaluate(() => document.querySelector('main [data-message="pile"]')?.textContent ?? '');
ok('5. « Décidez seul, désormais » : le mandat est donné et ce qui attendait est décidé', aConfier > 0 && /Ajmani décide seul/.test(ditMandat), ditMandat.slice(0, 160) || 'aucun dossier confiable (tous critiques ou sans recommandation)');
await p.goto(`${BASE}/#/garde/ajmani`); await a(3000);
const mandat = await texte(p, 'main section[aria-label="Le mandat"]');
ok('   le mandat se lit chez Ajmani, avec « Retirer »', /Retirer/.test(mandat) && !/Aucun mandat/.test(mandat), mandat.slice(0, 200));
// 6. Le silence se règle.
await p.locator('main section[aria-label="Le silence"] select').first().selectOption('23'); await a(1500);
const silence = await texte(p, 'main section[aria-label="Il parle en premier"]');
ok('6. le silence se règle (23 h)', /23 h/.test(silence), silence.match(/\d+ h – \d+ h/)?.[0] ?? '');
await p.locator('main section[aria-label="Le silence"] select').first().selectOption('22'); await a(1000);

// 7. Le panneau Ajmani, dans la Garde, est la voix du Capitaine : pas de modèle, une réponse avec preuves ; hors Garde, il reste lui-même.
await p.locator('header button', { hasText: 'Ajmani' }).first().click(); await a(1200);
const pied = await p.evaluate(() => [...document.querySelectorAll('span')].map((x) => x.textContent?.trim() ?? '').find((x) => /voix du Capitaine|IA locale|Moteur intégré/.test(x)) ?? '');
ok('7. dans la Garde, le panneau dit « la voix du Capitaine »', /voix du Capitaine/.test(pied), pied);
const zone = p.locator('textarea').first();
await zone.fill('Qui n’a pas payé ?'); await zone.press('Enter'); await a(3500);
const reponsePanneau = await p.evaluate(() => document.body.textContent?.replace(/\s+/g, ' ') ?? '');
ok('   il répond par le Capitaine', /Tout le monde est à jour|compte(s)? en retard/i.test(reponsePanneau), (reponsePanneau.match(/(Tout le monde est à jour|[^.]*compte[^.]*en retard[^.]*)/i)?.[0] ?? '').slice(0, 160));
await zone.fill('Personne ne touche à Fleuriste'); await zone.press('Enter'); await a(3500);
const demande = await p.evaluate(() => document.body.textContent?.replace(/\s+/g, ' ') ?? '');
const aDemande = /Je confirme et je fais|D’accord pour|Répondez « oui »/.test(demande);
ok('   un ordre qui modifie demande confirmation dans le panneau', aDemande, (demande.match(/(Je confirme et je fais[^?]*\?|D’accord pour[^?]*\?)/)?.[0] ?? '').slice(0, 160));
if (aDemande) {
  await zone.fill('oui'); await zone.press('Enter'); await a(3500);
  const fait = await p.evaluate(() => document.body.textContent?.replace(/\s+/g, ' ') ?? '');
  ok('   « oui » fait, et c’est journalisé', /personne ne touche à|Compris/i.test(fait), (fait.match(/Compris[^.]*\./) ?? [''])[0].slice(0, 160));
}
await p.screenshot({ path: `${OUT}/22-garde-panneau-ajmani.png` });
await p.keyboard.press('Escape'); await a(500);
await p.goto(`${BASE}/#/`); await a(2500);
await p.locator('header button', { hasText: 'Ajmani' }).first().click(); await a(1000);
const piedPoste = await p.evaluate(() => [...document.querySelectorAll('span')].map((x) => x.textContent?.trim() ?? '').find((x) => /voix du Capitaine|IA locale|Moteur intégré/.test(x)) ?? '');
ok('   hors Garde, le panneau redevient Ajmani du poste', !/voix du Capitaine/.test(piedPoste), piedPoste);
await p.keyboard.press('Escape');
// On dégèle Fleuriste pour laisser la base comme on l'a trouvée.
await p.goto(`${BASE}/#/garde/ajmani`); await a(2500);
const c2 = p.locator('main section[aria-label="Que voulez-vous faire ?"] input[aria-label="Poser une question, donner un ordre"]');
await c2.fill('Tu peux retoucher à Fleuriste'); await c2.press('Enter'); await a(2500);
const ouiBtn = p.locator('main section[aria-label="Que voulez-vous faire ?"] button', { hasText: 'Oui, faites-le' }).first();
if (await ouiBtn.count()) { await ouiBtn.click(); await a(2000); }
await p.context().close();

// Téléphone : Ajmani tient en un écran, la proposition d'abord.
const q = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
q.on('pageerror', (e) => erreurs.push(`page (téléphone) : ${String(e).slice(0, 160)}`));
await connecter(q, [195, 420]);
await q.goto(`${BASE}/#/garde/ajmani`); await a(3500);
const tel = await q.evaluate(() => ({ prop: Boolean(document.querySelector('main [data-proposition]')), largeur: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
ok('8. téléphone : la proposition d’abord, sans débordement', tel.prop && tel.largeur);
await q.screenshot({ path: `${OUT}/23-garde-ajmani-telephone.png` });
await q.context().close();

console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);

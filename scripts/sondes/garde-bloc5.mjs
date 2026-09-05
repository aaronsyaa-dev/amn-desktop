/* Garde, Bloc 5 — la Garde des Comptes et le site : Aaron émet un jeton (interne), la cliente le colle (Business) et le module s'ouvre ; un jeton déjà servi est refusé avec motif ; un impayé passe en grâce, « Payé » rouvre. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/garde-2026-09-05';
const INTERNE = process.env.WEB || 'http://127.0.0.1:4181';
const BUSINESS = process.env.WEB_BUSINESS || 'http://127.0.0.1:4180';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, base, email, mdp, clic) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const erreurs = [];
const ok = (etiquette, valeur, detail = '') => { console.log(`${valeur ? '✓' : '✗'} ${etiquette}${detail ? ` — ${detail}` : ''}`); if (!valeur) erreurs.push(etiquette); };
const texte = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? '', sel);

// ——— Interne : le pupitre du Chef des Comptes ———
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
await connecter(p, INTERNE, 'essai.interne@exemple.test', 'Interne-2026-Essai', [720, 860]);
await p.goto(`${INTERNE}/#/garde/bureaux/comptes`); await a(3500);
const pupitre = await p.evaluate(() => ({ jetons: Boolean(document.querySelector('main section[aria-label="Les jetons"]')), reglements: Boolean(document.querySelector('main section[aria-label="Les règlements"]')) }));
ok('1. le Chef des Comptes a son pupitre : jetons et règlements', pupitre.jetons && pupitre.reglements);
// Émettre un jeton pour le module Stock.
const form = p.locator('main form[aria-label="Émettre un jeton"]');
await form.locator('input[aria-label="Clé du module"]').fill('stock');
await form.locator('input[aria-label="Note"]').fill('sonde bloc 5');
await form.locator('button[type="submit"]').click(); await a(2500);
const secret = await texte(p, 'main [data-jeton-emis] [data-secret]');
ok('2. un jeton est émis, son secret se lit une fois', /^jeton:[A-Za-z0-9_-]{16,}$/.test(secret), secret.slice(0, 18) + '…');
await p.screenshot({ path: `${OUT}/30-garde-comptes-jeton-emis.png` });
const emisAvant = await p.locator('main li[data-jeton-etat="emis"]').count();
console.log('   jetons émis en attente :', emisAvant);

// ——— Business : la cliente colle le jeton ———
const q = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
q.on('pageerror', (e) => erreurs.push(`page (cliente) : ${String(e).slice(0, 160)}`));
await connecter(q, BUSINESS, 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai', [720, 860]);
await q.goto(`${BUSINESS}/#/decouvrir`); await a(2500);
const stockAvant = await q.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].some((x) => x.getAttribute('href') === '#/stock' && !x.closest('main')));
const champ = q.locator('form[aria-label="J’ai un jeton de paiement"] input');
ok('3. la cliente a « J’ai un jeton de paiement » dans sa Bibliothèque', (await champ.count()) === 1);
await champ.fill(secret); await q.locator('form[aria-label="J’ai un jeton de paiement"] button[type="submit"]').click(); await a(4000);
const reponse = await texte(q, '[data-jeton-reponse]');
ok('   le jeton est vérifié et Stock s’ouvre sur-le-champ', /vérifié/i.test(reponse) && /Stock|stock/.test(reponse), reponse);
await q.screenshot({ path: `${OUT}/31-cliente-jeton-accepte.png` });
await q.reload(); await a(2600); await q.mouse.click(720, 860); await a(800);
const stockApres = await q.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].some((x) => x.getAttribute('href') === '#/stock' && !x.closest('main')));
ok('   Stock est dans sa barre après rechargement', stockApres, `avant ${stockAvant} → après ${stockApres}`);
// Le même jeton une seconde fois.
await q.goto(`${BUSINESS}/#/decouvrir`); await a(2000);
await q.locator('form[aria-label="J’ai un jeton de paiement"] input').fill(secret);
await q.locator('form[aria-label="J’ai un jeton de paiement"] button[type="submit"]').click(); await a(4000);
const refus = await texte(q, '[data-jeton-reponse]');
ok('4. le même jeton une seconde fois est refusé, avec son motif', /déjà utilisé/.test(refus) && /prévenu/.test(refus), refus);
await q.context().close();

// ——— Interne : le jeton est marqué utilisé, par qui ; l'impayé ———
await p.goto(`${INTERNE}/#/garde/bureaux/comptes`); await a(3000);
const utilise = await p.evaluate(() => [...document.querySelectorAll('main li[data-jeton-etat="utilise"]')].map((x) => x.textContent?.replace(/\s+/g, ' ') ?? '').find((x) => /sonde bloc 5/.test(x)) ?? '');
ok('5. côté AMN, le jeton se lit « utilisé par Fleuriste… »', /utilisé par Fleuriste/.test(utilise), utilise.slice(0, 160));
const pile = await texte(p, 'main section[aria-label="À votre avis"]');
ok('   le refus est remonté au chef (jeton non recevable)', /pas recevable/.test(pile), pile.slice(0, 160));
// Impayé sur la fleuriste : préavis + grâce à la ronde suivante ; « Payé » rouvre.
await p.locator('main input[aria-label="Une organisation…"]').fill('Fleuriste d Essai'); await a(1500);
await p.locator('main [role="listbox"] button', { hasText: 'Impayé' }).first().click(); await a(2000);
const ditImpaye = await texte(p, 'main [data-comptes-dit]');
ok('6. « Impayé » est noté ; la Garde envoie le préavis à sa ronde', /impayé noté/i.test(ditImpaye), ditImpaye);
// La ronde des impayés, tout de suite, par le chef.
const question = p.locator('main input[aria-label="Poser une question, donner un ordre"]');
await question.fill('Refais ta ronde maintenant'); await question.press('Enter'); await a(4000);
await p.goto(`${INTERNE}/#/garde/bureaux/comptes`); await a(3000);
const grace = await p.locator('main li[data-compte-etat="grace"]').count();
ok('   après la ronde, le compte est en grâce (préavis déposé chez la cliente)', grace >= 1, `${grace} compte(s) en grâce`);
await p.screenshot({ path: `${OUT}/32-garde-comptes-grace.png` });
await p.locator('main li[data-compte-etat="grace"] button', { hasText: 'Payé' }).first().click(); await a(2500);
const ditPaye = await texte(p, 'main [data-comptes-dit]');
ok('7. « Payé » remet à jour', /à jour/.test(ditPaye), ditPaye);
await p.context().close();

// ——— Business : le préavis puis le remerciement se lisent chez elle ———
const r = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await connecter(r, BUSINESS, 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai', [195, 420]);
await r.goto(`${BUSINESS}/#/annonces`); await a(3000);
const annonces = await r.evaluate(() => document.querySelector('main')?.textContent?.replace(/\s+/g, ' ') ?? '');
ok('8. chez la cliente : « Règlement en attente » puis « Règlement reçu » se lisent dans ses annonces', /Règlement reçu/.test(annonces) && /Règlement en attente/.test(annonces), (annonces.match(/Règlement (reçu|en attente)[^.]*\./) ?? [''])[0].slice(0, 160));
await r.screenshot({ path: `${OUT}/33-cliente-annonces-telephone.png` });
await r.context().close();

console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);

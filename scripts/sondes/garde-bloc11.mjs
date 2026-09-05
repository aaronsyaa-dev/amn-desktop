/* Garde, Blocs 11 et 12 — le ton et l'harmonie : le budget de parole d'Ajmani, la clôture du soir (écran et palette), « Et si ? » sur une règle d'un bureau, la cliente qui arrive installée par la Garde des Clientes, visible dans son bureau et dans le dossier de l'organisation. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/garde-2026-09-05';
const BASE = process.env.WEB || 'http://127.0.0.1:4181';
const API = process.env.API || 'http://127.0.0.1:4171';
const EMAIL = 'essai.interne@exemple.test'; const MDP = 'Interne-2026-Essai';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, clic) => {
  await p.goto(`${BASE}/`); await a(1800);
  await p.locator('input[name="email"]').fill(EMAIL); await p.locator('input[name="password"]').fill(MDP);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const erreurs = [];
const ok = (etiquette, valeur, detail = '') => { console.log(`${valeur ? '✓' : '✗'} ${etiquette}${detail ? ` — ${detail}` : ''}`); if (!valeur) erreurs.push(etiquette); };
const texte = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? '', sel);

// Par l'API, comme le site le ferait : une organisation arrive « cette nuit », avec sa propriétaire invitée.
const jeton = (await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: MDP }) })).json()).token;
const api = async (path, init = {}) => { const r = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}`, ...(init.headers ?? {}) } }); return { status: r.status, body: await r.json().catch(() => null) }; };
const nom = `Nuit d Essai ${Date.now().toString().slice(-5)}`;
const creee = await api('/v1/admin/organizations', { method: 'POST', body: JSON.stringify({ name: nom, plan: 'business_standard', ownerEmail: `nuit.${Date.now()}@exemple.test` }) });
ok('0. une organisation arrive par l’API (données de test)', creee.status === 201 || creee.status === 200, `${creee.status} · ${nom}`);
const orgId = creee.body?.organization?.id ?? creee.body?.org?.id ?? creee.body?.id;

const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
await connecter(p, [720, 860]);

// 1. Ajmani : sa parole du jour est comptée, et la clôture du soir tient en un geste.
await p.goto(`${BASE}/#/garde/ajmani`); await a(3500);
const budget = await p.evaluate(() => { const b = document.querySelector('main [data-budget]'); return b ? { dites: Number(b.getAttribute('data-budget')), max: Number(b.getAttribute('data-budget-max')), texte: b.textContent?.trim() ?? '' } : null; });
ok('1. Ajmani dit sa parole du jour, sur un budget', Boolean(budget) && budget.max > 0 && budget.dites <= budget.max, budget ? `« ${budget.texte} »` : 'absent');
await p.locator('main [data-cloture]').click(); await a(3500);
const cloture = await texte(p, 'main [data-chef-reponse]');
ok('   « Clôturer la soirée » : ce qui attend, et ce que la Garde fera cette nuit', /Rien ne vous attend|Ce qui vous attend|Avant d’arrêter|rien ne vous attend/.test(cloture) && /Cette nuit|Pour la nuit/.test(cloture), cloture.slice(0, 200));
ok('   sans point d’exclamation ni servilité', !/!|désolé|à vos ordres|mon roi/i.test(cloture));
await p.screenshot({ path: `${OUT}/80-ajmani-cloture.png` });

// 2. « Et si ? » : un seuil rejoué sur le mois, au bureau des Sites, sans rien changer.
await p.goto(`${BASE}/#/garde/bureaux/sites`); await a(3500);
const formEtSi = p.locator('main form[aria-label="Et si ? tombe"]').first();
ok('2. le bureau des Sites propose « Et si ? » sur la règle qui se rejoue', (await formEtSi.count()) === 1);
await formEtSi.locator('input[type="number"]').fill('5'); await formEtSi.locator('button[type="submit"]').click(); await a(3000);
const etsi = await texte(p, 'main [data-etsi="tombe"]');
ok('   la réponse dit ce que le mois aurait produit, et que rien n’est changé', /au lieu de|ne se rejoue pas/.test(etsi) && /Rien n’est changé|ne se rejoue pas/.test(etsi), etsi.slice(0, 160));
await formEtSi.scrollIntoViewIfNeeded().catch(() => {}); await a(300);
await p.screenshot({ path: `${OUT}/81-bureau-et-si.png` });

// 3. La palette : « bonne nuit » est compris comme la clôture du soir.
await p.goto(`${BASE}/#/tasks`); await a(2500);
await p.keyboard.press('Control+k'); await a(800);
const palette = p.locator('input[placeholder]').last();
await palette.fill('bonne nuit'); await a(700);
await p.locator('button', { hasText: 'Demander à la Garde' }).first().click().catch(async () => { await p.keyboard.press('Enter'); }); await a(3000);
const rep = await texte(p, '[data-palette-garde]');
ok('3. « bonne nuit » dans la palette : la Garde répond par la clôture', /Cette nuit|Pour la nuit|Rien ne vous attend|Ce qui vous attend/.test(rep), rep.slice(0, 160));
await p.screenshot({ path: `${OUT}/82-palette-bonne-nuit.png` });
await p.keyboard.press('Escape'); await a(300); await p.keyboard.press('Escape'); await a(400);

// 4. La cliente qui arrive : l'Accueil l'installe à sa ronde, et le dit.
const ronde = await api('/v1/garde/agents/clientes.accueil/ronde', { method: 'POST', body: '{}' });
ok('4. la ronde d’Accueil, forcée par l’API', ronde.status === 200, `${ronde.status} · ${JSON.stringify(ronde.body).slice(0, 140)}`);
await p.goto(`${BASE}/#/garde/bureaux/clientes`); await a(3500);
const bureau = await p.evaluate(() => document.querySelector('main')?.textContent?.replace(/\s+/g, ' ') ?? '');
const accueillie = new RegExp(`${nom.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[^.]{0,40}arrivée à`).test(bureau);
ok('   le bureau des Clientes dit l’arrivée et l’installation', accueillie && /formule Standard/.test(bureau) && /(lien d’accueil|invitation court)/.test(bureau), (bureau.match(new RegExp(`.{0,60}${nom}.{0,140}`)) ?? [''])[0].slice(0, 200));
await p.screenshot({ path: `${OUT}/83-bureau-clientes-accueil.png` });
// Dans le dossier de l'organisation : la Garde chez elle.
await p.goto(`${BASE}/#/tour/organisations`); await a(1500); await p.reload(); await a(3000); await p.mouse.click(720, 860).catch(() => {}); await a(600);
await p.locator('input[aria-label="Chercher une organisation"]').fill(nom); await a(1800);
await p.locator('main button', { hasText: nom }).first().click(); await a(2500);
const chezElle = await texte(p, '[data-garde-chez-elle]');
ok('   et le dossier de l’organisation porte la trace, avec l’équipe et le pourquoi', /des Clientes/.test(chezElle) && /arrivée à/.test(chezElle), chezElle.slice(0, 160));
await p.screenshot({ path: `${OUT}/84-dossier-accueillie.png` });
await p.context().close();

// Ménage : l'organisation d'essai n'est pas laissée dans le parc.
if (orgId) { const s = await api(`/v1/admin/organizations/${orgId}`, { method: 'DELETE', body: JSON.stringify({ confirm: nom }) }); console.log(`ménage : suppression de ${nom} → ${s.status}`); }
console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);

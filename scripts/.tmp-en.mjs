/* Sonde EN de bout en bout — connexion, rideau, relève, réglages. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/lang';
const PREFIX = process.env.PREFIX || 'x-';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
// Le choix personnel EN, posé AVANT tout code applicatif.
await ctx.addInitScript(() => {
  try { window.localStorage.setItem('amn.langue.utilisateur', 'en'); } catch {}
});
const p = await ctx.newPage();
const shot = (n) => p.screenshot({ path: `${OUT}/${PREFIX}${n}.png` });

await p.goto('http://127.0.0.1:4180/');
await a(2200);
await shot('01-connexion');
const loginTexte = await p.evaluate(() => document.body.innerText);
console.log('LOGIN «Sign in» ?', loginTexte.includes('Sign in'));
console.log('LOGIN résidu FR ?', /Se connecter|Votre espace|Identifiant/.test(loginTexte));

await p.locator('input[name="email"]').fill(process.env.E);
await p.locator('input[name="password"]').fill(process.env.P);
await p.locator('button:has-text("Sign in")').click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(1800);
await shot('02-apres-connexion');
const apres = await p.evaluate(() => document.body.innerText);
console.log('WELCOME EN ?', /Welcome to/.test(apres), '| «BONJOUR» ?', /BONJOUR/i.test(apres.replace(/Hello/g, '')));
await a(2600);
await p.mouse.click(720, 860); await a(800); // passer le rideau s'il traîne

/* La relève : réécrire le repère de passage à avant-hier 19 h, effacer
   l'épingle de session, recharger — la cérémonie doit parler anglais. */
const cle = await p.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('amn.releve.passage.') && !k.endsWith('.lu')));
console.log('clé de passage :', cle);
if (cle) {
  // Par initScript : le script court APRÈS l'écriture de départ du document
  // précédent (visibilitychange pose « maintenant »), AVANT le code de l'app.
  await p.addInitScript((k) => {
    const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(19, 0, 0, 0);
    try { localStorage.setItem(k, d.toISOString()); sessionStorage.removeItem(`${k}.lu`); } catch {}
  }, cle);
  await p.reload(); await a(5000);
  await shot('03-releve');
  const releve = await p.evaluate(() => document.body.innerText);
  const ligne = releve.split('\n').filter((l) => /While you were away|Since|Overnight|weekend|All is well|Nothing/.test(l));
  console.log('RELÈVE EN :', JSON.stringify(ligne.slice(0, 6)));
}
await a(600);
await shot('04-accueil');

if (process.env.REGLAGES) {
  await p.goto(`http://127.0.0.1:4180/${process.env.REGLAGES}`); await a(1800);
  await shot('05-reglages');
  const reg = await p.evaluate(() => document.body.innerText);
  console.log('RÉGLAGES langue ?', /Follow the organisation|English/.test(reg));
}
await nav.close();
console.log('OK sonde EN', PREFIX);

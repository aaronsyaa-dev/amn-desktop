/* Parcours cliente : créer une fiche, une tâche, une note — et survivre au rechargement. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:4180/'); await a(2000);
await p.locator('input[name="email"]').fill('fleuriste.essai@exemple.test');
await p.locator('input[name="password"]').fill('Fleuriste-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);

const HORODATE = String(Date.now()).slice(-6);

// 1. UNE FICHE CLIENT
await p.goto('http://127.0.0.1:4180/#/clients'); await a(2000);
const nouveauClient = p.locator('button:has-text("Nouveau client"), button:has-text("Nouvelle fiche"), button:has-text("Ajouter")').first();
console.log('CLIENTS: bouton création trouvé ?', await nouveauClient.count() > 0);
await nouveauClient.click(); await a(1200);
await p.screenshot({ path: '/tmp/e2e/chasse/10-fiche-formulaire.png' });
// Le premier champ du dialogue : sans nom ni placeholder — au clavier.
await p.keyboard.type(`Chasse Nuit ${HORODATE}`); await a(300);
await p.locator('button:has-text("Créer la fiche")').click(); await a(2000);
let txt = await p.evaluate(() => document.body.innerText);
console.log('CLIENTS: la fiche apparaît ?', txt.includes(`Chasse Nuit ${HORODATE}`));

// 2. UNE TÂCHE
await p.goto('http://127.0.0.1:4180/#/tasks'); await a(2000);
const nouvelleTache = p.locator('button:has-text("Nouvelle tâche"), button:has-text("Ajouter une tâche"), button:has-text("Ajouter")').first();
console.log('TÂCHES: bouton création trouvé ?', await nouvelleTache.count() > 0);
if (await nouvelleTache.count()) {
  await nouvelleTache.click(); await a(1000);
  const champTitre = p.locator('input:visible, textarea:visible').first();
  await champTitre.fill(`Vérifier la chasse ${HORODATE}`);
  await p.keyboard.press('Enter'); await a(1500);
  txt = await p.evaluate(() => document.body.innerText);
  console.log('TÂCHES: la tâche apparaît ?', txt.includes(`Vérifier la chasse ${HORODATE}`));
}

// 3. UNE NOTE
await p.goto('http://127.0.0.1:4180/#/notes'); await a(2000);
const nouvelleNote = p.locator('button:has-text("Nouvelle note"), button:has-text("Nouvelle"), button[aria-label*="ouvelle"]').first();
console.log('NOTES: bouton création trouvé ?', await nouvelleNote.count() > 0);
if (await nouvelleNote.count()) {
  await nouvelleNote.click(); await a(1200);
  await p.keyboard.type(`Note de chasse ${HORODATE}`); await a(1200);
  await p.screenshot({ path: '/tmp/e2e/chasse/11-note.png' });
}

// 4. LE RECHARGEMENT — tout doit survivre (serveur, pas mémoire)
await p.reload(); await a(3000); await p.mouse.click(720, 860); await a(600);
await p.goto('http://127.0.0.1:4180/#/clients'); await a(2000);
txt = await p.evaluate(() => document.body.innerText);
console.log('SURVIE fiche ?', txt.includes(`Chasse Nuit ${HORODATE}`));
await p.goto('http://127.0.0.1:4180/#/tasks'); await a(2000);
txt = await p.evaluate(() => document.body.innerText);
console.log('SURVIE tâche ?', txt.includes(`Vérifier la chasse ${HORODATE}`));
await p.screenshot({ path: '/tmp/e2e/chasse/12-apres-rechargement.png' });
await nav.close();

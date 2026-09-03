/* Audit des modules (Bloc 2) : chaque module, sur les deux éditions, poste + téléphone + anglais.
   Pour chaque écran : erreurs de page, réponses réseau en échec, en-tête, état vide/plein,
   création générique → rechargement → suppression, largeur au téléphone, résidus de français en anglais.
   Sortie : /tmp/e2e/audit/rapport.json + captures. Aucune donnée réelle : comptes d'essai de /tmp/e2e. */
import fs from 'node:fs';
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/e2e/audit';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

const BUSINESS = [
  ['home','Accueil','/'],['agenda','Agenda','/agenda'],['projects','Projets','/projets'],['tasks','Tâches','/tasks'],['okr','Objectifs & résultats','/objectifs-resultats'],['weekly','Revue hebdo','/revue-hebdo'],['meetings','Réunions','/reunions'],['priorities','Priorités du jour','/priorites'],['routines','Routines','/routines'],['logbook','Journal de bord','/journal-de-bord'],['forms','Formulaires','/formulaires'],['minisite','Mini-page publique','/mini-page'],['newsletter','Lettre d’information','/lettre'],['esign','Signature sur place','/signature'],['portfolio','Portfolio','/portfolio'],
  ['clients','Clients','/clients'],['invoices','Facturation','/facturation'],['orders','Commandes','/commandes'],['evenements','Événements','/evenements'],['pipeline','Pipeline','/pipeline'],['reminders','Relances','/relances'],['subscriptions','Abonnements','/abonnements'],['contracts','Contrats','/contrats'],['reviews','Avis','/avis'],['loyalty','Fidélité','/fidelite'],['referrals','Parrainage','/parrainage'],['booking','Rendez-vous en ligne','/rdv-en-ligne'],['cashCount','Caisse du jour','/caisse'],
  ['time','Temps','/temps'],['expenses','Dépenses','/depenses'],['calculators','Calculateurs','/calculateurs'],['board','Tableau des projets','/tableau-projets'],['stock','Stock','/stock'],['suppliers','Fournisseurs','/fournisseurs'],['shifts','Planning d’équipe','/planning'],['checklists','Contrôles qualité','/controles'],['assembly','Suivi de montage','/montage'],['aftersales','SAV','/sav'],['bom','Nomenclatures','/nomenclatures'],['rounds','Tournées','/tournees'],['equipment','Matériel','/materiel'],
  ['notes','Notes','/notes'],['pages','Pages','/pages'],['reports','Rapports','/reports'],['media','Médias','/media'],
  ['dm','Messages privés','/messages-prives'],['groups','Groupes','/groupes'],['announcements','Annonces','/annonces'],['polls','Sondages','/sondages'],['leaves','Absences','/absences'],['directory','Trombinoscope','/trombinoscope'],['calls','Appels','/appels'],
  ['qr','QR codes','/outils/qr'],['converters','Convertisseurs','/outils/convertisseurs'],['templates','Modèles','/outils/modeles'],['automations','Automatisations','/outils/automatisations'],['dataPort','Import / export','/outils/donnees'],
  ['budget','Avant la paie','/personnel/budget'],['courses','Courses','/personnel/courses'],['habits','Habitudes','/personnel/habitudes'],['personalGoals','Objectifs perso','/personnel/objectifs'],['diary','Journal perso','/personnel/journal'],['pomodoro','Pomodoro','/personnel/pomodoro'],
  ['settings','Paramètres','/settings'],['members','Membres','/membres'],['assistance','Assistance','/assistance'],['discover','Découvrir','/decouvrir'],['vault','Coffre-fort','/vault'],
];
const INTERNE = [
  ['team','Équipe','/team'],['decisions','Décisions','/decisions'],['knowledge','Connaissances','/knowledge'],['library','Bibliothèque','/bibliotheque'],
  ['tour','Vue d’ensemble','/tour'],['orgs','Organisations','/tour/organisations'],['access','Journal d’accès','/tour/journal'],['generator','Atelier','/tour/generateur'],
  ['supervision','Supervision','/supervision'],['sites','Sites','/sites'],['tracker','Trackers','/tracker'],['socMaturity','Maturité SOC','/maturite-soc'],['orgCompare','Comparatif clientes','/comparatif'],['customAlerts','Alertes personnalisées','/alertes-personnalisees'],['clientReport','Rapport client enrichi','/rapport-client'],
  ['scanner','Scanner','/scanner'],['comply','Comply','/comply'],['ssl','SSL Monitor','/ssl'],
];
// Pas de création générique là où le geste aurait un effet réel ou demande un secret.
const SANS_CREATION = new Set(['home','settings','members','assistance','discover','vault','dataPort','calls','tour','orgs','access','generator','supervision','sites','tracker','scanner','comply','ssl','library','esign','qr','converters','pomodoro','calculators','budget','minisite','booking','media','automations','cashCount','socMaturity','orgCompare','customAlerts','clientReport']);

const rapport = [];
const connecter = async (p, base, email, mdp, clic) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const brancher = (p, sac) => {
  p.on('pageerror', (e) => sac.erreurs.push(String(e).slice(0, 140)));
  p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('127.0.0.1:4171')) sac.reseau.push(`${r.status()} ${r.request().method()} ${r.url().replace('http://127.0.0.1:4171', '')}`.slice(0, 120)); });
  p.on('dialog', (d) => d.accept().catch(() => {}));
};
const entete = (p) => p.evaluate(() => {
  const h1 = document.querySelector('main h1, h1');
  const bloc = h1?.closest('header') ?? h1?.parentElement?.parentElement;
  const t = (bloc?.innerText ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  return { h1: h1?.innerText?.trim() ?? '', tete: t.slice(0, 4).join(' | ').slice(0, 220), vide: Boolean(document.querySelector('main div.max-w-lg.py-6, div.max-w-lg.py-6')), lignes: document.querySelectorAll('main li, main tr, main article').length, boutons: document.querySelectorAll('main button').length, entrees: document.querySelectorAll('main input, main textarea, main select').length, largeur: document.documentElement.scrollWidth };
});
const FRANCAIS = /\b(le|la|les|des|une|un|et|pour|avec|vos|votre|aucun|aucune|ajouter|enregistrer|supprimer|nouveau|nouvelle|depuis|encore|rien)\b/gi;

async function poste(base, compte, routes, prefixe) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const sac = { erreurs: [], reseau: [] }; brancher(p, sac);
  await connecter(p, base, compte.email, compte.mdp, [720, 860]);
  for (const [key, label, to] of routes) {
    sac.erreurs.length = 0; sac.reseau.length = 0;
    const ligne = { edition: prefixe, key, label, to };
    try {
      await p.goto(`${base}/#${to}`); await a(1900);
      Object.assign(ligne, await entete(p));
      await p.screenshot({ path: `${OUT}/${prefixe}-${key}-poste.png` });
      if (!SANS_CREATION.has(key)) {
        const marque = `Audit ${key} 0904`;
        const action = p.locator('main button.bg-accent, main button[class*="bg-accent"]').first();
        let cree = false, persiste = false, supprime = false, note = '';
        if (await action.count()) {
          await action.click().catch(() => {}); await a(700);
          const champs = p.locator('main input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=date]):not([type=datetime-local]):not([type=time]):not([type=color]):not([type=range]):not([type=search]), main textarea');
          const n = await champs.count();
          let rempli = 0;
          for (let i = 0; i < n; i += 1) {
            const c = champs.nth(i);
            if (!(await c.isVisible().catch(() => false))) continue;
            const type = (await c.getAttribute('type')) ?? 'text';
            const val = await c.inputValue().catch(() => '');
            if (val) continue;
            if (type === 'number') { await c.fill('12').catch(() => {}); rempli += 1; continue; }
            if (['text', 'email', 'url', 'tel', 'password'].includes(type) || (await c.evaluate((e) => e.tagName)) === 'TEXTAREA') {
              await c.fill(rempli === 0 ? marque : `${marque} ${i}`).catch(() => {}); rempli += 1;
            }
          }
          if (rempli === 0) note = 'aucun champ texte à remplir';
          const soumettre = p.locator('main form button[type="submit"]').first();
          if (await soumettre.count()) await soumettre.click().catch(() => {}); else await p.keyboard.press('Enter').catch(() => {});
          await a(1600);
          cree = (await p.evaluate(() => document.body.innerText)).includes(marque);
          if (cree) {
            await p.reload(); await a(2600); await p.mouse.click(720, 860); await a(600);
            persiste = (await p.evaluate(() => document.body.innerText)).includes(marque);
            const bloc = p.locator(`main :is(li, tr, article, div):has-text("${marque}")`).last();
            const btn = bloc.locator('button[aria-label*="upprim" i], button[title*="upprim" i], button[aria-label*="etirer" i], button[aria-label*="nnuler" i]').first();
            if (await btn.count()) {
              await bloc.hover().catch(() => {}); await btn.click({ force: true }).catch(() => {}); await a(1300);
              supprime = !(await p.evaluate(() => document.body.innerText)).includes(marque);
            } else note += (note ? ' ; ' : '') + 'pas de bouton de suppression trouvé';
          }
        } else note = 'pas de bouton d’action principal';
        Object.assign(ligne, { cree, persiste, supprime, note });
      }
    } catch (e) { ligne.exception = String(e).slice(0, 160); }
    ligne.erreurs = [...sac.erreurs]; ligne.reseau = [...sac.reseau];
    rapport.push(ligne);
    console.log(`${prefixe} ${key.padEnd(14)} h1=${JSON.stringify(ligne.h1 ?? '')} vide=${ligne.vide} lignes=${ligne.lignes} ${ligne.cree !== undefined ? `créé=${ligne.cree} persiste=${ligne.persiste} supprimé=${ligne.supprime} ${ligne.note ?? ''}` : ''} ${ligne.erreurs.length ? 'ERREURS ' + ligne.erreurs.join(' / ') : ''} ${ligne.reseau.length ? 'RÉSEAU ' + ligne.reseau.join(' / ') : ''}`);
  }
  await ctx.close();
}
async function telephone(base, compte, routes, prefixe) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const sac = { erreurs: [], reseau: [] }; brancher(p, sac);
  await connecter(p, base, compte.email, compte.mdp, [195, 420]);
  for (const [key, , to] of routes) {
    sac.erreurs.length = 0;
    const ligne = rapport.find((l) => l.edition === prefixe && l.key === key) ?? {};
    try {
      await p.goto(`${base}/#${to}`); await a(1700);
      const e = await entete(p);
      ligne.tel = { largeur: e.largeur, deborde: e.largeur > 390, h1: e.h1, erreurs: [...sac.erreurs] };
      await p.screenshot({ path: `${OUT}/${prefixe}-${key}-tel.png` });
    } catch (err) { ligne.tel = { exception: String(err).slice(0, 120) }; }
    console.log(`${prefixe} tél ${key.padEnd(14)} largeur=${ligne.tel?.largeur} ${ligne.tel?.deborde ? 'DÉBORDE' : ''} ${ligne.tel?.erreurs?.length ? 'ERREURS ' + ligne.tel.erreurs.join(' / ') : ''}`);
  }
  await ctx.close();
}
async function anglais(base, compte, routes, prefixe) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const sac = { erreurs: [], reseau: [] }; brancher(p, sac);
  await connecter(p, base, compte.email, compte.mdp, [720, 860]);
  await p.evaluate(() => localStorage.setItem('amn.langue.utilisateur', 'en')); await p.reload(); await a(2500); await p.mouse.click(720, 860); await a(500);
  for (const [key, , to] of routes) {
    const ligne = rapport.find((l) => l.edition === prefixe && l.key === key) ?? {};
    try {
      await p.goto(`${base}/#${to}`); await a(1500);
      const texte = await p.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
      const lignes = texte.split('\n').map((s) => s.trim()).filter((s) => s && FRANCAIS.test(s) && !/Audit \w+ 0904/.test(s));
      FRANCAIS.lastIndex = 0;
      const e = await entete(p);
      ligne.en = { h1: e.h1, residus: lignes.length, exemples: lignes.slice(0, 3).map((s) => s.slice(0, 70)) };
      if (lignes.length) await p.screenshot({ path: `${OUT}/${prefixe}-${key}-en.png` });
    } catch (err) { ligne.en = { exception: String(err).slice(0, 120) }; }
    console.log(`${prefixe} en  ${key.padEnd(14)} h1=${JSON.stringify(ligne.en?.h1 ?? '')} résidus=${ligne.en?.residus} ${(ligne.en?.exemples ?? []).join(' / ')}`);
  }
  await p.evaluate(() => localStorage.removeItem('amn.langue.utilisateur'));
  await ctx.close();
}

const FLEURISTE = { email: 'fleuriste.essai@exemple.test', mdp: 'Fleuriste-2026-Essai' };
const INTERNE_CPT = { email: 'essai.interne@exemple.test', mdp: 'Interne-2026-Essai' };
await poste('http://127.0.0.1:4180', FLEURISTE, BUSINESS, 'business');
fs.writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rapport, null, 1));
await telephone('http://127.0.0.1:4180', FLEURISTE, BUSINESS, 'business');
fs.writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rapport, null, 1));
await anglais('http://127.0.0.1:4180', FLEURISTE, BUSINESS, 'business');
fs.writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rapport, null, 1));
await poste('http://127.0.0.1:4181', INTERNE_CPT, INTERNE, 'interne');
await telephone('http://127.0.0.1:4181', INTERNE_CPT, INTERNE, 'interne');
await anglais('http://127.0.0.1:4181', INTERNE_CPT, INTERNE, 'interne');
fs.writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rapport, null, 1));
await nav.close();
console.log('AUDIT_FINI', rapport.length);

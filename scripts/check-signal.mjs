#!/usr/bin/env node
/**
 * UN SEUL OBJET AMBRE PAR ÉCRAN — le seul garde-fou du système de design
 * qu'un humain ne tiendra pas à la main sur soixante-huit modules.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## La règle, et pourquoi elle se perd sans contrôle
 *
 * L'ambre (`--color-signal`, #d09a4a) marque CE QUI DEMANDE UNE DÉCISION :
 * un J-11, un segment en retard, une catégorie dépassée, un créneau déjà pris.
 * Un par écran. Pas un par carte, pas un par colonne.
 *
 * C'est la règle la plus facile à casser sans le remarquer, parce qu'elle se
 * casse toujours de la même façon : deux personnes (ou la même, deux semaines
 * plus tard) ajoutent chacune un ambre justifié dans deux composants
 * différents du même écran. Chaque geste est défendable ; le résultat ne l'est
 * pas. Au troisième, l'ambre ne veut plus rien dire — c'est devenu la couleur
 * de la marque, ce que tout le système existe pour éviter.
 *
 * ## Ce qu'il mesure, et pourquoi dans un navigateur
 *
 * Un `grep` sur les sources ne peut pas répondre : le même composant rend de
 * l'ambre ou pas selon les données (l'encart « à encaisser » n'est en ambre
 * que s'il y a quelque chose à encaisser), et un écran compose des morceaux
 * écrits dans dix fichiers. La question « combien d'objets ambre voit-on sur
 * cet écran » n'a de réponse qu'à l'écran.
 *
 * On compte donc les ÉLÉMENTS RENDUS dont le fond, la couleur, la bordure ou
 * l'ombre portent la teinte du signal. Deux précisions qui évitent les faux
 * positifs :
 *
 *   · un élément dont un ANCÊTRE porte déjà l'ambre ne compte pas — une plaque
 *     ambre avec trois lignes de texte dedans est UN objet, pas quatre ;
 *   · un élément invisible (hauteur ou largeur nulle, `display:none`) ne compte
 *     pas : il n'est pas à l'écran.
 *
 * ## Mode d'emploi
 *
 *   1. npm run build:web:business   (AMN_WEB_OUT=… pour un dossier à part)
 *   2. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-signal.mjs <bundle> [port]
 *
 * Comme `check:largeur` et `check:contraste`, il lui faut un navigateur, un
 * bundle construit et une session : il vit hors CI, et son mode d'emploi est
 * ici. Ce qu'il rend est une LISTE D'ÉCRANS FAUTIFS avec ce qu'il a compté,
 * jamais un simple « non ».
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4195);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';

if (!BUNDLE || !EMAIL || !MOT_DE_PASSE) {
  console.error(
    'Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-signal.mjs <dossier-du-bundle> [port]',
  );
  process.exit(2);
}

/*
  Les écrans parcourus. La liste couvre les familles du système de design —
  pas les soixante-huit modules : ce contrôle mesure la RÈGLE, et un écran par
  famille suffit à attraper la dérive qu'elle guette. En ajouter un est une
  ligne.
*/
const ECRANS = [
  ['Accueil', ''],
  ['Clients', '#/clients'],
  ['Projets', '#/projets'],
  ['Notes', '#/notes'],
  ['Contrats', '#/contrats'],
  ['Commandes', '#/commandes'],
  ['Facturation', '#/facturation'],
  ['Dépenses', '#/depenses'],
  ['Abonnements', '#/abonnements'],
  ['Agenda', '#/agenda'],
  ['Réunions', '#/reunions'],
  ['Priorités', '#/priorites'],
  ['Routines', '#/routines'],
  ['Temps', '#/temps'],
  ['Stock', '#/stock'],
  ['Tournées', '#/tournees'],
  ['Contrôles', '#/controles'],
  ['Matériel', '#/materiel'],
  ['Pages', '#/pages'],
  ['Rapports', '#/reports'],
  ['Médias', '#/media'],
  /* `/outils/automatisations`, et non `/automations` : l'ancienne adresse
     n'existe dans aucune des deux éditions, et le routeur repliait donc sur
     l'accueil — cette ligne mesurait l'Accueil une seconde fois, et rendait un
     vert qui ne parlait pas d'Automatisations. */
  ['Automatisations', '#/outils/automatisations'],
  ['Avant la paie', '#/personnel/budget'],
  ['Tâches', '#/tasks'],
  ['Objectifs & résultats', '#/objectifs-resultats'],
];

const serveur = spawn('node', [new URL('./servir-bundle.mjs', import.meta.url).pathname, BUNDLE, String(PORT)], {
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 3000));

const navigateur = await chromium.launch({ executablePath: CHROMIUM });
const page = await navigateur.newPage({ viewport: { width: 1180, height: 1000 } });
const fautifs = [];
let mesures = 0;

try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 20 && (await page.content()).includes('name="password"'); i += 1) {
    await page.waitForTimeout(500);
  }
  if ((await page.content()).includes('name="password"')) {
    throw new Error('connexion refusée — vérifiez le compte d’essai et l’API pointée par le bundle');
  }
  await page.waitForTimeout(1200);

  for (const [nom, route] of ECRANS) {
    await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(900);
    const objets = await page.evaluate(() => {
      // La teinte du signal, sous ses deux écritures possibles une fois rendue.
      const AMBRE = ['rgb(208, 154, 74)', '#d09a4a'];
      const porte = (valeur) => AMBRE.some((a) => (valeur ?? '').toLowerCase().includes(a));
      const marques = [];
      const contenu = document.querySelector('main') ?? document.querySelector('[role="main"]');
      for (const el of (contenu ? contenu.querySelectorAll('*') : [])) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
        const touche =
          porte(s.backgroundColor) ||
          porte(s.backgroundImage) ||
          porte(s.color) ||
          porte(s.borderTopColor) ||
          porte(s.borderLeftColor) ||
          porte(s.boxShadow);
        if (touche) marques.push(el);
      }
      // Un descendant d'un objet déjà compté n'est pas un deuxième objet.
      const racines = marques.filter((el) => !marques.some((autre) => autre !== el && autre.contains(el)));
      /*
        UN SIGNAL PEUT S'ÉCRIRE EN DEUX ENDROITS — et reste un signal.

        Cas réel, prévu par le paquet de design lui-même : sur Facturation, le
        montant en retard et le segment de barre qui le représente disent LA
        MÊME CHOSE, à deux endroits de la même bande. La table des écrans les
        nomme d'ailleurs d'un seul terme (« le segment en retard »), et le
        montant est l'une des deux exceptions écrites de la règle 2.
        `data-signal-groupe` rend cette parenté explicite dans le code plutôt
        que de la laisser à l'appréciation de qui relit. Deux groupes
        différents sur un écran restent deux fautes.
      */
      const vus = new Set();
      const uniques = racines.filter((el) => {
        const groupe = el.getAttribute('data-signal-groupe') ?? el.closest('[data-signal-groupe]')?.getAttribute('data-signal-groupe');
        if (!groupe) return true;
        if (vus.has(groupe)) return false;
        vus.add(groupe);
        return true;
      });
      return uniques.map((el) => {
        const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
        return `${el.tagName.toLowerCase()}${t ? ` « ${t} »` : ''}`;
      });
    });
    mesures += 1;
    if (objets.length > 1) fautifs.push({ nom, route, objets });
    const etat = objets.length > 1 ? '✗' : objets.length === 1 ? '·' : ' ';
    console.log(`  ${etat} ${nom.padEnd(24)} ${objets.length} objet(s) ambre`);
  }
} finally {
  await navigateur.close();
  serveur.kill('SIGTERM');
}

console.log('');
if (fautifs.length === 0) {
  console.log(`OK — ${mesures} écran(s) mesuré(s), aucun n’a plus d’un objet ambre.`);
  process.exit(0);
}
console.error(`${fautifs.length} écran(s) portent plus d’un objet ambre :\n`);
for (const f of fautifs) {
  console.error(`  ✗ ${f.nom} (${f.route || '/'}) — ${f.objets.length} objets :`);
  for (const o of f.objets) console.error(`      · ${o}`);
}
console.error(
  '\nL’ambre marque ce qui demande une DÉCISION, et un écran n’en pose qu’une à la fois.\n' +
    'Deux ambres sur un écran, ce n’est pas deux signaux : c’est aucun.',
);
process.exit(1);

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
 * ## La deuxième règle : un écran VIDE n'a pas d'ambre
 *
 * Le système de design la pose comme l'exception écrite à tout ce qui précède,
 * et elle ne concerne que deux écrans sur soixante-seize : un écran sans
 * données n'a rien à signaler, donc il ne pose pas de décision, donc il n'a
 * pas d'ambre. Elle a un corollaire qui compte autant : AUCUN CHIFFRE À ZÉRO.
 * « 0 € encaissé » se lit comme un échec ; « rien n'est encore passé en
 * caisse » se lit comme un début. Les deux se mesurent ici, sur un écran qui
 * DÉCLARE être vide via `<EcranVide>` (src/components/EtatEcran.tsx) — la
 * garde ne devine pas, elle lit.
 *
 * Cette règle se casse dans l'autre sens que la première : la première se
 * casse en AJOUTANT de l'ambre, la seconde en OUBLIANT de le retirer quand
 * les données disparaissent. Un écran composé sur un jeu de données rempli
 * peut être parfait, et poser trois zéros en mono au premier jour de sa
 * cliente. C'est ce cas-là qui est contrôlé.
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
  /* La famille Pilotage, recomposée en septembre 2026 : chaque module y a
     reçu son instrument, donc chacun y a une région ambre neuve à mesurer. */
  ['Journal de bord', '#/journal-de-bord'],
  ['Revue hebdo', '#/revue-hebdo'],
  ['Formulaires', '#/formulaires'],
  ['Mini-page', '#/mini-page'],
  ['Lettre d\'information', '#/lettre'],
  ['Signature sur place', '#/signature'],
  ['Portfolio', '#/portfolio'],
  ['Accueil', ''],
  ['Clients', '#/clients'],
  ['Projets', '#/projets'],
  ['Notes', '#/notes'],
  ['Contrats', '#/contrats'],
  ['Commandes', '#/commandes'],
  ['Facturation', '#/facturation'],
  /* Devis n'est PAS une entrée de barre latérale — il vit sous Facturation
     (`MODULES.md`, module 19). Il est mesuré ici par son adresse réelle. */
  ['Devis', '#/facturation/devis'],
  ['Dépenses', '#/depenses'],
  ['Abonnements', '#/abonnements'],
  ['Caisse du jour', '#/caisse'],
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
  /* La famille « collectif », composée le 12 septembre : quatre natures
     différentes, donc quatre écrans à mesurer. Groupes est dans la liste
     alors qu'il n'a AUCUN ambre — la garde compte un maximum, zéro la
     satisfait, et l'écran y figure pour que l'ajout d'un ambre un jour
     passe devant elle plutôt qu'à côté. */
  ['Sondages', '#/sondages'],
  ['Annonces', '#/annonces'],
  ['Appels', '#/appels'],
  ['Groupes', '#/groupes'],
  /* La famille « files » : quelque chose arrive et attend une réponse. */
  ['Relances', '#/relances'],
  ['SAV', '#/sav'],
  /* Rendez-vous en ligne : une VITRINE, pas une file — voir l'en-tête de
     `BookingScreen.tsx`. Aucun ambre quand la page est ouverte et pourvue. */
  ['RDV en ligne', '#/rdv-en-ligne'],
  ['Assistance', '#/assistance'],
  ['Messages privés', '#/messages-prives'],
  /* La famille « plans » : des données à deux axes, et le piège de la
     deuxième matrice — voir l'en-tête de `ShiftsScreen.tsx`. */
  ['Planning d\'équipe', '#/planning'],
  ['Absences', '#/absences'],
  ['Tableau des projets', '#/tableau-projets'],
  ['Prospects', '#/pipeline'],
  /* La famille « registres » : on y cherche une entrée, on n'y surveille pas
     un état. Trombinoscope n'a AUCUN ambre, et c'est la bonne réponse. */
  ['Fournisseurs', '#/fournisseurs'],
  ['Nomenclatures', '#/nomenclatures'],
  ['Modèles', '#/outils/modeles'],
  ['Trombinoscope', '#/trombinoscope'],
  /* La famille « ce qui fait revenir » : chacun a un objet à lui, et un seul
     ambre — le dixième tampon, l'aiguille du peson, la racine de la branche
     la plus lourde. */
  ['Fidélité', '#/fidelite'],
  ['Avis', '#/avis'],
  ['Parrainage', '#/parrainage'],
];

const serveur = spawn('node', [new URL('./servir-bundle.mjs', import.meta.url).pathname, BUNDLE, String(PORT)], {
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 3000));

const navigateur = await chromium.launch({ executablePath: CHROMIUM });
const page = await navigateur.newPage({ viewport: { width: 1180, height: 1000 } });
const fautifs = [];
/* Les deux règles de l'écran vide — comptées à part, parce qu'elles se corrigent autrement. */
const videAmbre = [];
const videZeros = [];
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
    const mesure = await page.evaluate(() => {
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
      const nomme = (el) => {
        const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
        return `${el.tagName.toLowerCase()}${t ? ` « ${t} »` : ''}`;
      };

      /*
        L'ÉCRAN VIDE — la deuxième règle, et son corollaire.

        Le système de design la tire des deux états transverses : « un écran
        vide n'a pas d'ambre » (il n'a rien à signaler), et « aucun chiffre à
        zéro nulle part » (« 0 € encaissé » se lit comme un échec). Les deux
        se mesurent ici parce qu'elles ne se voient qu'une fois rendues, sur
        un compte qui n'a pas encore de données.

        Le marqueur vient de `<EcranVide>` (src/components/EtatEcran.tsx) : un
        nœud en `display: contents`, sans boîte, posé autour du contenu de
        l'écran. Un écran qui ne le pose pas n'est pas contrôlé — la garde ne
        DEVINE pas qu'un écran est vide, elle lit ce qu'il déclare.
      */
      const marqueur = contenu?.querySelector('[data-ecran-vide]');
      const vide = Boolean(marqueur);
      const zeros = [];
      if (vide) {
        for (const el of contenu.querySelectorAll('.tnum, [class*="font-mono"]')) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          const t = (el.textContent ?? '').trim();
          // « 0 », « 0 € », « 0,00 € », « 0 h », « 0 % » — un relevé nul écrit en clair.
          if (/^0([.,]0+)?\s*(€|%|h|j|min)?$/i.test(t)) zeros.push(nomme(el));
        }
      }

      return { objets: uniques.map(nomme), vide, zeros };
    });
    mesures += 1;
    const { objets, vide, zeros } = mesure;
    if (objets.length > 1) fautifs.push({ nom, route, objets });
    if (vide && objets.length > 0) videAmbre.push({ nom, route, objets });
    if (zeros.length > 0) videZeros.push({ nom, route, zeros });
    const etat = objets.length > 1 || (vide && objets.length > 0) || zeros.length ? '✗' : objets.length === 1 ? '·' : ' ';
    const suffixe = vide ? ' · écran vide' : '';
    console.log(`  ${etat} ${nom.padEnd(24)} ${objets.length} objet(s) ambre${suffixe}`);
  }
} finally {
  await navigateur.close();
  serveur.kill('SIGTERM');
}

console.log('');
if (fautifs.length === 0 && videAmbre.length === 0 && videZeros.length === 0) {
  console.log(`OK — ${mesures} écran(s) mesuré(s), aucun n’a plus d’un objet ambre.`);
  console.log('Les écrans déclarés vides n’en portent aucun, et n’affichent aucun relevé à zéro.');
  process.exit(0);
}

if (fautifs.length > 0) {
  console.error(`${fautifs.length} écran(s) portent plus d’un objet ambre :\n`);
  for (const f of fautifs) {
    console.error(`  ✗ ${f.nom} (${f.route || '/'}) — ${f.objets.length} objets :`);
    for (const o of f.objets) console.error(`      · ${o}`);
  }
  console.error(
    '\nL’ambre marque ce qui demande une DÉCISION, et un écran n’en pose qu’une à la fois.\n' +
      'Deux ambres sur un écran, ce n’est pas deux signaux : c’est aucun.',
  );
}

if (videAmbre.length > 0) {
  console.error(`\n${videAmbre.length} écran(s) VIDES portent de l’ambre :\n`);
  for (const f of videAmbre) {
    console.error(`  ✗ ${f.nom} (${f.route || '/'}) :`);
    for (const o of f.objets) console.error(`      · ${o}`);
  }
  console.error('\nUn écran vide n’a rien à signaler. C’est l’exception écrite à la règle d’ambre.');
}

if (videZeros.length > 0) {
  console.error(`\n${videZeros.length} écran(s) vides affichent un relevé à zéro :\n`);
  for (const f of videZeros) {
    console.error(`  ✗ ${f.nom} (${f.route || '/'}) :`);
    for (const z of f.zeros) console.error(`      · ${z}`);
  }
  console.error(
    '\n« 0 € encaissé » se lit comme un échec ; « rien n’est encore passé en caisse »\n' +
      'se lit comme un début. Sur un écran vide, on écrit la phrase, pas le chiffre.',
  );
}
process.exit(1);

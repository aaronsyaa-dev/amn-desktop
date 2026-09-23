#!/usr/bin/env node
/**
 * LE TÉLÉPHONE — ce qui se mesure, plutôt que « ce n'est pas adapté ».
 * ═══════════════════════════════════════════════════════════════════
 *
 * ## Pourquoi ce fichier
 *
 * Le système de design a été composé à 1180 px. Dire « le mobile n'est pas
 * adapté » est vrai et inutilisable : on ne sait pas par où commencer, ni
 * quand on a fini. Ce contrôle transforme cette phrase en une LISTE — écran
 * par écran, largeur par largeur, avec le nombre lu.
 *
 * Il ne juge pas le goût. Il mesure quatre choses qui rendent un écran
 * inutilisable sur un téléphone, et qu'un humain ne tiendra pas à la main sur
 * 71 modules × quatre largeurs.
 *
 *   1. LE DÉBORDEMENT HORIZONTAL. Un écran qui se balaie latéralement sur un
 *      téléphone est cassé : on perd la moitié du contenu sans le savoir. On
 *      mesure la page ET chaque élément qui dépasse le bord droit.
 *
 *   2. LE TEXTE MANGÉ PAR SON ELLIPSE. C'est le défaut le plus fréquent d'une
 *      composition de bureau rétrécie, et le plus silencieux : `truncate`
 *      coupe sans rien casser. Relevé sur l'Accueil à 390 px, dans la liste
 *      « À traiter » : « Couro… », « Engra… », « Stock … ». Six caractères sur
 *      un nom d'article — la ligne est là, elle ne dit plus rien.
 *      On signale un texte dont l'ellipse mange plus de la MOITIÉ.
 *
 *   3. L'AMBRE, À LA LARGEUR DU TÉLÉPHONE. La règle « un seul objet ambre par
 *      écran » a toujours été mesurée à 1180 px (`check:signal`). Une carte
 *      qui passait à côté d'une autre sur un bureau passe DESSOUS sur un
 *      téléphone : deux grappes séparées par un titre, c'est-à-dire deux
 *      objets là où le bureau n'en montrait qu'un. La règle ne change pas
 *      avec la largeur ; sa vérification non plus.
 *
 *   4. LA NAVIGATION DU TÉLÉPHONE EST BIEN CELLE DU TÉLÉPHONE. Sous `md`, la
 *      colonne de bureau ne doit pas être rendue du tout — ni visible, ni
 *      glissée hors cadre. C'est ce qu'elle faisait : un rail de 52 px et un
 *      panneau de 184 sur un écran de 390.
 *
 * ## Les largeurs
 *
 * Quatre, et pas un point de rupture unique : 360 (Android d'entrée de
 * gamme, encore très répandu), 390 (iPhone courant), 430 (grand iPhone), 768
 * (tablette en portrait, la frontière `md` de Tailwind). Un écran qui tient
 * aux quatre tient au continuum entre elles.
 *
 * ## Mode d'emploi
 *
 *   1. npm run build:web:business   (ou build:web)
 *   2. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… \
 *        node scripts/check-mobile.mjs <dossier-du-bundle> [port]
 *
 * Il vit hors CI, comme `check:signal` et `check:contraste` : il lui faut un
 * navigateur, un bundle et une session.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4196);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';

if (!BUNDLE || !EMAIL || !MOT_DE_PASSE) {
  console.error(
    'Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-mobile.mjs <dossier-du-bundle> [port]',
  );
  process.exit(2);
}

/** Les largeurs mesurées. Voir l'en-tête : quatre, pas un seuil. */
const LARGEURS = [
  [360, 740, 'Android d’entrée de gamme'],
  [390, 844, 'iPhone courant'],
  [430, 932, 'grand iPhone'],
  [768, 1024, 'tablette en portrait — la frontière md'],
];

/*
  Les écrans du quotidien, ceux qu'on ouvre debout dans un couloir. Ce sont
  eux qui prouvent la direction ; le reste du catalogue suivra. En ajouter un
  est une ligne.
*/
const ECRANS = [
  ['Accueil', '#/'],
  ['Agenda', '#/agenda'],
  ['Clients', '#/clients'],
  ['Facturation', '#/facturation'],
  ['Tâches', '#/tasks'],
  /* Les nouveaux modules des cahiers 6 à 8 : composés d'emblée pour le
     téléphone, ils entrent dans la mesure dès leur arrivée. */
  ['Boutique', '#/boutique'],
  ['Billetterie', '#/billetterie'],
  ['Dons', '#/dons'],
  ['Acompte en ligne', '#/acompte'],
  ['Chatbot', '#/chatbot'],
  ['Standard', '#/standard'],
  ['Montage vidéo', '#/montage-video'],
  ['Visuels pub', '#/visuels-pub'],
  ['Planificateur', '#/planificateur'],
  ['Podcast', '#/podcast'],
  ['Identité visuelle', '#/identite-visuelle'],
  ['Images produits', '#/images-produits'],
  ['Sentiment', '#/sentiment'],
  ['Veille', '#/veille-prix'],
  ['NPS', '#/nps'],
  ['Trésorerie prévue', '#/tresorerie'],
  ['Scénarios', '#/scenarios'],
  ['Simulateur de prêt', '#/simulateur-pret'],
  ['Analytique', '#/analytique'],
  ['Rapprochement', '#/rapprochement'],
  ['Prévision fiscale', '#/prevision-fiscale'],
  ['Multi-devises', '#/multi-devises'],
  ['Notes de frais', '#/notes-de-frais'],
  ['Factures entrantes', '#/factures-entrantes'],
  ['Recrutement', '#/recrutement'],
  ['Procédures', '#/procedures'],
  ['Formation', '#/formation'],
  ['Habilitations', '#/habilitations'],
  ['Bulletins de paie', '#/bulletins'],
  ['Clausier', '#/clausier'],
  ['Signature à distance', '#/signature-a-distance'],
  ['RGPD', '#/rgpd'],
  ['Impact RSE', '#/impact-rse'],
  ['Vérification d’identité', '#/verification-identite'],
  ['Tableau de bord', '#/tableau-de-bord'],
];

const AMBRE = ['rgb(208, 154, 74)', '#d09a4a'];

async function mesurer(page) {
  return page.evaluate((AMBRE) => {
    const d = document.documentElement;
    const largeur = d.clientWidth;

    /* 1 · le débordement, de la page et des éléments. */
    const debordPage = Math.max(0, d.scrollWidth - largeur);
    const deborde = [];
    for (const el of document.querySelectorAll('main *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
      if (s.position === 'fixed') continue;
      if (r.right > largeur + 1) {
        deborde.push({
          quoi: (el.textContent ?? '').trim().slice(0, 28) || el.tagName.toLowerCase(),
          de: Math.round(r.right - largeur),
        });
      }
    }

    /* 2 · le texte mangé par son ellipse. */
    const manges = [];
    for (const el of document.querySelectorAll('main *')) {
      if (el.children.length > 0) continue; // seulement les feuilles de texte
      const texte = (el.textContent ?? '').trim();
      if (texte.length < 4) continue;
      const s = getComputedStyle(el);
      if (s.textOverflow !== 'ellipsis' && s.overflow !== 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      /* La part réellement visible, en largeur. Sous la moitié, la ligne ne
         dit plus ce qu'elle nomme — c'est le seuil qu'on refuse. */
      const part = el.clientWidth / el.scrollWidth;
      if (part < 0.5) manges.push({ texte: texte.slice(0, 40), part: Math.round(part * 100) });
    }

    /* 3 · l'ambre, compté comme `check:signal` le compte. */
    const porte = (v) => AMBRE.some((a) => (v ?? '').toLowerCase().includes(a));
    const marques = [];
    const contenu = document.querySelector('main') ?? document.querySelector('[role="main"]');
    for (const el of contenu ? contenu.querySelectorAll('*') : []) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
      if (
        porte(s.backgroundColor) || porte(s.backgroundImage) || porte(s.color) ||
        porte(s.fill) || porte(s.stroke) || porte(s.borderTopColor) ||
        porte(s.borderLeftColor) || porte(s.boxShadow)
      ) marques.push(el);
    }
    const racines = marques.filter((el) => !marques.some((a) => a !== el && a.contains(el)));
    const groupes = new Set(
      racines.map((el) => el.closest('[data-signal-groupe]')?.getAttribute('data-signal-groupe') ?? null),
    );
    const objetsAmbre = groupes.has(null)
      ? racines.filter((el) => !el.closest('[data-signal-groupe]')).length + (groupes.size - 1)
      : groupes.size;

    /* 4 · la colonne de bureau ne doit pas être montée sous md. */
    const colonne = document.querySelector('[data-coquille]');
    const colonneRendue = Boolean(colonne) && colonne.getBoundingClientRect().width > 0;

    return { largeur, debordPage, deborde: deborde.slice(0, 5), nDeborde: deborde.length, manges: manges.slice(0, 6), nManges: manges.length, objetsAmbre, colonneRendue };
  }, AMBRE);
}

const serveur = spawn(
  'node',
  [new URL('./servir-bundle.mjs', import.meta.url).pathname, BUNDLE, String(PORT)],
  { stdio: 'ignore' },
);
await new Promise((r) => setTimeout(r, 3000));

const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const fautes = [];
let mesures = 0;

try {
  for (const [L, H, quoi] of LARGEURS) {
    const ctx = await navigateur.newContext({
      viewport: { width: L, height: H },
      deviceScaleFactor: 2,
      isMobile: L < 768,
      hasTouch: L < 768,
    });
    const page = await ctx.newPage();
    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
    await page.locator('button[type="submit"]').click();
    for (let i = 0; i < 25 && (await page.content()).includes('name="password"'); i += 1) {
      await page.waitForTimeout(600);
    }
    if ((await page.content()).includes('name="password"')) {
      throw new Error('connexion refusée — vérifiez le compte d’essai et l’API pointée par le bundle');
    }

    for (const [nom, route] of ECRANS) {
      await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
      await page.waitForTimeout(900);
      /* Le rideau de bienvenue couvre l'écran une fois par jour ; il se ferme
         au clic, et ce n'est pas lui qu'on mesure. */
      for (let i = 0; i < 3; i += 1) {
        if (!(await page.$('text=Bienvenue sur'))) break;
        await page.mouse.click(L / 2, H / 2);
        await page.waitForTimeout(600);
      }
      const m = await mesurer(page);
      mesures += 1;
      const ou = `${nom} @ ${L}px`;

      if (m.debordPage > 0) {
        fautes.push(`${ou} · la page déborde de ${m.debordPage}px : l'écran se balaie latéralement.`);
      }
      for (const d of m.deborde) {
        fautes.push(`${ou} · « ${d.quoi} » dépasse le bord droit de ${d.de}px.`);
      }
      if (m.nDeborde > m.deborde.length) {
        fautes.push(`${ou} · … et ${m.nDeborde - m.deborde.length} autre(s) élément(s) qui dépassent.`);
      }
      for (const t of m.manges) {
        fautes.push(`${ou} · « ${t.texte} » n'est visible qu'à ${t.part}% — l'ellipse mange le nom.`);
      }
      if (m.nManges > m.manges.length) {
        fautes.push(`${ou} · … et ${m.nManges - m.manges.length} autre(s) texte(s) coupé(s) de moitié.`);
      }
      if (m.objetsAmbre > 1) {
        fautes.push(`${ou} · ${m.objetsAmbre} objets ambre. La règle ne change pas avec la largeur.`);
      }
      if (L < 768 && m.colonneRendue) {
        fautes.push(
          `${ou} · la colonne de bureau est rendue sous md. Le rail de 52 px et le panneau de 184 n'ont pas de sens ici — voir components/rail/PanneauMobile.tsx.`,
        );
      }
    }
    await ctx.close();
    console.log(`  ${L}px (${quoi}) — ${ECRANS.length} écran(s) mesuré(s).`);
  }
} finally {
  await navigateur.close();
  serveur.kill();
}

if (fautes.length > 0) {
  console.error(`\nTéléphone : ${fautes.length} mesure(s) fautive(s) sur ${mesures} écran(s).\n`);
  for (const f of fautes) console.error(`  ✗ ${f}`);
  console.error(
    '\nUn nom coupé à six caractères occupe une ligne sans rien nommer :\n' +
      'c’est pire qu’une ligne absente, parce qu’on croit avoir lu.\n',
  );
  process.exit(1);
}

console.log(
  `\nTéléphone : OK — ${mesures} mesure(s), aucun débordement, aucun texte coupé de moitié,\nun objet ambre au plus, et la navigation du téléphone est bien la sienne.`,
);

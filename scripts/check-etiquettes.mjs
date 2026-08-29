#!/usr/bin/env node
/**
 * Contrôle des ÉTIQUETTES — ce qu'un lecteur d'écran entend, ou n'entend pas.
 *
 * ## Trois questions, et une seule réponse acceptable
 *
 *   1. chaque champ de saisie a-t-il un nom ?
 *   2. chaque commande sans texte visible en a-t-elle un ?
 *   3. chaque image porte-t-elle une alternative, fût-elle vide ?
 *
 * Un bouton qui ne montre qu'une icône s'annonce « bouton », et rien de plus.
 * Une liste déroulante sans étiquette s'annonce « liste déroulante » : on ne
 * sait pas ce qu'elle filtre. Le sens que porte la mise en page — le champ
 * juste à côté, la première option — n'existe qu'à l'œil.
 *
 * ## Ce qu'il a trouvé
 *
 * **Le bouton « Se déconnecter » de la barre cliente.** Son libellé disparaît
 * quand la barre est repliée ; il ne restait qu'une icône, sans nom ni au
 * survol ni à l'oreille. Les liens de navigation juste au-dessus portaient
 * déjà les deux — c'était le seul oublié, et le plus conséquent : on ne se
 * déconnecte pas par erreur.
 *
 * Puis un filtre de bibliothèque média, et un « + » d'ajout d'échange dans une
 * fiche client. Trois en tout, sur 2 346 éléments examinés — le produit était
 * déjà largement en règle, et c'est ce qui rend ces trois-là faciles à rater.
 *
 * ## Ce qu'il accepte, et pourquoi
 *
 * Un `placeholder` compte pour un champ : ce n'est pas l'idéal (il disparaît à
 * la saisie), mais il est annoncé, et exiger davantage signalerait comme
 * fautifs des champs parfaitement utilisables. Un `alt=""` compte pour une
 * image : c'est la façon normale de dire « décorative, passe ton chemin ».
 *
 *   1. npm run build:web            (ou build:web:business)
 *   1bis. npm run seed:essai        — sinon les écrans sont VIDES, et ce
 *                                     contrôle ne mesure que des états vides
 *   2. npx serve -s dist -l 4180
 *   3. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… npm run check:etiquettes
 */

const APP = (process.env.AMN_E2E_URL ?? 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

if (!EMAIL || !MOT_DE_PASSE) {
  console.log('Contrôle des étiquettes : SAUTÉ — il faut une session pour atteindre les écrans.\n');
  console.log('  AMN_E2E_EMAIL et AMN_E2E_PASSWORD ne sont pas définis. Sans elles, ce');
  console.log('  contrôle ne verrait que l’écran de connexion, et passerait au vert en');
  console.log('  n’ayant rien mesuré — exactement ce qu’il est censé empêcher.');
  console.log('\n  Voir l’en-tête de scripts/check-etiquettes.mjs pour le mode d’emploi.');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const { parcourirVuesDetail, exigerDesVuesDetail } = await import('./lib/vues-detail.mjs');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

console.log(`Contrôle des étiquettes — ${APP}\n`);

await page.goto(APP);
await attendre(2500);
await page.locator('input[name="email"]').fill(EMAIL);
await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
await page.locator('button:has-text("Se connecter")').click();
for (let i = 0; i < 15 && (await page.content()).includes('name="password"'); i += 1) {
  await attendre(1000);
}
if ((await page.content()).includes('name="password"')) {
  console.error('ÉCHEC : la connexion n’a pas abouti. Rien n’a pu être mesuré.');
  await nav.close();

  process.exit(1);
}
await attendre(2000);

const routes = await page.evaluate(() => [
  ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
]);
if (routes.length === 0) {
  console.error('ÉCHEC : aucune route trouvée dans la navigation. Rien n’a pu être mesuré.');
  await nav.close();
  process.exit(1);
}

const muets = new Map();
let examines = 0;
let detailsOuverts = 0;

for (const route of routes) {
  await page.goto(APP + route).catch(() => undefined);
  await attendre(1000);

  const mesurer = async (ou) => {
    const releve = await page.evaluate(() => {
    const out = [];
    let n = 0;

    /** Le nom accessible, par les cinq chemins que les navigateurs suivent. */
    const nomme = (el) => {
      if (el.getAttribute('aria-label')?.trim()) return true;
      const par = el.getAttribute('aria-labelledby');
      if (par && par.split(/\s+/).some((id) => document.getElementById(id)?.textContent?.trim())) {
        return true;
      }
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
      if (el.closest('label')) return true;
      if (el.getAttribute('title')?.trim()) return true;
      return false;
    };

    const visible = (el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };

    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (el.type === 'hidden' || !visible(el)) continue;
      n += 1;
      // Un `placeholder` n'est pas idéal — il disparaît à la saisie — mais il
      // est annoncé. L'exiger absent signalerait des champs utilisables.
      if (nomme(el) || el.getAttribute('placeholder')?.trim()) continue;
      out.push({
        genre: 'champ',
        tag: `${el.tagName.toLowerCase()}[${el.type || ''}]`,
        cls: String(el.className || '').slice(0, 48),
      });
    }

    for (const el of document.querySelectorAll('button, [role="button"], a[href]')) {
      if (!visible(el)) continue;
      n += 1;
      // Un texte visible EST le nom accessible : rien à ajouter.
      if ((el.textContent || '').trim().length > 0) continue;
      if (nomme(el)) continue;
      out.push({ genre: 'commande', tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 48) });
    }

    for (const el of document.querySelectorAll('img')) {
      if (!visible(el)) continue;
      n += 1;
      // `alt=""` est un choix valide : « décorative, passe ton chemin ».
      if (el.hasAttribute('alt')) continue;
      out.push({ genre: 'image', tag: 'img', cls: String(el.className || '').slice(0, 48) });
    }

    return { out, n };
    });

    examines += releve.n;
    for (const x of releve.out) {
      const cle = `${x.genre}|${x.tag}|${x.cls}`;
      const e = muets.get(cle) ?? { ...x, n: 0, routes: new Set() };
      e.n += 1;
      e.routes.add(ou);
      muets.set(cle, e);
    }
  };

  await mesurer(route);

  /*
    LES VUES DE DÉTAIL, ET PAS SEULEMENT LES LISTES.

    Les champs de saisie et les commandes à icône seule — celles qui ont besoin
    d'un nom — vivent dans les formulaires et les fenêtres, pas sur les écrans
    de liste que ce contrôle visitait seul. Il mesurait donc surtout des liens
    de navigation, qui portent tous leur texte.
  */
  detailsOuverts += await parcourirVuesDetail(page, route, mesurer, attendre);
}

await nav.close();

/*
  LE TÉMOIN DES VUES DE DÉTAIL — posé ICI, après la boucle, et pas près du
  premier `nav.close()` venu.

  Mon premier jet l'avait accroché à la fermeture d'une branche d'échec
  PRÉCOCE, qui vit avant la déclaration de `detailsOuverts`. Une session
  refusée ne donnait donc plus le message clair prévu pour elle, mais un
  `ReferenceError: Cannot access 'detailsOuverts' before initialization` —
  c'est-à-dire un contrôle qui parle de sa propre plomberie au moment précis
  où quelqu'un a besoin de savoir que son mot de passe ne passe pas.
*/
exigerDesVuesDetail(detailsOuverts, 'check:etiquettes');


/* Le témoin : sans élément examiné, il n'y a pas de bonne nouvelle. */
if (examines === 0) {
  console.error('ÉCHEC : aucun élément examiné. Le contrôle n’a rien vu, il ne conclut pas.');
  process.exit(1);
}

if (muets.size > 0) {
  const total = [...muets.values()].reduce((n, e) => n + e.n, 0);
  console.error(`${muets.size} forme(s) sans nom — ${total} occurrence(s) :\n`);
  for (const e of [...muets.values()].sort((a, b) => b.n - a.n)) {
    console.error(`  ✗ ${e.n}×  ${e.genre}  <${e.tag}>`);
    console.error(`      [${e.cls}]  ${[...e.routes].slice(0, 4).join(' ')}`);
    console.error('');
  }
  console.error('Un lecteur d’écran annonce « bouton » ou « liste déroulante », et rien de');
  console.error('plus. Le sens que porte la mise en page — le champ juste à côté, la');
  console.error('première option — n’existe qu’à l’œil. Un `aria-label` suffit, et un');
  console.error('`title` en plus rend le nom visible au survol.');
  process.exit(1);
}

console.log(
  `OK — ${routes.length} écrans + ${detailsOuverts} vue(s) de détail, ` +
    `${examines} éléments examinés, tous nommés.`,
);

/**
 * TOUTES LES ROUTES DE LA COQUILLE — y compris celles des familles fermées.
 * ════════════════════════════════════════════════════════════════════════
 *
 * ## Le trou que ce fichier bouche
 *
 * Quatre garde-fous navigateur (`check:contraste`, `check:cibles`,
 * `check:largeur`, `check:mouvement`) amorcent leur parcours en lisant les
 * `a[href^="#/"]` de la page d'accueil, puis élargissent au fur et à mesure.
 * Tant que la barre latérale listait toutes les sections de l'espace courant
 * d'un coup, l'amorce faisait une soixantaine de liens et la boule de neige
 * couvrait le produit.
 *
 * Le rail a changé cela sans prévenir. Deux mesures, faites juste après la
 * bascule :
 *
 *   à 1400 px  ·  une seule famille est ouverte, les onze autres sont des
 *                 TUILES — des `<button>`, sans `href`. `check:contraste` est
 *                 passé de 96 écrans à 41 ;
 *   à 390 px   ·  la colonne est repliée au rail, et le panneau n'est pas
 *                 rendu du tout. `check:cibles` est passé de 74 routes à
 *                 QUATRE — l'accueil et les trois épinglés de la barre du
 *                 pouce.
 *
 * Les deux sont restés VERTS. C'est exactement la façon dont une garde
 * rassure à tort, et c'est ce que ce fichier corrige.
 *
 * ## Ce que fait ce fichier
 *
 * Il énumère les routes sur une page SŒUR, ouverte large et dépliée, dans le
 * même contexte de navigateur — donc avec la même session, sans reconnexion.
 * Il y ouvre chaque tuile du rail et relève les liens du panneau.
 *
 * La page sœur est le point important : le contrôle appelant garde sa fenêtre
 * intacte. `check:cibles` travaille à 390 px et mesure des cibles au pixel
 * près ; lui déplier une colonne sous le nez, ou faire défiler sa page pour
 * atteindre une tuile hors cadre, fausserait tout ce qu'il mesure ensuite.
 * Mesuré aussi, celui-là : ses clics de ligne tombaient à côté et il n'ouvrait
 * plus AUCUNE vue de détail.
 *
 * Aucune connaissance du catalogue n'est recopiée ici : on ouvre ce que la
 * colonne montre, donc un module ajouté est couvert sans qu'on y pense — et un
 * module que la colonne n'atteint PAS ne l'est pas, ce qui est la vérité utile.
 */

/** La clé où la colonne retient le choix de pli (voir src/lib/barreLaterale.ts). */
const CLE_CHOIX = 'amn.sidebar.expanded';

/** La largeur à laquelle la colonne se déplie sans discuter. */
const LARGE = 1400;

/**
 * @param page      la page Playwright, déjà connectée
 * @param attendre  (ms) => Promise — la temporisation du contrôle appelant
 * @param base      l'URL de l'application (défaut : celle de `page`)
 * @returns {Promise<string[]>} les routes `#/…`, sans doublon
 */
export async function routesDeLaCoquille(page, attendre, base) {
  const lire = (p) =>
    p.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href')),
      ),
    ]);

  /* Ce que la page de l'appelant montre déjà : la barre du pouce, l'en-tête,
     le pied. On part de là, pour que l'échec de la page sœur n'enlève rien. */
  const routes = new Set(await lire(page));

  const adresse = base ?? new URL(page.url().split('#')[0]).toString();
  let soeur;
  try {
    soeur = await page.context().newPage();
    await soeur.setViewportSize({ width: LARGE, height: 1000 });
    /* Le choix explicite gagne sur la largeur — `lib/barreLaterale.ts`. On le
       pose avant la première mise en page, sinon la colonne démarre repliée et
       le panneau n'existe pas encore quand on lit. */
    await soeur.goto(adresse);
    await soeur.evaluate((cle) => window.localStorage.setItem(cle, 'true'), CLE_CHOIX);
    await soeur.goto(adresse);
    await attendre(2000);

    const combien = await soeur.evaluate(
      () => document.querySelectorAll('[data-rail-tuile]').length,
    );
    for (const r of await lire(soeur)) routes.add(r);
    for (let i = 0; i < combien; i += 1) {
      /*
        `el.click()` depuis la page, et non un clic à la souris : on veut
        déclencher le gestionnaire React, pas éprouver le pointeur. On relit
        la liste à chaque tour — ouvrir une famille rend le panneau, et React
        peut remplacer les nœuds du rail au passage.
      */
      await soeur.evaluate((n) => {
        document.querySelectorAll('[data-rail-tuile]')[n]?.click();
      }, i);
      await attendre(200);
      for (const r of await lire(soeur)) routes.add(r);
    }
  } catch (err) {
    /* Pas de coquille — un écran de connexion, une barre écrite à la main :
       on rend ce qu'on a lu plutôt que d'échouer. C'est à l'appelant de dire
       qu'il n'a rien trouvé, il le fait déjà et mieux.

       Mais on le DIT. Une amorce muette qui retombe sur quatre routes est
       précisément ce qui a laissé `check:contraste` vert sur un tiers du
       produit : l'échec doit s'entendre, même quand il ne fait pas échouer. */
    console.warn(`  note  l'énumération par le rail a échoué (${err?.message ?? err}) — amorce réduite.`);
  } finally {
    await soeur?.close().catch(() => undefined);
  }

  console.log(`  amorce : ${routes.size} route(s), rail compris.`);
  return [...routes];
}

/**
 * OUVRIR CE QUI SE CACHE DERRIÈRE UNE LISTE
 * ═════════════════════════════════════════
 *
 * Les garde-fous navigateur parcouraient les écrans de LISTE et s'arrêtaient
 * là. Or c'est derrière — dans la fiche, la fenêtre, l'éditeur — que vivent
 * les gestes destructeurs et les commandes serrées.
 *
 * Mesuré la nuit du 28 : en ouvrant les vues de détail, `check:cibles` est
 * passé de 796 à 1 624 cibles côté cliente et de 1 654 à 2 825 côté interne —
 * un peu plus du double de l'application réellement mesurée. Huit défauts s'y
 * cachaient, dont un « Retirer la ligne » de 12 × 12 px et le « Fermer » de
 * huit fenêtres à 18 px.
 *
 * ## Repérées par leur GÉOMÉTRIE, pas par leurs classes
 *
 * Un premier jet cherchait `li button`, `article button`, `[role=button]` : du
 * balisage que l'édition interne emploie et pas l'édition cliente, dont les
 * lignes de liste sont de simples `<button>` dans un `<div>`. Le contrôle
 * n'ouvrait alors plus rien du tout, et c'est son propre témoin qui l'a dit.
 *
 * Ce qu'on cherche n'est pas une balise, c'est une LIGNE : large comme son
 * conteneur, assez haute pour qu'on la vise, et qui n'est pas le bouton
 * d'action principal de l'écran.
 *
 * ## Ce module est partagé, et c'est le but
 *
 * Quatre contrôles ont le même angle mort. Recopier la boucle dans chacun
 * garantissait qu'ils divergeraient — l'un corrigé, les autres pas.
 */

/** Ce qui crée ou trie, plutôt que d'ouvrir. */
const PAS_UNE_LIGNE = 'Nouveau|Nouvelle|Ajouter|Créer|Importer|Enregistrer|Filtrer|Trier';

/**
 * Les libellés des premières « lignes » ouvrables de l'écran courant.
 *
 * Des libellés et non des poignées Playwright : entre le repérage et le clic,
 * un rendu peut remplacer les nœuds, et une poignée prise trop tôt pointerait
 * dans le vide.
 */
export async function rangsOuvrables(page, combien = 2) {
  return page.evaluate(
    ({ combien, motif }) => {
      const main = document.querySelector('main') ?? document.body;
      const large = main.getBoundingClientRect().width;
      /*
        Le seuil doit valoir sur un téléphone comme sur un écran large.
        `check:cibles` mesure à 390 px, où une ligne prend toute la largeur ;
        `check:contraste` à 1 400 px, où la même liste tient dans une colonne
        de 400 px. Un seuil de 60 % de `main` ouvrait douze vues sur l'un et
        UNE sur l'autre.

        On prend donc le plus petit des deux : soixante pour cent du conteneur,
        ou trois cents pixels — la largeur en dessous de laquelle un bouton
        n'est plus une ligne de liste mais une commande.
      */
      const seuil = Math.min(large * 0.6, 300);
      const exclure = new RegExp(`^(${motif})`, 'i');
      const out = [];
      for (const b of main.querySelectorAll('button')) {
        const r = b.getBoundingClientRect();
        if (r.width < seuil || r.height < 40) continue;
        const t = (b.textContent || '').trim();
        if (!t || exclure.test(t)) continue;
        out.push(t.slice(0, 40));
        if (out.length >= combien) break;
      }
      return out;
    },
    { combien, motif: PAS_UNE_LIGNE },
  );
}

/**
 * Ouvre chaque ligne repérée, appelle `mesurer(libelléDeLaVue)`, puis referme
 * à Échap. Rend le nombre de vues réellement ouvertes.
 *
 * `attendre` est passé par l'appelant : chaque contrôle a son propre rythme, et
 * certains coupent les transitions avant de mesurer.
 */
export async function parcourirVuesDetail(page, route, mesurer, attendre, combien = 2) {
  let ouvertes = 0;
  const rangs = await rangsOuvrables(page, combien).catch(() => []);
  for (const rang of rangs) {
    const avant = await page.evaluate(() => document.body.innerHTML.length);
    try {
      await page.locator('main button', { hasText: rang }).first().click({ timeout: 2500 });
    } catch {
      continue; // recouvert, détaché, hors écran : ce n'est pas un défaut
    }
    await attendre(700);
    const apres = await page.evaluate(() => document.body.innerHTML.length);
    /*
      Rien n'a bougé : le clic n'a pas ouvert de vue. Re-mesurer les mêmes
      éléments gonflerait le compte et donnerait l'illusion d'une couverture
      qu'on n'a pas.
    */
    if (Math.abs(apres - avant) < 400) continue;
    ouvertes += 1;
    await mesurer(`${route} (détail)`);
    await page.keyboard.press('Escape');
    await attendre(400);
  }
  return ouvertes;
}

/**
 * LES BASCULES DE VUE — le second angle mort, jumeau du premier.
 *
 * Un écran qui propose « Liste » ou « Graphe », « Semaine » ou « Mois »,
 * n'existait pour les garde-fous que dans son état par DÉFAUT. Tout ce que
 * l'autre vue dessine — ses cibles, ses contrastes, ses noms — n'a jamais été
 * mesuré, alors qu'il suffit d'un clic pour y être et qu'on y passe des
 * heures.
 *
 * Repérées par `aria-pressed`, qui est précisément ce qu'une bascule doit
 * porter : on ne devine pas des classes, on lit ce que l'interface déclare
 * déjà à un lecteur d'écran. Une bascule qui n'en porte pas est un défaut à
 * part, et `check:etiquettes` en parle mieux que ce module.
 *
 * L'état de départ est RESTAURÉ à la fin : la suite du parcours — les vues de
 * détail, l'écran suivant — doit retrouver l'écran tel qu'elle l'attend.
 */
export async function parcourirBascules(page, route, mesurer, attendre) {
  const bascules = await page
    .evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const out = { autres: [], depart: null };
      for (const b of main.querySelectorAll('button[aria-pressed]')) {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const t = (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 40);
        if (!t) continue;
        if (b.getAttribute('aria-pressed') === 'true') out.depart ??= t;
        else out.autres.push(t);
      }
      return out;
    })
    .catch(() => ({ autres: [], depart: null }));

  let vues = 0;
  for (const nom of bascules.autres.slice(0, 3)) {
    try {
      await page.locator('main button', { hasText: nom }).first().click({ timeout: 2500 });
    } catch {
      continue;
    }
    await attendre(700);
    vues += 1;
    await mesurer(`${route} (${nom})`);
  }
  if (vues > 0 && bascules.depart) {
    await page
      .locator('main button', { hasText: bascules.depart })
      .first()
      .click({ timeout: 2500 })
      .catch(() => undefined);
    await attendre(500);
  }
  return vues;
}

/**
 * Le témoin : sans une seule vue de détail ouverte, le contrôle est retombé
 * dans l'angle mort qui lui faisait manquer la moitié de l'application. Un vert
 * obtenu en ne regardant que des listes n'est pas un vert.
 */
export function exigerDesVuesDetail(ouvertes, nomDuControle) {
  if (ouvertes > 0) return;
  console.error(
    `ÉCHEC : ${nomDuControle} n’a pu ouvrir AUCUNE vue de détail.\n\n` +
      '  Il n’aurait mesuré que des écrans de liste — exactement ce qui lui avait fait\n' +
      '  manquer un « Retirer la ligne » de 12 × 12 px et le « Fermer » de huit fenêtres.\n\n' +
      '  Deux causes possibles :\n' +
      '    · le jeu d’essai est vide → node scripts/seed-essai.mjs\n' +
      '    · le repérage des lignes ne tient plus → scripts/lib/vues-detail.mjs',
  );
  process.exit(1);
}

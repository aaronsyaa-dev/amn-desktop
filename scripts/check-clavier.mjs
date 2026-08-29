#!/usr/bin/env node
/**
 * CE QU'ON NE PEUT PAS FAIRE AU CLAVIER
 * ═════════════════════════════════════
 *
 * Deux règles, et la première est celle qui a motivé ce contrôle.
 *
 * ## 1. Un calque qui se ferme au clic doit se fermer à Échap
 *
 * Vingt calques de l'application — formulaires en modale, panneaux, menus —
 * se fermaient au clic sur leur fond et ne répondaient pas à Échap. Neuf
 * autres l'écoutaient déjà : la convention existait dans un tiers du produit
 * et manquait dans les deux autres tiers.
 *
 * Mesuré au navigateur avant correctif, en ouvrant chaque calque et en
 * appuyant sur Échap : neuf calques atteints sur l'édition cliente, **zéro**
 * ne se fermait.
 *
 * À la souris on clique à côté, et on ne voit rien. Au clavier il faut tabuler
 * jusqu'à la croix — à travers tous les champs du formulaire, et quand elle
 * existe. C'est le geste le plus universel de toute interface, et celui qu'on
 * fait par réflexe après s'être trompé de bouton.
 *
 * ## 2. Un élément cliquable doit être atteignable
 *
 * Un `<div onClick>` est un bouton pour la souris et n'existe pas pour le
 * clavier : pas de tabulation, pas d'Entrée, rien pour un lecteur d'écran.
 * Il lui faut au minimum un `role`, un `tabIndex` et un `onKeyDown` — ou,
 * mieux, être un vrai `<button>`.
 *
 * Un FOND de calque en est dispensé : au clavier on ferme avec Échap, pas en
 * tabulant jusqu'au vide. C'est la règle 1 qui le couvre, et les deux se
 * complètent exactement.
 *
 * ## Ce qu'il ne juge pas
 *
 * Les composants React en majuscule (`<Modal>`, `<Panel>`) : ils rendent ce
 * qu'ils veulent, et le contrôle les verra de toute façon dans leur propre
 * fichier. `motion.button` est un bouton — framer-motion rend la balise
 * qu'on nomme.
 *
 *   npm run check:clavier
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const failures = [];

/**
 * Les calques dispensés d'Échap, avec leur raison.
 *
 * Une dispense se MÉRITE : chacune dit pourquoi fermer à Échap serait faux
 * ici, pas seulement pourquoi ce serait pénible à écrire.
 */
const SANS_ECHAP = new Map([
  [
    'components/call/CallOverlay.tsx',
    'un appel en cours ne se raccroche pas d’un réflexe. Échap est la touche ' +
      'qu’on frappe pour annuler une erreur ; l’associer à « couper la ' +
      'communication » ferait raccrocher au nez de quelqu’un.',
  ],
]);

/** Les balises qui reçoivent le focus toutes seules. */
const FOCUSABLES = /^(button|a|input|select|textarea|summary|label|option)$/;

/**
 * Les rôles qui promettent une ACTION, et doivent donc s'activer au clavier.
 *
 * Un `role="dialog"` ou `role="status"` n'a rien à activer : il décrit une
 * région, pas une commande. Exiger `tabIndex` et `onKeyDown` de sa part
 * signalerait une faute là où il n'y en a pas — le premier jet de ce contrôle
 * le faisait, et pointait quatre modales parfaitement correctes.
 */
const ROLES_ACTIFS = /^(button|link|menuitem|menuitemcheckbox|menuitemradio|tab|checkbox|radio|switch|option)$/;

const fichiers = [];
(function marcher(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) marcher(p);
    else if (e.name.endsWith('.tsx')) fichiers.push(p);
  }
})(SRC);

let calques = 0;
let cliquables = 0;

for (const chemin of fichiers) {
  const rel = path.relative(SRC, chemin).replace(/\\/g, '/');
  const source = fs.readFileSync(chemin, 'utf-8');
  const lignes = source.split('\n');

  /*
    COMMENTAIRES RETIRÉS, ET L'IMPORT NE COMPTE PAS.

    Deux fausses preuves, trouvées en mutant ce contrôle :

      · un `// useFermetureEchap(true, onClose);` mis en commentaire laissait
        la chaîne dans le fichier, et la règle passait au vert sur un calque
        qui ne se ferme plus. C'est le même piège que `check:naming` a connu —
        un contrôle doit lire du code, pas de la prose à propos du code ;
      · la LIGNE D'IMPORT suffisait elle aussi. Un fichier peut parfaitement
        importer le hook et ne l'appeler nulle part.

    On cherche donc un APPEL, dans du code débarrassé de ses commentaires.
  */
  const codeNu = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const ecouteEchap =
    /useFermetureEchap\s*\(/.test(codeNu.replace(/^import .*$/gm, '')) ||
    /['"]Escape['"]/.test(codeNu);

  for (let i = 0; i < lignes.length; i += 1) {
    if (!/\bonClick=/.test(lignes[i])) continue;

    /*
      Remonter jusqu'à l'ouverture de la balise qui porte le `onClick` — et
      VÉRIFIER qu'on ne l'a pas dépassée. Sans ce contrôle, un `onClick` posé
      sur un enfant remontait jusqu'à la balise du parent, et le contrôle
      jugeait une modale entière sur le bouton qu'elle contient.
    */
    let j = i;
    let balise = null;
    while (j >= 0 && j > i - 30) {
      const m = /<([A-Za-z][\w.]*)/.exec(lignes[j]);
      if (m) {
        // La balise se referme-t-elle avant d'atteindre notre `onClick` ?
        const entre = lignes.slice(j, i).join('\n').slice(m.index);
        if (j !== i && /[^=]>/.test(entre)) break;
        balise = m[1];
        break;
      }
      j -= 1;
    }
    if (!balise) continue;

    // `motion.button` EST un bouton : framer-motion rend la balise nommée.
    const nu = balise.replace(/^motion\./, '');
    if (FOCUSABLES.test(nu)) continue;
    if (/^[A-Z]/.test(nu)) continue;

    /*
      LES ATTRIBUTS DE LA BALISE, DÉLIMITÉS PAR LES ACCOLADES.

      Un `bloc.indexOf('>')` naïf s'arrête sur la flèche d'une fonction —
      `onClick={(e) => {` — et coupe la liste d'attributs en plein milieu. Le
      premier jet de ce contrôle signalait ainsi deux éléments qui avaient bel
      et bien leur `onKeyDown`, simplement écrit trois lignes plus bas.

      C'est le même piège que `check:ecrans` a connu sur son bloc `stats`. On
      compte donc les accolades, et la balise se ferme au premier `>` rencontré
      à profondeur zéro.
    */
    const bloc = lignes.slice(j, Math.min(j + 40, lignes.length)).join('\n');
    let profondeur = 0;
    let fin = -1;
    for (let k = bloc.indexOf('<'); k < bloc.length; k += 1) {
      const c = bloc[k];
      if (c === '{') profondeur += 1;
      else if (c === '}') profondeur -= 1;
      else if (c === '>' && profondeur === 0 && bloc[k - 1] !== '=') {
        fin = k;
        break;
      }
    }
    const attrs = fin === -1 ? bloc : bloc.slice(0, fin);

    /* ─── Règle 1 : un fond de calque exige Échap ───────────────────────── */

    const fond = /(fixed|absolute) inset-0/.test(attrs);
    if (fond) {
      calques += 1;
      if (ecouteEchap || SANS_ECHAP.has(rel)) continue;
      failures.push(
        `${rel}:${j + 1} pose un calque qui se ferme au CLIC et pas à Échap. ` +
          `Au clavier, il n'existe aucun moyen d'en sortir sans tabuler à travers ` +
          `tout le contenu. Appelez \`useFermetureEchap(ouvert, fermer)\` — voir ` +
          `src/lib/useFermetureEchap.ts.`,
      );
      continue;
    }

    /* ─── Règle 2 : un cliquable doit être atteignable ──────────────────── */

    /*
      UN ÉCRAN D'ARRÊT N'EST PAS UNE COMMANDE.

      `onClick={(e) => e.stopPropagation()}` ne fait rien : il empêche
      seulement le clic d'atteindre le fond du calque et de le fermer. C'est
      le contenu de la fenêtre qui se protège, pas un bouton.

      Au clavier le problème ne se pose même pas — on ne « clique pas à
      travers » en tabulant. Exiger un `role` et un `onKeyDown` ici ajouterait
      un arrêt de tabulation sur une image ou un panneau, c'est-à-dire
      exactement le bruit que ce contrôle cherche à supprimer.
    */
    const corps = attrs.slice(attrs.indexOf('onClick='));
    const arretSeul = /onClick=\{\((\w+)\) =>\s*\1\.(stopPropagation|preventDefault)\(\)\s*\}/.test(corps);
    if (arretSeul) continue;

    // Un rôle qui ne promet aucune action n'a rien à activer au clavier.
    const role = /\brole="([\w-]+)"/.exec(attrs)?.[1] ?? null;
    if (role && !ROLES_ACTIFS.test(role)) continue;

    cliquables += 1;
    if (/\brole=/.test(attrs) && /\btabIndex=/.test(attrs) && /\bonKeyDown=/.test(attrs)) continue;
    if (/\brole=|\btabIndex=|\bonKeyDown=/.test(attrs)) {
      /*
        À moitié fait est PIRE que pas fait. Un `role="button"` avec
        `tabIndex={0}` mais sans `onKeyDown` annonce un bouton, arrête le
        focus dessus… et ne s'active ni à Entrée ni à Espace. La tabulation
        s'y bloque pour rien, et rien n'indique pourquoi.
      */
      const manque = ['role', 'tabIndex', 'onKeyDown'].filter((a) => !new RegExp(`\\b${a}=`).test(attrs));
      failures.push(
        `${rel}:${j + 1} <${balise}> annonce une commande sans l'être complètement — il manque ` +
          `\`${manque.join('\`, \`')}\`. Un \`role="button"\` qui n'écoute pas Entrée arrête le ` +
          `focus sur un élément qui ne fait rien.`,
      );
      continue;
    }
    failures.push(
      `${rel}:${j + 1} <${balise}> réagit au clic et n'existe pas pour le clavier : ` +
        `ni tabulation, ni Entrée, rien pour un lecteur d'écran. Un \`<button>\` fait ` +
        `les trois tout seul.`,
    );
  }
}

if (failures.length > 0) {
  console.error(`\nAccès clavier : ${failures.length} problème(s).\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  `\nAccès clavier : rien d'inatteignable.\n` +
    `  ${calques} calque(s) qui se ferment au clic, tous joignables à Échap\n` +
    `  ${cliquables} élément(s) cliquable(s) non natifs, tous atteignables\n` +
    `  ${SANS_ECHAP.size} dispense(s) nommée(s)`,
);

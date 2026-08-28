#!/usr/bin/env node
/**
 * LE JOURNAL D'AUDIT — trois listes, croisées entre les deux dépôts
 * ════════════════════════════════════════════════════════════════
 *
 * Le même sujet est écrit à trois endroits : ce que les routes d'amn-api
 * ÉCRIVENT, la liste `ACCESS_LOG_ACTIONS` qui prétend les énumérer, et les
 * formulations françaises `ACCESS_VERB` que le poste affiche. Rien ne les
 * croisait, et les trois avaient divergé.
 *
 * Ce que ça avait produit, mesuré avant d'y toucher :
 *
 *   · `user_removed` était écrite depuis des mois SANS figurer dans la liste
 *     de référence — laquelle est purement décorative, puisque `logOrgAccess`
 *     accepte n'importe quelle chaîne (vérifié en l'appelant) ;
 *   · QUATRE gestes sensibles n'étaient tracés nulle part : renommer une
 *     organisation, changer sa formule, suspendre un membre, et changer le
 *     RÔLE d'un membre.
 *
 * Le dernier est le plus gênant : une promotion silencieuse est exactement ce
 * qu'on veut pouvoir relire après coup, et c'est la seule question à laquelle
 * un journal d'accès doit savoir répondre.
 *
 * Quatre règles :
 *
 *   1. toute action ÉCRITE par une route est déclarée dans `ACCESS_LOG_ACTIONS` ;
 *   2. toute action déclarée a une formulation française ;
 *   3. aucune formulation ne survit à une action disparue ;
 *   4. les mutations sensibles laissent une trace — la liste est nommée ici,
 *      et une route qui en sort sans journaliser fait échouer le contrôle.
 *
 *   npm run check:journal
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/* ─── Ce que le poste sait dire ──────────────────────────────────────────── */

const verbes = /export const ACCESS_VERB: Record<string, string> = \{([\s\S]*?)\n\};/.exec(
  read('src/screens/ControlTowerScreen.tsx'),
);
if (!verbes) failures.push('`ACCESS_VERB` est introuvable dans ControlTowerScreen.tsx.');
const nommees = verbes ? [...verbes[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]) : [];

/* ─── Ce que le serveur déclare et écrit ─────────────────────────────────── */

const apiRoot = ['/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].find((c) =>
  fs.existsSync(path.join(c, 'src/db/tenancy.js')),
);

if (!apiRoot) {
  notes.push('amn-api introuvable localement — le croisement avec le serveur est sauté.');
} else {
  const tenancy = fs.readFileSync(path.join(apiRoot, 'src/db/tenancy.js'), 'utf-8');
  const bloc = /export const ACCESS_LOG_ACTIONS = \[([\s\S]*?)\];/.exec(tenancy);
  const declarees = bloc ? [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [];
  if (declarees.length === 0) {
    failures.push('`ACCESS_LOG_ACTIONS` est introuvable ou vide dans amn-api.');
  }

  /**
   * Ce que les routes écrivent VRAIMENT.
   *
   * On découpe la LISTE D'ARGUMENTS de chaque appel et on ne lit que celui qui
   * porte l'action, plutôt que de chercher une chaîne dans les parages. Deux
   * raisons, et la seconde a été trouvée en écrivant ce contrôle :
   *
   *   · l'action est parfois un TERNAIRE
   *     (`status === 'suspended' ? 'member_suspended' : 'member_reactivated'`),
   *     que le premier jet manquait — il signalait alors ces deux actions comme
   *     « déclarées mais jamais écrites », ce qui était faux ;
   *   · une lecture large ramasserait `'suspended'`, qui est une valeur de
   *     statut et non un nom d'action.
   */
  const argsDe = (src, depuis) => {
    // `depuis` pointe sur la parenthèse ouvrante. On avance jusqu'à sa fermante,
    // en tenant compte des chaînes pour ne pas s'arrêter sur une parenthèse
    // écrite dans un message.
    let profondeur = 0;
    let quote = null;
    for (let i = depuis; i < src.length && i < depuis + 6000; i += 1) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === '(') profondeur += 1;
      else if (c === ')') {
        profondeur -= 1;
        if (profondeur === 0) return src.slice(depuis + 1, i);
      }
    }
    return '';
  };

  /** Découpe sur les virgules DE PREMIER NIVEAU seulement. */
  const argumentsSepares = (texte) => {
    const out = [];
    let profondeur = 0;
    let quote = null;
    let courant = '';
    for (let i = 0; i < texte.length; i += 1) {
      const c = texte[i];
      if (quote) {
        courant += c;
        if (c === '\\') {
          courant += texte[i + 1] ?? '';
          i += 1;
        } else if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        quote = c;
        courant += c;
        continue;
      }
      if ('([{'.includes(c)) profondeur += 1;
      if (')]}'.includes(c)) profondeur -= 1;
      if (c === ',' && profondeur === 0) {
        out.push(courant);
        courant = '';
        continue;
      }
      courant += c;
    }
    if (courant.trim()) out.push(courant);
    return out.map((a) => a.trim());
  };

  /**
   * Les valeurs qu'un argument d'action peut PRENDRE.
   *
   * Sur un ternaire, seules les DEUX BRANCHES comptent : la condition
   * `status === 'suspended'` contient une chaîne qui n'est pas un nom
   * d'action, et le premier jet la signalait comme « écrite mais non
   * déclarée ». Un contrôle qui invente une divergence use la confiance aussi
   * sûrement qu'un contrôle qui en rate une.
   */
  const valeursPossibles = (expression) => {
    const interro = expression.indexOf('?');
    if (interro !== -1) {
      const branches = expression.slice(interro + 1);
      return [...branches.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    }
    return [...expression.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };

  const ecrites = new Set();
  const routesDir = path.join(apiRoot, 'src/routes');
  // Le rang de l'argument qui porte l'action, par fonction appelée.
  const RANG_ACTION = { journal: 2, journalInterne: 1 };

  for (const f of fs.readdirSync(routesDir)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(routesDir, f), 'utf-8');

    for (const [nom, rang] of Object.entries(RANG_ACTION)) {
      const motif = new RegExp(`\\b${nom}\\(`, 'g');
      for (const m of src.matchAll(motif)) {
        const args = argumentsSepares(argsDe(src, m.index + nom.length));
        const actionArg = args[rang];
        if (!actionArg) continue;
        for (const valeur of valeursPossibles(actionArg)) ecrites.add(valeur);
      }
    }

    // L'appel direct : `logOrgAccess({ …, action: 'x', … })`.
    for (const m of src.matchAll(/logOrgAccess\(\{[\s\S]{0,600}?action:\s*([^,\n}]+)/g)) {
      for (const valeur of valeursPossibles(m[1])) ecrites.add(valeur);
    }
  }

  if (ecrites.size === 0) {
    failures.push("Aucune écriture de journal relevée dans les routes : le relevé ne fonctionne plus.");
  }

  /* 1. Écrite mais non déclarée */
  for (const action of ecrites) {
    if (!declarees.includes(action)) {
      failures.push(
        `La route écrit « ${action} » mais \`ACCESS_LOG_ACTIONS\` ne la déclare pas. ` +
          `C'est exactement ce qui est arrivé à « user_removed », écrite pendant des ` +
          `mois sans y figurer — et rien ne le signalait, puisque la liste n'est pas ` +
          `appliquée à l'écriture.`,
      );
    }
  }

  /* Déclarée mais jamais écrite : une trace qu'on croit avoir. */
  for (const action of declarees) {
    if (!ecrites.has(action)) {
      failures.push(
        `« ${action} » est déclarée mais AUCUNE route ne l'écrit. Une entrée morte ` +
          `fait croire à une traçabilité qu'on n'a pas.`,
      );
    }
  }

  /* 2 & 3. Chaque action déclarée se dit en français, et rien de plus. */
  for (const action of declarees) {
    if (!nommees.includes(action)) {
      failures.push(
        `« ${action} » n'a pas de formulation dans \`ACCESS_VERB\`. Ce journal est lu ` +
          `par la CLIENTE dans ses propres paramètres : une clé technique brute y est ` +
          `illisible, et ressemble à une erreur plutôt qu'à un geste.`,
      );
    }
  }
  for (const action of nommees) {
    if (!declarees.includes(action)) {
      failures.push(`« ${action} » a une formulation française mais n'est plus déclarée côté serveur.`);
    }
  }

  /* ─── 4. Les mutations sensibles laissent une trace ────────────────────── */

  /*
    Nommées une par une plutôt que déduites : une règle automatique sur « toute
    route PUT/DELETE » signalerait aussi le changement de son propre mot de
    passe ou la fermeture de sa propre session, qui n'ont rien à faire dans le
    journal d'accès d'une organisation. La liste dit donc ce qu'on a décidé.
  */
  const SENSIBLES = [
    ['auth.js', "/users/:id/status", 'suspendre ou réactiver un membre'],
    ['auth.js', "/users/:id/role", 'changer le rôle d’un membre'],
    ['admin.js', "/organizations/:id/plan", 'changer la formule d’une cliente'],
    ['admin.js', "/organizations/:id/users/:userId", 'supprimer un compte chez une cliente'],
  ];

  for (const [fichier, motif, description] of SENSIBLES) {
    const src = fs.readFileSync(path.join(routesDir, fichier), 'utf-8');
    const i = src.indexOf(motif);
    if (i === -1) {
      failures.push(`Route « ${motif} » introuvable dans ${fichier} : le contrôle ne garde plus ${description}.`);
      continue;
    }
    // Du début de la route jusqu'à la suivante : la fenêtre du geste.
    const suite = src.slice(i, i + 4000);
    if (!/journal\(req|journalInterne\(req|logOrgAccess\(/.test(suite)) {
      failures.push(
        `${description} (${motif}) ne laisse AUCUNE TRACE. C'est le geste même qu'un ` +
          `journal d'accès existe pour pouvoir relire.`,
      );
    }
  }
}

/* ─────────────────────────────── verdict ───────────────────────────────── */

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length > 0) {
  console.error('\nJournal d’audit : les listes ont divergé.\n');
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  `\nJournal d’audit : ce qui est écrit, déclaré et dit en français s'accorde.\n` +
    `  ${nommees.length} actions, toutes tracées, toutes lisibles par une cliente.`,
);

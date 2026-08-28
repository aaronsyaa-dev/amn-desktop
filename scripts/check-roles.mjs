#!/usr/bin/env node
/**
 * QUI SUIS-JE, ET AVEC QUEL RÔLE — le contrôle qui manquait
 * ═════════════════════════════════════════════════════════
 *
 * Aaron, propriétaire de son organisation, s'est vu refuser des écrans par sa
 * propre application. Rien n'avait planté : le rôle valait simplement `null`,
 * et personne ne le lui avait dit.
 *
 * L'autopsie a trouvé QUATRE endroits qui réglaient l'identité sans régler le
 * rôle, plus un `useMemo` qui publiait le rôle et l'organisation active sans
 * les surveiller. Aucun de ces cinq défauts n'échouait, n'avertissait, ni ne
 * se voyait dans un rendu : ils se contentaient de rendre `null` là où la
 * vérité existait pourtant, une requête plus loin.
 *
 * C'est la signature de ce dépôt : la même information écrite ou dérivée à
 * plusieurs endroits, et un endroit qui décroche. Les contrôles existants
 * (`check:modules`, `check:sync`, `check:persistence`) croisent des listes ;
 * celui-ci croise les sources d'IDENTITÉ.
 *
 * Cinq règles, et chacune correspond à un défaut réellement trouvé :
 *
 *   1. la session stockée n'a qu'UN écrivain ;
 *   2. `setUser` et `setRole` ne se séparent jamais ;
 *   3. les deux ponts rapportent le rôle EFFECTIF, pas celui d'origine ;
 *   4. un contexte ne publie rien qu'il ne surveille ;
 *   5. les rôles connus du poste sont ceux que le serveur reconnaît.
 *
 *   node scripts/check-roles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/**
 * Les commentaires retirés avant toute lecture de code.
 *
 * Ces fichiers sont commentés en français, où l'apostrophe est le caractère du
 * guillemet simple : sans ce nettoyage, « l'identité » se lit comme une chaîne
 * et fausse tout comptage. Même parade que dans `check-modules.mjs`.
 */
function sansCommentaires(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* ═══════════════ 1. La session stockée n'a qu'un seul écrivain ═══════════ */

/*
  Le défaut : `OrgContextContext` écrivait cette clé lui-même, en la retapant
  en toutes lettres, dans une forme qui n'était pas celle d'`AuthContext` — le
  rôle en moins. Une bascule d'organisation suffisait donc à effacer le rôle
  pour de bon.
*/
const PROPRIETAIRE_SESSION = 'src/auth/session.ts';
const CLE_SESSION = 'amn-desktop.auth.session';

const fichiersSrc = [];
(function parcourir(dir) {
  for (const entree of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entree.name}`;
    if (entree.isDirectory()) parcourir(rel);
    else if (/\.tsx?$/.test(entree.name)) fichiersSrc.push(rel);
  }
})('src');

for (const fichier of fichiersSrc) {
  if (fichier === PROPRIETAIRE_SESSION) continue;
  const source = sansCommentaires(read(fichier));
  if (source.includes(CLE_SESSION)) {
    failures.push(
      `${fichier} nomme la clé de session en toutes lettres (« ${CLE_SESSION} »). ` +
        `Elle n'appartient qu'à ${PROPRIETAIRE_SESSION} : importez ` +
        `\`writeStoredSession\` / \`readStoredSession\` plutôt que d'écrire cette ` +
        `entrée à la main — c'est exactement par là que le rôle a disparu.`,
    );
  }
}

const proprietaire = read(PROPRIETAIRE_SESSION);
if (!proprietaire.includes('export const SESSION_STORAGE_KEY')) {
  failures.push(
    `${PROPRIETAIRE_SESSION} ne déclare plus SESSION_STORAGE_KEY : ce contrôle lit cette ` +
      `déclaration-là et refuse d'en deviner une autre.`,
  );
}

/* ══════════ 2. `setUser` et `setRole` ne se séparent jamais ══════════════ */

/*
  Le défaut : quatre chemins d'`AuthContext` réglaient l'utilisateur sans
  toucher au rôle — revalidation au démarrage, reconnexion silencieuse, repli
  local, déconnexion. Chacun laissait un rôle faux : périmé dans un cas, absent
  dans les trois autres.

  La parade est structurelle : les deux setters ne vivent QUE dans les deux
  fonctions qui adoptent ou oublient une identité entière. Ce contrôle vérifie
  qu'on n'en a pas ressorti un ailleurs.
*/
const HELPERS_IDENTITE = ['adopterIdentite', 'oublierIdentite'];
const authSource = sansCommentaires(read('src/auth/AuthContext.tsx'));

/** Le corps de la fonction nommée, du `= useCallback(` à sa fermeture. */
function corpsDuHelper(source, nom) {
  const debut = source.indexOf(`const ${nom} = useCallback(`);
  if (debut === -1) return null;
  // On s'arrête au prochain `const <nom> =` de même niveau, ce qui suffit ici :
  // ces helpers sont courts et déclarés côte à côte.
  const suite = source.slice(debut + 1);
  const fin = suite.search(/\n  const \w+ =|\n  useEffect\(|\n  useLayoutEffect\(/);
  return fin === -1 ? suite : suite.slice(0, fin);
}

const corpsHelpers = HELPERS_IDENTITE.map((nom) => {
  const corps = corpsDuHelper(authSource, nom);
  if (corps === null) {
    failures.push(
      `AuthContext.tsx ne déclare plus \`${nom}\` : l'identité doit s'adopter et s'oublier ` +
        `d'un seul geste, sinon rien n'empêche de régler l'utilisateur en oubliant le rôle.`,
    );
  }
  return corps ?? '';
}).join('\n');

for (const setter of ['setUser(', 'setRole(']) {
  const total = authSource.split(setter).length - 1;
  const dansHelpers = corpsHelpers.split(setter).length - 1;
  if (total !== dansHelpers) {
    failures.push(
      `AuthContext.tsx appelle \`${setter}\` ${total} fois, dont ${dansHelpers} dans ` +
        `${HELPERS_IDENTITE.join(' / ')}. Les ${total - dansHelpers} autre(s) règlent une ` +
        `identité PARTIELLE — c'est le défaut d'origine : un utilisateur posé sans son rôle, ` +
        `et une application qui refuse ensuite à quelqu'un qui a tous les droits.`,
    );
  }
}

/* ══════ 3. Les deux ponts rapportent le rôle EFFECTIF, pas l'originel ═════ */

/*
  `/v1/auth/me` rend DEUX rôles : `user.role` est celui du compte dans son
  organisation d'origine, `auth.role` celui de l'organisation ACTIVE. Ils
  diffèrent dès qu'une session a basculé — Aaron est propriétaire chez lui et
  peut n'être que membre chez une cliente qui l'a invité.

  Les deux restaurations ne lisaient que `me.user`. Deux défauts en un : le
  rôle n'arrivait jamais à l'écran, et le prendre dans `user.role` par
  commodité aurait donné à Aaron, chez sa cliente, les pouvoirs de chez lui.
*/
const PONTS = [
  ['src/lib/bridge.ts', 'pont navigateur (web et mobile)'],
  ['src/main/remoteApi.ts', 'pont du process principal (application installée)'],
];

for (const [fichier, quoi] of PONTS) {
  const source = sansCommentaires(read(fichier));
  if (!/auth\?\.role/.test(source)) {
    failures.push(
      `${fichier} (${quoi}) ne lit plus \`auth?.role\` : la restauration de session rapporterait ` +
        `le rôle de l'organisation D'ORIGINE au lieu de celui de l'organisation active.`,
    );
  }
  // La bascule doit normaliser elle aussi : le rôle juste y est au premier
  // niveau de la réponse, pas dans `user`.
  const bascule = source.slice(source.indexOf('organizations/switch'));
  if (bascule && !/res\.role/.test(bascule.slice(0, 900))) {
    failures.push(
      `${fichier} (${quoi}) ne normalise pas le rôle rendu par \`/organizations/switch\` : ` +
        `\`res.role\` porte celui de l'appartenance, \`res.user.role\` celui de l'organisation ` +
        `d'origine. Sans cette normalisation, entrer chez une cliente y emporte ses pouvoirs ` +
        `de chez soi.`,
    );
  }
}

/* ═══════ 4. Un contexte ne publie rien qu'il ne surveille ════════════════ */

/*
  Le défaut le plus fourbe des cinq, et celui qui a coûté le plus longtemps à
  voir. `OrgContextContext` publiait `myOrganizations`, `loadingMine`,
  `activeOrgId` et `switchToOrganization` dans la valeur de son contexte — sans
  les mettre dans le tableau de dépendances du `useMemo`. Les consommateurs
  gardaient donc les valeurs du PREMIER rendu : liste vide, organisation active
  nulle.

  Et ce n'était pas franc : le memo se recalculait quand même dès qu'une AUTRE
  dépendance bougeait, ramassant les valeurs à jour au passage. Tout paraissait
  normal tant que quelque chose d'autre s'agitait. Après une bascule vers une
  organisation cliente, plus rien ne bougeait — et le rail restait figé, sans
  aucun moyen de revenir chez soi.

  `react-hooks/exhaustive-deps` attraperait ceci ; le greffon n'est pas
  configuré dans ce dépôt. Cette règle en couvre le cas qui nous a mordus : les
  fournisseurs de contexte, là où une valeur figée se propage à tout l'écran.
*/
const CONTEXTES = fichiersSrc.filter((f) => /Context\.tsx$/.test(f));
if (CONTEXTES.length === 0) failures.push('Aucun fichier de contexte trouvé — le lecteur est cassé.');

for (const fichier of CONTEXTES) {
  const source = sansCommentaires(read(fichier));
  // `useMemo<T>(() => ({ … }), [ … ])` — la forme d'une valeur de contexte.
  const re = /useMemo<[^>]*>\(\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\),\s*\[([\s\S]*?)\],?\s*\)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    // Publiées en RACCOURCI seulement : `isAuthenticated: user !== null` est
    // une valeur calculée, elle n'a pas à figurer dans les dépendances.
    const publiees = m[1]
      .split(',')
      .map((ligne) => ligne.trim())
      .filter((ligne) => /^[A-Za-z_$][\w$]*$/.test(ligne));
    const surveillees = new Set(
      m[2].split(',').map((d) => d.trim()).filter(Boolean),
    );
    const oubliees = publiees.filter((nom) => !surveillees.has(nom));
    if (oubliees.length > 0) {
      failures.push(
        `${fichier} : la valeur du contexte publie « ${oubliees.join(', ') } » sans les ` +
          `surveiller dans les dépendances du useMemo. Les consommateurs garderont la valeur ` +
          `du premier rendu — et ne le sauront pas, puisque le memo se rafraîchit quand même ` +
          `dès qu'une autre dépendance bouge.`,
      );
    }
  }
}

/* ═════ 5. Les rôles du poste sont ceux que le serveur reconnaît ══════════ */

const apiRoot = ['/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].find((c) =>
  fs.existsSync(path.join(c, 'src/db/tenancy.js')),
);

if (!apiRoot) {
  notes.push('amn-api introuvable localement — comparaison des rôles sautée.');
} else {
  const bloc = /export const USER_ROLES = \[([\s\S]*?)\];/.exec(
    sansCommentaires(fs.readFileSync(path.join(apiRoot, 'src/db/tenancy.js'), 'utf-8')),
  );
  if (!bloc) {
    failures.push('USER_ROLES introuvable dans amn-api/src/db/tenancy.js.');
  } else {
    const serveur = [...bloc[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    const contrat = /export type UserRole =([^;]+);/.exec(read('src/shared/api.ts'));
    if (!contrat) {
      failures.push('`UserRole` introuvable dans src/shared/api.ts.');
    } else {
      const poste = [...contrat[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      for (const role of serveur) {
        if (!poste.includes(role)) {
          failures.push(
            `Le rôle « ${role} » existe côté serveur mais pas dans \`UserRole\` (shared/api.ts) : ` +
              `un compte qui le porte serait traité comme un rôle inconnu par le poste.`,
          );
        }
      }
      for (const role of poste) {
        if (!serveur.includes(role)) {
          failures.push(
            `Le rôle « ${role} » est déclaré côté poste mais absent d'USER_ROLES (amn-api) : ` +
              `le serveur refuserait cette valeur.`,
          );
        }
      }
    }
  }
}

/* ─── 6. « owner ou admin » ne s'écrit qu'à un seul endroit ──────────────── */

/*
  Le motif exact qui a coûté son rôle à Aaron : plusieurs listes disant la même
  chose, jamais croisées, jusqu'au jour où l'une bouge.

  « owner ou admin » était écrit en toutes lettres à cinq endroits du poste —
  la modération des messages, le panneau Membres, les gabarits de pages, deux
  écrans de dossier. Un seul aurait suffi à créer une divergence silencieuse.
  La liste vit désormais dans `src/auth/roles.ts`, et ce contrôle refuse toute
  autre écriture en dur.

  `PagesScreen` est admis : il ne teste pas un droit, il fabrique la liste
  d'éditeurs PAR DÉFAUT d'une page neuve — une donnée enregistrée, pas une
  décision. La confondre avec le droit d'administrer figerait l'une sur
  l'autre.
*/
const SOURCE_ADMIN = 'src/auth/roles.ts';
const ADMIN_TOLERE = new Set([SOURCE_ADMIN, 'src/screens/PagesScreen.tsx']);

const listeAdmin = /export const ADMIN_ROLES: readonly UserRole\[\] = \[([^\]]*)\];/.exec(
  read(SOURCE_ADMIN),
);
if (!listeAdmin) {
  failures.push(
    `\`ADMIN_ROLES\` est introuvable dans ${SOURCE_ADMIN} : la liste unique des ` +
      `rôles qui administrent a disparu, et chaque écran va la réinventer.`,
  );
} else {
  const posteAdmin = [...listeAdmin[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

  // Croisée avec celle du serveur, qui décide vraiment.
  if (apiRoot) {
    const garde = /if \(!\[([^\]]*)\]\.includes\(req\.auth\.role\)\)/.exec(
      fs.readFileSync(path.join(apiRoot, 'src/middleware/tenantAuth.js'), 'utf-8'),
    );
    if (!garde) {
      failures.push(
        "Le contrôle de rôle de `foundingOrgAdmin` (amn-api) n'a plus la forme " +
          'attendue : la comparaison avec la liste du poste ne peut plus se faire.',
      );
    } else {
      const serveurAdmin = [...garde[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      const memes =
        posteAdmin.length === serveurAdmin.length &&
        posteAdmin.every((r) => serveurAdmin.includes(r));
      if (!memes) {
        failures.push(
          `Le poste administre avec [${posteAdmin.join(', ')}] et le serveur avec ` +
            `[${serveurAdmin.join(', ')}]. L'écart se paie dans un seul sens : ` +
            `le poste propose un geste que le serveur refuse, et la personne ` +
            `croit à une panne.`,
        );
      }
    }
  }

  for (const fichier of fichiersSrc) {
    if (ADMIN_TOLERE.has(fichier)) continue;
    const src = sansCommentaires(read(fichier));
    if (/\['owner',\s*'admin'\]/.test(src)) {
      failures.push(
        `${fichier} écrit « ['owner', 'admin'] » en dur. Cette liste vit dans ` +
          `${SOURCE_ADMIN} (\`isAdminRole\`) — une copie ne suivra pas le jour où ` +
          `un rôle s'ajoute.`,
      );
    }
    if (/role === 'owner' \|\| role === 'admin'|role === 'admin' \|\| role === 'owner'/.test(src)) {
      failures.push(
        `${fichier} teste « owner ou admin » à la main. Utiliser \`isAdminRole\` ` +
          `(${SOURCE_ADMIN}) plutôt que de rejouer la liste.`,
      );
    }
  }
}

/* ───────────────────────────────── verdict ───────────────────────────────── */

for (const note of notes) console.log(`  note  ${note}`);

if (failures.length > 0) {
  console.error('\nIdentité et rôles : incohérences trouvées.\n');
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  `\nIdentité et rôles : les sources s'accordent ` +
    `(1 écrivain de session, 2 ponts, ${CONTEXTES.length} contextes relus).`,
);

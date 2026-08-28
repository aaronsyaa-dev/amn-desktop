/**
 * Ce qu'un bundle Business ne doit pas contenir, et ce qu'il doit contenir.
 *
 * Extrait dans son propre module parce que deux contrôles s'en servent, et que
 * deux copies de cette liste finiraient par diverger — précisément le jour où
 * l'une des deux servirait à valider un déploiement chez une cliente :
 *
 *   - `check-business-bundle.mjs` relit un dossier `dist/` local ;
 *   - `check-deployed-bundle.mjs` relit ce qu'une URL SERT RÉELLEMENT.
 */

/**
 * Ce qui ne doit apparaître nulle part.
 *
 * Chaque entrée porte sa raison : sans elle, le prochain à voir passer le
 * script devant une fausse alerte ne saura pas s'il peut retirer la ligne.
 * `pattern` est cherché tel quel, sans respect de la casse.
 */
export const FORBIDDEN = [
  // --- Identité et comptes d'AMN DevSec ---
  { pattern: 'amn-devsec.com', why: 'nos adresses email' },
  {
    pattern: 'AMN DevSec',
    why: 'notre raison sociale',
    /*
      L'UNIQUE EXCEPTION, ET ELLE EST COMPTÉE (BLOC M)

      Aaron veut que l'application livrée dise qui l'a faite. La règle n'est
      donc pas levée — elle est RÉTRÉCIE à une chaîne exacte, autorisée une
      fois par fichier, et nulle part ailleurs :

        · « AMN DevSec » seul, sans le « by » : toujours refusé ;
        · la signature recopiée sur un deuxième écran : refusée, parce que le
          quota est dépassé et que la deuxième occurrence reste visible au
          contrôle ;
        · « by AMN DevSec » dans un autre fichier du bundle : refusé pour la
          même raison — le quota vaut par fichier, et la signature n'a qu'un
          seul lieu légitime (l'écran « À propos », voir SettingsScreen.tsx).

      La casse est respectée ici alors que le motif, lui, est cherché sans
      casse : « BY AMN DEVSEC » en capitales dans une facture ne serait pas la
      signature, ce serait une fuite.
    */
    allowExact: { text: 'by AMN DevSec', max: 1 },
  },
  { pattern: 'aaron@', why: 'compte opérateur' },
  { pattern: 'mohamed@', why: 'compte opérateur' },
  { pattern: 'AmnQG-2026', why: 'mot de passe de départ des comptes locaux' },
  { pattern: '$2b$10$', why: 'empreinte bcrypt d’un compte de démonstration' },

  // --- Produits de cybersécurité ---
  // Sensible à la casse : `react.memo_cache_sentinel`, dans React, n'est pas
  // notre produit. Le contrôle porte sur le nom propre, pas sur le mot.
  { pattern: 'Sentinel', why: 'catalogue Tracker', caseSensitive: true },
  { pattern: 'trackerCatalog', why: 'catalogue Tracker' },
  { pattern: 'security-monitor', why: 'le tracker installé chez nos clients' },
  { pattern: 'AMN Suite', why: 'palier du catalogue Tracker' },
  { pattern: 'SSL Monitor', why: 'produit exclusif' },
  { pattern: 'Comply', why: 'produit exclusif (RGPD)' },
  { pattern: 'Ajmani', why: 'assistant local, exclusif' },
  /*
    LE NOM DE NOTRE PRODUIT INTERNE.

    Il manquait à cette liste, et le trou s'est vu : une constante « le nom de
    l'autre édition » y faisait entrer « AMN Business » alors que le seul
    message qui l'employait ne s'affiche jamais dans un paquet cliente (son
    refus est gardé par `!IS_BUSINESS`). Rien ne l'a signalé.

    Une cliente n'a aucune raison de lire le nom de l'application qu'elle n'a
    pas. Ce n'est pas un secret, mais c'est une trace de notre organisation
    dans un fichier qu'elle peut ouvrir — au même titre que le reste de cette
    liste.
  */
  { pattern: 'AMN Business', why: 'le nom produit de l’édition INTERNE' },

  // --- Routes et canaux qui n'existent pas chez une cliente ---
  { pattern: '/v1/admin/', why: 'console inter-organisations' },
  { pattern: 'support-session', why: 'contexte client — n’existe que chez nous' },
  { pattern: '/v1/comply', why: 'route produit' },
  { pattern: '/v1/scans', why: 'route produit' },

  // --- Données de démonstration qui sont les nôtres ---
  { pattern: 'G20 Corvetto', why: 'client de démonstration' },
  { pattern: 'Atlas Retail', why: 'client de démonstration' },

  // --- Jetons ---
  { pattern: 'VITE_AMN_API_WEB_TOKEN', why: 'un build cliente n’embarque aucun jeton' },
  { pattern: 'VITE_AMN_API_OPERATOR_TOKEN', why: 'un build cliente n’embarque aucun jeton' },
];

/**
 * Masque les occurrences EXPRESSÉMENT autorisées avant la recherche.
 *
 * Deux contrôles appellent cette fonction (`check-business-bundle.mjs` sur un
 * `dist/` local, `check-deployed-bundle.mjs` sur ce qu'une URL sert vraiment) :
 * écrite ici, la tolérance ne peut pas exister dans l'un et manquer dans
 * l'autre — ce qui reviendrait à autoriser en production ce qu'on refuse en
 * local, ou l'inverse.
 *
 * Le masque a EXACTEMENT la longueur du texte remplacé. Les index ne bougent
 * donc pas d'un caractère, et l'extrait affiché en cas d'échec continue de
 * montrer le vrai voisinage de la fuite plutôt qu'un texte décalé.
 *
 * Au-delà du quota, les occurrences suivantes ne sont PAS masquées : elles
 * restent visibles au contrôle, qui échoue. C'est ce qui rend l'exception
 * comptée plutôt qu'ouverte.
 *
 * Le quota vaut pour TOUT LE BUNDLE, pas par fichier — d'où le budget passé
 * d'un fichier à l'autre. Un quota par fichier aurait laissé passer la même
 * signature recopiée dans deux morceaux différents, alors que la consigne est
 * « un seul endroit ». Le découpage en chunks n'est pas décidé par nous : s'en
 * remettre à lui pour compter reviendrait à faire dépendre une règle d'identité
 * des choix d'un empaqueteur.
 */
export function createAllowanceBudget() {
  const budget = new Map();
  for (const rule of FORBIDDEN) {
    if (rule.allowExact) budget.set(rule.pattern, rule.allowExact.max);
  }
  return budget;
}

export function maskAllowed(content, rule, budget) {
  const allowed = rule.allowExact;
  if (!allowed) return content;
  // Sans budget partagé, on retombe sur le quota nominal — utile pour un
  // appel isolé (un test), jamais pour un parcours de bundle.
  let reste = budget ? (budget.get(rule.pattern) ?? 0) : allowed.max;
  const masque = '\u00B7'.repeat(allowed.text.length);
  let out = content;
  let from = 0;
  while (reste > 0) {
    const i = out.indexOf(allowed.text, from);
    if (i === -1) break;
    out = out.slice(0, i) + masque + out.slice(i + allowed.text.length);
    from = i + allowed.text.length;
    reste -= 1;
  }
  if (budget) budget.set(rule.pattern, reste);
  return out;
}

/**
 * Ce qui DOIT s'y trouver.
 *
 * Le contrôle d'absence, seul, est trop facile à satisfaire : un build raté,
 * ou le mauvais dossier passé en argument, passerait au vert. Ces deux marqueurs
 * confirment qu'on a bien relu une édition Business construite.
 */
export const REQUIRED = [
  // Nom échangé au Bloc 1 : l'édition LIVRÉE aux clientes s'appelle désormais
  // « AMN Desktop ». Ce marqueur confirme qu'on a bien relu la bonne édition.
  { pattern: 'AMN Desktop', why: 'le nom produit de l’édition livrée' },
  { pattern: 'Agenda', why: 'le calendrier, module quotidien de l’édition Business' },
  { pattern: 'Coffre-fort', why: 'un module de l’édition Business' },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ARTEFACT EMPAQUETÉ — un jeu de règles À PART, et pourquoi (BLOC O)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `FORBIDDEN` ci-dessus vaut pour le bundle du RENDERER : les écrans. On y
 * interdit « AMN DevSec » parce qu'aucun écran de cliente n'a de raison
 * d'afficher notre raison sociale au milieu de ses fiches.
 *
 * L'application EMPAQUETÉE, elle, contient aussi le processus principal — et
 * celui-ci nomme AMN DevSec depuis toujours, à un seul endroit et pour une
 * bonne raison : quand une mise à jour ne peut pas aboutir, la phrase utile
 * est « contactez AMN DevSec », pas « contactez votre prestataire ». Appliquer
 * la liste du renderer à l'asar ferait donc échouer un artefact parfaitement
 * sain, et la première réaction serait de désactiver le contrôle.
 *
 * Ces règles-ci répondent à une autre question, plus étroite et plus utile
 * avant de publier chez une cliente : **est-ce bien l'édition Business ?**
 *
 * Elles portent sur les PRODUITS et les ROUTES qui n'existent que chez nous.
 * Un nom de fichier ou un nom d'application ne suffirait pas : « AMN Desktop »
 * apparaît dans les deux artefacts (le `package.json` embarqué porte ce nom
 * quelle que soit l'édition construite), et se fier au nom du `.exe` revient à
 * faire confiance à celui qui l'a nommé.
 *
 * Le contrôle lit l'asar comme un tas d'octets. C'est suffisant : asar
 * concatène ses fichiers sans les compresser, donc une chaîne présente dans un
 * fichier est présente dans l'archive.
 */
export const ARTIFACT_FORBIDDEN = [
  { pattern: 'trackerCatalog', why: 'catalogue Tracker — édition interne' },
  { pattern: 'security-monitor', why: 'le tracker installé chez nos clients' },
  { pattern: 'SSL Monitor', why: 'produit exclusif' },
  { pattern: 'Comply', why: 'produit exclusif (RGPD)' },
  { pattern: 'Ajmani', why: 'assistant local, exclusif' },
  { pattern: 'Sentinel', why: 'palier du catalogue Tracker', caseSensitive: true },
  { pattern: 'Tour de contrôle', why: 'l’espace de supervision, interne' },
  { pattern: '/v1/admin/', why: 'console inter-organisations' },
  { pattern: 'support-session', why: 'contexte client — n’existe que chez nous' },
  { pattern: '/v1/comply', why: 'route produit' },
  { pattern: '/v1/scans', why: 'route produit' },
  { pattern: 'G20 Corvetto', why: 'client de démonstration interne' },
  { pattern: 'Atlas Retail', why: 'client de démonstration interne' },
  {
    pattern: 'amn-jeton-operateur-embarque',
    why: 'un jeton opérateur partagé a été compilé dans ce build — voir ARTIFACT_REQUIRED',
  },
];

/**
 * Ce que l'artefact DOIT contenir.
 *
 * Sans ça, un dossier vide, un mauvais chemin ou un build interrompu
 * passeraient au vert — un contrôle d'absence seul est toujours trop facile à
 * satisfaire.
 */
export const ARTIFACT_REQUIRED = [
  // Nom échangé au Bloc 1 : l'édition LIVRÉE aux clientes s'appelle désormais
  // « AMN Desktop ». Ce marqueur confirme qu'on a bien relu la bonne édition.
  { pattern: 'AMN Desktop', why: 'le nom produit de l’édition livrée' },
  { pattern: 'Coffre-fort', why: 'un module de l’édition Business' },
  { pattern: '/v1/updates/business', why: 'le canal de mise à jour des clientes' },
  /*
    LE MARQUEUR DE PROVENANCE DU JETON, ET LA PREMIÈRE VERSION QUI NE MARCHAIT PAS

    Le vrai risque n'est pas qu'un produit interne se glisse dans l'artefact —
    la liste ci-dessus s'en charge. C'est qu'un jeton opérateur PARTAGÉ y soit
    compilé : la machine d'Aaron a forcément ce jeton dans son `.env`, puisque
    c'est la même qui construit l'édition interne. Une application cliente qui
    l'embarque se synchronise sur l'espace d'AMN DevSec avant même que sa
    propriétaire se connecte. Constaté sur base d'essai, pas redouté en l'air.

    Premier essai, abandonné : exiger que la lecture
    `process.env.AMN_API_OPERATOR_TOKEN` soit encore présente, en pariant sur
    le fait qu'un `define` la remplace par la valeur et la fait disparaître. Le
    contrôle est resté vert sur un build qui embarquait le jeton — parce qu'un
    message d'erreur du processus principal cite ce nom en toutes lettres. Une
    règle qu'on croit tenir et qui ne tient rien est pire que pas de règle.

    Le build INSCRIT donc le fait lui-même : `remoteConfig.ts` replie une
    constante littérale (voir vite.main.config.ts) en l'une de ces deux
    chaînes, qui n'existent nulle part ailleurs et ne peuvent pas apparaître
    par accident.
  */
  {
    pattern: 'amn-aucun-jeton-operateur',
    why: 'le build doit déclarer qu’aucun jeton opérateur n’y a été figé',
  },
];

/**
 * QUEL PROJET VERCEL CONSTRUIT QUELLE ÉDITION — écrit ici, pas dans un tableau de bord.
 * ══════════════════════════════════════════════════════════════════════════════════
 *
 * ## Pourquoi ce fichier existe
 *
 * L'édition ne pouvait se déclarer QUE dans une variable d'environnement de
 * projet, parce que `vercel.json` est lu par les deux projets et ne peut pas
 * les distinguer. C'est vrai de la CONFIGURATION de Vercel ; ce n'est pas vrai
 * du BUILD, qui reçoit `VERCEL_PROJECT_ID` et sait donc parfaitement pour qui
 * il travaille.
 *
 * La différence compte, et elle est la leçon de l'incident :
 *
 *   · une variable de tableau de bord peut être supprimée, renommée, ou cochée
 *     pour Production et pas pour Preview, par une personne pressée, sans
 *     qu'aucun commit n'en garde trace et sans que personne ne le relise ;
 *   · une ligne de ce fichier se relit en revue, se date, et ne change pas
 *     toute seule.
 *
 * `amn-desktop.vercel.app` a servi l'édition interne en production — empreintes
 * bcrypt des comptes de départ, routes inter-organisations, produits exclusifs
 * — parce que la seule chose qui disait « cette adresse est celle des
 * clientes » était le fait que son nom y ressemblait.
 *
 * ## Le piège de nommage, puisqu'il est la cause
 *
 * Le dépôt s'appelle `amn-desktop`. Le PREMIER projet créé depuis lui a donc
 * pris ce nom : c'était le web INTERNE. Le second a reçu le suffixe que Vercel
 * ajoute quand le nom est pris, `-8wgo`. Puis les noms commerciaux ont été
 * échangés, et l'édition CLIENTE s'est mise à s'appeler « AMN Desktop ».
 *
 * Depuis, `amn-desktop.vercel.app` se LIT comme l'adresse des clientes tout en
 * étant celle de l'interne. Aucun raisonnement à partir des noms ne peut
 * rattraper ça. Les identifiants, si : ils ne veulent rien dire, donc ils ne
 * peuvent pas mentir.
 *
 * ## Comment ajouter un projet
 *
 * L'identifiant se lit dans Vercel (Project Settings → General → Project ID),
 * ou dans le commentaire que le bot Vercel poste sur chaque PR. Un projet
 * absent de cette table n'est pas deviné : le build le REFUSE, en demandant
 * soit cette ligne, soit un `AMN_EDITION` explicite. C'est voulu — un
 * troisième projet créé un jour ne doit pas hériter d'un défaut.
 */

/** @type {Record<string, 'internal' | 'business'>} */
export const EDITION_PAR_PROJET = {
  // amn-desktop — le web d'AMN DevSec. Domaine par défaut amn-desktop.vercel.app.
  prj_1cxQuGWYnWreIhjEoKkEUUED60AQ: 'internal',
  // amn-desktop-8wgo — l'édition livrée aux organisations clientes.
  prj_Tc93J7ggtMCYL2Embd6UiyyrtbqX: 'business',
};

/** Le nom lisible d'un projet, pour les messages. Sans valeur de vérité. */
export const NOM_PAR_PROJET = {
  prj_1cxQuGWYnWreIhjEoKkEUUED60AQ: 'amn-desktop',
  prj_Tc93J7ggtMCYL2Embd6UiyyrtbqX: 'amn-desktop-8wgo',
};

/**
 * L'édition que ce projet DOIT construire, ou `null` si on ne le connaît pas.
 * `null` n'est jamais un feu vert : l'appelant refuse, il ne devine pas.
 */
export function editionDuProjet(projectId) {
  if (!projectId) return null;
  return EDITION_PAR_PROJET[projectId] ?? null;
}

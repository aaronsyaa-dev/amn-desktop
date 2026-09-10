/**
 * LA FILE D'ENVOI — CE QUI N'EST PAS PARTI DOIT REPARTIR
 * ══════════════════════════════════════════════════════
 *
 * Module SANS React et SANS DOM, délibérément : `scripts/check-envoi.ts` le
 * charge tel quel depuis les sources. Ce qui compte ici — « une écriture
 * refusée par le réseau finit par arriver, une écriture refusée par le serveur
 * ne boucle pas » — est une propriété d'exécution qu'aucune lecture de code ne
 * démontre.
 *
 * ## Le défaut qu'elle répare
 *
 * MESURÉ AU NAVIGATEUR, l'API répondant 503 à toute écriture : cinq
 * soumissions sur cinq — un rendez-vous, une tâche, un client, une facture, un
 * rapport — n'ont produit **aucun mot**. Deux fois, la fenêtre s'est même
 * FERMÉE, ce que tout le monde lit comme « c'est enregistré ».
 *
 * Les écritures sont optimistes : le miroir local reçoit l'enregistrement
 * d'abord, l'API ensuite. Le miroir garde donc la donnée, et l'écran la
 * montre — sur CET appareil. Le `catch` qui avalait l'échec portait ce
 * commentaire :
 *
 *     catch { « offline: mirror keeps the optimistic record;
 *              will re-sync later » }
 *
 * « will re-sync later » : rien ne le faisait. `pullAll()` ne fait que TIRER,
 * à la reconnexion comme au retour de l'onglet. Aucun chemin ne renvoyait
 * jamais une écriture perdue. La facture existait sur le poste, n'existait pas
 * sur le serveur, donc n'existait pas sur le téléphone, ni pour le collègue,
 * ni après un vidage du cache du navigateur.
 *
 * C'est la même forme de défaut que cette nuit a rencontrée cinq fois : ce qui
 * est observé est bien enregistré, c'est le RÉVEIL qui ne survit pas.
 *
 * ## Les quatre règles, et pourquoi ce n'est pas « on réessaie »
 *
 * **1. Une seule entrée par enregistrement.** Modifier trois fois la même
 * facture hors ligne ne doit pas envoyer trois PUT : les deux premiers portent
 * un état déjà périmé, et le serveur les diffuserait aux autres postes qui
 * verraient la facture reculer avant d'avancer. La dernière valeur remplace la
 * précédente EN PLACE — la position d'origine est conservée, parce que l'ordre
 * de création porte du sens : un devis créé après son client part après lui.
 *
 * **2. Le dernier geste gagne, même quand il change de nature.** Créer puis
 * supprimer laisse une suppression, pas les deux. Supprimer puis recréer
 * laisse la création. Rejouer les deux ferait dépendre le résultat de l'ordre
 * d'arrivée sur le serveur.
 *
 * **3. Tout ne se réessaie pas.** Une requête sans réponse (réseau coupé,
 * serveur éteint) ou un serveur qui dit « plus tard » (408, 429, 5xx)
 * reviendra. Un REFUS — 400, 403, 404, 409, 422 — est une décision : le
 * serveur a lu la demande et l'a rejetée. La rejouer indéfiniment martèle
 * l'API sans jamais aboutir, et surtout masque le seul cas où la donnée est
 * VRAIMENT perdue. Un refus sort donc de la file et se signale.
 *
 * Cette distinction est la raison d'être du module. Une file qui réessaie tout
 * transforme un refus en boucle infinie ; une file qui n'en réessaie aucun ne
 * sert à rien.
 *
 * **4. Bornée.** Une file qui grandit sans limite est elle-même une panne :
 * le miroir est dans le stockage du navigateur, et le remplir fait échouer
 * toutes les écritures, y compris celles qui marchaient. Au-delà de la borne,
 * la plus ANCIENNE part — celle qui a le moins de chances d'être encore juste
 * — et son abandon est signalé.
 */

/** Ce qu'on a demandé au serveur de faire. */
export type GesteEnvoi = 'ecriture' | 'suppression';

export interface EntreeEnvoi {
  readonly collection: string;
  readonly id: string;
  geste: GesteEnvoi;
  /** Absent pour une suppression : il n'y a rien à porter. */
  donnees?: Record<string, unknown>;
  /**
   * LA VERSION DONT CE GESTE EST PARTI — `updatedAt` de l'enregistrement tel
   * que ce poste le connaissait au moment où la personne a agi.
   *
   * C'est ce qui permet au serveur de distinguer « personne n'a bougé depuis »
   * de « quelqu'un a écrit entre-temps », et donc de fusionner plutôt que
   * d'écraser (voir amn-api/src/lib/fusion.js). Absent pour une création, pour
   * une suppression, et pour un geste dont le patch n'est pas exprimable :
   * l'écriture repart alors entière, comme avant ce correctif.
   */
  base?: string;
  /**
   * Les SEULS champs que ce poste a changés depuis `base`.
   *
   * Envoyé à côté de l'enregistrement entier, jamais à la place : si
   * l'enregistrement n'existe plus côté serveur, il faut de quoi le recréer.
   */
  patch?: Record<string, unknown>;
  /** Horodatage du geste, côté client. Sert à l'ordre et au diagnostic. */
  pose: string;
  /** Combien de fois on a essayé de l'envoyer, sans y arriver. */
  essais: number;
  /**
   * Quand le dernier essai a échoué. Absent tant qu'aucun n'a eu lieu.
   *
   * C'est CE moment, et non celui du geste, qui fait courir l'attente : mesurer
   * depuis `pose` ferait repartir aussitôt une entrée écrite il y a une heure
   * et qui vient d'échouer, et le doublement ne servirait à rien.
   */
  dernierEssai?: string;
}

/**
 * CE QUE CE POSTE A CHANGÉ, ET RIEN D'AUTRE
 * ═════════════════════════════════════════
 *
 * L'autre moitié du correctif d'écrasement (l'autre vit dans
 * `amn-api/src/lib/fusion.js`, qui applique ce que celle-ci calcule).
 *
 * Le serveur ne PEUT pas deviner seul quels champs ont bougé : il reçoit un
 * enregistrement entier, et rien n'y distingue un champ que la personne a
 * délibérément remis à son ancienne valeur d'un champ qu'elle n'a jamais
 * touché. C'est donc au poste de le dire — il est le seul à connaître la
 * version dont il est parti.
 *
 * Rend `null`, et non un patch vide, dans les trois cas où une fusion par
 * champ ne peut pas dire la vérité. L'écriture repart alors entière, c'est-à-
 * dire exactement comme avant ce correctif : on ne régresse jamais en dessous
 * du comportement connu.
 */
export const PATCH_MAX_OCTETS = 256 * 1024;

function memeValeur(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => memeValeur(v, b[i]));
  }
  const ca = a as Record<string, unknown>;
  const cb = b as Record<string, unknown>;
  const cles = Object.keys(ca);
  if (cles.length !== Object.keys(cb).length) return false;
  return cles.every((k) => Object.prototype.hasOwnProperty.call(cb, k) && memeValeur(ca[k], cb[k]));
}

export function champsModifies(
  avant: Record<string, unknown> | null | undefined,
  apres: Record<string, unknown>,
): Record<string, unknown> | null {
  // Une CRÉATION : il n'y a pas de version d'avant, donc rien à fusionner avec.
  if (!avant) return null;

  /*
    Un champ RETIRÉ ne s'exprime pas dans une fusion par champ : le serveur
    recompose avec `{ ...ce qu'il détient, ...le patch }`, ce qui sait ajouter
    et remplacer, jamais enlever. On pourrait convenir qu'un `null` veut dire
    « efface » — mais `null` est une valeur LÉGITIME ici (`clientId`, `siteId`,
    `quoteId` valent null tous les jours), et la convention effacerait ces
    champs-là au lieu de les mettre à null. Plutôt que d'inventer une règle qui
    se trompe sur des cas réels, on renonce au patch pour ce geste-ci.
  */
  for (const cle of Object.keys(avant)) {
    if (!Object.prototype.hasOwnProperty.call(apres, cle)) return null;
  }

  const champs: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(apres)) {
    if (!memeValeur(avant[cle], valeur)) champs[cle] = valeur;
  }

  /*
    Un patch énorme n'apporte rien : il voyage EN PLUS de l'enregistrement
    entier, donc au-delà d'une certaine taille il ne fait que doubler la
    requête. Les champs sur lesquels deux personnes se marchent dessus — un
    statut, une priorité, une épingle, une réaction — tiennent tous dans
    quelques octets.
  */
  if (JSON.stringify(champs).length > PATCH_MAX_OCTETS) return null;
  return champs;
}

/**
 * Le patch cumulé de deux gestes successifs sur le même enregistrement.
 *
 * `undefined` dès que l'un des deux n'est pas exprimable : l'union d'un patch
 * et d'un « je ne sais pas dire » ne peut être qu'un « je ne sais pas dire ».
 */
export function fusionPatches(
  ancienne: EntreeEnvoi,
  nouvelle: EntreeEnvoi,
): Record<string, unknown> | undefined {
  if (ancienne.geste !== 'ecriture' || nouvelle.geste !== 'ecriture') return undefined;
  if (!ancienne.patch || !nouvelle.patch) return undefined;
  return { ...ancienne.patch, ...nouvelle.patch };
}

/** Pourquoi une entrée quitte la file sans être partie. */
export type MotifAbandon = 'refus' | 'trop-d-essais' | 'file-pleine';

export interface Abandon {
  readonly entree: EntreeEnvoi;
  readonly motif: MotifAbandon;
  /** Ce que le serveur a répondu, quand il a répondu. */
  readonly detail?: string;
}

/**
 * La borne de la file.
 *
 * Deux cents gestes hors ligne, c'est déjà une très longue coupure ; au-delà,
 * le problème n'est plus la file mais la connexion, et continuer d'empiler
 * remplirait le stockage du navigateur — ce qui ferait échouer jusqu'aux
 * écritures locales.
 */
export const FILE_MAX = 200;

/**
 * Le nombre d'essais avant d'abandonner une entrée.
 *
 * Une panne réseau ordinaire se règle au premier ou au deuxième essai. Dix
 * échecs successifs sur une entrée qui, elle, se dit réessayable, veut dire
 * qu'elle ne passera pas : mieux vaut le DIRE que continuer indéfiniment.
 */
export const ESSAIS_MAX = 10;

/** Les codes qui veulent dire « plus tard », par opposition à « non ». */
const PLUS_TARD = new Set([408, 425, 429, 500, 502, 503, 504, 507, 509]);

/**
 * CE QUI VAUT LA PEINE D'ÊTRE RENVOYÉ.
 *
 * Sans statut — une requête qui n'a jamais eu de réponse — on réessaie : c'est
 * le cas du réseau coupé, et c'est le cas le plus courant.
 *
 * Avec un statut, seul un « plus tard » explicite est réessayé. Tout le reste
 * est une décision du serveur, et la rejouer ne la changerait pas. Un 401 y
 * compris : la session a expiré, et c'est la reconnexion — pas la file — qui
 * doit régler ça.
 */
export function vautLaPeine(statut?: number): boolean {
  if (statut === undefined) return true;
  return PLUS_TARD.has(statut);
}

/**
 * Pose (ou remplace) une entrée dans la file. Rend la file suivante et ce qui
 * a dû être abandonné pour lui faire de la place.
 *
 * La file d'entrée n'est pas modifiée : ce module ne détient aucun état, ce
 * qui le rend éprouvable et lui évite d'être un deuxième endroit où la vérité
 * peut diverger du miroir.
 */
export function poser(
  file: readonly EntreeEnvoi[],
  entree: EntreeEnvoi,
): { file: EntreeEnvoi[]; abandons: Abandon[] } {
  const suite = [...file];
  const i = suite.findIndex((e) => e.collection === entree.collection && e.id === entree.id);
  if (i !== -1) {
    /*
      RÈGLES 1 ET 2 — remplacement EN PLACE.

      La position d'origine est conservée : l'ordre de création porte du sens
      (un devis part après le client qu'il cite). Et le compteur d'essais
      repart de zéro, parce que ce qu'on envoie n'est plus la même chose : les
      échecs de l'ancienne valeur ne condamnent pas la nouvelle.

      LA BASE, ELLE, NE SE REMPLACE PAS. Le deuxième geste hors ligne s'appuie
      sur le premier, qui n'a jamais atteint le serveur : sa base à lui est une
      version que le serveur n'a jamais eue. Celle qui compte reste la
      PREMIÈRE — la dernière version réellement venue du serveur — et les
      champs changés s'accumulent d'un geste à l'autre. Sans ça, trois
      modifications hors ligne feraient un patch qui ne décrit que la dernière,
      et les deux premières seraient perdues à la fusion.
    */
    const ancienne = suite[i];
    suite[i] = {
      ...entree,
      base: ancienne.base ?? entree.base,
      patch: fusionPatches(ancienne, entree),
      essais: 0,
    };
    return { file: suite, abandons: [] };
  }

  suite.push({ ...entree, essais: 0 });

  const abandons: Abandon[] = [];
  while (suite.length > FILE_MAX) {
    // RÈGLE 4 — la plus ancienne part. C'est celle dont l'état a le plus de
    // chances d'avoir été remplacé depuis, et la seule qu'on puisse désigner
    // sans arbitraire.
    abandons.push({ entree: suite[0], motif: 'file-pleine' });
    suite.shift();
  }
  return { file: suite, abandons };
}

/** Ce que l'envoi d'une entrée a donné. */
export interface Verdict {
  /** `true` si le serveur a accepté. */
  readonly parti: boolean;
  /** Le code HTTP, quand il y en a eu un. Absent = aucune réponse. */
  readonly statut?: number;
  readonly detail?: string;
}

/**
 * Applique le verdict d'un envoi à la file.
 *
 * Trois issues, et une seule laisse l'entrée en place :
 *   · parti      → l'entrée sort, sans bruit ;
 *   · refus      → l'entrée sort, et s'annonce (la donnée est perdue) ;
 *   · plus tard  → l'entrée reste, son compteur monte, et au bout elle
 *                  s'annonce aussi.
 */
export function appliquer(
  file: readonly EntreeEnvoi[],
  entree: EntreeEnvoi,
  verdict: Verdict,
  /** L'horloge, passée explicitement pour que le contrôle puisse la tenir. */
  maintenant: string = new Date().toISOString(),
): { file: EntreeEnvoi[]; abandons: Abandon[] } {
  const i = file.findIndex((e) => e.collection === entree.collection && e.id === entree.id);
  /*
    L'entrée peut avoir disparu pendant l'envoi : un geste plus récent l'a
    remplacée, ou la file a été vidée à la déconnexion. Le verdict porte alors
    sur un état périmé, et l'appliquer écraserait le geste le plus récent.
  */
  if (i === -1) return { file: [...file], abandons: [] };

  const courante = file[i];
  /*
    Même position, mais est-ce le même geste ? Si l'entrée a été remplacée
    pendant l'envoi (créer, puis supprimer avant la réponse), le verdict de
    l'envoi précédent ne dit rien de celui-ci — et retirer l'entrée perdrait
    la suppression.
  */
  if (courante.pose !== entree.pose) return { file: [...file], abandons: [] };

  const sansElle = () => [...file.slice(0, i), ...file.slice(i + 1)];

  if (verdict.parti) return { file: sansElle(), abandons: [] };

  if (!vautLaPeine(verdict.statut)) {
    // RÈGLE 3 — un refus n'est pas une panne. Il sort, et il se dit.
    return { file: sansElle(), abandons: [{ entree: courante, motif: 'refus', detail: verdict.detail }] };
  }

  const essais = courante.essais + 1;
  if (essais >= ESSAIS_MAX) {
    return {
      file: sansElle(),
      abandons: [{ entree: courante, motif: 'trop-d-essais', detail: verdict.detail }],
    };
  }

  const suite = [...file];
  suite[i] = { ...courante, essais, dernierEssai: maintenant };
  return { file: suite, abandons: [] };
}

/**
 * Cette entrée peut-elle repartir maintenant ?
 *
 * Une entrée qui n'a jamais échoué part tout de suite. Une entrée qui vient
 * d'échouer attend `attenteAvantEssai(essais)` À PARTIR DE SON DERNIER ESSAI.
 *
 * Le piège que cette fonction ferme : compter depuis `pose` (le moment du
 * geste). Une modification écrite il y a une heure et qui vient d'échouer
 * serait alors « en retard » et repartirait immédiatement — le doublement
 * n'aurait aucun effet, et un serveur en difficulté recevrait de chaque poste
 * ouvert une requête par seconde.
 *
 * Une date illisible rend `true` : mieux vaut un essai de trop qu'une entrée
 * bloquée pour toujours par un horodatage abîmé.
 */
export function pretALEnvoi(entree: EntreeEnvoi, maintenant: number): boolean {
  if (entree.essais <= 0) return true;
  if (!entree.dernierEssai) return true;
  const depuis = Date.parse(entree.dernierEssai);
  if (!Number.isFinite(depuis)) return true;
  return maintenant - depuis >= attenteAvantEssai(entree.essais);
}

/**
 * L'ATTENTE AVANT LE PROCHAIN ESSAI, EN MILLISECONDES.
 *
 * Doublement à chaque échec, plafonné à cinq minutes. Sans plafond, le
 * dixième essai arriverait après huit heures — l'application serait rouverte
 * dix fois d'ici là. Sans doublement, une API en difficulté recevrait de
 * chaque poste ouvert une requête par seconde, ce qui l'empêcherait de se
 * relever : la file aggraverait la panne qu'elle est censée absorber.
 */
export const ATTENTE_MAX_MS = 5 * 60 * 1000;

export function attenteAvantEssai(essais: number): number {
  if (essais <= 0) return 0;
  return Math.min(2000 * 2 ** (essais - 1), ATTENTE_MAX_MS);
}

/**
 * Ce que la file dit à l'écran.
 *
 * Le défaut mesuré était le SILENCE : cinq échecs, aucun mot. Une file qui
 * répare l'envoi sans jamais le dire ne répare que la moitié du problème —
 * pendant une longue coupure, on doit pouvoir savoir que le travail n'est pas
 * encore parti avant de fermer l'application.
 *
 * Rend `null` quand il n'y a rien à dire : une file vide ne mérite pas un
 * indicateur permanent qui apprendrait à être ignoré.
 */
export function resume(file: readonly EntreeEnvoi[]): string | null {
  if (file.length === 0) return null;
  const n = file.length;
  const bloquee = file.some((e) => e.essais > 0);
  const mot = n === 1 ? 'modification' : 'modifications';
  return bloquee
    ? `${n} ${mot} en attente d’envoi — la connexion au serveur ne répond pas`
    : `${n} ${mot} en attente d’envoi`;
}

/**
 * Ce qu'on dit quand une entrée est abandonnée.
 *
 * C'est le seul moment où l'utilisateur DOIT être dérangé : sa donnée est sur
 * cet appareil et n'ira nulle part. Le message nomme le geste plutôt que la
 * collection technique, et dit quoi faire.
 */
export function motsAbandon(a: Abandon): string {
  const quoi = a.entree.geste === 'suppression' ? 'Une suppression' : 'Une modification';
  switch (a.motif) {
    case 'refus':
      return `${quoi} a été refusée par le serveur et n’a pas été enregistrée${
        a.detail ? ` : ${a.detail}` : '.'
      } Elle reste affichée sur cet appareil, mais nulle part ailleurs.`;
    case 'trop-d-essais':
      return `${quoi} n’a pas pu être envoyée après ${ESSAIS_MAX} tentatives. Elle reste affichée sur cet appareil, mais nulle part ailleurs.`;
    case 'file-pleine':
      return `${quoi} a été abandonnée : plus de ${FILE_MAX} modifications attendaient d’être envoyées. Vérifiez la connexion au serveur.`;
  }
}

/**
 * CE QUI PART AVEC LE MIROIR DOIT ÊTRE DIT.
 *
 * La file d'un contexte client vit sous le même préfixe que son miroir, et
 * c'est voulu : les données d'une cliente n'ont pas à rester sur le disque de
 * l'opérateur une fois la porte refermée, la file comprise.
 *
 * Mais une file non vide au moment de la purge, ce sont des écritures qui
 * n'atteindront jamais le serveur. Les effacer sans un mot rejouerait
 * exactement le défaut que la file répare — et au pire moment : une session de
 * support qui EXPIRE toute seule, sans que personne n'ait décidé de partir.
 * C'est le seul cas où l'on perd du travail sans avoir rien fait pour ça.
 *
 * Rend `null` quand il n'y avait rien en attente — de très loin le cas le plus
 * courant, et qui ne mérite aucun mot.
 */
export function motsPurge(perdues: number): string | null {
  if (perdues <= 0) return null;
  return perdues === 1
    ? '1 modification n’avait pas encore atteint le serveur et a été perdue en refermant cet espace.'
    : `${perdues} modifications n’avaient pas encore atteint le serveur et ont été perdues en refermant cet espace.`;
}

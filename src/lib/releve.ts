/**
 * LA RELÈVE — ce qui s'est passé pendant qu'on n'était pas là
 * ═══════════════════════════════════════════════════════════
 *
 * « Relève de poste » est le vocabulaire réel d'une salle de contrôle : celui
 * qui arrive lit ce que celui qui part lui laisse. Ici, celui qui part est
 * l'application elle-même — elle a continué d'observer — et celui qui arrive
 * est la personne qui rouvre après des heures.
 *
 * ## Génération 100 % déterministe — aucune IA, aucun modèle
 *
 * Chaque ligne est assemblée depuis des observations COMPTÉES par l'appelant
 * sur ses vraies collections. Zéro invention possible : ce module ne connaît
 * ni les données ni le réseau, il ne fait que composer des phrases selon une
 * grammaire fixe. C'est ce qui lui permet de tourner partout — poste, web,
 * téléphone — et d'être exercé par mutation comme n'importe quelle règle.
 *
 * ## La grammaire (brief §8, exécutable)
 *
 *   · TROIS lignes au plus, la dernière est TOUJOURS le verdict d'état ;
 *   · le plus important d'abord — l'ordre des observations fait foi ;
 *   · les petits nombres en toutes lettres (« deux commandes ») ;
 *   · jamais de point d'exclamation, jamais d'emoji ;
 *   · deux tons, une grammaire : le Majordome (édition cliente) est un degré
 *     plus chaud que la relève SOC — mêmes règles, autres mots.
 *
 * ## Quand elle se tait
 *
 * En dessous de QUATRE heures d'absence, pas de relève : rouvrir l'application
 * après le déjeuner n'est pas une relève de poste, et une cérémonie rejouée
 * dix fois par jour cesse d'en être une. Sans repère du dernier passage
 * (première ouverture sur ce poste), pas de relève non plus : on ne raconte
 * pas « pendant votre absence » à quelqu'un dont on ignore l'absence.
 */

export interface Observation {
  /** Combien — zéro fait disparaître la ligne. */
  readonly nombre: number;
  /** « une nouvelle commande » — la forme quand il n'y en a qu'une. */
  readonly un: string;
  /** « nouvelles commandes » — le nom seul, le nombre s'écrit devant. */
  readonly plusieurs: string;
}

export interface Releve {
  /** « Pendant le week-end », « Depuis hier »… */
  readonly entete: string;
  /** Les lignes, verdict inclus en dernière position. Trois au plus. */
  readonly lignes: string[];
}

/** Le seuil en dessous duquel une absence n'est pas une absence. */
export const ABSENCE_MIN_MS = 4 * 60 * 60 * 1000;

const EN_LETTRES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];

/** Féminin par défaut : les noms observés ici sont surtout féminins (commande,
    tâche, facture, fiche). L'appelant qui compte des masculins passe par `un`. */
function enLettres(n: number): string {
  return n >= 0 && n <= 10 ? EN_LETTRES[n] : String(n);
}

/**
 * L'en-tête : comment nommer le temps passé dehors.
 *
 * Les cas se recouvrent, donc l'ordre TRANCHE : le week-end d'abord (parti
 * vendredi ou samedi, revenu après), puis la nuit (parti le soir, revenu le
 * matin d'après), puis hier, puis la date. « Ces dernières heures » couvre le
 * reste d'une même journée.
 */
export function nommeLAbsence(depuis: Date, maintenant: Date): string {
  const jourDepart = depuis.getDay();
  const memeJour =
    depuis.getFullYear() === maintenant.getFullYear() &&
    depuis.getMonth() === maintenant.getMonth() &&
    depuis.getDate() === maintenant.getDate();
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  const partiHier =
    depuis.getFullYear() === hier.getFullYear() &&
    depuis.getMonth() === hier.getMonth() &&
    depuis.getDate() === hier.getDate();

  if ((jourDepart === 5 || jourDepart === 6 || jourDepart === 0) && !memeJour && !partiHier) {
    return 'Pendant le week-end';
  }
  if (partiHier && depuis.getHours() >= 17 && maintenant.getHours() < 13) {
    return 'Pendant la nuit';
  }
  if (partiHier) return 'Depuis hier';
  if (memeJour) return 'Ces dernières heures';
  const quand = depuis.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return `Depuis le ${quand}`;
}

function ligneDe(obs: Observation): string {
  if (obs.nombre === 1) return obs.un;
  return `${enLettres(obs.nombre)} ${obs.plusieurs}`;
}

export function construireReleve({
  depuis,
  maintenant,
  observations,
  attentions,
  ton,
}: {
  /** Le dernier passage sur CE poste, ou null si on ne le connaît pas. */
  depuis: Date | null;
  maintenant: Date;
  /** Déjà comptées, déjà ordonnées par importance — l'ordre fait foi. */
  observations: readonly Observation[];
  /** Combien de points d'attention sont ouverts en ce moment. */
  attentions: number;
  ton: 'majordome' | 'soc';
}): Releve | null {
  if (!depuis) return null;
  const absence = maintenant.getTime() - depuis.getTime();
  if (!Number.isFinite(absence) || absence < ABSENCE_MIN_MS) return null;

  const chaud = ton === 'majordome';

  const nouvelles = observations.filter((o) => o.nombre > 0).slice(0, 2).map(ligneDe);
  if (nouvelles.length === 0) {
    nouvelles.push(chaud ? 'Rien de nouveau pendant votre absence' : 'Aucune arrivée pendant l’absence');
  }

  /*
    LE VERDICT FERME TOUJOURS LA RELÈVE. C'est la règle qui la distingue d'un
    fil d'activité : on ne laisse jamais quelqu'un sur une énumération, on lui
    dit s'il peut poser son manteau ou pas.
  */
  let verdict: string;
  if (attentions === 0) {
    verdict = chaud ? 'Tout va bien.' : 'Rien d’autre à savoir.';
  } else if (attentions === 1) {
    verdict = 'Un point à voir.';
  } else {
    verdict = `${enLettres(attentions).replace(/^une$/, 'Une')} points à voir.`.replace(/^./, (c) =>
      c.toUpperCase(),
    );
  }

  return {
    entete: nommeLAbsence(depuis, maintenant),
    lignes: [...nouvelles, verdict],
  };
}

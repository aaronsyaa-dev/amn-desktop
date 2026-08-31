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

export type LangueReleve = 'fr' | 'en';

/** Le seuil en dessous duquel une absence n'est pas une absence. */
export const ABSENCE_MIN_MS = 4 * 60 * 60 * 1000;

/*
  CHAQUE LANGUE A SA GRAMMAIRE — jamais un gabarit traduit mot à mot.

  Le français écrit les petits nombres en lettres jusqu'à dix ; l'anglais
  suit sa propre convention d'édition (spell out one through nine) et n'a pas
  de genre à porter. Les verdicts, les en-têtes et les replis sont ÉCRITS
  dans chaque langue, pas convertis — c'est la règle du chantier langue, et
  `check:releve` l'éprouve dans les deux.
*/
const LETTRES_FR = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
const LETTRES_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** FR : féminin par défaut — les noms observés sont surtout féminins
    (commande, tâche, facture, fiche) ; un masculin passe par `un`. */
function enLettres(n: number, langue: LangueReleve): string {
  if (langue === 'en') return n >= 0 && n <= 9 ? LETTRES_EN[n] : String(n);
  return n >= 0 && n <= 10 ? LETTRES_FR[n] : String(n);
}

/**
 * L'en-tête : comment nommer le temps passé dehors.
 *
 * Les cas se recouvrent, donc l'ordre TRANCHE : le week-end d'abord (parti
 * vendredi ou samedi, revenu après), puis la nuit (parti le soir, revenu le
 * matin d'après), puis hier, puis la date. « Ces dernières heures » couvre le
 * reste d'une même journée.
 */
export function nommeLAbsence(depuis: Date, maintenant: Date, langue: LangueReleve = 'fr'): string {
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

  const anglais = langue === 'en';
  if ((jourDepart === 5 || jourDepart === 6 || jourDepart === 0) && !memeJour && !partiHier) {
    return anglais ? 'Over the weekend' : 'Pendant le week-end';
  }
  if (partiHier && depuis.getHours() >= 17 && maintenant.getHours() < 13) {
    return anglais ? 'Overnight' : 'Pendant la nuit';
  }
  if (partiHier) return anglais ? 'Since yesterday' : 'Depuis hier';
  if (memeJour) return anglais ? 'These past hours' : 'Ces dernières heures';
  if (anglais) {
    // La convention anglaise : « Since 12 March » (jour puis mois, sans « le »).
    const quand = depuis.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    return `Since ${quand}`;
  }
  const quand = depuis.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return `Depuis le ${quand}`;
}

function ligneDe(obs: Observation, langue: LangueReleve): string {
  if (obs.nombre === 1) return obs.un;
  return `${enLettres(obs.nombre, langue)} ${obs.plusieurs}`;
}

export function construireReleve({
  depuis,
  maintenant,
  observations,
  attentions,
  ton,
  langue = 'fr',
}: {
  /** Le dernier passage sur CE poste, ou null si on ne le connaît pas. */
  depuis: Date | null;
  maintenant: Date;
  /** Déjà comptées, déjà ordonnées par importance — l'ordre fait foi.
      Les libellés `un`/`plusieurs` arrivent DÉJÀ dans la langue voulue. */
  observations: readonly Observation[];
  /** Combien de points d'attention sont ouverts en ce moment. */
  attentions: number;
  ton: 'majordome' | 'soc';
  langue?: LangueReleve;
}): Releve | null {
  if (!depuis) return null;
  const absence = maintenant.getTime() - depuis.getTime();
  if (!Number.isFinite(absence) || absence < ABSENCE_MIN_MS) return null;

  const chaud = ton === 'majordome';
  const anglais = langue === 'en';

  const nouvelles = observations
    .filter((o) => o.nombre > 0)
    .slice(0, 2)
    .map((o) => ligneDe(o, langue));
  if (nouvelles.length === 0) {
    nouvelles.push(
      anglais
        ? chaud
          ? 'Nothing new while you were away'
          : 'No arrivals during the absence'
        : chaud
          ? 'Rien de nouveau pendant votre absence'
          : 'Aucune arrivée pendant l’absence',
    );
  }

  /*
    LE VERDICT FERME TOUJOURS LA RELÈVE. C'est la règle qui la distingue d'un
    fil d'activité : on ne laisse jamais quelqu'un sur une énumération, on lui
    dit s'il peut poser son manteau ou pas.
  */
  let verdict: string;
  if (anglais) {
    if (attentions === 0) {
      verdict = chaud ? 'All is well.' : 'Nothing else to report.';
    } else if (attentions === 1) {
      verdict = 'One thing to look at.';
    } else {
      verdict = `${enLettres(attentions, 'en')} things to look at.`.replace(/^./, (c) =>
        c.toUpperCase(),
      );
    }
  } else if (attentions === 0) {
    verdict = chaud ? 'Tout va bien.' : 'Rien d’autre à savoir.';
  } else if (attentions === 1) {
    verdict = 'Un point à voir.';
  } else {
    verdict = `${enLettres(attentions, 'fr').replace(/^une$/, 'Une')} points à voir.`.replace(
      /^./,
      (c) => c.toUpperCase(),
    );
  }

  return {
    entete: nommeLAbsence(depuis, maintenant, langue),
    lignes: [...nouvelles, verdict],
  };
}

/**
 * L'ACCUEIL, ET CE QU'IL A LE DROIT D'AFFIRMER
 * ════════════════════════════════════════════
 *
 * La ligne de bienvenue et l'invitation « où commencer » changent à chaque
 * lancement sans devenir du bruit : elles sont tirées de variantes écrites à la
 * main, rangées par moment de la journée. Le tirage garde la chose vivante ;
 * le créneau horaire la garde sensée.
 *
 * ## Le défaut qui a motivé cette réécriture
 *
 * Vu sur une capture réelle, en haut de l'accueil :
 *
 *     La nuit est calme, Aaron.
 *     12 sites hors ligne — à regarder
 *     21 points d'attention
 *
 * La première phrase que lit l'opérateur contredit tout ce qui la suit. Dans
 * un produit de cybersécurité, un accueil qui rassure pendant que le parc
 * brûle est pire qu'un accueil muet : il apprend à ne plus le croire, et le
 * jour où il dit vrai personne ne l'écoute.
 *
 * La cause est simple : la salutation ne savait RIEN. Elle tirait au hasard
 * dans une liste où la moitié des variantes affirment un fait — « la nuit est
 * calme », « tout est en ordre », « au calme » — sans que rien ne les autorise.
 *
 * ## La règle
 *
 * Deux familles par créneau :
 *
 *   - **NEUTRES** — elles saluent, elles n'affirment rien. « Bonjour Aaron. »
 *     est vrai quoi qu'il arrive.
 *   - **SEREINES** — elles affirment le calme. On n'y a droit que si
 *     l'appelant le certifie.
 *
 * Et le défaut est du bon côté : `serein` vaut FAUX par défaut. Un appelant
 * qui oublie le paramètre obtient une salutation neutre — jamais une fausse
 * réassurance. C'est l'inverse qui serait dangereux, et c'est exactement ce
 * qui s'était produit.
 *
 * Rien d'alarmant n'est ajouté quand ça ne va pas : la ligne rouge juste en
 * dessous dit déjà les sites hors ligne, et la doubler d'une salutation
 * inquiète ferait deux fois le même bruit.
 */

type Slot = 'night' | 'morning' | 'afternoon' | 'evening';

function slotFor(hour: number): Slot {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** Elles saluent, et n'affirment rien. Vraies quoi qu'il arrive. */
export const GREETINGS_NEUTRES: Record<Slot, string[]> = {
  night: ['Encore là, {name} ?', 'Bonsoir {name}.', 'Toujours debout, {name} ?'],
  morning: ['Bonjour {name}.', 'Belle matinée, {name}.', 'On démarre, {name} ?'],
  afternoon: ['Bon après-midi, {name}.', 'Content de te revoir, {name}.', 'Ça avance, {name} ?'],
  evening: ['Bonsoir, {name}.', 'Bonne soirée, {name}.', 'On fait le point, {name} ?'],
};

/** Elles affirment le calme. Réservées aux moments où c'est vrai. */
export const GREETINGS_SEREINES: Record<Slot, string[]> = {
  /*
    « veille tranquille » a été retiré : c'est du vocabulaire de SOC, et ce
    fichier sert AUSSI l'édition livrée aux clientes. Une fleuriste qui ouvre
    son application à une heure du matin ne tient pas une veille — elle finit
    sa journée. « Rien à signaler » dit la même chose et se comprend des deux
    côtés ; c'est en plus le mot exact qu'emploie le panneau d'attention juste
    en dessous.
  */
  night: ['La nuit est calme, {name}.', 'Bonsoir {name} — rien à signaler.'],
  morning: ['Bonjour {name} — tout est en ordre.', 'Matinée dégagée, {name}.'],
  afternoon: ['Bon après-midi {name} — au calme.', 'Rien ne presse, {name}.'],
  evening: ['Bonsoir {name} — journée bientôt bouclée.', 'Soirée tranquille, {name}.'],
};

const NUDGES: string[] = [
  'Par où commencer ?',
  'Que veux-tu regarder ?',
  'Un endroit où aller ?',
  'On commence par quoi ?',
  'Choisis un point de départ.',
];

/** Tirage stable pendant une session, différent au lancement suivant. */
const launchSeed = Math.floor(Math.random() * 100000);
function pick<T>(arr: T[], salt: number): T {
  return arr[(launchSeed + salt) % arr.length];
}

/**
 * La ligne de bienvenue.
 *
 * `serein` doit être ACTIVEMENT certifié par l'appelant — rien à traiter, rien
 * hors ligne. Voir l'en-tête pour la raison : le défaut penche du côté qui ne
 * ment pas.
 */
export function homeWelcome(name: string, now = new Date(), serein = false): string {
  const slot = slotFor(now.getHours());
  const source = serein ? GREETINGS_SEREINES[slot] : GREETINGS_NEUTRES[slot];
  return pick(source, 0).replace('{name}', name);
}

export function homeNudge(): string {
  return pick(NUDGES, 7);
}

/* ------------------- Qui a le droit de dire que c'est calme ---------------- */

/**
 * L'ÉTAT DU PARC, tel qu'il autorise — ou non — une phrase rassurante.
 *
 * ## Le trou trouvé après coup
 *
 * `serein` se calculait dans les écrans, et il comptait les sites HORS LIGNE.
 * Il ne comptait pas les sites dont le traceur n'a **jamais** rien envoyé.
 *
 * Mesuré sur la base d'essai : dix-neuf sites supervisés, douze hors ligne, et
 * **sept dont on n'a jamais eu le moindre signe**. Ces sept-là n'entraient dans
 * aucun des deux chiffres de l'accueil, ni « en ligne » ni « hors ligne ». Un
 * parc entièrement composé de sites jamais vus — traceur jamais posé, ou posé
 * et jamais fonctionnel — donnait donc zéro hors ligne, zéro point d'attention,
 * et « La nuit est calme ».
 *
 * C'est exactement le défaut corrigé plus haut dans ce fichier, revenu par une
 * autre porte : on avait bouché le cas « ça va mal », pas le cas « on n'en sait
 * rien ». Or « jamais vu » est le PIRE des trois pour une entreprise de
 * supervision — un site hors ligne, au moins, on l'a vu vivre une fois. Un site
 * jamais vu est une supervision facturée qui n'a jamais commencé.
 *
 * Le moteur des points d'attention dit la même chose de son côté depuis
 * toujours, pour les certificats : « un certificat jamais vérifié ne produit
 * rien du tout — ni valide ni à surveiller ». Même doctrine, même défaut.
 *
 * ## Pourquoi c'est une fonction, et pas trois lignes dans l'écran
 *
 * Parce que c'est une RÈGLE. Calculée dans deux écrans, elle y était déjà
 * écrite de deux façons différentes ; à la troisième elle aurait divergé pour
 * de bon. Ici elle est unique et éprouvée.
 */
export interface EtatDuParc {
  /** Points d'attention en cours. */
  attentions: number;
  /**
   * L'évaluation a-t-elle réellement eu lieu ?
   *
   * Une liste vide peut vouloir dire « rien à signaler » ou « je n'ai pas
   * encore regardé », et affirmer le calme dans le second cas est un mensonge
   * qu'on ne peut même pas qualifier d'erreur.
   */
  regarde: boolean;
  /** Sites qui ne répondent plus. */
  horsLigne?: number;
  /** Sites dont le traceur n'a JAMAIS rien envoyé. */
  jamaisVus?: number;
}

export function parcSerein(etat: EtatDuParc): boolean {
  return (
    etat.regarde &&
    etat.attentions === 0 &&
    (etat.horsLigne ?? 0) === 0 &&
    (etat.jamaisVus ?? 0) === 0
  );
}

/**
 * La ligne rouge sous la salutation, ou `null` quand il n'y a rien à dire.
 *
 * Les deux états ne demandent pas le même geste, et la phrase le dit :
 *
 *   · hors ligne → **à regarder**. Le site a vécu, il ne répond plus, quelqu'un
 *     ouvre le parc et va voir ;
 *   · jamais vu → il n'y a rien à « regarder » au sens de la supervision. Le
 *     traceur n'a jamais parlé : il n'a pas été posé, ou il ne marche pas. Le
 *     geste est une installation, pas un diagnostic.
 *
 * Les mélanger sous un même « à regarder » enverrait ouvrir un tableau vide.
 */
export function alerteParc(etat: { horsLigne?: number; jamaisVus?: number }): string | null {
  const bas = etat.horsLigne ?? 0;
  const muets = etat.jamaisVus ?? 0;
  const s = (n: number) => (n > 1 ? 's' : '');

  if (bas > 0 && muets > 0) {
    return `${bas} site${s(bas)} hors ligne · ${muets} sans aucun signe de vie — à regarder`;
  }
  if (bas > 0) return `${bas} site${s(bas)} hors ligne — à regarder`;
  if (muets > 0) {
    return muets > 1
      ? `${muets} sites n’ont jamais donné signe de vie`
      : '1 site n’a jamais donné signe de vie';
  }
  return null;
}

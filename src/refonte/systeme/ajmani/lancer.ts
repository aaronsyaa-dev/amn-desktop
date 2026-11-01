/**
 * LES QUATRE LIGNES « OU LANCEZ » — logique pure, sans React.
 *
 * Toujours quatre lignes (zéro zone morte). Les deux premières dépendent de l'écran courant (sa famille), les
 * deux dernières sont les actions que la personne lance le plus souvent. Quand elle écrit, les lignes dont les
 * mots correspondent remontent en tête : la liste se réordonne, elle ne se vide jamais.
 *
 * Une ligne ne fait jamais d'effet par elle-même : elle remet un texte dans le champ (et la demande repasse par
 * la proposition), ouvre un écran (lecture), ou délègue une demande à l'assistant.
 */
import { aplatir } from './sensibles';
import type { Usage } from './historique';
import type { CleMot } from './i18n';
import type { FamilleCourante, IconeAjmani } from './intentions';

export type EffetLigne =
  | { type: 'texte'; cle: CleMot }
  | { type: 'aller'; route: string }
  | { type: 'demander'; cle: CleMot };

export interface LigneLancer {
  id: string;
  icone: IconeAjmani;
  titre: CleMot;
  sous: CleMot;
  effet: EffetLigne;
  /** La ligne mène à La Garde : réservée aux administrateurs. */
  reservee?: boolean;
}

export const NOMBRE_LIGNES = 4;

export const CATALOGUE: Readonly<Record<string, LigneLancer>> = {
  'creer-facture': { id: 'creer-facture', icone: 'plus', titre: 'lancer.creerFacture.titre', sous: 'lancer.creerFacture.sous', effet: { type: 'texte', cle: 'seed.creerFacture' } },
  trouver: { id: 'trouver', icone: 'loupe', titre: 'lancer.trouver.titre', sous: 'lancer.trouver.sous', effet: { type: 'texte', cle: 'seed.trouver' } },
  garde: { id: 'garde', icone: 'bouclier', titre: 'lancer.garde.titre', sous: 'lancer.garde.sous', effet: { type: 'texte', cle: 'seed.garde' }, reservee: true },
  'compte-rendu': { id: 'compte-rendu', icone: 'document', titre: 'lancer.compteRendu.titre', sous: 'lancer.compteRendu.sous', effet: { type: 'texte', cle: 'seed.compteRendu' } },
  relancer: { id: 'relancer', icone: 'envoi', titre: 'lancer.relancer.titre', sous: 'lancer.relancer.sous', effet: { type: 'texte', cle: 'seed.relancer' } },
  resumer: { id: 'resumer', icone: 'liste', titre: 'lancer.resumer.titre', sous: 'lancer.resumer.sous', effet: { type: 'texte', cle: 'seed.resumer' } },
  'trouver-client': { id: 'trouver-client', icone: 'utilisateur', titre: 'lancer.trouverClient.titre', sous: 'lancer.trouverClient.sous', effet: { type: 'texte', cle: 'seed.trouverClient' } },
  'resumer-messages': { id: 'resumer-messages', icone: 'message', titre: 'lancer.resumerMessages.titre', sous: 'lancer.resumerMessages.sous', effet: { type: 'demander', cle: 'seed.resumerMessages' } },
  annonce: { id: 'annonce', icone: 'envoi', titre: 'lancer.annonce.titre', sous: 'lancer.annonce.sous', effet: { type: 'aller', route: '/annonces' } },
  appel: { id: 'appel', icone: 'appel', titre: 'lancer.appel.titre', sous: 'lancer.appel.sous', effet: { type: 'aller', route: '/appels' } },
  note: { id: 'note', icone: 'note', titre: 'lancer.note.titre', sous: 'lancer.note.sous', effet: { type: 'aller', route: '/notes' } },
  agenda: { id: 'agenda', icone: 'agenda', titre: 'lancer.agenda.titre', sous: 'lancer.agenda.sous', effet: { type: 'aller', route: '/agenda' } },
  'pile-garde': { id: 'pile-garde', icone: 'bouclier', titre: 'lancer.pileGarde.titre', sous: 'lancer.pileGarde.sous', effet: { type: 'aller', route: '/garde/pile' }, reservee: true },
};

/** Les deux lignes que l'écran courant met en avant, selon sa famille. */
export const SELON_LA_FAMILLE: Readonly<Record<FamilleCourante | 'defaut', readonly [string, string]>> = {
  defaut: ['creer-facture', 'trouver'],
  jour: ['creer-facture', 'trouver'],
  contacts: ['trouver-client', 'creer-facture'],
  ecrire: ['compte-rendu', 'note'],
  argent: ['creer-facture', 'relancer'],
  echanger: ['resumer-messages', 'annonce'],
  creer: ['compte-rendu', 'trouver'],
  outils: ['trouver', 'compte-rendu'],
  garde: ['garde', 'pile-garde'],
};

/** Les lignes proposées quand rien n'a encore été lancé : celles de la maquette, dans son ordre. */
export const PAR_DEFAUT: readonly string[] = ['creer-facture', 'trouver', 'garde', 'compte-rendu', 'resumer', 'relancer'];

export interface EntreeLancer {
  famille: FamilleCourante | null;
  usage: Usage;
  /** Ce que la personne a déjà écrit : les lignes qui lui répondent remontent. */
  texte?: string;
  /** Les textes de chaque ligne, dans la langue courante (pour retrouver les mots tapés). */
  libelle?: (cle: CleMot) => string;
}

/**
 * Les quatre lignes. Deux selon l'écran, deux selon l'usage (les plus lancées, puis les lignes par défaut) ;
 * chaque ligne n'apparaît qu'une fois.
 */
export function lignesLancer(e: EntreeLancer): LigneLancer[] {
  const [a, b] = SELON_LA_FAMILLE[e.famille ?? 'defaut'];
  const vues = new Set<string>([a, b]);
  const usuelles = Object.entries(e.usage)
    .filter(([id, n]) => n > 0 && id in CATALOGUE && !vues.has(id))
    .sort((x, y) => y[1] - x[1] || PAR_DEFAUT.indexOf(x[0]) - PAR_DEFAUT.indexOf(y[0]))
    .map(([id]) => id);
  const ordre = [a, b, ...usuelles, ...PAR_DEFAUT.filter((id) => !usuelles.includes(id))].filter((id, i, tout) => tout.indexOf(id) === i);

  const base = ordre.slice(0, NOMBRE_LIGNES);
  const texte = e.texte ? aplatir(e.texte) : '';
  if (!texte || !e.libelle) return base.map((id) => CATALOGUE[id]);

  // Les mots tapés : les lignes qui leur répondent passent devant, sans que la liste ne perde une ligne.
  const mots = texte.split(' ').filter((m) => m.length >= 2);
  const libelle = e.libelle;
  const colle = (l: LigneLancer): boolean => {
    const cible = aplatir(`${libelle(l.titre)} ${libelle(l.sous)}`).split(' ');
    return mots.some((m) => cible.some((c) => c.startsWith(m)));
  };
  const toutes = [...ordre, ...Object.keys(CATALOGUE).filter((id) => !ordre.includes(id))].map((id) => CATALOGUE[id]);
  const qui = toutes.filter(colle);
  const retenues = [...qui, ...toutes.filter((l) => !qui.includes(l))].slice(0, NOMBRE_LIGNES);
  return retenues;
}

import type { GardeAgent, GardeEquipe, GardeJournalEntree } from '../../shared/garde';
import type { Langue } from '../../i18n';
import { compte, traduireGarde, type CleGarde } from './i18n';
import { estCleEquipe } from './equipes';

/**
 * LE FIL D'ACTIVITÉ — une ligne par équipe, ce qu'elle fait en ce moment (S3).
 *
 * Pur. Une équipe a toujours exactement une ligne, dans l'ordre de
 * `EQUIPES_ORDRE` : le fil ne s'allonge pas quand la Garde travaille, il
 * change de mots. C'est ce qui le rend lisible sans bruit — rien ne défile,
 * rien ne s'empile, rien ne réclame l'œil.
 *
 * Ce qu'une ligne dit, par ordre de priorité :
 *   1. une garde en échec → le dit, ton sérieux ;
 *   2. une garde en ronde → sa phrase du moment (celle du serveur) ;
 *   3. sinon la dernière ligne du journal de l'équipe, datée ;
 *   4. sinon « Au repos. ».
 */
export type EtatLigne = 'echec' | 'ronde' | 'recent' | 'repos';

export interface LigneFil {
  equipe: string;
  nom: string;
  /** Nombre de gardes de l'équipe, tel que le serveur le rend. */
  gardes: number;
  etat: EtatLigne;
  texte: string;
  /** Heure de ce que dit la ligne, s'il y en a une. */
  at: string | null;
}

export interface EntreeFil {
  ordre: readonly string[];
  equipes: GardeEquipe[];
  agents: GardeAgent[];
  journal: GardeJournalEntree[];
  /** Signal local (bus de moments) à rattacher à l'équipe Sécurité. */
  suspecteAt?: string | null;
}

export function nomDEquipe(cle: string, equipes: GardeEquipe[], langue: Langue): string {
  if (estCleEquipe(cle)) return traduireGarde(langue, `equipe.${cle}` as CleGarde);
  const e = equipes.find((x) => x.key === cle);
  return e?.nom ?? cle;
}

export function filParEquipe(e: EntreeFil, langue: Langue): LigneFil[] {
  // Les équipes connues dans l'ordre, puis celles qu'un serveur plus récent ajouterait.
  const cles = [...e.ordre, ...e.equipes.map((x) => x.key).filter((k) => !e.ordre.includes(k))];
  const dernier = new Map<string, GardeJournalEntree>();
  for (const j of e.journal) {
    const d = dernier.get(j.equipe);
    if (!d || j.createdAt > d.createdAt) dernier.set(j.equipe, j);
  }
  return cles.map((cle) => {
    const siens = e.agents.filter((a) => a.equipe === cle);
    const base = { equipe: cle, nom: nomDEquipe(cle, e.equipes, langue), gardes: siens.length };
    const enEchec = siens.filter((a) => a.actif && a.etat === 'echec');
    if (enEchec.length) return { ...base, etat: 'echec', texte: compte(langue, 'fil.echec', enEchec.length), at: enEchec[0].derniereRondeAt };
    const enRonde = siens.find((a) => a.actif && a.etat === 'ronde' && a.phrase);
    if (enRonde) return { ...base, etat: 'ronde', texte: enRonde.phrase, at: enRonde.derniereRondeAt };
    if (cle === 'securite' && e.suspecteAt) return { ...base, etat: 'recent', texte: traduireGarde(langue, 'fil.suspecte'), at: e.suspecteAt };
    const j = dernier.get(cle);
    if (j) return { ...base, etat: 'recent', texte: phraseDuJournal(j), at: j.createdAt };
    return { ...base, etat: 'repos', texte: traduireGarde(langue, 'fil.repos'), at: null };
  });
}

/** Le « pourquoi » du journal est déjà une phrase du serveur ; l'action n'est qu'une clé. */
function phraseDuJournal(j: GardeJournalEntree): string {
  const t = (j.pourquoi || j.action || '').trim();
  return t.length > 110 ? `${t.slice(0, 108).trimEnd()}…` : t;
}

/** « il y a 4 min », « 4 min ago » — court, sans seconde. */
export function depuisQuand(iso: string | null, maintenant: number, langue: Langue): string {
  if (!iso) return '';
  const min = Math.round((maintenant - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min)) return '';
  if (min < 1) return traduireGarde(langue, 'fil.maintenant');
  const rtf = new Intl.RelativeTimeFormat(langue, { numeric: 'always', style: 'short' });
  if (min < 60) return rtf.format(-min, 'minute');
  const h = Math.round(min / 60);
  if (h < 48) return rtf.format(-h, 'hour');
  return rtf.format(-Math.round(h / 24), 'day');
}

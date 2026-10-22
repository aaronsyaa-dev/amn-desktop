import type { Langue } from '../../i18n';
import { compte, traduireGarde } from './i18n';

/**
 * LE RÉSUMÉ DE LA NUIT — ce que la Garde a fait pendant que personne ne
 * regardait, en phrases courtes (S3).
 *
 * Pur : il reçoit des comptes déjà faits et rend des phrases. Les données
 * viennent du serveur (`donnees.ts`) ; aucun nombre n'est écrit en dur.
 *
 * L'ordre suit la gravité, pas la chronologie : ce qui attend une décision
 * passe avant ce qui a été fait. Dès qu'il y a un problème, la phrase
 * d'ouverture change de ton — elle ne dit plus « nuit calme ».
 */
export type TonPhrase = 'calme' | 'info' | 'serieux' | 'critique';

export interface PhraseResume {
  cle: string;
  texte: string;
  ton: TonPhrase;
}

export interface EntreeResume {
  /** Rondes terminées sur la période ; `null` si le serveur ne les a pas rendues. */
  rondes: number | null;
  /** Lignes du journal sur la période, par résultat. */
  regles: number;
  remontes: number;
  ratees: number;
  /** Ce qui attend aujourd'hui (la pile). */
  critiquesOuverts: number;
  dossiersOuverts: number;
  /** Les gardes en échec maintenant (`pouls.enEchec`). */
  gardesEnEchec: number;
}

export interface Resume {
  ton: TonPhrase;
  phrases: PhraseResume[];
}

export function resumerNuit(e: EntreeResume, langue: Langue): Resume {
  const p: PhraseResume[] = [];
  const dire = (cle: string, texte: string, ton: TonPhrase) => p.push({ cle, texte, ton });

  // Ce qui attend, d'abord.
  if (e.critiquesOuverts > 0) dire('critique', compte(langue, 'resume.critique', e.critiquesOuverts), 'critique');
  const autres = Math.max(0, e.dossiersOuverts - e.critiquesOuverts);
  if (autres > 0) dire('decision', compte(langue, 'resume.decision', autres), 'serieux');
  if (e.gardesEnEchec > 0) dire('echec', compte(langue, 'resume.echec', e.gardesEnEchec), 'serieux');
  if (e.ratees > 0) dire('ratees', compte(langue, 'resume.ratees', e.ratees), 'serieux');

  // Puis ce qui a été fait.
  if (e.rondes !== null) dire('rondes', compte(langue, 'resume.rondes', e.rondes), e.rondes === 0 ? 'serieux' : 'info');
  if (e.remontes > 0) dire('remontes', compte(langue, 'resume.remontes', e.remontes), 'info');
  if (e.regles > 0) dire('regles', compte(langue, 'resume.regles', e.regles), 'calme');

  if (e.dossiersOuverts === 0 && e.critiquesOuverts === 0) dire('rien', traduireGarde(langue, 'resume.rien'), 'calme');

  const ton: TonPhrase = p.some((x) => x.ton === 'critique') ? 'critique' : p.some((x) => x.ton === 'serieux') ? 'serieux' : 'calme';
  const ouverture =
    ton === 'critique' ? traduireGarde(langue, 'resume.ouverture.critique') : ton === 'serieux' ? traduireGarde(langue, 'resume.ouverture.serieux') : traduireGarde(langue, 'resume.ouverture.calme');
  return { ton, phrases: [{ cle: 'ouverture', texte: ouverture, ton }, ...p] };
}

/** Compte les mots d'une phrase, comme un lecteur : les nombres comptent pour un mot. */
export function motsDe(phrase: string): number {
  return phrase.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

/**
 * La fenêtre « cette nuit » : du début du silence la veille à sa fin ce
 * matin ; avant la fin, la nuit en cours. Même calcul que `bureaux/garde/Nuit.tsx`.
 */
export function fenetreDeNuit(silence: { de: number; a: number }, maintenant = new Date()): { debut: Date; fin: Date } {
  const finDuJour = new Date(maintenant);
  finDuJour.setHours(silence.a, 0, 0, 0);
  const fin = maintenant.getTime() < finDuJour.getTime() ? maintenant : finDuJour;
  const debut = new Date(finDuJour);
  debut.setDate(debut.getDate() - 1);
  debut.setHours(silence.de, 0, 0, 0);
  return { debut, fin };
}

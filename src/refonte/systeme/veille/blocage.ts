import type { CallPhase } from '../../../state/CallContext';
import type { EtatVocal } from '../../../assistant/voix';

/**
 * JAMAIS PENDANT UN APPEL, UN PARTAGE D'ÉCRAN, UN ENREGISTREMENT OU UNE VIDÉO (G09, rubrique 6).
 *
 * Les sources RÉELLES de l'application, et rien d'inventé :
 *
 *   appel          `useCall().phase` (CallContext, le contexte de `CallOverlay`) : sonnerie sortante ou entrante,
 *                  connexion, appel en cours — tout sauf « idle » et « ended » ;
 *   partage        `sharingScreen` (nous partageons), `viewingScreen` (nous regardons celui de l'autre),
 *                  `controlledBy` / `controlling` (prise en main, dans un sens ou dans l'autre) — même contexte ;
 *   enregistrement la dictée d'Ajmani (`useAssistant().voixEtat` : « enregistrement », puis « transcription ») ;
 *                  le message vocal de l'équipe (`VoiceRecorder`) n'a pas d'état lisible de l'extérieur : il
 *                  plafonne à 3 min, sous le plus court délai de veille (5 min, `reglage.ts`) ;
 *   vidéo          une balise <video> de la fenêtre en lecture (ni en pause, ni finie) — visionneuse de médias,
 *                  pièce jointe, écran partagé reçu : écouté par les événements de lecture, en phase de capture.
 *
 * Ce fichier ne garde que la règle (pure, éprouvée par `check:systeme-veille`) ; le branchement sur les
 * contextes est `useBlocageVeille.ts`.
 *
 * Tant qu'une source bloque, le minuteur d'inactivité est coupé (et un écran de veille ouvert se referme : un
 * appel qui sonne doit se voir) ; il repart du début quand plus rien ne bloque.
 */
export interface EtatBlocage {
  phase: CallPhase;
  sharingScreen: boolean;
  viewingScreen: boolean;
  controlledBy: string;
  controlling: boolean;
  voixEtat: EtatVocal;
  videoEnLecture: boolean;
}

export type RaisonBlocage = 'appel' | 'partage' | 'enregistrement' | 'video';

/** Ce qui empêche la veille en ce moment, ou `null`. Fonction pure. */
export function raisonDeBlocage(e: EtatBlocage): RaisonBlocage | null {
  if (e.phase !== 'idle' && e.phase !== 'ended') return 'appel';
  if (e.sharingScreen || e.viewingScreen || Boolean(e.controlledBy) || e.controlling) return 'partage';
  if (e.voixEtat === 'enregistrement' || e.voixEtat === 'transcription') return 'enregistrement';
  if (e.videoEnLecture) return 'video';
  return null;
}

/** Une vidéo de la fenêtre est-elle en lecture ? */
export function uneVideoJoue(doc: Pick<Document, 'querySelectorAll'> = document): boolean {
  for (const v of Array.from(doc.querySelectorAll('video'))) if (!v.paused && !v.ended) return true;
  return false;
}

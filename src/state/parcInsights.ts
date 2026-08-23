import { useEffect, useState } from 'react';
import { bridge } from '../lib/bridge';
import type { ParcInsights } from '../shared/api';

/**
 * LE RELEVÉ DU PARC, PARTAGÉ PAR LES ÉCRANS QUI LE REGARDENT (BLOCS E ET F)
 * ════════════════════════════════════════════════════════════════════════
 *
 * ## Pourquoi un magasin, et pas un `useEffect` par écran
 *
 * Deux écrans veulent ce relevé — le registre des organisations et la Tour de
 * contrôle — et la banderole de CHAQUE cliente veut y lire sa ligne. Un
 * `useEffect` par consommateur aurait donné autant de rondes de requêtes que de
 * composants montés, sur une donnée strictement identique pour tous.
 *
 * Ici la ronde est unique : elle démarre au premier abonné, s'arrête au
 * dernier, et tout le monde lit le même état. Un abonné qui arrive en cours de
 * route reçoit immédiatement la dernière valeur connue plutôt qu'un écran vide
 * le temps d'un aller-retour.
 *
 * ## Ce que « temps réel » veut dire ici, exactement
 *
 * La DONNÉE est réelle : le serveur compte ses sockets ouvertes et
 * authentifiées à l'instant où il répond (voir `connectionCounts` dans
 * amn-api/src/ws/hub.js). Rien n'est simulé, rien n'est déduit d'une « dernière
 * visite ».
 *
 * Le TRANSPORT jusqu'à cet écran, lui, est une interrogation périodique, pas
 * une poussée. Une cliente qui ferme son application disparaît donc du relevé
 * dans les quinze secondes, pas dans la seconde. C'est un choix, et il vaut
 * mieux l'écrire que le laisser croire : pousser la présence de TOUTES les
 * organisations vers la console demanderait au hub un canal transverse aux
 * organisations, alors qu'il est aujourd'hui construit pour n'en franchir
 * aucune — c'est précisément ce qui garantit qu'une cliente ne reçoit jamais
 * rien de l'espace d'une autre. Quinze secondes de retard sur un point vert ne
 * valent pas qu'on entame cette garantie-là.
 *
 * ## La ronde s'arrête quand la fenêtre n'est pas regardée
 *
 * `document.hidden` suffit : interroger le serveur toutes les quinze secondes
 * pour une fenêtre réduite depuis une heure ne sert personne. Au retour, on
 * redemande tout de suite plutôt que d'attendre le prochain tour — sinon
 * l'écran affiche, pendant quinze secondes, l'état du parc tel qu'il était
 * avant la pause.
 */

const INTERVALLE_MS = 15_000;

export interface ParcInsightsState {
  data: ParcInsights | null;
  /**
   * Vrai tant qu'aucune réponse n'est encore arrivée. Une fois le premier
   * relevé obtenu, les rondes suivantes se font en silence : faire clignoter
   * l'écran toutes les quinze secondes dirait « quelque chose a changé » alors
   * que, le plus souvent, rien n'a changé.
   */
  loading: boolean;
  /**
   * Vrai si la DERNIÈRE ronde a échoué.
   *
   * `data` garde alors la dernière valeur connue, et c'est délibéré : effacer
   * l'écran à la première requête ratée le ferait clignoter à chaque
   * micro-coupure. Mais l'écran doit pouvoir dire qu'il ne sait plus — afficher
   * « 0 connexion » sur un relevé périmé serait un de ces zéros auxquels on
   * finit par faire confiance.
   */
  stale: boolean;
}

let etat: ParcInsightsState = { data: null, loading: true, stale: false };
const abonnes = new Set<(s: ParcInsightsState) => void>();
let minuterie: ReturnType<typeof setInterval> | null = null;
let enVol = false;

function publier(next: ParcInsightsState) {
  etat = next;
  for (const abonne of abonnes) abonne(etat);
}

async function tourner() {
  // Une ronde à la fois. Sur une connexion lente, l'intervalle rattraperait la
  // requête précédente et on empilerait des appels au lieu d'en espacer.
  if (enVol) return;
  enVol = true;
  try {
    const data = await bridge().remote.admin.insights();
    publier({ data, loading: false, stale: false });
  } catch {
    publier({ data: etat.data, loading: false, stale: true });
  } finally {
    enVol = false;
  }
}

function onVisibilite() {
  if (document.hidden) return;
  void tourner();
}

/**
 * Combien d'abonnés ont besoin que la ronde CONTINUE fenêtre masquée.
 *
 * La règle par défaut — se taire quand personne ne regarde — est la bonne pour
 * un écran : interroger le serveur toutes les quinze secondes pour une fenêtre
 * réduite depuis une heure ne sert personne.
 *
 * Elle est fausse pour un SURVEILLANT. Un notificateur qui ne s'exécute que
 * pendant qu'on regarde l'application n'annonce jamais rien qu'on n'aurait pas
 * vu de toute façon — c'est-à-dire qu'il ne sert à rien. `document.hidden` est
 * vrai dès que la fenêtre est réduite, ce qui est exactement le moment où une
 * notification système a de la valeur.
 *
 * D'où ce compteur : tant qu'au moins un abonné demande l'arrière-plan, la
 * ronde continue. Dès qu'ils sont tous partis, on retrouve le comportement
 * économe.
 */
let abonnesArrierePlan = 0;

function demarrer() {
  if (minuterie) return;
  minuterie = setInterval(() => {
    if (!document.hidden || abonnesArrierePlan > 0) void tourner();
  }, INTERVALLE_MS);
  document.addEventListener('visibilitychange', onVisibilite);
  void tourner();
}

function arreter() {
  if (minuterie) clearInterval(minuterie);
  minuterie = null;
  document.removeEventListener('visibilitychange', onVisibilite);
}

/**
 * S'abonne au relevé du parc. À n'utiliser que dans les écrans d'AMN DevSec :
 * la route est réservée à l'opérateur, et l'édition Business n'embarque ni ces
 * écrans ni ce pont.
 */
export function useParcInsights(options?: {
  /**
   * Garder la ronde active même fenêtre masquée. Réservé à ce qui doit
   * réagir SANS qu'on regarde — un notificateur, typiquement. Un écran ne
   * doit pas le demander : il n'a rien à afficher quand personne ne le voit.
   */
  background?: boolean;
}): ParcInsightsState {
  const [snapshot, setSnapshot] = useState(etat);
  const background = options?.background ?? false;

  useEffect(() => {
    abonnes.add(setSnapshot);
    if (background) abonnesArrierePlan += 1;
    demarrer();
    // Le dernier relevé connu, tout de suite : un écran monté en cours de
    // ronde ne doit pas repasser par « je ne sais pas ».
    setSnapshot(etat);
    return () => {
      abonnes.delete(setSnapshot);
      if (background) abonnesArrierePlan -= 1;
      if (abonnes.size === 0) arreter();
    };
  }, [background]);

  return snapshot;
}

/**
 * Le relevé d'UNE organisation, ou `null` si le parc n'est pas encore connu.
 *
 * `null` ne veut pas dire « zéro » : l'appelant doit pouvoir distinguer « pas
 * de connexion » de « je ne sais pas encore », et n'a pas le droit d'écrire le
 * premier quand c'est le second.
 */
export function insightFor(state: ParcInsightsState, orgId: string) {
  return state.data?.orgs.find((o) => o.id === orgId) ?? null;
}

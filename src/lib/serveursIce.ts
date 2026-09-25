/**
 * LES SERVEURS ICE — un seul endroit, et un TURN qui s'ajoute sans recompiler.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## Le défaut que ce fichier corrige
 *
 * La liste des serveurs ICE était écrite DEUX fois, en dur :
 * `state/CallContext.tsx` (l'appel entre deux comptes) et
 * `screens/GuestCallScreen.tsx` (le visiteur invité par lien). Les deux
 * portaient les mêmes deux STUN publics de Google, et RIEN d'autre.
 *
 * Deux conséquences, et la seconde est celle qui se voit :
 *
 *   · deux copies d'une liste finissent toujours par diverger. Ajouter un TURN
 *     à l'une sans l'autre aurait donné un produit où l'appel entre collègues
 *     marche et l'appel avec un visiteur non ;
 *   · **sans TURN, un téléphone en 4G n'atteint pas un ordinateur en wifi.**
 *     Ce n'est pas une hypothèse : les opérateurs mobiles placent leurs
 *     abonnés derrière un CGNAT, dont la traduction d'adresse est
 *     *symétrique*. STUN apprend à un pair l'adresse publique qu'il présente
 *     à un serveur donné ; sur un NAT symétrique, cette adresse ne vaut QUE
 *     pour ce serveur, et le pair d'en face ne peut rien en faire. Il faut
 *     alors un relais — c'est exactement ce qu'est un TURN.
 *
 * Le commentaire d'en-tête de `CallContext.tsx` le disait déjà : « V1 uses
 * public STUN only, no TURN. That covers the common case (both peers behind
 * ordinary NAT) and fails honestly when it doesn't. » Le cas « téléphone ↔
 * ordinateur, deux réseaux » n'est pas le cas rare : c'est l'usage normal.
 *
 * ## Ce que ce fichier NE fait pas
 *
 * Il ne fournit pas de TURN. Un TURN est une INFRASTRUCTURE — un serveur qui
 * relaie des octets, donc de la bande passante et un coût. Il n'y en a pas
 * dans ce produit aujourd'hui, ni côté poste ni dans amn-api (vérifié).
 *
 * Ce fichier rend son ajout possible sans toucher au code : trois variables
 * de build, lues ici, et les deux chemins d'appel en bénéficient d'un coup.
 * Tant qu'elles sont vides, on retombe sur les STUN publics — le comportement
 * d'avant, à l'identique.
 *
 *     VITE_AMN_TURN_URL=turns:turn.exemple.net:5349   (plusieurs : séparées par des virgules)
 *     VITE_AMN_TURN_USER=…
 *     VITE_AMN_TURN_PASS=…
 *
 * `turns:` (TLS sur 5349) plutôt que `turn:` quand c'est possible : c'est le
 * seul qui traverse les réseaux d'entreprise qui ne laissent sortir que 443.
 *
 * ## Sur le secret
 *
 * Un identifiant TURN inliné dans un bundle web est LISIBLE par quiconque
 * ouvre l'application. C'est assumé et c'est l'usage courant, à condition que
 * le TURN émette des identifiants ÉPHÉMÈRES (REST API d'ephemeral credentials,
 * RFC 7635) plutôt qu'un couple permanent. Le jour où amn-api sait en délivrer,
 * `serveursIce()` deviendra asynchrone et les lira à la demande ; la forme est
 * prête pour ça, puisqu'un seul endroit décide.
 */

/**
 * Les STUN publics de repli. Ils suffisent quand les deux pairs sont derrière
 * un NAT ordinaire — deux postes du même bureau, ou deux abonnés fibre.
 */
const STUN_PUBLICS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/** Les trois variables de build qui décrivent le relais. */
export interface EnvTurn {
  VITE_AMN_TURN_URL?: string;
  VITE_AMN_TURN_USER?: string;
  VITE_AMN_TURN_PASS?: string;
}

/**
 * Ce que la configuration donne, et pourquoi. `raison` ne sert qu'au journal
 * de développement : l'écran, lui, ne connaît que `relaisDisponible()`.
 */
export type EtatTurn =
  | { actif: true; serveur: RTCIceServer }
  | { actif: false; raison: 'absent' | 'identifiants-manquants' | 'url-invalide'; urlsRejetees?: string[] };

/*
  Une URL que le navigateur accepte : `turn:` ou `turns:`, un hôte, un port
  facultatif, un `?transport=` facultatif. `new RTCPeerConnection` LÈVE une
  SyntaxError sur une URL qu'il ne comprend pas — « turn.amn.fr:3478 », sans
  schéma, suffit : l'appel planterait au lieu de retomber sur les STUN. On
  filtre donc ici, avant le navigateur.
*/
const URL_TURN = /^turns?:[^\s:?/]+(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/i;

/**
 * LA DÉCISION, sans `import.meta` : une fonction pure de trois chaînes, pour
 * que `check:appels` l'exécute dans Node avec les cas qui comptent (rien de
 * posé, URL seule, URL mal écrite, tout posé) au lieu de la croire sur parole.
 *
 * Plusieurs URL se séparent par des virgules — l'usage courant est
 * `turn:hôte:3478?transport=udp,turns:hôte:5349`. Les URL mal écrites sont
 * écartées une par une ; s'il n'en reste aucune, pas de relais.
 */
export function etatTurn(env: EnvTurn): EtatTurn {
  const brut = (env.VITE_AMN_TURN_URL || '').trim();
  if (!brut) return { actif: false, raison: 'absent' };
  const username = (env.VITE_AMN_TURN_USER || '').trim();
  const credential = (env.VITE_AMN_TURN_PASS || '').trim();
  /*
    Un TURN sans identifiants n'existe pas : la RFC 5766 exige
    l'authentification. Une URL posée seule serait un serveur que le navigateur
    essaierait et qui refuserait chaque allocation — c'est-à-dire trois
    secondes perdues à chaque appel, pour rien. On préfère ne pas l'annoncer.
  */
  if (!username || !credential) return { actif: false, raison: 'identifiants-manquants' };
  const candidates = brut.split(',').map((u) => u.trim()).filter(Boolean);
  const urls = candidates.filter((u) => URL_TURN.test(u));
  if (urls.length === 0) return { actif: false, raison: 'url-invalide', urlsRejetees: candidates };
  return { actif: true, serveur: { urls, username, credential } };
}

/** Les serveurs ICE pour une configuration donnée — STUN d'abord, le relais en dernier recours. */
export function serveursIcePour(env: EnvTurn): RTCIceServer[] {
  const etat = etatTurn(env);
  return etat.actif ? [...STUN_PUBLICS, etat.serveur] : STUN_PUBLICS;
}

/*
  LE JOURNAL DE DÉVELOPPEMENT — une ligne, une fois par session, au premier
  appel. C'est ce qu'on regarde le jour où le serveur est monté : « le build
  a-t-il bien reçu les trois variables ? ». Jamais en production (Vite retire
  la branche), et jamais l'identifiant ni le mot de passe, même en dev.
*/
let dejaDit = false;
function direEnDev(etat: EtatTurn): void {
  if (!import.meta.env.DEV || dejaDit) return;
  dejaDit = true;
  if (etat.actif) {
    const urls = ([] as string[]).concat(etat.serveur.urls);
    console.info(`[appels] relais TURN actif : ${urls.join(', ')} (identifiants posés). Les STUN publics restent essayés d'abord.`);
    return;
  }
  const pourquoi = {
    absent: 'VITE_AMN_TURN_URL est vide',
    'identifiants-manquants': 'VITE_AMN_TURN_URL est posée, mais VITE_AMN_TURN_USER ou VITE_AMN_TURN_PASS manque',
    'url-invalide': `aucune URL valable dans VITE_AMN_TURN_URL (lu : ${(etat.urlsRejetees ?? []).join(', ')}) — il faut « turn: » ou « turns: »`,
  }[etat.raison];
  console.info(`[appels] relais TURN inactif : ${pourquoi}. STUN publics seuls.`);
}

/** L'environnement de ce build — lu en accès statiques, que Vite remplace à la construction. */
function envDuBuild(): EnvTurn {
  return {
    VITE_AMN_TURN_URL: import.meta.env.VITE_AMN_TURN_URL,
    VITE_AMN_TURN_USER: import.meta.env.VITE_AMN_TURN_USER,
    VITE_AMN_TURN_PASS: import.meta.env.VITE_AMN_TURN_PASS,
  };
}

/**
 * Les serveurs ICE, dans l'ordre où le navigateur doit les essayer :
 * les STUN d'abord (une connexion directe coûte moins qu'un relais), le TURN
 * en dernier recours. C'est ICE qui arbitre, pas nous — mais l'ordre de la
 * liste est ce qui lui dit quoi préférer à coût égal.
 */
export function serveursIce(): RTCIceServer[] {
  const env = envDuBuild();
  direEnDev(etatTurn(env));
  return serveursIcePour(env);
}

/**
 * Y a-t-il un relais ? Les deux écrans d'appel s'en servent pour ÉCRIRE LA
 * VRAIE PHRASE quand la connexion échoue.
 *
 * Sans TURN, « votre réseau la bloque peut-être » accuse le réseau de la
 * personne d'un défaut qui est le nôtre : rien n'était prévu pour ce cas. Avec
 * un TURN, l'échec est réellement du côté du réseau, et la phrase devient
 * juste. Une garde-fou d'honnêteté, pas une chaîne de plus.
 */
export function relaisDisponible(): boolean {
  return etatTurn(envDuBuild()).actif;
}

/**
 * Ce qu'on affiche quand la voie audio n'a pas pu s'établir. Deux phrases,
 * parce que ce sont deux situations différentes et deux gestes différents.
 */
export function phraseEchecConnexion(): string {
  return relaisDisponible()
    ? 'La connexion audio n’a pas pu s’établir. Vérifiez votre réseau et réessayez.'
    : 'La connexion audio n’a pas pu s’établir entre ces deux réseaux. C’est attendu entre un téléphone en données mobiles et un poste en wifi : il manque un relais côté AMN.';
}

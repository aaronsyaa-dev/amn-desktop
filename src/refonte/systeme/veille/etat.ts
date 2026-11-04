import type { EtatGarde } from '../../../socle/coquille';
import type { TonVivant } from '../../../socle/ui/vivant/tons';

/**
 * CE QUE DIT LA PASTILLE DE L'ÉCRAN DE VEILLE (G09) — l'état global de La Garde, rien d'autre.
 *
 * L'état vient de la MÊME règle que la pastille de l'en-tête de la coquille (`usePoulsGarde`,
 * `src/refonte/coquille/pouls.ts` : le `niveau` du pouls de la Garde, « inconnu » après trois lectures
 * manquées) ; le réseau du poste passe avant (hors ligne, on ne sait plus rien de neuf). Fonctions pures.
 *
 *   calme      point vert vivant  « La Garde veille · tout est en ordre · prochaine ronde 12:30 »
 *   attention  point orange fixe  « La Garde veille · un point demande votre attention · prochaine ronde … »
 *   critique   point rouge FIXE   « La Garde veille · une alerte critique » — aucun détail, ni ronde
 *   horsLigne  point orange fixe  « Hors connexion · La Garde reprend au retour du réseau »
 *   inconnu    point bleu fixe    « La Garde ne répond pas » (le mot de l'en-tête : on ne dit pas « en ordre »)
 */
export type EtatPastille = 'calme' | 'attention' | 'critique' | 'horsLigne' | 'inconnu';

export function etatPastille(garde: EtatGarde, enLigne: boolean): EtatPastille {
  if (!enLigne) return 'horsLigne';
  return garde;
}

export const TON_PASTILLE: Record<EtatPastille, TonVivant> = { calme: 'ok', attention: 'attention', critique: 'critique', horsLigne: 'attention', inconnu: 'info' };

/** Le seul point qui vit (l'onde) : « tout est en ordre ». Au rouge, le point reste fixe. */
export function pointVivant(etat: EtatPastille): boolean {
  return etat === 'calme';
}

/** La prochaine ronde ne se dit que quand La Garde tient l'heure : ni au rouge, ni hors ligne, ni sans réponse. */
export function rondeMontree(etat: EtatPastille): boolean {
  return etat === 'calme' || etat === 'attention';
}

/**
 * LA PROCHAINE RONDE — la plus proche `prochaineRondeAt` À VENIR parmi les gardes actives (la Salle de la Garde,
 * `garde.salle()`, déjà lue par la source des bureaux). Rien d'autre n'est lu des gardes. `null` quand aucune
 * n'est annoncée : l'écran n'invente pas d'heure.
 */
export function prochaineRonde(agents: readonly { actif: boolean; prochaineRondeAt: string | null }[], maintenant: Date): Date | null {
  const t0 = maintenant.getTime();
  let meilleure: number | null = null;
  for (const a of agents) {
    if (!a.actif || !a.prochaineRondeAt) continue;
    const t = Date.parse(a.prochaineRondeAt);
    if (!Number.isFinite(t) || t < t0) continue;
    if (meilleure === null || t < meilleure) meilleure = t;
  }
  return meilleure === null ? null : new Date(meilleure);
}

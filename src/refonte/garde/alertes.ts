/**
 * ALERTES CRITIQUES QUAND L'APP EST FERMÉE — le contrat côté app (S3).
 *
 * RIEN N'EST ENVOYÉ D'ICI. Ce fichier fixe ce que le poste et amn-api devront
 * se dire : les types d'alerte, le seuil « critique », les préférences, et la
 * forme d'une alerte. L'envoi (Web Push, e-mail) est le travail d'amn-api,
 * décrit dans `docs/refonte-alertes.md`.
 *
 * Le principe : quand l'app est fermée, on ne réveille personne pour autre
 * chose que le critique. Le reste attend le résumé du matin. Une alerte de
 * trop, et la personne coupe tout — la nuit où ça compte, plus rien ne passe.
 */

/** Les seuls types qui peuvent traverser l'app fermée. */
export const TYPES_ALERTE_CRITIQUE = ['incident-critique', 'escalade', 'site-muet', 'garde-en-echec', 'remontee-critique'] as const;
export type TypeAlerteCritique = (typeof TYPES_ALERTE_CRITIQUE)[number];

export type CanalAlerte = 'notification' | 'email';

/**
 * Le seuil, type par type. Un signal qui ne le passe pas n'est PAS une alerte
 * app fermée : il reste dans la pile et le résumé.
 *
 *   incident-critique  un incident de gravité `critical` est OUVERT (le premier
 *                      signal d'un incident, jamais un par alerte : une IP qui
 *                      mitraille fait un incident, donc une alerte) ;
 *   escalade           le même incident est resté sans preneur au-delà du délai
 *                      d'escalade du serveur (déjà compté par amn-api) ;
 *   site-muet          un site suivi ne répond plus depuis `siteMuetMinutes` ;
 *   garde-en-echec     une garde a échoué `gardeEchecsConsecutifs` rondes de suite ;
 *   remontee-critique  la Garde ouvre une remontée de gravité `critique`.
 */
export interface SeuilsCritiques {
  siteMuetMinutes: number;
  gardeEchecsConsecutifs: number;
  /** Une même clé (incident, site, garde) ne ressonne pas avant ce délai. */
  silenceRepetitionMinutes: number;
}

export const SEUILS_CRITIQUES_DEFAUT: SeuilsCritiques = {
  siteMuetMinutes: 15,
  gardeEchecsConsecutifs: 3,
  silenceRepetitionMinutes: 60,
};

/** Un signal tel que le serveur le voit, avant de décider s'il sonne. */
export type SignalAlerte =
  | { type: 'incident-critique'; incidentId: string; siteId: string; severite: 'critical' | 'high' | 'medium' | 'low'; premierDeLIncident: boolean }
  | { type: 'escalade'; incidentId: string; siteId: string; prisPar: string | null }
  | { type: 'site-muet'; siteId: string; muetDepuisMinutes: number }
  | { type: 'garde-en-echec'; agent: string; equipe: string; echecsConsecutifs: number }
  | { type: 'remontee-critique'; remonteeId: string; equipe: string; gravite: 'critique' | 'haute' | 'normale' };

/** Le seuil « critique ». La même règle doit être appliquée par amn-api. */
export function estCritique(s: SignalAlerte, seuils: SeuilsCritiques = SEUILS_CRITIQUES_DEFAUT): boolean {
  switch (s.type) {
    case 'incident-critique':
      return s.severite === 'critical' && s.premierDeLIncident;
    case 'escalade':
      return s.prisPar === null;
    case 'site-muet':
      return s.muetDepuisMinutes >= seuils.siteMuetMinutes;
    case 'garde-en-echec':
      return s.echecsConsecutifs >= seuils.gardeEchecsConsecutifs;
    case 'remontee-critique':
      return s.gravite === 'critique';
  }
}

/** La clé de regroupement : une seule alerte par clé dans `silenceRepetitionMinutes`. */
export function cleDAlerte(s: SignalAlerte): string {
  switch (s.type) {
    case 'incident-critique':
    case 'escalade':
      return `${s.type}:${s.incidentId}`;
    case 'site-muet':
      return `site-muet:${s.siteId}`;
    case 'garde-en-echec':
      return `garde-en-echec:${s.agent}`;
    case 'remontee-critique':
      return `remontee-critique:${s.remonteeId}`;
  }
}

/**
 * Les préférences d'une personne. Stockées côté serveur (le poste est fermé
 * quand elles servent), par compte. Par défaut : tout le critique, par les
 * deux canaux. Le silence de nuit de la Garde NE s'applique PAS au critique :
 * c'est précisément la nuit qu'il compte.
 */
export interface PreferencesAlertesCritiques {
  version: 1;
  canaux: Record<CanalAlerte, boolean>;
  types: Record<TypeAlerteCritique, boolean>;
  /** Adresse d'envoi. `null` = l'adresse du compte. Jamais une autre sans vérification. */
  email: string | null;
}

export const PREFERENCES_ALERTES_DEFAUT: PreferencesAlertesCritiques = {
  version: 1,
  canaux: { notification: true, email: true },
  types: { 'incident-critique': true, escalade: true, 'site-muet': true, 'garde-en-echec': true, 'remontee-critique': true },
  email: null,
};

/** Relit des préférences venues du serveur ou du stockage : tout champ manquant prend le défaut. */
export function normaliserPreferences(brut: unknown): PreferencesAlertesCritiques {
  const p = (brut && typeof brut === 'object' ? brut : {}) as Partial<PreferencesAlertesCritiques>;
  const canaux = { ...PREFERENCES_ALERTES_DEFAUT.canaux };
  for (const c of Object.keys(canaux) as CanalAlerte[]) if (typeof p.canaux?.[c] === 'boolean') canaux[c] = p.canaux[c];
  const types = { ...PREFERENCES_ALERTES_DEFAUT.types };
  for (const t of TYPES_ALERTE_CRITIQUE) if (typeof p.types?.[t] === 'boolean') types[t] = p.types[t];
  const email = typeof p.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ? p.email : null;
  return { version: 1, canaux, types, email };
}

/** Les canaux par lesquels CE signal partirait pour CETTE personne. Vide = rien ne part. */
export function canauxPour(s: SignalAlerte, prefs: PreferencesAlertesCritiques, seuils: SeuilsCritiques = SEUILS_CRITIQUES_DEFAUT): CanalAlerte[] {
  if (!estCritique(s, seuils) || !prefs.types[s.type]) return [];
  return (Object.keys(prefs.canaux) as CanalAlerte[]).filter((c) => prefs.canaux[c]);
}

/**
 * Ce qu'amn-api pousse au service worker (`public/sw.js`, `kind`) et met dans
 * l'e-mail. Des identifiants et un texte court ; jamais un secret, jamais le
 * contenu d'un message de cliente. `vers` est une route de l'app (HashRouter).
 */
export interface AlerteCritique {
  kind: 'alerte-critique';
  type: TypeAlerteCritique;
  cle: string;
  titre: string;
  corps: string;
  vers: string;
  at: string;
}

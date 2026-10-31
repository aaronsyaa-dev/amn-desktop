/**
 * LES VALEURS SENSIBLES ET CE QU'AJMANI NE FAIT JAMAIS — logique pure, sans React.
 *
 * Trois règles de la charte (G05, rubrique 6) vivent ici, pour qu'un contrôle
 * puisse les rejouer sans navigateur :
 *
 *   · une valeur sensible (carte, IBAN, clé, jeton) ne s'affiche que masquée
 *     (« •••• 4242 ») et n'entre ni dans l'historique ni dans le journal ;
 *   · Ajmani ne déclenche jamais un paiement, un remboursement ni un virement :
 *     il renvoie vers l'écran concerné, où la personne valide elle-même ;
 *   · le coffre-fort, les accès et les clés sont hors de son périmètre.
 */

/** Sans accent, sans casse, ponctuation changée en espaces : la forme sur laquelle on compare. */
export function aplatir(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`\-–—/·,.;:!?()«»"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** « •••• 4242 » : on ne garde que les quatre derniers caractères utiles. */
export function masquerValeur(valeur: string): string {
  const brut = valeur.replace(/[\s-]/g, '');
  if (brut.length <= 4) return '••••';
  return `•••• ${brut.slice(-4)}`;
}

/* Un numéro de carte : 13 à 19 chiffres, par groupes ou d'un bloc. */
const CARTE = /\b(?:\d[ -]?){12,18}\d\b/g;
/* Un IBAN : deux lettres, deux chiffres, puis de quoi remplir un compte. */
const IBAN = /\b[A-Za-z]{2}\d{2}(?:[ ]?[A-Za-z0-9]{4}){3,7}(?:[ ]?[A-Za-z0-9]{1,4})?\b/g;
/* Une clé ou un jeton : préfixes d'usage, ou un long mot mêlant lettres et chiffres. */
const CLE = /\b(?:sk|pk|rk|whsec|ghp|xox[abp])[_-][A-Za-z0-9_-]{8,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}/g;
const JETON_LONG = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{24,}\b/g;

/** Remplace toute valeur sensible d'un texte par sa forme masquée. */
export function masquerSensibles(texte: string): string {
  return texte
    .replace(CLE, '••••')
    .replace(IBAN, (m) => masquerValeur(m))
    .replace(CARTE, (m) => masquerValeur(m))
    .replace(JETON_LONG, '••••');
}

/* Les mots qui annoncent un secret : la demande entière est alors laissée de côté. */
const MOT_DE_SECRET = /\b(mot de passe|mots de passe|mdp|password|passcode|jeton|token|secret|cle api|api key|cle privee|code pin|cvv|cryptogramme)\b/;

/** Nombre de caractères au-delà duquel une « demande » ressemble à un message collé : on ne la garde pas. */
export const LONGUEUR_MAX_DEMANDE = 160;

/**
 * Ce qu'on peut retenir d'une demande : son texte seul, masqué s'il portait une valeur sensible.
 * `null` : on ne la garde pas (secret annoncé, texte trop long pour être une demande, ou vide).
 */
export function assainirDemande(texte: string): string | null {
  const net = texte.replace(/\s+/g, ' ').trim();
  if (!net || net.length > LONGUEUR_MAX_DEMANDE) return null;
  if (MOT_DE_SECRET.test(aplatir(net))) return null;
  return masquerSensibles(net);
}

export type CategorieInterdite = 'paiement' | 'coffre';

const PAIEMENT = /\b(payer|payez|regler|reglez|rembourser|rembourse|remboursez|remboursement|virer|virez|virement|encaisser|prelever|pay|refund|wire)\b/;
const COFFRE = /\b(coffre|coffre fort|vault|mot de passe|mots de passe|password|identifiants?|cle api|api key|cles? secretes?|jeton|token|acces)\b/;

/**
 * La demande touche-t-elle à ce qu'Ajmani ne fait jamais ?
 * Un paiement n'est jamais déclenché d'ici ; le coffre-fort et les accès sont hors périmètre.
 * Le verbe d'action est cherché tel quel : « les factures payées » (un participe) ne déclenche rien.
 */
export function categorieInterdite(texte: string): CategorieInterdite | null {
  const t = aplatir(texte);
  if (COFFRE.test(t)) return 'coffre';
  if (PAIEMENT.test(t)) return 'paiement';
  return null;
}

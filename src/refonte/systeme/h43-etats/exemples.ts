/**
 * Les valeurs D'EXEMPLE de la page de démonstration H43 — FICTIVES, jamais des données réelles.
 *
 * Elles vivent ici, à part de `PageEtatsMessages.tsx` (qui n'a aucun nom en dur : `check:socle-situations` le
 * vérifie) et de `i18n.ts`. La page les reçoit en props ; sans props, elle prend celles-ci. Un écran réel passe
 * ses propres noms : c'est tout l'intérêt des variables {objet}, {terme}, {prenom}.
 *
 * Les longueurs ressemblent à celles de la maquette, pour que les retours à la ligne tombent aux mêmes endroits.
 */
export interface ExempleH43 {
  /** L'objet au singulier et en minuscules. */
  objet: string;
  /** Les objets au pluriel, sans déterminant. */
  objets: string;
  /** Ce que la personne a tapé (et que rien ne trouve). */
  terme: string;
  /** L'élément proche qu'on propose (tolérance aux fautes de frappe). */
  proche: string;
  /** Le prénom de qui peut accorder l'accès. */
  prenomAdmin: string;
  /** Le nom de l'élément à supprimer. */
  nomSupprime: string;
  /** Le destinataire de la facture envoyée. */
  nomClientFacture: string;
  /** Le prénom de l'autre personne sur la page. */
  prenomCollaborateur: string;
  /** Les personnes affichées en avatars (initiales), vous en premier. */
  noms: string[];
}

export const EXEMPLE_H43: ExempleH43 = {
  objet: 'client',
  objets: 'clients',
  terme: 'exmple',
  proche: 'Société exemple',
  prenomAdmin: 'Alex',
  nomSupprime: 'Client exemple',
  nomClientFacture: 'Exemple SA',
  prenomCollaborateur: 'Sacha',
  noms: ['Robin', 'Sacha'],
};

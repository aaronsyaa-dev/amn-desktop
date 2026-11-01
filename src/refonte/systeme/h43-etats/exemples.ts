/**
 * Les valeurs D'EXEMPLE de la page de démonstration H43 — FICTIVES, jamais des données réelles.
 *
 * Elles vivent ici, à part de `PageEtatsMessages.tsx` (qui n'a aucun nom en dur : `check:socle-situations` le
 * vérifie) et de `i18n.ts`. La page les reçoit en props ; sans props, elle prend celles-ci. Un écran réel passe
 * ses propres noms : c'est tout l'intérêt des variables {objet}, {terme}, {prenom}.
 *
 * Les noms sont NEUTRES (« Client A », « Alex ») : la planche montre la forme, pas une histoire. L'aperçu de capture
 * (`scripts/apercu/ecrans/H43.tsx`) passe ceux de la maquette, qui ne vivent que là. Les longueurs ressemblent à
 * celles de la maquette, pour que les retours à la ligne tombent aux mêmes endroits.
 */
export type StatutFactureExemple = 'envoyee' | 'retard' | 'payee';

export interface ExempleH43 {
  /* 1 — Vide (Clients). */
  /** L'objet au singulier et en minuscules. */
  objet: string;
  /* 2 — Chargement (Facturation). */
  /** Les objets au pluriel, sans déterminant. */
  objets: string;
  /* 3 — Hors ligne (Messagerie). */
  enAttente: number;
  /** Le correspondant de la conversation (son prénom). */
  correspondant: string;
  messageRecu: string;
  messageEnvoye: string;
  /* 4 — Droits manquants (Coffre-fort). */
  /** Le prénom de qui peut accorder l'accès. */
  prenomAdmin: string;
  /** Le prénom de la personne connectée. */
  prenomConnecte: string;
  /* 5 — Aucun résultat (Documents). */
  /** Ce que la personne a tapé (et que rien ne trouve). */
  terme: string;
  /** L'élément proche qu'on propose (tolérance aux fautes de frappe). */
  proche: string;
  /* 6 — Confirmation (Clients). */
  /** La liste derrière le voile ; `detail` à droite (« client », « fiche d'essai »). */
  liste: ReadonlyArray<{ nom: string; detail?: string }>;
  /** Le rang, dans `liste`, de l'élément à supprimer (sa ligne reste visible derrière le voile). */
  rangSupprime: number;
  /* 7 — Succès discret (Facturation). */
  factures: ReadonlyArray<{ numero: string; client: string; montant: number; statut: StatutFactureExemple }>;
  /** Le destinataire de la facture envoyée (le titre du toast). */
  nomClientFacture: string;
  /** Les secondes restantes à l'instant montré (la barre se vide en 8 s). */
  secondesRestantes: number;
  /* 8 — Deux personnes (Notes et pages). */
  /** Le prénom de l'autre personne sur la page. */
  prenomCollaborateur: string;
  /** Les personnes affichées en avatars (initiales), vous en premier. */
  noms: string[];
  titrePage: string;
  paragraphe: string;
  /** La seconde ligne : un début, puis le passage que l'autre personne vient d'écrire (surligné). */
  debutModifie: string;
  passageModifie: string;
  /* 9 — Erreur (Prévisions). */
  objetsErreur: string;
  genreErreur: 'masculin' | 'feminin';
  /** L'heure de la dernière valeur connue. */
  heureDerniere: string;
  /** Les dernières valeurs connues de la courbe (de 0 à 1), grisées. */
  courbe: readonly number[];
  /** Le prochain essai automatique, en secondes. */
  prochainEssai: number;
}

export const EXEMPLE_H43: ExempleH43 = {
  objet: 'client',
  objets: 'factures',
  enAttente: 2,
  correspondant: 'Alex',
  messageRecu: 'Tu peux passer chez le client A cet après-midi ?',
  messageEnvoye: 'Oui, j’y suis à 15 h. Je prends le dossier.',
  prenomAdmin: 'Alex',
  prenomConnecte: 'Robin',
  terme: 'exmple',
  proche: 'Document exemple',
  liste: [{ nom: 'Client A', detail: 'client' }, { nom: 'Client B', detail: 'fiche d’essai' }, { nom: 'Client C' }, { nom: 'Client D' }, { nom: 'Client E' }],
  rangSupprime: 1,
  factures: [
    { numero: 'F-0003', client: 'Client A', montant: 2400, statut: 'envoyee' },
    { numero: 'F-0002', client: 'Client B', montant: 640, statut: 'retard' },
    { numero: 'F-0001', client: 'Client C', montant: 1800, statut: 'payee' },
  ],
  nomClientFacture: 'Client A',
  secondesRestantes: 6,
  prenomCollaborateur: 'Sacha',
  noms: ['Robin', 'Sacha'],
  titrePage: 'Compte rendu · Client A',
  paragraphe: 'Le tableau de bord affiche de nouveau les utilisateurs actifs.',
  debutModifie: 'Cause : ',
  passageModifie: 'une session expirée, renouvelée à 10:31',
  objetsErreur: 'prévisions',
  genreErreur: 'feminin',
  heureDerniere: '10:12',
  courbe: [0.12, 0.2, 0.18, 0.3, 0.34, 0.31, 0.46, 0.55, 0.52, 0.72],
  prochainEssai: 20,
};

import type { UserRole } from '../shared/api';

/**
 * LES RÔLES, DITS DANS LA LANGUE DU MÉTIER (BLOC 6)
 * ═════════════════════════════════════════════════
 *
 * `owner`, `admin`, `member` sont des mots de développeur. Ils décrivent des
 * droits, ce qui est exactement ce dont une cliente n'a pas à s'occuper : la
 * personne qui tient la boutique se voit comme la gérante, pas comme la
 * propriétaire d'un enregistrement, et celle qui vend se voit comme vendeuse,
 * pas comme « membre ».
 *
 * ## Ce qui change, et ce qui ne change pas
 *
 * Uniquement l'INTITULÉ. Les droits restent `owner`/`admin`/`member`, arbitrés
 * par amn-api, et rien ici n'est lu par une décision d'autorisation — ce
 * fichier ne sait que traduire. C'est important : un jour où l'on ajoutera un
 * métier, on n'ouvrira aucun droit par erreur en le nommant.
 *
 * ## Pourquoi les intitulés vivent ici et la liste des métiers sur le serveur
 *
 * La liste des métiers (`ORG_TRADES`, amn-api) est validée à l'écriture : le
 * serveur refuse un métier qu'il ne connaît pas, comme il refuse un module
 * inconnu. Les intitulés, eux, sont de la langue d'interface, au même endroit
 * que le reste de la langue d'interface. `npm run check:modules` tient
 * l'accord entre les deux listes d'identifiants, pour qu'un métier ajouté d'un
 * côté ne reste pas muet de l'autre.
 *
 * ## Sans métier connu
 *
 * On retombe sur les intitulés génériques. Les organisations créées avant que
 * ce champ existe n'ont pas de métier, et leur en supposer un afficherait
 * « Gérante » à quelqu'un qui dirige une association — un mot faux dit avec
 * l'aplomb d'une donnée saisie. Le générique ne ment sur personne.
 */

/** Les intitulés quand le métier est inconnu. Justes partout, parlants nulle part. */
const GENERIQUES: Record<UserRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  guest: 'Invité',
};

/**
 * Par métier. Un métier absent de cette table retombe sur les génériques —
 * c'est délibérément permissif : un métier ajouté côté serveur doit s'afficher
 * correctement avant même qu'on ait choisi ses mots, plutôt que rendre une
 * case vide.
 *
 * `guest` n'est jamais renommé : ce n'est pas un siège de travail mais
 * quelqu'un qui passe pour un appel, et « invité » se dit de la même façon
 * dans tous les métiers.
 */
const PAR_METIER: Record<string, Partial<Record<UserRole, string>>> = {
  boutique: { owner: 'Gérante', admin: 'Responsable', member: 'Vendeur' },
  services: { owner: 'Dirigeant', admin: 'Chef de projet', member: 'Intervenant' },
  evenementiel: { owner: 'Organisateur', admin: 'Régisseur', member: 'Équipier' },
  artisan: { owner: 'Chef d’entreprise', admin: 'Chef de chantier', member: 'Compagnon' },
  collectif: { owner: 'Président', admin: 'Bureau', member: 'Adhérent' },
};

/** L'intitulé d'un rôle pour ce métier, ou l'intitulé générique. */
export function roleLabel(role: string, trade?: string | null): string {
  const cle = role as UserRole;
  const metier = trade ? PAR_METIER[trade] : undefined;
  return metier?.[cle] ?? GENERIQUES[cle] ?? role;
}

/**
 * Les intitulés d'un métier, dans l'ordre des droits (du plus large au plus
 * étroit) — pour les écrans qui font CHOISIR un rôle plutôt que d'en afficher un.
 */
export function assignableRoles(trade?: string | null): { role: UserRole; label: string }[] {
  // `guest` n'y figure pas : on n'attribue pas ce rôle depuis un écran
  // d'administration, il naît d'un lien d'appel.
  return (['owner', 'admin', 'member'] as UserRole[]).map((role) => ({
    role,
    label: roleLabel(role, trade),
  }));
}

/** Les métiers connus du desktop. `check:modules` les compare à `ORG_TRADES`. */
export const TRADES_WITH_ROLE_LABELS = Object.keys(PAR_METIER);

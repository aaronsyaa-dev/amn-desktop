import type { VaultTransfer } from '../state/useVault';

/** Le type d'accès remis à une organisation cliente. */
export type OrgHandoverKind = 'password' | 'invitation';

export interface OrgAccessSecret {
  orgName: string;
  /** Le compte propriétaire de l'organisation cliente. */
  email: string;
  secret: string;
  kind: OrgHandoverKind;
  /** ISO — un jeton d'activation périme ; un mot de passe temporaire, non. */
  expiresAt?: string;
}

/**
 * L'entrée de coffre-fort d'un accès d'organisation cliente.
 *
 * Écrite ici, une fois, parce qu'elle est produite depuis DEUX écrans qui ne se
 * connaissent pas : la création d'une organisation (rail) et le panneau
 * Administration de son contexte (réémission, mot de passe perdu). Les laisser
 * chacun composer sa version donnerait, dans la même rubrique, deux formats de
 * libellé et deux façons d'écrire la même chose — et surtout des clés
 * différentes, donc des doublons au lieu d'une mise à jour.
 *
 * La clé est l'adresse du compte propriétaire : c'est ce qui ne bouge pas quand
 * on réémet un accès, et c'est ce qu'on cherche quand on revient six mois plus
 * tard avec au téléphone une cliente qui ne sait plus se connecter.
 */
export function organizationTransfer(input: OrgAccessSecret): VaultTransfer {
  const emitted = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const notes = [
    `Organisation : ${input.orgName}`,
    `Compte propriétaire : ${input.email}`,
    input.kind === 'password'
      ? 'Mot de passe temporaire — ne périme pas, à faire changer à la première connexion.'
      : 'Jeton d’activation — usage unique, la cliente choisit son mot de passe.',
    input.expiresAt
      ? `Expire le : ${new Date(input.expiresAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`
      : null,
    `Émis le : ${emitted}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    category: 'orgs',
    label: `${input.orgName} — compte propriétaire`,
    subject: input.email,
    secret: input.secret,
    notes,
  };
}

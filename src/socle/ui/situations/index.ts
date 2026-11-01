/**
 * Les briques du groupe « situations » (LOT-00, écran H43) : ce qu'on montre quand il n'y a rien, quand ça charge,
 * quand ça casse, quand il faut confirmer, quand c'est fait, quand on n'est pas seul sur la page.
 * Mode d'emploi : docs/refonte-socle.md.
 *
 *   import { EtatVideInvitation, EtatChargement, DialogueConfirmation, FournisseurToasts, useToastsSocle } from '../socle/ui';
 */
export {
  BlocEtat,
  EtatVideInvitation,
  EtatHorsConnexion,
  EtatAccesRefuse,
  EtatAucunResultat,
  EtatErreurChargement,
  type BlocEtatProps,
  type TonEtat,
  type EtatVideInvitationProps,
  type EtatHorsConnexionProps,
  type EtatAccesRefuseProps,
  type EtatAucunResultatProps,
  type EtatErreurChargementProps,
} from './BlocEtat';
export { SqueletteLignes, EtatChargement, useChargementDiffere, type EtatChargementProps } from './Squelettes';
export { DialogueConfirmation, DialogueConfirmationEnPlace, type DialogueConfirmationProps } from './DialogueConfirmation';
export { Toast, FournisseurToasts, useToastsSocle, type ToastProps, type NotificationToast, type ToastsSocle } from './Toasts';
export { AvisCollaboration, type AvisCollaborationProps } from './AvisCollaboration';
export { SANS_ACTION } from './statique';
export type { TypeToast, EtatChargementDiffere } from './regles';

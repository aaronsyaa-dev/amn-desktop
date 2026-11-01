import React from 'react';
import { PageNotifications } from './notifications';
import { useToastsSocle } from '../../socle/ui/situations';

/**
 * LA PAGE NOTIFICATIONS, BRANCHÉE (H40) — la page elle-même ne connaît pas les toasts : elle remet à l'appelant de
 * quoi annuler (« Reportée… », « Tout est lu »), et c'est ici qu'un toast avec « Annuler » (8 s) est posé.
 */
export function PageNotificationsRoute() {
  const { notifier } = useToastsSocle();
  return <PageNotifications surAnnulable={({ message, annuler }) => notifier({ type: 'succes', titre: message, annuler })} />;
}

export default PageNotificationsRoute;

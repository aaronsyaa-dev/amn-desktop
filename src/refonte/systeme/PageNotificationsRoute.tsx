import React from 'react';
import { PageNotifications } from './notifications';
import { useMots } from './notifications/i18n';
import { usePageCoquille } from '../coquille/page';
import { useToastsSocle } from '../../socle/ui/situations';

/**
 * LA PAGE NOTIFICATIONS, BRANCHÉE (H40) — la page elle-même ne connaît pas les toasts : elle remet à l'appelant de
 * quoi annuler (« Reportée… », « Tout est lu »), et c'est ici qu'un toast avec « Annuler » (8 s) est posé.
 *
 * Elle dit aussi à la coquille v3 ce qu'elle est (`usePageCoquille`) : « Ma journée / Notifications », l'Accueil
 * allumé (Notifications n'a pas d'entrée propre), et le texte de la barre Ajmani de la fiche (rubrique 3, Z5).
 */
export function PageNotificationsRoute() {
  const { notifier } = useToastsSocle();
  const { tm } = useMots();
  usePageCoquille({ famille: 'jour', sousPage: 'home', miettes: [{ libelle: tm('page.titre') }], ajmani: tm('page.ajmani') });
  return <PageNotifications surAnnulable={({ message, annuler }) => notifier({ type: 'succes', titre: message, annuler })} />;
}

export default PageNotificationsRoute;

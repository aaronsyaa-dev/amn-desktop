import { useMemo } from 'react';
import { useAutomations, type Declencheur } from '../state/useAutomations';
import { useLangue } from '../i18n';

/**
 * Le moteur des automatisations, monté dans la mise en page : il tourne tant
 * qu'un poste est ouvert, pas seulement quand l'écran Automatisations l'est.
 * Ne rend rien.
 */
export function AutomationsRunner() {
  const { t } = useLangue();
  const libelles = useMemo<Record<Declencheur, (a: string, b: string) => string>>(
    () => ({
      formAnswer: (formulaire, premiere) => t('automatisations.produit.formAnswer', { formulaire, premiere }),
      invoiceOverdue: (client, numero) => t('automatisations.produit.invoiceOverdue', { client, numero }),
      ticketOpened: (sujet, client) => t('automatisations.produit.ticketOpened', { sujet, client }),
      prospectWon: (nom, societe) => t('automatisations.produit.prospectWon', { nom, societe }),
      stockLow: (article, quantite) => t('automatisations.produit.stockLow', { article, quantite }),
    }),
    [t],
  );
  useAutomations(libelles);
  return null;
}

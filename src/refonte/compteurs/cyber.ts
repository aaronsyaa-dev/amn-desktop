import { useMemo } from 'react';
import { useCyber } from '../../bureaux/donnees/cyber';
import { declarerCompteurs } from '../coquille/declarerCompteurs';

/**
 * LE COMPTEUR DE CYBER (toujours là dans SURVEILLANCE, §1.10) : les alertes
 * ouvertes du SOC, celles de la console Cyber (`useCyber().alertes`). Tant que
 * la source n'a pas répondu, rien n'est déclaré : la barre ne montre pas de
 * compteur inventé (et pas un zéro).
 */
function useCompteurs(): Record<string, number> {
  const modele = useCyber();
  const alertes = modele.pret ? modele.alertes.length : null;
  return useMemo(() => {
    const compteurs: Record<string, number> = {};
    if (alertes !== null) compteurs['/cyber'] = alertes;
    return compteurs;
  }, [alertes]);
}

export default declarerCompteurs({ famille: 'cyber', useCompteurs });

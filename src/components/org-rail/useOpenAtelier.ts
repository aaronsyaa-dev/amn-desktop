import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgContext } from '../../state/OrgContextContext';

/**
 * OUVRIR L'ATELIER, D'OÙ QU'ON PARTE (BLOC E)
 * ═══════════════════════════════════════════
 *
 * Il y avait DEUX chemins de création : l'Atelier (profil métier, curseurs,
 * aperçu vivant, lien d'installeur) et une boîte de dialogue rapide dans le
 * rail. Le rapport précédent les qualifiait lui-même de « redondance assumée,
 * pas une élégance ». C'en était une : deux formes pour un même geste obligent
 * à choisir, et le choix n'apporte rien — la boîte rapide ne faisait rien de
 * plus vite, elle faisait seulement moins.
 *
 * Il n'y en a plus qu'un. Toutes les entrées — le « + » du rail, le sélecteur
 * d'organisation, le registre, la Tour de contrôle — mènent à l'Atelier.
 *
 * LE SEUL CAS QUI JUSTIFIAIT LA BOÎTE était le contexte client : ses routes ne
 * connaissent pas `/tour/generateur`, donc y naviguer retombait sur l'accueil
 * de la cliente. Ce hook lève l'objection en sortant du contexte AVANT de
 * naviguer — ce qui est de toute façon le comportement juste : on ne crée pas
 * une organisation cliente depuis l'intérieur d'une autre.
 */
export function useOpenAtelier(): () => void {
  const navigate = useNavigate();
  const { support, leaveOrganization } = useOrgContext();

  return useCallback(() => {
    if (!support) {
      navigate('/tour/generateur');
      return;
    }
    // `leaveOrganization` remonte déjà sur l'accueil d'AMN DevSec ; on enchaîne
    // sur l'Atelier une fois la bascule terminée, pour que le geste demandé
    // aboutisse au lieu de s'arrêter à mi-chemin.
    void leaveOrganization().then(() => navigate('/tour/generateur'));
  }, [support, leaveOrganization, navigate]);
}

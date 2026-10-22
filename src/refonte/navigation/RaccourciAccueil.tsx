import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * L'ACCUEIL AU CLAVIER — « G puis A », partout dans l'édition interne.
 *
 * Même grammaire que les espaces (« G puis 0 à 5 », `src/bureaux/navigation.tsx`) :
 * hors d'un champ, sans modificateur, et jamais quand une boîte de dialogue a
 * la main. « G puis 0 » mène déjà au poste ; « G puis A » dit ce qu'il fait.
 * Le bouton, lui, est la première ligne du rail.
 *
 * Monté par `AppLayout` au-dessus du poste ET des bureaux : depuis Cyber ou
 * la Garde, le raccourci ramène aussi à l'Accueil.
 */
export const DELAI_G_MS = 1200;

const enSaisie = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable;
};

export function RaccourciAccueil(): null {
  const navigate = useNavigate();
  useEffect(() => {
    let g = 0;
    const surTouche = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || enSaisie(ev.target) || enSaisie(document.activeElement)) {
        g = 0;
        return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const touche = ev.key.toLowerCase();
      if (touche === 'g') {
        g = Date.now();
        return;
      }
      if (touche === 'a' && g && Date.now() - g <= DELAI_G_MS) {
        g = 0;
        ev.preventDefault();
        navigate('/');
        return;
      }
      g = 0;
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [navigate]);
  return null;
}

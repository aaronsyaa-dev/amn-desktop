import { useEffect, useState } from 'react';

/**
 * Vrai sous `sm` (640 px) : un téléphone tenu droit — ou sous la largeur
 * passée (`1024` : sous `lg`, une tablette dont le rail mange un tiers).
 * Suit le redimensionnement.
 */
export function useEtroit(sous = 640): boolean {
  const requete = `(max-width: ${sous - 1}px)`;
  const [etroit, setEtroit] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(requete).matches === true);
  useEffect(() => {
    const m = window.matchMedia?.(requete);
    if (!m) return;
    const maj = () => setEtroit(m.matches);
    m.addEventListener('change', maj);
    return () => m.removeEventListener('change', maj);
  }, [requete]);
  return etroit;
}

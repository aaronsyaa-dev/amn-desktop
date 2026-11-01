import React, { useEffect, useRef, useState } from 'react';

/**
 * UN TEXTE QUI PEUT ÊTRE COUPÉ, ET QUI LE DIT.
 *
 * Mode d'emploi : `<TexteTronque>{titre}</TexteTronque>` tient sur une ligne (ellipse `…`), `lignes={3}` sur trois.
 * Quand le texte est réellement coupé, l'info-bulle (`title`) porte le texte entier ; sinon il n'y en a pas, pour
 * ne pas faire lire deux fois ce qui l'est déjà. La mesure se refait quand la taille change.
 * Règle du socle (§7.1) : aucun texte tronqué sans ellipse ET info-bulle.
 */
export function TexteTronque({ children, lignes = 1, as = 'span', className = '' }: { children: string; lignes?: number; as?: 'span' | 'p'; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [tronque, setTronque] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mesurer = () => setTronque(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    mesurer();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [children, lignes]);
  const Balise = as;
  return (
    <Balise
      ref={ref as React.Ref<HTMLSpanElement & HTMLParagraphElement>}
      title={tronque ? children : undefined}
      data-lignes={lignes > 1 ? lignes : undefined}
      style={lignes > 1 ? ({ '--sc-lignes': lignes } as React.CSSProperties) : undefined}
      className={`sc-tronque ${className}`.trim()}
    >
      {children}
    </Balise>
  );
}

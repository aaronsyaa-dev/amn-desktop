import React, { useEffect, useRef, useState } from 'react';
import { useLangue } from '../i18n';

/**
 * DÉPLIABLE — aucun paragraphe de plus de deux lignes visible par défaut (Bloc 1 de l'Automatique).
 *
 * « Des pavés, ça donne pas envie de lire. » Le texte est coupé à N lignes ;
 * s'il déborde vraiment (mesuré, pas supposé), un « Lire plus » le déplie.
 * Un texte court ne montre rien de plus : pas de bouton pour rien. Le repli
 * garde la place du texte replié — la page ne saute pas.
 */
export function Depliable({ lignes = 2, children, className = '' }: { lignes?: 1 | 2 | 3; children: React.ReactNode; className?: string }) {
  const { t } = useLangue();
  const ref = useRef<HTMLDivElement | null>(null);
  const [deborde, setDeborde] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mesurer = () => setDeborde(el.scrollHeight > el.clientHeight + 2);
    mesurer();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [children, ouvert]);
  const clamp = lignes === 1 ? 'line-clamp-1' : lignes === 3 ? 'line-clamp-3' : 'line-clamp-2';
  return (
    <div className={className} data-depliable={ouvert ? 'ouvert' : deborde ? 'replie' : 'court'}>
      <div ref={ref} className={ouvert ? '' : clamp}>{children}</div>
      {(deborde || ouvert) && (
        <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="-mx-1 mt-0.5 min-h-8 px-1 font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-primary">
          {ouvert ? t('commun.reduire') : t('commun.lirePlus')}
        </button>
      )}
    </div>
  );
}

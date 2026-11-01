import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import type { CleMots } from './i18n';
import type { OptionReport } from './modele';

/**
 * « REPORTER » ET SON MENU (H40) — le même geste sur une carte d'action (« Maintenant ») et sur une ligne survolée.
 *
 * Quatre échéances calculées (`optionsReport`) : dans 1 heure, ce soir 18:00, demain 9:00, lundi 9:00. Le menu prend
 * le focus sur son premier choix, ↑ ↓ y circulent, Échap ou un clic ailleurs le ferment, et le focus revient au
 * bouton. Il s'ouvre vers le haut quand le bas du fil n'a pas la place de le montrer en entier.
 */
const LIBELLE_REPORT = { heure: 'report.heure', soir: 'report.soir', demain: 'report.demain', lundi: 'report.lundi' } as const satisfies Record<OptionReport['cle'], CleMots>;

export interface MenuReportProps {
  tm: (cle: CleMots, params?: Record<string, string | number>) => string;
  options: readonly OptionReport[];
  ouvert: boolean;
  /** L'horloge devant le libellé (carte d'action, v3). */
  icone?: boolean;
  /** Une seconde ligne lue aux lecteurs d'écran : ce qui est reporté. */
  libelle?: string;
  onBasculer: () => void;
  onFermer: () => void;
  onChoisir: (option: OptionReport) => void;
}

export function MenuReport({ tm, options, ouvert, icone = false, libelle, onBasculer, onFermer, onChoisir }: MenuReportProps): React.ReactElement {
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const etaitOuvert = useRef(false);
  const [versLeHaut, setVersLeHaut] = useState(false);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useFermetureEchap(ouvert, onFermer);

  useLayoutEffect(() => {
    if (!ouvert) return;
    const b = bouton.current?.getBoundingClientRect();
    const zone = bouton.current?.closest('.sc-notif__fil')?.getBoundingClientRect();
    if (!b || !zone) return;
    const bas = zone.bottom - b.bottom;
    const haut = b.top - zone.top;
    setVersLeHaut(bas < 190 && haut > bas);
  }, [ouvert]);

  useEffect(() => {
    if (ouvert) {
      etaitOuvert.current = true;
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    } else if (etaitOuvert.current) {
      etaitOuvert.current = false;
      bouton.current?.focus();
    }
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (menu.current?.contains(cible) || bouton.current?.contains(cible)) return;
      fermer.current();
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  const dansLeMenu = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const choix = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = choix.indexOf(document.activeElement as HTMLElement);
    const suivant = e.key === 'ArrowDown' ? (i + 1) % choix.length : (i - 1 + choix.length) % choix.length;
    choix[suivant]?.focus();
  };

  return (
    <div className="sc-notif__report">
      <Bouton
        ref={bouton}
        variante="secondaire"
        taille="petit"
        icone={icone ? <Clock aria-hidden /> : undefined}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={libelle}
        onClick={onBasculer}
      >
        {tm('ligne.reporter')}
      </Bouton>
      {ouvert && (
        <div ref={menu} role="menu" aria-label={tm('report.titre')} className="sc-notif__menu" data-vers={versLeHaut ? 'haut' : undefined} onKeyDown={dansLeMenu}>
          {options.map((o) => (
            <button key={o.cle} type="button" role="menuitem" className="sc-notif__menu-choix" onClick={() => onChoisir(o)}>
              {tm(LIBELLE_REPORT[o.cle], { heure: o.heure })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

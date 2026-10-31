import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, Euro, Flag, Lock, MessageSquare, Package, Users } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { DrapeauUrgent } from '../../../socle/ui/controles';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import type { CleMots } from './i18n';
import type { IconeNotification, Notification, OptionReport } from './modele';

/**
 * UNE LIGNE DE NOTIFICATION (H40) — 61 px, le composant propre à cet écran.
 *
 * Point « non lu » de 8 px, tuile d'icône 38 × 38 (rayon 11, fond = la couleur de la famille à .13, ou le
 * critique pour une alerte urgente), titre de 13,5 px / 600 sur UNE ligne (ellipsis + info-bulle) avec le drapeau
 * « Urgent » qui ne passe jamais à la ligne, détail de 12,5 px, heure tabulaire à droite. « Ouvrir » (le seul bouton
 * primaire de la liste) et « Reporter » n'existent que pour la ligne survolée ou qui a le focus : la liste ne porte
 * jamais un bouton blanc par ligne.
 *
 * Le corps de la ligne est un vrai `<button>` : Entrée l'ouvre, il se tabule (un seul arrêt dans la liste, les flèches
 * font le reste, voir `VueNotifications`). L'état « non lu » se dit par le point ET par un mot lu aux lecteurs d'écran.
 */
const ICONES: Record<IconeNotification, React.ComponentType<{ 'aria-hidden'?: boolean }>> = {
  drapeau: Flag,
  euro: Euro,
  cadenas: Lock,
  bulle: MessageSquare,
  calendrier: CalendarDays,
  coche: Check,
  boite: Package,
  utilisateurs: Users,
  cloche: Bell,
};

const LIBELLE_REPORT = { heure: 'report.heure', soir: 'report.soir', demain: 'report.demain', lundi: 'report.lundi' } as const satisfies Record<OptionReport['cle'], CleMots>;

export interface LigneNotificationProps {
  notification: Notification;
  heure: string;
  tm: (cle: CleMots, params?: Record<string, string | number>) => string;
  /** Un seul arrêt de tabulation dans toute la liste : la ligne qui le porte. */
  tabIndex: 0 | -1;
  /** « Ouvrir » et « Reporter » sont montés (survol, focus ou menu ouvert). */
  actionsVisibles: boolean;
  menuOuvert: boolean;
  options: readonly OptionReport[];
  sortie: boolean;
  onOuvrir: () => void;
  onChoisirReport: (option: OptionReport) => void;
  onBasculerMenu: () => void;
  onFermerMenu: () => void;
  onSurvol: (survole: boolean) => void;
  onFocusLigne: () => void;
  onQuitterFocus: () => void;
}

export function LigneNotification(p: LigneNotificationProps): React.ReactElement {
  const { notification: n, tm } = p;
  const Icone = ICONES[n.icone];
  const boutonReport = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const etaitOuvert = useRef(false);
  const [versLeHaut, setVersLeHaut] = useState(false);

  const fermer = useRef(p.onFermerMenu);
  fermer.current = p.onFermerMenu;

  useFermetureEchap(p.menuOuvert, p.onFermerMenu);

  // Le menu s'ouvre vers le haut quand le bas de la carte n'a pas la place de le montrer en entier.
  useLayoutEffect(() => {
    if (!p.menuOuvert) return;
    const bouton = boutonReport.current?.getBoundingClientRect();
    const zone = boutonReport.current?.closest('.sc-notif__defilement')?.getBoundingClientRect();
    if (!bouton || !zone) return;
    const bas = zone.bottom - bouton.bottom;
    const haut = bouton.top - zone.top;
    setVersLeHaut(bas < 190 && haut > bas);
  }, [p.menuOuvert]);

  // Le menu prend le focus sur son premier choix ; à la fermeture, le focus retourne à « Reporter ».
  useEffect(() => {
    if (p.menuOuvert) {
      etaitOuvert.current = true;
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    } else if (etaitOuvert.current) {
      etaitOuvert.current = false;
      boutonReport.current?.focus();
    }
  }, [p.menuOuvert]);

  // Un clic ailleurs ferme le menu (Échap aussi : `useFermetureEchap`).
  useEffect(() => {
    if (!p.menuOuvert) return undefined;
    const dehors = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (menu.current?.contains(cible) || boutonReport.current?.contains(cible)) return;
      fermer.current();
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [p.menuOuvert]);

  const dansLeMenu = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const choix = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = choix.indexOf(document.activeElement as HTMLElement);
    const suivant = e.key === 'ArrowDown' ? (i + 1) % choix.length : (i - 1 + choix.length) % choix.length;
    choix[suivant]?.focus();
  };

  return (
    <li
      className="sc-notif__ligne"
      data-lue={n.lue}
      data-actif={p.actionsVisibles || undefined}
      data-sortie={p.sortie || undefined}
      onMouseEnter={() => p.onSurvol(true)}
      onMouseLeave={() => p.onSurvol(false)}
      onFocus={p.onFocusLigne}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) p.onQuitterFocus();
      }}
    >
      <button type="button" className="sc-notif__corps-ligne" data-ligne={n.id} tabIndex={p.tabIndex} onClick={p.onOuvrir}>
        <span aria-hidden className="sc-notif__point" />
        {!n.lue && <span className="sc-notif__sr">{tm('ligne.nonLue')}</span>}
        <span aria-hidden className="sc-notif__tuile" data-urgente={n.urgente || undefined} style={{ '--sc-notif-teinte': `var(--socle-fam-${n.famille})` } as React.CSSProperties}>
          <Icone aria-hidden />
        </span>
        <span className="sc-notif__texte">
          <span className="sc-notif__ligne-titre">
            <span className="sc-notif__ligne-nom" title={n.titre}>
              {n.titre}
            </span>
            {n.urgente && <DrapeauUrgent />}
          </span>
          <span className="sc-notif__detail" title={n.detail}>
            {n.detail}
          </span>
        </span>
        <time className="sc-notif__heure" dateTime={n.date}>
          {p.heure}
        </time>
      </button>
      {p.actionsVisibles && (
        <div className="sc-notif__actions">
          <Bouton variante="primaire" onClick={p.onOuvrir} aria-label={tm('ligne.ouvrirLibelle', { titre: n.titre })}>
            {tm('ligne.ouvrir')}
          </Bouton>
          <div style={{ position: 'relative' }}>
            <Bouton ref={boutonReport} variante="secondaire" aria-haspopup="menu" aria-expanded={p.menuOuvert} onClick={p.onBasculerMenu}>
              {tm('ligne.reporter')}
            </Bouton>
            {p.menuOuvert && (
              <div ref={menu} role="menu" aria-label={tm('report.titre')} className="sc-notif__menu" data-vers={versLeHaut ? 'haut' : undefined} onKeyDown={dansLeMenu}>
                {p.options.map((o) => (
                  <button key={o.cle} type="button" role="menuitem" className="sc-notif__menu-choix" onClick={() => p.onChoisirReport(o)}>
                    {tm(LIBELLE_REPORT[o.cle], { heure: o.heure })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

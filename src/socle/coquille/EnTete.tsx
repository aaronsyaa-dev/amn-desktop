import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import { LiveDot, PileAvatars, type TonVivant } from '../ui';
import { useSocleLangue } from '../i18n';
import { useFermetureEchap } from '../../lib/useFermetureEchap';
import type { EtatGarde, MiettePain } from './types';

/**
 * L'EN-TÊTE (60 px) — où je suis, qui est là, ce qui m'attend, si tout va bien.
 *
 * De gauche à droite : le fil d'Ariane « Famille / Page » (la famille en T4, la
 * page en T1 500 ; libellés du registre ou de la page, jamais tirés de
 * l'adresse), la pile d'avatars « 3 en ligne », la cloche et son badge, et la
 * pastille de La Garde, dont le point est un voyant vivant (§0.4 : l'onde du
 * `LiveDot`) dans l'état de la pire situation ouverte (vert, attention,
 * critique). `extra` accueille ce qui doit rester à portée sans faire partie
 * du dessin (l'état de la synchronisation, l'organisation) ; il s'efface sous
 * 640 px. Quand la barre latérale est repliée, le bouton de menu la redéplie.
 */
export interface EnTeteProps {
  fil: MiettePain[];
  enLigne: string[];
  presenceMontree: boolean;
  /** Ce qui attend la personne. */
  notifications: number;
  /** La page des notifications : la cloche en devient un lien (H40 — « la cloche ouvre cette page »). Sans elle, la cloche ouvre un volet. */
  versNotifications?: string;
  /** Le contenu du volet de la cloche (quand elle n'est pas un lien) ; il reçoit de quoi se fermer. */
  volet?: (fermer: () => void) => React.ReactNode;
  garde: { etat: EtatGarde; points: number; vers: string };
  extra?: React.ReactNode;
  onMenu: () => void;
  /** La barre latérale est repliée : le bouton de menu reste visible à toute largeur, et la redéplie. */
  lateralRepliee?: boolean;
}

const TON_GARDE: Record<EtatGarde, TonVivant> = { calme: 'ok', attention: 'attention', critique: 'critique', inconnu: 'info' };

export function EnTete({ fil, enLigne, presenceMontree, notifications, versNotifications, volet, garde, extra, onMenu, lateralRepliee = false }: EnTeteProps) {
  const { ts } = useSocleLangue();
  const texteGarde =
    garde.etat === 'calme'
      ? ts('entete.garde.calme')
      : garde.etat === 'attention'
        ? ts('entete.garde.attention', { n: garde.points })
        : garde.etat === 'critique'
          ? ts('entete.garde.critique')
          : ts('entete.garde.inconnu');

  return (
    <header data-socle="entete" className="sc-entete">
      <button type="button" onClick={onMenu} aria-label={ts(lateralRepliee ? 'coquille.deplier' : 'coquille.menu.ouvrir')} data-repliee={lateralRepliee || undefined} className="sc-menu sc-focus">
        <Menu size={17} aria-hidden />
      </button>

      <nav aria-label={ts('entete.fil')} className="sc-fil">
        <ol>
          {fil.map((m, i) => {
            const dernier = i === fil.length - 1;
            return (
              <li key={`${m.libelle}-${i}`} aria-current={dernier ? 'page' : undefined}>
                {m.vers && !dernier ? (
                  <Link to={m.vers} className="sc-focus">
                    {m.libelle}
                  </Link>
                ) : (
                  <span>{m.libelle}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="sc-entete__droite">
        {extra && <div className="sc-entete__extra">{extra}</div>}

        {presenceMontree && enLigne.length > 0 && (
          <span className="sc-entete__presence">
            <PileAvatars noms={enLigne} libelle={ts('entete.enLigne', { n: enLigne.length })} />
            <span aria-hidden className="sc-entete__presence-texte">
              {ts('entete.enLigne', { n: enLigne.length })}
            </span>
          </span>
        )}

        {versNotifications ? <ClocheLien nombre={notifications} vers={versNotifications} /> : volet ? <Cloche nombre={notifications} volet={volet} /> : null}

        <Link to={garde.vers} data-etat={garde.etat} data-guide="garde" className="sc-garde sc-focus" title={texteGarde}>
          <span aria-hidden className="sc-garde__point">
            <LiveDot ton={TON_GARDE[garde.etat]} onde={garde.etat !== 'inconnu'} halo={false} libelle={texteGarde} />
          </span>
          <span className="sc-garde__texte">{texteGarde}</span>
        </Link>
      </div>
    </header>
  );
}

/** La cloche, lien vers la page des notifications : 34 px, un badge (« 99+ » au-delà). Le compteur est celui de « Non lues ». */
function ClocheLien({ nombre, vers }: { nombre: number; vers: string }) {
  const { ts } = useSocleLangue();
  return (
    <Link to={vers} aria-label={nombre > 0 ? ts('entete.cloche.nombre', { n: nombre }) : ts('entete.cloche')} className="sc-cloche sc-focus">
      <Bell size={16} aria-hidden />
      {nombre > 0 && (
        <span aria-hidden className="sc-cloche__badge">
          {nombre > 99 ? '99+' : nombre}
        </span>
      )}
    </Link>
  );
}

/** La cloche : 34 px, un badge, un volet qui se ferme sur Échap et au clic dehors. */
function Cloche({ nombre, volet }: { nombre: number; volet: (fermer: () => void) => React.ReactNode }) {
  const { ts } = useSocleLangue();
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const idVolet = useId();
  const fermer = () => {
    setOuvert(false);
    bouton.current?.focus();
  };
  useFermetureEchap(ouvert, fermer);
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  return (
    <div ref={zone} className="sc-cloche-zone">
      <button
        ref={bouton}
        type="button"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idVolet : undefined}
        aria-label={nombre > 0 ? ts('entete.cloche.nombre', { n: nombre }) : ts('entete.cloche')}
        onClick={() => setOuvert((v) => !v)}
        className="sc-cloche sc-focus"
      >
        <Bell size={16} aria-hidden />
        {nombre > 0 && (
          <span aria-hidden className="sc-cloche__badge">
            {nombre > 99 ? '99+' : nombre}
          </span>
        )}
      </button>
      {ouvert && (
        <div id={idVolet} role="region" aria-label={ts('entete.cloche.titre')} className="sc-popover">
          {volet(fermer)}
        </div>
      )}
    </div>
  );
}

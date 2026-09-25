import React, { useEffect, useState } from 'react';
import { espace as espaceDe, touchePrincipale, type BureauKey } from '../jetons';
import { poserAmbiance, useReglagesBureaux } from '../ambiance';
import { useNavigationEspaces } from '../navigation';
import { espaceDuChemin } from '../catalogue';
import { useRegards } from '../../state/RegardsContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { UserAvatar } from '../../components/UserAvatar';
import { Glyphe, MarqueAmn } from './Glyphe';
import { hhmm } from '../format';
import { EDITION_PRODUCT_NAME } from '../../edition/edition';

/* Le mot qui suit la marque (« Business ») : il vient de l'édition, pas d'une chaîne figée. */
const MOT_EDITION = EDITION_PRODUCT_NAME.replace(/^AMN\s+/, '');

/**
 * LA BARRE HAUTE COMMUNE — cahier 11, `44d`. La seule chose qui ne change pas
 * d'un bureau à l'autre : elle dit où l'on est et comment en sortir.
 *
 * 48 px, fond `barre` du bureau, filet bas `filet`, reflet. De gauche à droite :
 * le logo et « Business », l'indicateur d'espace (jamais repliable), le
 * sélecteur (⌘ E), la présence, l'Ambiance, l'heure, le Poste de travail.
 */
export function BarreHaute({ bureau }: { bureau: BureauKey }) {
  const e = espaceDe(bureau);
  const nav = useNavigationEspaces();
  const { ambiance, reduit } = useReglagesBureaux();
  const heure = useHeure();
  const touche = touchePrincipale();

  return (
    <header
      className="relative z-20 flex h-12 flex-none items-center gap-3.5 pl-[18px] pr-4"
      style={{ background: e.barre, borderBottom: `1px solid ${e.filet}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)' }}
      data-barre-haute
    >
      <span className="flex items-center gap-2" aria-label={EDITION_PRODUCT_NAME}>
        <MarqueAmn hauteur={14} />
        <span className="hidden text-[12px] text-[#9a9a97] sm:inline">{MOT_EDITION}</span>
      </span>
      <span aria-hidden className="h-[18px] w-px" style={{ background: e.filet }} />
      <span
        data-indicateur-espace
        className="flex h-7 flex-none items-center gap-2 pl-[9px] pr-[11px]"
        style={{ background: e.rel, border: `1px solid ${e.filet}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)' }}
      >
        <Glyphe espace={bureau} couleur="#f7f7f5" />
        <span className="whitespace-nowrap text-[12.5px] font-semibold text-[#f7f7f5]">{e.nom}</span>
      </span>
      <button
        type="button"
        onClick={() => (nav.palette ? nav.fermerPalette() : nav.ouvrirPalette())}
        aria-haspopup="dialog"
        aria-expanded={nav.palette}
        className="hidden h-7 w-[236px] flex-none items-center gap-2.5 pl-[11px] pr-[7px] text-left md:flex"
        style={{ border: `1px solid ${nav.palette ? '#8a8a87' : e.filet}` }}
      >
        <span className={`flex-1 whitespace-nowrap text-[12.5px] ${nav.palette ? 'text-[#e4e4e1]' : 'text-[#9a9a97]'}`}>Changer d’espace</span>
        <kbd className="px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#a3a3a0]" style={{ border: `1px solid ${e.filet}`, background: e.surf }}>
          {touche === '⌘' ? '⌘ E' : 'Ctrl E'}
        </kbd>
      </button>
      {nav.attenteG && (
        <span className="hidden font-mono text-[10px] tracking-[0.14em] text-[#a3a3a0] lg:inline" aria-live="polite">
          G · 0 À 5
        </span>
      )}
      <Presence bureau={bureau} bord={e.barre} />
      <button
        type="button"
        role="switch"
        aria-checked={ambiance && !reduit}
        disabled={reduit}
        onClick={() => poserAmbiance(!ambiance)}
        title={reduit ? 'Le système demande moins de mouvement : l’Ambiance est coupée d’office.' : ambiance ? 'Couper le mouvement ambiant et les sas' : 'Rendre le mouvement ambiant et les sas'}
        className="hidden items-center gap-[7px] disabled:cursor-not-allowed sm:flex"
      >
        <span className="font-mono text-[9.5px] tracking-[0.14em] text-[#9a9a97]">AMBIANCE</span>
        <span className={`flex h-[14px] w-[26px] rounded-[7px] p-[2px] ${ambiance && !reduit ? 'justify-end bg-[#3a3a3a]' : 'justify-start bg-[#242424]'}`}>
          <span className={`h-[10px] w-[10px] rounded-full ${ambiance && !reduit ? 'bg-[#e4e4e1]' : 'bg-[#8a8a87]'}`} />
        </span>
      </button>
      <span className="hidden font-mono text-[11px] font-medium tabular-nums text-[#a3a3a0] sm:inline">{heure}</span>
      <button
        type="button"
        onClick={() => nav.allerEspace('poste')}
        title="Poste de travail (G puis 0)"
        className="flex h-7 flex-none items-center gap-[7px] whitespace-nowrap border border-[#3a3a3a] px-[11px] text-[12px] font-semibold text-[#e4e4e1] hover:border-[#8a8a87] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7f7f5]"
      >
        <Glyphe espace="poste" taille={12} couleur="#a3a3a0" />
        <span className="hidden sm:inline">Poste de travail</span>
      </button>
    </header>
  );
}

function useHeure(): string {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), 15_000);
    return () => clearInterval(i);
  }, []);
  return hhmm(t);
}

/** Les autres personnes dans CE bureau — avatars de 22 px en pile, bordés de la couleur de la barre. */
function Presence({ bureau, bord }: { bureau: BureauKey; bord: string }) {
  const { autres } = useRegards();
  const profils = useProfilesOptionnel();
  const ici = [...new Map(autres.filter((r) => !r.parti && espaceDuChemin(r.module) === bureau).map((r) => [r.email, r])).values()];
  if (!ici.length) return <span className="ml-auto" />;
  const noms = ici.map((r) => profils?.profileFor(r.email).name || r.email.split('@')[0]);
  return (
    <span className="ml-auto hidden items-center pl-1.5 sm:flex" aria-label={`Aussi dans ce bureau : ${noms.join(', ')}`} title={`Aussi dans ce bureau : ${noms.join(', ')}`}>
      {ici.slice(0, 4).map((r, i) => (
        <span key={r.email} className="rounded-full" style={{ marginLeft: i === 0 ? 0 : -6, boxShadow: `0 0 0 1.5px ${bord}`, zIndex: 10 - i }}>
          <UserAvatar email={r.email} size={22} />
        </span>
      ))}
      {ici.length > 4 && <span className="ml-1.5 font-mono text-[10px] text-[#a3a3a0]">+{ici.length - 4}</span>}
    </span>
  );
}

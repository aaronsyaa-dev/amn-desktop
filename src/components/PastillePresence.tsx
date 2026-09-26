import React, { useId, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { useRegardsSurModule, vueDuChemin, type Regard } from '../state/RegardsContext';
import { useProfilesOptionnel } from '../state/ProfilesContext';
import { UserAvatar } from './UserAvatar';

/**
 * LA PASTILLE DE PRÉSENCE (cahier 15, `51a`) — à droite de l'en-tête du module.
 *
 * Une autre personne a le même module ouvert : sa photo, 24 px. À plusieurs,
 * une pile de trois au plus (chevauchement de 7 px), puis « +N » ; la
 * dernière arrivée à gauche. Au survol et au focus, une infobulle : « Mohamed
 * utilise ce module aussi », depuis quand, la vue ouverte. Quand elle ferme
 * le module, sa pastille passe à 40 % et un filet gris en fait le tour une
 * minute, « vient de partir », puis disparaît.
 *
 * Pas d'ambre : la présence n'attend rien de personne.
 */
export function PastillePresence() {
  const dansRouteur = useInRouterContext();
  if (!dansRouteur) return null;
  return <Pile />;
}

/** « page Devis » : le dernier segment de la vue, dit comme un nom d'écran. */
const libelleVue = (vue: string) => {
  const dernier = vue.split('/').filter(Boolean).pop() ?? '';
  const mot = dernier.replace(/-/g, ' ');
  return mot ? `page ${mot.charAt(0).toUpperCase()}${mot.slice(1)}` : '';
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function Pile() {
  const chemin = useLocation().pathname;
  const regards = useRegardsSurModule(chemin);
  const maVue = vueDuChemin(chemin);
  const profils = useProfilesOptionnel();
  const [ouverte, setOuverte] = useState<string | null>(null);
  const id = useId();
  if (!regards.length) return null;
  const montres = regards.slice(0, 3);
  const reste = regards.length - montres.length;
  const nom = (r: Regard) => profils?.profileFor(r.email).name || r.email.split('@')[0];

  return (
    <div className="relative flex items-center" aria-label={`${regards.filter((r) => !r.parti).length} autre${regards.length > 1 ? 's' : ''} sur ce module`} data-pastille-presence>
      {montres.map((r, i) => (
        <button
          key={`${r.email}-${r.module}`}
          type="button"
          aria-describedby={ouverte === r.email ? `${id}-bulle` : undefined}
          onMouseEnter={() => setOuverte(r.email)}
          onMouseLeave={() => setOuverte(null)}
          onFocus={() => setOuverte(r.email)}
          onBlur={() => setOuverte(null)}
          className="relative flex h-[26px] w-[26px] items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
          style={{ marginLeft: i === 0 ? 0 : -7, zIndex: 10 - i, opacity: r.parti ? 0.4 : 1 }}
        >
          <span className="rounded-full" style={{ boxShadow: r.parti ? '0 0 0 1.5px var(--color-trait-sourd)' : '0 0 0 1.5px var(--color-bg, var(--color-bg))' }}>
            <UserAvatar email={r.email} size={24} />
          </span>
          {ouverte === r.email && (
            <span
              id={`${id}-bulle`}
              role="tooltip"
              className="absolute right-0 top-[calc(100%+8px)] z-30 w-max max-w-[260px] border border-border-sheet bg-[#111] px-3 py-2 text-left shadow-[0_18px_40px_-16px_rgba(0,0,0,1)]"
            >
              <span className="block text-[12.5px] font-semibold text-text-primary">
                {r.parti ? `${nom(r)} a quitté le module à ${hhmm(r.partiA ?? r.depuis)}` : `${nom(r)} utilise ce module aussi`}
              </span>
              <span className="mt-1 block font-mono text-[10.5px] tracking-[0.06em] text-text-secondary">
                {r.parti ? 'vient de partir' : `depuis ${hhmm(r.depuis)}`}
                {/* La vue ouverte, seulement si elle diffère de la vôtre. */}
                {!r.parti && r.vue && r.vue !== maVue && libelleVue(r.vue) ? ` · ${libelleVue(r.vue)}` : ''}
              </span>
            </span>
          )}
        </button>
      ))}
      {reste > 0 && <span className="ml-1.5 font-mono text-[11px] text-text-secondary">+{reste}</span>}
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLangue, carteModule, libelleNav } from '../i18n';
import { sectionsForSpace, spaceForPath } from '../data/spaces';
import { useGuide } from './GuideContext';
import { parcoursGeneral, parcoursModule } from './parcours';
import { signalerGuide } from './memoire';

/**
 * LE POINT D'INTERROGATION — l'aide qui manquait à l'édition cliente.
 *
 * Quatre gestes, toujours les mêmes : rejouer la visite, montrer l'écran
 * courant, changer de profil, demander de l'aide (l'écran Assistance, qui
 * envoie un message à l'équipe qui accompagne l'organisation). C'est la
 * cible de la dernière étape de chaque visite (`data-guide="aide"`).
 */
export function BoutonAide({ extra }: { extra?: React.ReactNode } = {}) {
  const { t } = useLangue();
  const { user } = useAuth();
  const { lancer } = useGuide();
  const navigate = useNavigate();
  const location = useLocation();
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    window.addEventListener('mousedown', fermer);
    window.addEventListener('keydown', touche);
    return () => {
      window.removeEventListener('mousedown', fermer);
      window.removeEventListener('keydown', touche);
    };
  }, [ouvert]);

  const montrerEcran = () => {
    const items = sectionsForSpace(spaceForPath(location.pathname)).flatMap((s) => s.items);
    let item = items.find((i) => i.to !== '/' && (location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))) ?? null;
    for (const c of items) if (c.to !== '/' && (location.pathname === c.to || location.pathname.startsWith(`${c.to}/`)) && (!item || c.to.length > item.to.length)) item = c;
    const nom = item ? libelleNav(item) : t('guide.general.accueil.titre');
    const quoi = item ? (carteModule(item.key)?.quoi ?? item.hint) : t('guide.general.accueil.texte');
    lancer(parcoursModule(item?.key ?? 'home', nom, quoi));
  };

  const visite = () => {
    setOuvert(false);
    navigate('/');
    window.setTimeout(() => lancer(parcoursGeneral(user?.name?.split(' ')[0] || '')), 350);
  };

  const ligne = 'flex min-h-11 w-full items-center px-3 text-left text-[13px] text-text-body hover:bg-surface-hover md:min-h-9';

  return (
    <div className="relative" ref={boite}>
      <button
        type="button"
        data-guide="aide"
        onClick={() => setOuvert((v) => !v)}
        aria-label={t('guide.aide')}
        aria-expanded={ouvert}
        title={t('guide.aide')}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:text-text-primary md:h-9 md:w-9"
      >
        <HelpCircle size={17} strokeWidth={1.9} />
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 border border-border-raised bg-elevated py-1 shadow-[0_24px_48px_-20px_rgba(0,0,0,1)]" role="menu">
          <button type="button" role="menuitem" className={ligne} onClick={visite}>
            {t('guide.revoir')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={ligne}
            onClick={() => {
              setOuvert(false);
              montrerEcran();
            }}
          >
            {t('guide.montrerEcran')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={ligne}
            onClick={() => {
              setOuvert(false);
              signalerGuide();
            }}
          >
            {t('guide.changerProfil')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={ligne}
            onClick={() => {
              setOuvert(false);
              navigate('/assistance');
            }}
          >
            {t('guide.demanderAide')}
          </button>
          {extra}
        </div>
      )}
    </div>
  );
}

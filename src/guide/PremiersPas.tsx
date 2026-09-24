import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLangue } from '../i18n';
import { useGuide, useGuideDisponible } from './GuideContext';
import { useSupportContext } from '../state/OrgContextContext';
import { parcoursGeneral } from './parcours';
import { signalerGuide } from './memoire';
import { texte } from './profils';
import { usePremiersPas } from './usePremiersPas';

/**
 * « VOS PREMIERS PAS » — le point de départ concret, sur l'Accueil.
 *
 * Trois ou quatre lignes, chacune un lien vers le module où le pas se fait,
 * cochée par les données. Le panneau disparaît de lui-même quand tout est
 * fait, ou d'un clic (« Masquer », mémorisé sur ce poste). Calme : aucun
 * ambre, aucun chiffre — c'est une liste, pas un instrument.
 */
const CLE = (email: string) => `amn.guide.pas.${email || 'anonyme'}`;

export function PremiersPas() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { profil, pas } = usePremiersPas();
  const { lancer } = useGuide();
  /* En support, l'Accueil est celui de la cliente : les premiers pas de l'opérateur n'y ont pas leur place. */
  const support = useSupportContext();
  const guide = useGuideDisponible();
  const email = user?.email ?? '';
  const [masque, setMasque] = useState(() => {
    try {
      return window.localStorage.getItem(CLE(email)) === 'masque';
    } catch {
      return false;
    }
  });
  if (support || !guide || !profil || pas.length === 0 || masque) return null;
  const restants = pas.filter((p) => !p.fait);
  const cacher = () => {
    setMasque(true);
    try {
      window.localStorage.setItem(CLE(email), 'masque');
    } catch {
      /* stockage refusé : le panneau reviendra */
    }
  };

  return (
    <section className="panel px-5 py-4" data-guide="premiers-pas" aria-label={t('guide.pas.titre')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="eyebrow text-text-secondary">{t('guide.pas.titre')}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">{texte(profil.label)}</span>
      </div>
      <p className="mt-1.5 text-[13px] text-text-secondary">{restants.length === 0 ? t('guide.pas.tout') : t('guide.pas.texte')}</p>
      <ol className="mt-3 flex flex-col">
        {pas.map((p) => (
          <li key={p.id} className="flex items-center gap-3 border-t border-border-row py-2">
            <span
              className={`flex h-5 w-5 flex-none items-center justify-center border ${p.fait ? 'border-text-primary bg-text-primary text-bg' : 'border-border-strong'}`}
              aria-hidden
            >
              {p.fait && <Check size={12} strokeWidth={2.5} />}
            </span>
            {p.fait ? (
              <span className="text-[13.5px] text-text-muted line-through decoration-border-strong">
                {texte(p.titre)} <span className="no-underline font-mono text-[10px] uppercase tracking-[0.1em]">· {t('guide.pas.fait')}</span>
              </span>
            ) : (
              <Link to={p.to} className="min-h-8 text-[13.5px] text-text-primary underline-offset-2 hover:underline">
                {texte(p.titre)}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border-row pt-3">
        <button type="button" onClick={() => lancer(parcoursGeneral(user?.name?.split(' ')[0] || ''))} className="min-h-8 text-[12.5px] text-text-secondary hover:text-text-primary">
          {t('guide.revoir')}
        </button>
        <button type="button" onClick={signalerGuide} className="min-h-8 text-[12.5px] text-text-secondary hover:text-text-primary">
          {t('guide.changerProfil')}
        </button>
        <span className="flex-1" />
        <button type="button" onClick={cacher} className="min-h-8 text-[12.5px] text-text-muted hover:text-text-primary">
          {t('guide.pas.masquer')}
        </button>
      </div>
    </section>
  );
}

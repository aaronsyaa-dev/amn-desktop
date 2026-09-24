import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLangue } from '../i18n';
import { useGuide } from './GuideContext';
import { parcoursGeneral } from './parcours';
import { signalerGuide } from './memoire';
import { texte } from './profils';
import { useProfilDepart } from './usePremiersPas';

/**
 * LE GUIDE, DANS PARAMÈTRES — tout se rejoue : la visite, les présentations
 * de module (leur mémoire « déjà vu » est effacée, elles reviendront à la
 * prochaine ouverture de chaque module), et le profil de départ.
 */
export function GuideSection() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { lancer } = useGuide();
  const navigate = useNavigate();
  const profil = useProfilDepart();
  const [presentationsEffacees, setPresentationsEffacees] = useState(false);
  const email = user?.email ?? '';

  const effacerPresentations = () => {
    try {
      window.localStorage.removeItem(`amn.presentation.vue.${email || 'anonyme'}`);
    } catch {
      /* stockage refusé */
    }
    setPresentationsEffacees(true);
  };

  const bouton = 'min-h-11 border border-border-strong px-3 text-[13px] font-semibold text-text-body hover:bg-surface-hover md:min-h-9';

  return (
    <section className="panel p-4" id="reglages-guide">
      <p className="eyebrow mb-2">{t('guide.section.titre')}</p>
      <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-text-secondary">{t('guide.section.texte')}</p>
      <p className="mb-3 text-[13px] text-text-body">
        <span className="text-text-muted">{t('guide.section.profilActuel')} :</span> {profil ? texte(profil.label) : '—'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={bouton}
          onClick={() => {
            navigate('/');
            window.setTimeout(() => lancer(parcoursGeneral(user?.name?.split(' ')[0] || '')), 350);
          }}
        >
          {t('guide.revoir')}
        </button>
        <button type="button" className={bouton} onClick={signalerGuide}>
          {t('guide.changerProfil')}
        </button>
        <button type="button" className={bouton} onClick={effacerPresentations} disabled={presentationsEffacees}>
          {t('guide.presentations')}
        </button>
      </div>
      {presentationsEffacees && <p className="mt-3 text-[12.5px] text-text-secondary">{t('guide.presentationsFaites')}</p>}
    </section>
  );
}

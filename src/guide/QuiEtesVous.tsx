import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PROFILS } from '@edition/guide';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useNavFavorites } from '../state/useNavFavorites';
import { useNavAlleges } from '../state/useNavAlleges';
import { useAccueil } from '../accueils/useAccueil';
import { isModuleEnabled } from '../data/spaces';
import { useLangue } from '../i18n';
import { Logo } from '../components/Logo';
import { useGuide } from './GuideContext';
import { parcoursGeneral } from './parcours';
import { marquerGuide } from './memoire';
import { ecrireIndexFamilles } from '../lib/barreLaterale';
import { texte, type ProfilDepart } from './profils';

/**
 * « QUI ÊTES-VOUS ? » — la question du premier lancement.
 *
 * Une feuille, quatre portes (deux dans l'édition interne), un bouton
 * « Plus tard ». Choisir applique le profil : les épinglés, les modules
 * allégés, l'Accueil, et enregistre le profil sur le compte (synchronisé).
 * Puis la visite guidée démarre depuis l'Accueil. On ne touche à rien qui
 * n'existe pas dans l'organisation : un module que la formule n'ouvre pas
 * n'est ni épinglé ni allégé.
 */
export function QuiEtesVous({ onFerme, relance = false }: { onFerme: () => void; relance?: boolean }) {
  const { t } = useLangue();
  const { user } = useAuth();
  const { updateSelf } = useProfiles();
  const { setFavorites } = useNavFavorites();
  const { remplacer } = useNavAlleges();
  const { choisir } = useAccueil();
  const { lancer } = useGuide();
  const navigate = useNavigate();
  const [occupe, setOccupe] = useState<string | null>(null);
  const email = user?.email ?? '';

  const appliquer = async (p: ProfilDepart) => {
    setOccupe(p.id);
    try {
      setFavorites(p.epingles.filter((k) => k === 'home' || isModuleEnabled(k)));
      remplacer((p.alleges ?? []).filter((k) => isModuleEnabled(k)));
      if (p.accueil) await choisir(p.accueil);
      ecrireIndexFamilles(Boolean(p.indexFamilles));
      await updateSelf(email, { profil: p.id });
    } finally {
      marquerGuide('profil', email);
      onFerme();
      if (!relance) {
        navigate('/');
        window.setTimeout(() => lancer(parcoursGeneral(user?.name?.split(' ')[0] || '')), 400);
        marquerGuide('general', email);
      }
    }
  };

  const plusTard = () => {
    marquerGuide('profil', email);
    onFerme();
  };

  return createPortal(
    <div className="fixed inset-0 z-[290] flex items-center justify-center overflow-y-auto bg-bg/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('guide.qui.titre')}>
      <div className="w-full max-w-[720px] border border-border-raised bg-elevated p-6 shadow-[0_34px_62px_-28px_rgba(0,0,0,1)] sm:p-9">
        <Logo height={18} />
        <h1 className="mt-6 text-[26px] font-bold leading-none tracking-[-0.03em] text-text-primary sm:text-[32px]">{t('guide.qui.titre')}</h1>
        <p className="mt-3 max-w-[60ch] text-[14.5px] leading-[1.65] text-text-secondary [text-wrap:pretty]">{t('guide.qui.texte')}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {PROFILS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={occupe !== null}
              onClick={() => void appliquer(p)}
              className="flex min-h-[96px] flex-col items-start border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-text-primary disabled:opacity-60"
            >
              <span className="text-[15px] font-bold text-text-primary">{texte(p.label)}</span>
              <span className="mt-1.5 text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">{texte(p.phrase)}</span>
              <span className="mt-auto pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {occupe === p.id ? '…' : t('guide.qui.commencer')}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={plusTard} className="min-h-11 px-3 text-[13px] text-text-muted hover:text-text-primary md:min-h-9">
            {t('guide.qui.plusTard')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

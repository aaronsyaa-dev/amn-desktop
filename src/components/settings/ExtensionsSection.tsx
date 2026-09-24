import React, { useEffect, useState } from 'react';
import { useLangue } from '../../i18n';
import { CLE_INDEX, EVENEMENT_INDEX, ecrireIndexFamilles, lireIndexFamilles } from '../../lib/barreLaterale';
import { ecrireTeintes, useTeintes } from '../../lib/teintes';
import { celebrationsActives, ecrireCelebrations } from '../Celebrations';
import { HallSection } from '../../hall/HallSection';

/**
 * LES EXTENSIONS GRATUITES — ce qui s'allume et s'éteint d'un geste.
 *
 * Rien ici n'est payant ni facturé : ce sont des façons d'habiter le poste
 * (les teintes de familles, l'index des familles, les célébrations, le Hall,
 * l'écran de veille, les Accueils). Chaque ligne dit ce qu'elle fait en une
 * phrase et s'applique à l'instant — c'est ce que « une extension » veut dire
 * pour quelqu'un qui n'a jamais installé un logiciel.
 */
function Ligne({ titre, texte, actif, onChange }: { titre: string; texte: string; actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-row py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-text-primary">{titre}</p>
        <p className="text-[12px] leading-relaxed text-text-secondary">{texte}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={actif}
        aria-label={titre}
        onClick={() => onChange(!actif)}
        className={`relative mt-0.5 h-6 w-11 flex-none border transition-colors ${actif ? 'border-text-primary bg-text-primary' : 'border-border-strong bg-sunken'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 transition-[left] ${actif ? 'left-6 bg-bg' : 'left-0.5 bg-text-muted'}`} aria-hidden />
      </button>
    </div>
  );
}

export function ExtensionsSection() {
  const { t } = useLangue();
  const teintes = useTeintes();
  const [index, setIndex] = useState(lireIndexFamilles);
  const [fetes, setFetes] = useState(celebrationsActives);
  useEffect(() => {
    const relire = () => setIndex(lireIndexFamilles());
    window.addEventListener(EVENEMENT_INDEX, relire);
    return () => window.removeEventListener(EVENEMENT_INDEX, relire);
  }, []);
  void CLE_INDEX;
  const lien = 'inline-flex min-h-11 items-center border border-border-strong px-3 text-[13px] font-semibold text-text-body hover:bg-surface-hover md:min-h-9';

  return (
    <div className="flex flex-col gap-4" id="reglages-extensions">
      <section className="panel p-4">
        <p className="eyebrow mb-1">{t('extensions.titre')}</p>
        <p className="mb-2 max-w-2xl text-[12px] leading-relaxed text-text-secondary">{t('extensions.texte')}</p>
        <Ligne titre={t('extensions.teintes.titre')} texte={t('extensions.teintes.texte')} actif={teintes} onChange={ecrireTeintes} />
        <Ligne titre={t('extensions.index.titre')} texte={t('extensions.index.texte')} actif={index} onChange={ecrireIndexFamilles} />
        <Ligne
          titre={t('extensions.fetes.titre')}
          texte={t('extensions.fetes.texte')}
          actif={fetes}
          onChange={(v) => {
            ecrireCelebrations(v);
            setFetes(v);
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="#reglages-veille" className={lien}>{t('extensions.veille')}</a>
          <a href="#reglages-accueil" className={lien}>{t('extensions.accueils')}</a>
        </div>
      </section>
      <HallSection />
    </div>
  );
}

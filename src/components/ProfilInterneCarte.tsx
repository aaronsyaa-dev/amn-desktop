import React, { useMemo, useState } from 'react';
import { NAV_SECTIONS } from '@edition/modules';
import { useAuth } from '../auth/AuthContext';
import { useLangue } from '../i18n';
import { useNavAlleges } from '../state/useNavAlleges';
import { ALWAYS_ON_MODULES } from '../data/spaces';
import { PROFILS_INTERNES_ORDRE, allegementsPourProfil, CLE_PROFIL } from '../data/profilsInternes';

/**
 * « QUEL EST VOTRE POSTE ? » — à la première ouverture d'un compte interne.
 *
 * Un nouveau compte chez AMN DevSec voit quatre-vingts écrans. Cette carte
 * lui en propose une mission d'un geste — Supervision, Commercial, Support —
 * ou tout garder. Le choix s'applique à sa barre (mémorisé côté serveur, par
 * personne) et la carte ne revient pas : le choix se change ensuite dans la
 * Bibliothèque, « Alléger ma barre ». Rien n'est imposé, rien ne bloque.
 */
function lireChoix(email: string): string | null {
  try { return window.localStorage.getItem(CLE_PROFIL(email)); } catch { return null; }
}

export function ProfilInterneCarte() {
  const { t } = useLangue();
  const { user } = useAuth();
  const email = user?.email ?? '';
  const { alleges, remplacer } = useNavAlleges();
  const [choisi, setChoisi] = useState<string | null>(() => lireChoix(email));
  const catalogue = useMemo(() => NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.key)), []);
  if (choisi || alleges.length > 0) return null;

  const choisir = (profil: (typeof PROFILS_INTERNES_ORDRE)[number] | 'tout') => {
    if (profil !== 'tout') remplacer(allegementsPourProfil(profil, catalogue, ALWAYS_ON_MODULES));
    try { window.localStorage.setItem(CLE_PROFIL(email), profil); } catch { /* sans mémoire locale, la carte reviendra : ce n'est qu'un clic */ }
    setChoisi(profil);
  };

  return (
    <section className="rounded-xl border border-border-strong bg-surface p-4" aria-label={t('profil.titre')} data-profil-carte>
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('profil.surtitre')}</p>
      <h2 className="mt-1 text-base font-semibold text-text-primary">{t('profil.titre')}</h2>
      <p className="mt-1 text-[13px] text-text-secondary">{t('profil.aide')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PROFILS_INTERNES_ORDRE.map((p) => (
          <button key={p} type="button" onClick={() => choisir(p)} className="flex min-h-11 flex-col items-start border border-border-strong bg-bg px-3 py-1.5 text-left hover:bg-surface-hover">
            <span className="text-sm font-medium text-text-primary">{t(`profil.${p}`)}</span>
            <span className="text-[11px] text-text-muted">{t(`profil.${p}.aide`)}</span>
          </button>
        ))}
        <button type="button" onClick={() => choisir('tout')} className="min-h-11 border border-border px-3 text-sm text-text-secondary hover:text-text-primary">{t('profil.tout')}</button>
      </div>
    </section>
  );
}

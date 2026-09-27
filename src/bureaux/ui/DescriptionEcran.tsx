import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { descriptionEcran, nomEcran } from '../libelles';
import { useLangue } from '../../i18n';

/**
 * À QUOI SERT CET ÉCRAN — la première fois qu'on ouvre un écran de Studio ou de Stratégie, une
 * ligne le dit en langage courant, avec « Compris » pour ne plus la revoir (sur ce poste). Ensuite,
 * la même phrase reste en infobulle sur l'onglet. Rien d'autre : pas de visite, pas de pop-up.
 */
const CLE = 'amn.bureaux.descriptionsVues';

function vues(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** La clé de l'écran : sa route, ou l'onglet d'un site du Studio (`piece:croquis`). */
function cleDe(chemin: string): string {
  const piece = /^\/studio\/pieces\/[^/]+(?:\/([^/]+))?/.exec(chemin);
  if (piece) return `piece:${piece[1] ?? 'croquis'}`;
  return chemin;
}

export function DescriptionEcran() {
  const { pathname } = useLocation();
  const { langue } = useLangue();
  const cle = cleDe(pathname);
  const [deja, setDeja] = useState<string[]>(vues);
  const texte = descriptionEcran(cle);
  if (!texte || deja.includes(cle)) return null;
  const compris = () => {
    const suivantes = [...new Set([...deja, cle])];
    setDeja(suivantes);
    try {
      localStorage.setItem(CLE, JSON.stringify(suivantes));
    } catch {
      /* stockage indisponible : la ligne reviendra, sans gravité */
    }
  };
  return (
    <div
      data-description-ecran
      className="mb-[18px] flex flex-wrap items-center gap-x-4 gap-y-2 border border-border px-4 py-3"
      style={{ background: 'rgba(255,255,255,.02)' }}
    >
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-text-body">
        <span className="mr-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
          {langue === 'en' ? 'What this screen is for' : 'À quoi sert cet écran'}
        </span>
        <span className="font-semibold text-text-primary">{nomEcran(cle, '')}</span>
        {' — '}
        {texte}
      </p>
      <button type="button" className="bx-btn2" onClick={compris}>
        {langue === 'en' ? 'Got it' : 'Compris'}
      </button>
    </div>
  );
}

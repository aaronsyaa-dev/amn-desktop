import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { touchePrincipale } from '../jetons';
import { useNavigationEspaces } from '../navigation';
import { poserAmbiance, poserVarianteSas, useReglagesBureaux, type VarianteSas } from '../ambiance';
import { isElectron } from '../../lib/platform';

/**
 * « ? » — TOUS LES RACCOURCIS DES BUREAUX (cahier 11, `44d`), et les deux
 * réglages de ce poste qui vont avec : l'Ambiance, et le sas joué à la
 * première entrée dans un bureau (« La porte » ou « La plongée »).
 */
export function AideRaccourcis() {
  const nav = useNavigationEspaces();
  if (!nav.aide) return null;
  return <Aide onClose={nav.fermerAide} />;
}

function Aide({ onClose }: { onClose: () => void }) {
  const t = touchePrincipale();
  const { ambiance, reduit, sas } = useReglagesBureaux();
  const fermer = useRef<HTMLButtonElement>(null);
  useEffect(() => fermer.current?.focus(), []);
  const lignes: [string, string][] = [
    [`${t} E`, 'ouvrir la palette d’espaces — partout'],
    ['G puis 0', 'revenir au poste de travail'],
    ['G puis 1 à 5', 'Supervisor, Cyber, Studio, Stratégie, La Garde'],
    ['1 à 9', 'les outils du bureau courant'],
    ['?', 'cette liste'],
    ['Échap', 'fermer la palette ou le panneau ouvert'],
  ];
  if (isElectron()) lignes.push(['F1 à F9', 'les mêmes outils que 1 à 9 — application installée seulement']);
  const choix: { v: VarianteSas; nom: string; dit: string }[] = [
    { v: 'porte', nom: 'La porte', dit: 'la plus sobre : une couture de lumière, aucun texte' },
    { v: 'plongee', nom: 'La plongée', dit: 'un carton-titre dit ce qui vous attend, puis rejoint la barre' },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-[240]">
      <div className="bx-voile absolute inset-0" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aide-bureaux-titre"
        data-aide-bureaux
        className="absolute left-1/2 top-16 w-[540px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-y-auto border border-[#2a2a2a] bg-[#111] shadow-[0_40px_80px_-30px_rgba(0,0,0,1)]"
        style={{ maxHeight: 'calc(100vh - 160px)' }}
      >
        <div className="flex items-center justify-between border-b border-[#222] px-5 py-4">
          <h2 id="aide-bureaux-titre" className="font-mono text-[10px] tracking-[0.2em] text-[#a3a3a0]">
            RACCOURCIS DES BUREAUX
          </h2>
          <button ref={fermer} type="button" onClick={onClose} aria-label="Fermer" className="p-1 text-[#a3a3a0] hover:text-[#f7f7f5]">
            <X size={15} />
          </button>
        </div>
        <dl className="px-5 py-2">
          {lignes.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_1fr] items-baseline gap-4 border-b border-[#1c1c1c] py-2.5 last:border-0">
              <dt className="font-mono text-[12px] font-medium text-[#f7f7f5]">{k}</dt>
              <dd className="text-[13px] text-[#a3a3a0]">{v}</dd>
            </div>
          ))}
        </dl>
        {!isElectron() && (
          <p className="px-5 pb-3 text-[12px] leading-relaxed text-[#9a9a97]">
            Dans un navigateur, F1 ouvre son aide et F5 recharge la page : les touches de fonction ne sont prises que par l’application installée.
          </p>
        )}
        <div className="border-t border-[#222] px-5 py-4">
          <div className="font-mono text-[9.5px] tracking-[0.2em] text-[#9a9a97]">LE SAS DE CE POSTE</div>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Le sas joué à la première entrée dans un bureau">
            {choix.map((c) => (
              <button
                key={c.v}
                type="button"
                role="radio"
                aria-checked={sas === c.v}
                onClick={() => poserVarianteSas(c.v)}
                className="border px-3 py-2.5 text-left"
                style={{ borderColor: sas === c.v ? '#8a8a87' : '#2a2a2a', background: sas === c.v ? '#1c1c1c' : 'transparent' }}
              >
                <span className="block text-[13px] font-semibold text-[#f7f7f5]">{c.nom}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[#a3a3a0]">{c.dit}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2.5 text-[12.5px] text-[#a3a3a0]">
            <input type="checkbox" checked={ambiance && !reduit} disabled={reduit} onChange={(e) => poserAmbiance(e.target.checked)} className="accent-[#e4e4e1]" />
            Ambiance : mouvement ambiant et sas{reduit ? ' — coupés d’office, le système demande moins de mouvement' : ''}
          </label>
        </div>
      </div>
    </div>
  );
}

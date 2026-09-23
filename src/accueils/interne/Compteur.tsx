import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { EnTeteQG, SiGardeLue } from './communs';
import { enLettres } from '../lettres';
import { useQG } from './qg';
import { palettes } from './parc';

/**
 * I5 · LE COMPTEUR DE NUIT (`42e`).
 *
 * Deux afficheurs à palettes. Le grand compte ce que la Garde a réglé seule
 * sur sept jours ; une flèche ; le petit, en plaque ambre, compte les
 * dossiers qui restent pour un humain.
 *
 * Règles (ACCUEILS.md) : le grand afficheur a AUTANT DE PALETTES QUE DE
 * CHIFFRES, jamais de séparateur de milliers. Si le petit nombre vaut zéro,
 * il reste affiché en encre claire et l'écran n'a pas d'ambre. Quand un
 * nombre change, la palette concernée bascule une fois (180 ms) ; rien ne
 * bouge sinon.
 */
const SEPT_JOURS = 7;


function Afficheur({ n, grand, ambre }: { n: number; grand?: boolean; ambre?: boolean }) {
  const chiffres = palettes(n);
  /* Ce qui était affiché au rendu précédent : seule une palette qui CHANGE bascule. */
  const avant = useRef<string[] | null>(null);
  const precedent = avant.current;
  useEffect(() => {
    avant.current = chiffres;
  });
  return (
    <span className="flex gap-1.5">
      {chiffres.map((c, i) => {
        const bascule = precedent !== null && precedent.length === chiffres.length && precedent[i] !== c;
        return (
          <span
            key={`${i}-${c}`}
            className={`relative inline-flex items-center justify-center font-mono font-bold ${bascule ? 'palette-bascule' : ''} ${
              grand ? 'h-[64px] w-[46px] text-[44px] sm:h-[88px] sm:w-16 sm:text-[60px]' : 'h-[88px] w-[66px] text-[62px] sm:h-[122px] sm:w-[92px] sm:text-[86px]'
            } ${ambre ? 'border border-signal bg-signal text-[#080808] shadow-[0_0_34px_-8px_rgba(208,154,74,.85)]' : 'border border-[#2b2b2b] bg-border-row text-text-primary'}`}
          >
            <span className={`absolute inset-x-0 top-1/2 h-px ${ambre ? 'bg-[rgba(8,8,8,.35)]' : 'bg-bg'}`} />
            {c}
          </span>
        );
      })}
    </span>
  );
}

/** « Un pour onze mille » : le rapport, arrondi à ce qui se dit. */
function rapport(grand: number, petit: number): string | null {
  if (petit === 0 || grand === 0) return null;
  const r = grand / petit;
  if (r < 1000) return `Un pour ${enLettres(Math.round(r))}.`;
  const milliers = Math.round(r / 1000);
  return `Un pour ${milliers === 1 ? 'mille' : `${enLettres(milliers)} mille`}.`;
}

export function Compteur() {
  const q = useQG();
  const series = q.salle?.series?.reglees ?? {};
  const debut = new Date(q.maintenant);
  debut.setHours(0, 0, 0, 0);
  debut.setDate(debut.getDate() - (SEPT_JOURS - 1));
  const cle = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const depuis = cle(debut);
  const regle = Object.entries(series).reduce((s, [jour, n]) => (jour >= depuis ? s + n : s), 0);
  const pile = q.accueil?.pile;
  const petit = pile?.compte.dossiers ?? 0;
  const critiques = (pile?.dossiers ?? []).filter((d) => d.gravite === 'critique');
  const ambre = petit > 0;

  const phrase = [
    rapport(regle, petit),
    petit === 0
      ? 'Rien n’attend un humain.'
      : critiques.length === 0
        ? `${petit === 1 ? 'Le dossier n’est pas critique' : `Aucun des ${enLettres(petit)} dossiers n’est critique`} : Ajmani peut en recevoir le mandat.`
        : critiques.length === 1
          ? `${petit === 1 ? 'Le dossier est critique' : `Des ${enLettres(petit)} dossiers, un seul est critique`} et ne peut pas être confié à Ajmani : ${critiques[0].titre.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())}.`
          : `Des ${enLettres(petit)} dossiers, ${enLettres(critiques.length)} sont critiques et ne peuvent pas être confiés à Ajmani.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="Le compteur de nuit" />
        <section className="panel-raised panel-raised-wide px-5 pb-[30px] pt-[34px] sm:px-9">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">Sept jours de Garde</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">RÉGLÉ SEULE · RENDU À UN HUMAIN</span>
          </div>
          <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
            <div>
              <Afficheur n={regle} grand />
              <span className="mt-3.5 block font-mono text-[11px] tracking-[0.16em] text-text-muted">REMONTÉES RÉGLÉES SANS VOUS</span>
            </div>
            <span className="pb-16 font-mono text-[24px] text-[#4a4a48]" aria-hidden>
              →
            </span>
            <div data-signal-groupe={ambre ? 'humain' : undefined}>
              <Afficheur n={petit} ambre={ambre} />
              <span className={`mt-3.5 block font-mono text-[11px] font-bold tracking-[0.16em] ${ambre ? 'text-signal' : 'text-text-muted'}`}>
                {petit === 1 ? 'DOSSIER POUR VOUS' : 'DOSSIERS POUR VOUS'}
              </span>
            </div>
          </div>
          <p className="mt-[26px] max-w-[70ch] border-t border-border-raised pt-[18px] text-[14px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{phrase}</p>
          <div className="mt-[18px] flex flex-wrap gap-[9px]">
            <Link to="/garde/pile" className="flex min-h-11 items-center bg-text-primary px-[13px] text-[12.5px] font-semibold text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] sm:min-h-[30px]">
              À votre avis
            </Link>
            <Link to="/garde" className="flex min-h-11 items-center border border-border-strong px-[13px] text-[12.5px] font-semibold text-text-body sm:min-h-[30px]">
              Ce qui a été réglé
            </Link>
          </div>
        </section>
      </div>
    </SiGardeLue>
  );
}

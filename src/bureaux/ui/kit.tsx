import React, { createContext, useContext } from 'react';
import { Link } from 'react-router-dom';
import type { BureauKey } from '../jetons';
import { AMBRE } from '../jetons';
import { hhmm, jourMois } from '../format';
import { PastillePresence } from '../../components/PastillePresence';

/**
 * LE PETIT KIT DES ÉCRANS DE BUREAU — la tête (`shell().head`), les deux
 * cartes (`dom`, `calm`), la ligne de liste (`line`), le relevé (`stat`), et
 * les états (vide, chargement compté, erreur datée) des planches `46i`,
 * `47j`, `48e`, `49e`, `50d`.
 */

export const BureauCtx = createContext<BureauKey>('supervisor');
export const useBureau = () => useContext(BureauCtx);

const TITRES: Record<BureauKey, { normal: string; accueil: string }> = {
  supervisor: { normal: 'font-sans text-[36px] font-bold tracking-[-0.03em]', accueil: 'font-sans text-[44px] font-bold tracking-[-0.03em]' },
  cyber: { normal: 'font-mono text-[24px] font-semibold tracking-[-0.01em]', accueil: 'font-mono text-[24px] font-semibold tracking-[-0.01em]' },
  studio: { normal: 'font-sans text-[38px] font-bold tracking-[-0.03em]', accueil: 'font-sans text-[38px] font-bold tracking-[-0.03em]' },
  strategie: { normal: 'font-sans text-[34px] font-semibold tracking-[-0.03em]', accueil: 'font-sans text-[34px] font-semibold tracking-[-0.03em]' },
  garde: { normal: 'font-sans text-[36px] font-bold tracking-[-0.03em]', accueil: 'font-sans text-[36px] font-bold tracking-[-0.03em]' },
};

export function EnTete({
  surtitre,
  titre,
  lede,
  actions,
  accueil = false,
  largeurTitre,
  taille,
  marge = 24,
}: {
  surtitre?: React.ReactNode;
  titre: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  accueil?: boolean;
  largeurTitre?: string;
  /** Une taille de titre imposée par l'écran (le paquet la règle écran par écran : `hs`). */
  taille?: number;
  marge?: number;
}) {
  const b = useBureau();
  const classe = TITRES[b][accueil ? 'accueil' : 'normal'];
  return (
    <div className="flex flex-wrap items-end gap-6" style={{ marginBottom: marge }}>
      <div className="min-w-0 flex-1">
        {surtitre && <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#a3a3a0]">{surtitre}</span>}
        <h1 className={`${classe} text-balance leading-[1.08] text-[#f7f7f5] ${surtitre ? 'mt-3' : ''}`} style={{ maxWidth: largeurTitre, fontSize: taille }}>
          {titre}
        </h1>
        {lede && <p className="mt-3.5 max-w-[74ch] text-pretty text-[14.5px] leading-[1.65] text-[#a3a3a0]">{lede}</p>}
      </div>
      {/* La présence des collègues sur ce même écran (cahier 15) : à droite de l'en-tête, jamais dans le contenu. */}
      <div className="flex flex-none flex-wrap items-center gap-2.5" data-screen-actions>
        <PastillePresence />
        {actions}
      </div>
    </div>
  );
}

/** La tête d'une carte : son titre mono à gauche, une mention à droite. */
export function TeteCarte({ titre, droite, className = '' }: { titre: React.ReactNode; droite?: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-[22px] flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a3a3a0]">{titre}</span>
      {droite !== undefined && droite !== null && droite !== '' && <span className="ml-auto text-right font-mono text-[10px] uppercase tracking-[0.1em] text-[#9a9a97]">{droite}</span>}
    </div>
  );
}

export function Carte({
  dominante = false,
  titre,
  droite,
  children,
  className = '',
  pad = 'p-6',
  ...reste
}: {
  dominante?: boolean;
  titre?: React.ReactNode;
  droite?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'children' | 'className'>) {
  return (
    <section className={`${dominante ? 'bx-dom' : 'bx-calme'} ${pad} ${className}`} {...reste}>
      {titre && <TeteCarte titre={titre} droite={droite} />}
      {children}
    </section>
  );
}

/** La ligne des cartes calmes : une heure ou un code, une phrase, une mention. */
export function Ligne({ a, b, c, colonnes, ambre = false, groupe, lien }: { a: React.ReactNode; b: React.ReactNode; c?: React.ReactNode; colonnes?: string; ambre?: boolean; groupe?: string; lien?: string }) {
  const contenu = (
    <>
      <span className="whitespace-nowrap font-mono text-[11px] font-medium tabular-nums" style={{ color: ambre ? AMBRE : '#9a9a97' }}>{a}</span>
      <span className="text-pretty text-[13px] leading-[1.5] text-[#e4e4e1]">{b}</span>
      <span className="whitespace-nowrap font-mono text-[10.5px] font-medium uppercase" style={{ color: ambre ? AMBRE : '#9a9a97' }}>{c ?? ''}</span>
    </>
  );
  const style = { gridTemplateColumns: colonnes ?? '64px minmax(0,1fr) auto' };
  return lien ? (
    <Link to={lien} className="bx-ligne hover:bg-white/[0.02]" style={style} data-signal-groupe={ambre ? groupe : undefined}>
      {contenu}
    </Link>
  ) : (
    <div className="bx-ligne" style={style} data-signal-groupe={ambre ? groupe : undefined}>
      {contenu}
    </div>
  );
}

export function Stat({ l, v, couleur }: { l: React.ReactNode; v: React.ReactNode; couleur?: string }) {
  return (
    <span>
      <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#9a9a97]">{l}</span>
      <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-[-0.03em]" style={{ color: couleur ?? '#f7f7f5' }}>
        {v}
      </span>
    </span>
  );
}

/** Le lien souligné du paquet (« Ouvrir la file »). */
export function LienFort({ to, children, onClick }: { to?: string; children: React.ReactNode; onClick?: () => void }) {
  if (to) {
    return (
      <Link to={to} className="bx-lien inline-block">
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="bx-lien inline-block">
      {children}
    </button>
  );
}

/**
 * LES ÉTATS D'UN INSTRUMENT (planches `46i`, `47j`, `48e`, `49e`, `50d`).
 *
 * · Chargement : un compte réel quand on l'a, rien de trié avant la fin.
 * · Erreur : le dernier état connu reste, estompé, hachuré et daté ; la
 *   raison est dite ; l'ambre va à la relance. Une erreur ne vide jamais
 *   l'écran.
 */
export function Chargement({ texte = 'Relevé en cours', compte }: { texte?: string; compte?: { n: number; sur: number } | null }) {
  return (
    <div className="flex items-center gap-3 py-10 font-mono text-[11px] tracking-[0.12em] text-[#a3a3a0]" role="status" aria-live="polite">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a3a3a0]" data-mv />
      {texte.toUpperCase()}
      {compte && (
        <span className="tabular-nums text-[#e4e4e1]">
          {compte.n} / {compte.sur}
        </span>
      )}
    </div>
  );
}

export function Erreur({ pannes, at, relancer, children }: { pannes: string[]; at: string | null; relancer: () => void; children?: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-4 border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3" role="alert">
        <span className="text-[13px] text-[#e4e4e1]">
          {pannes.length ? `Sans réponse : ${pannes.join(', ')}.` : 'Le relevé n’a pas abouti.'} {at ? `Dernier état connu : ${jourMois(at)}, ${hhmm(at)}.` : 'Aucun état antérieur.'}
        </span>
        <button type="button" onClick={relancer} className="ml-auto inline-flex h-8 items-center px-3.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ background: AMBRE, color: '#080808' }}>
          Relancer
        </button>
      </div>
      {children && (
        <div className="pointer-events-none relative opacity-45" aria-hidden>
          {children}
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 7px)' }} />
        </div>
      )}
    </div>
  );
}

/** Un instrument vide : dessiné sans données, une invitation, pas d'ambre, aucun zéro. */
export function Invitation({ titre, texte, action }: { titre: string; texte: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-[#2f2f2f] px-6 py-8">
      <span className="text-[15px] font-semibold text-[#f7f7f5]">{titre}</span>
      <span className="max-w-[62ch] text-[13.5px] leading-relaxed text-[#a3a3a0]">{texte}</span>
      {action}
    </div>
  );
}

/** Deux cartes calmes côte à côte, sous l'objet dominant. */
export function Paire({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">{children}</div>;
}

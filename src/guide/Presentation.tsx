import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Lock, HelpCircle } from 'lucide-react';
import { PRESENTATION } from '@edition/guide';
import { texte, type PagePresentation } from './profils';
import { useLangue } from '../i18n';

/**
 * LA PRÉSENTATION DU PRODUIT — ce que la cliente a entre les mains (U4).
 *
 * Avant : un message texte avec un identifiant et un mot de passe, puis la
 * porte « Qui êtes-vous ? ». Rien ne disait où l'on arrivait. Maintenant, à la
 * première connexion, le produit se présente lui-même en quelques pages —
 * une idée par page, un dessin fait des briques du système (la coquille, l'axe
 * de la journée, les tuiles de famille), sans image importée. Puis la porte,
 * puis la visite guidée existante.
 *
 * Plein écran, au-dessus de tout ; ← → et clic pour avancer, Échap pour passer.
 * Aucun ambre : rien ici n'attend une décision.
 */
export function Presentation({ orgName, onFin }: { orgName: string; onFin: () => void }) {
  const { t } = useLangue();
  const [i, setI] = useState(0);
  const reduit = useReducedMotion();
  const pages = PRESENTATION;
  const page = pages[i];
  const derniere = i === pages.length - 1;
  const suivant = useCallback(() => (derniere ? onFin() : setI((n) => n + 1)), [derniere, onFin]);
  const precedent = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') suivant();
      else if (e.key === 'ArrowLeft') precedent();
      else if (e.key === 'Escape') onFin();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [suivant, precedent, onFin]);

  return (
    <div className="fixed inset-0 z-[295] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={t('accueilProduit.titre')} data-presentation>
      <div className="flex items-center justify-between px-5 pt-5 md:px-10 md:pt-8">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">{orgName}</span>
        <button type="button" onClick={onFin} className="min-h-11 px-2 text-[13px] text-text-secondary hover:text-text-primary md:min-h-9">
          {t('accueilProduit.passer')}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-6 md:px-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={reduit ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduit ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-14"
          >
            <div className="min-w-0">
              <p className="eyebrow mb-3">
                {texte(page.sur)} · {i + 1} / {pages.length}
              </p>
              <h1 className="text-[28px] font-bold leading-[1.08] tracking-[-0.03em] text-text-primary [text-wrap:balance] md:text-[40px]">{texte(page.titre)}</h1>
              <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.7] text-text-secondary">{texte(page.texte)}</p>
            </div>
            <div className="panel-raised flex min-h-[220px] items-center justify-center p-6" aria-hidden>
              <Dessin quoi={page.dessin} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-6 md:px-10 md:pb-10">
        <div className="flex gap-1.5" aria-hidden>
          {pages.map((_, n) => (
            <span key={n} className={`h-1 w-6 ${n === i ? 'bg-text-primary' : n < i ? 'bg-text-secondary' : 'bg-border-strong'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {i > 0 && (
            <button type="button" onClick={precedent} aria-label={t('accueilProduit.precedent')} className="flex h-11 w-11 items-center justify-center border border-border-strong text-text-body hover:bg-surface-hover">
              <ArrowLeft size={16} />
            </button>
          )}
          <button type="button" onClick={suivant} className="flex h-11 items-center gap-2 bg-accent px-5 text-[14px] font-semibold text-bg hover:bg-accent-hover">
            {derniere ? t('accueilProduit.commencer') : t('accueilProduit.suivant')}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Les dessins : des briques du système, pas des illustrations. */
function Dessin({ quoi }: { quoi: PagePresentation['dessin'] }) {
  const tuile = (code: string, n: number, on = false) => (
    <span key={code} className={`flex h-[38px] w-[38px] flex-col items-center justify-center border font-mono text-[10px] leading-none ${on ? 'border-border-strong bg-elevated text-text-primary' : 'border-border text-text-muted'}`}>
      {code}
      <span className="mt-1 text-[8px]">{n}</span>
    </span>
  );
  if (quoi === 'coquille' || quoi === 'familles' || quoi === 'supervision') {
    const codes: [string, number][] = quoi === 'supervision' ? [['LG', 6], ['SU', 4], ['PA', 7], ['PD', 3]] : [['PI', 16], ['CR', 14], ['PR', 17], ['FI', 9], ['CO', 10]];
    return (
      <div className="flex w-full max-w-[340px] gap-4">
        <div className="flex flex-col gap-[6px]">{codes.map(([c, n], k) => tuile(c, n, k === 0))}</div>
        <div className="flex flex-1 flex-col gap-2 pt-1">
          {codes.map(([c], k) => (
            <span key={c} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `var(--famille-${c})` }} />
              <span className={`h-2 ${k === 0 ? 'w-3/4 bg-text-secondary' : 'w-1/2 bg-border-strong'}`} />
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (quoi === 'journee') {
    return (
      <div className="w-full max-w-[360px]">
        <div className="relative h-16 border border-border">
          {[0, 1, 2, 3, 4, 5].map((h) => <span key={h} className="absolute top-0 h-full w-px bg-border" style={{ left: `${h * 20}%` }} />)}
          <span className="absolute top-3 h-10 bg-raised" style={{ left: '14%', width: '18%' }} />
          <span className="absolute top-3 h-10 bg-raised" style={{ left: '48%', width: '26%' }} />
          <span className="absolute top-0 h-full w-0.5 bg-text-primary" style={{ left: '38%' }} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9px] text-text-muted"><span>08</span><span>12</span><span>16</span><span>20</span></div>
        <div className="mt-4 flex flex-col gap-2">
          <span className="h-2 w-2/3 bg-text-secondary" />
          <span className="h-2 w-1/2 bg-border-strong" />
        </div>
      </div>
    );
  }
  if (quoi === 'equipe') {
    return (
      <div className="flex -space-x-2">
        {['NA', 'SO', 'KA', 'LE', 'YA'].map((x, k) => (
          <span key={x} className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-bg bg-elevated font-mono text-[12px] text-text-primary">
            {x}
            {k < 2 && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg bg-success" />}
          </span>
        ))}
      </div>
    );
  }
  if (quoi === 'aide') return <HelpCircle size={64} strokeWidth={1.2} className="text-text-secondary" />;
  return <Lock size={64} strokeWidth={1.2} className="text-text-secondary" />;
}

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useLangue } from '../i18n';
import type { Etape, Parcours } from './types';

/**
 * LE PROJECTEUR, LE CURSEUR ET LA CARTE — la mécanique de toute visite.
 *
 * Trois choses à l'écran, et rien d'autre :
 *
 *   · un VOILE qui éteint tout sauf la cible, découpée au projecteur (une
 *     ombre portée immense autour d'un rectangle) ;
 *   · un CURSEUR simulé, qui part du coin de l'écran et se déplace jusqu'à
 *     la cible — c'est lui qui montre où on cliquera, mieux qu'une flèche ;
 *   · une CARTE courte, à côté de la cible : un titre, deux phrases, et les
 *     gestes (précédent, suivant, passer).
 *
 * On avance en cliquant à droite de l'écran, on recule en cliquant à gauche
 * (le brief le demande ainsi), ← → au clavier, Échap pour passer. Une étape
 * dont la cible n'existe pas est sautée dans le sens du déplacement — la
 * colonne latérale n'existe pas sous `md`, et une visite qui s'arrêterait sur
 * un rectangle vide aurait l'air cassée.
 *
 * PAS D'AMBRE. Le projecteur est en encre claire : pendant la visite, le voile
 * éteint l'écran et la cible est le seul objet allumé — c'est déjà le signal.
 * Un liseré ambre ici, par-dessus un écran qui a déjà son objet ambre, ferait
 * deux signaux. `prefers-reduced-motion` : le curseur se pose sans glisser,
 * le projecteur ne coulisse pas.
 */
const MARGE = 8;
const LARGEUR_CARTE = 328;
const DELAI_CIBLE_MS = 2500;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const estEtroit = () => typeof window !== 'undefined' && window.innerWidth < 768;

/** Le sélecteur de l'étape à cette largeur ; `null` = carte centrée. */
function selecteurDe(e: Etape): string | null {
  if (estEtroit() && e.cibleMobile !== undefined) return e.cibleMobile;
  return e.cible;
}

function rectDe(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - MARGE, y: r.top - MARGE, w: r.width + 2 * MARGE, h: r.height + 2 * MARGE };
}

export function GuideOverlay({ parcours, onFin }: { parcours: Parcours; onFin: () => void }) {
  const { t } = useLangue();
  const reduit = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [cible, setCible] = useState<Element | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [arrive, setArrive] = useState(false);
  /* Tant que la cible se cherche, rien ne s'affiche : une carte centrée sur du vide dirait « regardez là » sans rien montrer. */
  const [pret, setPret] = useState(false);
  const sens = useRef<1 | -1>(1);
  const carte = useRef<HTMLDivElement | null>(null);
  const etape = parcours.etapes[index];
  const total = parcours.etapes.length;

  /* ── Trouver la cible (en attendant un peu qu'elle apparaisse), ou sauter ── */
  useEffect(() => {
    if (!etape) return;
    const sel = selecteurDe(etape);
    setArrive(false);
    setPret(false);
    if (sel === null) {
      setCible(null);
      setRect(null);
      setPret(true);
      return;
    }
    let vivant = true;
    const debut = Date.now();
    const chercher = () => {
      if (!vivant) return;
      const el = document.querySelector(sel);
      if (el && (el as HTMLElement).getBoundingClientRect().width > 0) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduit ? 'auto' : 'smooth' });
        setCible(el);
        setPret(true);
        return;
      }
      if (Date.now() - debut > DELAI_CIBLE_MS) {
        /* Introuvable : on saute dans le sens du déplacement, sans s'arrêter sur du vide. */
        const suivant = index + sens.current;
        if (suivant < 0 || suivant >= total) onFin();
        else setIndex(suivant);
        return;
      }
      window.setTimeout(chercher, 120);
    };
    chercher();
    return () => {
      vivant = false;
    };
  }, [etape, index, total, onFin, reduit]);

  /* ── Suivre la cible : défilement, redimensionnement, mise en page qui bouge ── */
  useLayoutEffect(() => {
    if (!cible) return;
    let raf = 0;
    const mesurer = () => {
      raf = 0;
      setRect(rectDe(cible));
    };
    const demander = () => {
      if (!raf) raf = window.requestAnimationFrame(mesurer);
    };
    mesurer();
    const intervalle = window.setInterval(mesurer, 300);
    window.addEventListener('resize', demander);
    window.addEventListener('scroll', demander, true);
    return () => {
      window.clearInterval(intervalle);
      window.removeEventListener('resize', demander);
      window.removeEventListener('scroll', demander, true);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [cible]);

  /* ── Les gestes ── */
  const aller = useCallback(
    (d: 1 | -1) => {
      sens.current = d;
      const suivant = index + d;
      if (suivant >= total) onFin();
      else if (suivant >= 0) setIndex(suivant);
    },
    [index, total, onFin],
  );
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFin();
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        aller(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        aller(-1);
      }
    };
    window.addEventListener('keydown', surTouche, true);
    return () => window.removeEventListener('keydown', surTouche, true);
  }, [aller, onFin]);
  useEffect(() => {
    carte.current?.focus();
  }, [index]);

  /* ── Où poser la carte ── */
  const position = useMemo((): React.CSSProperties => {
    /* Au téléphone : en bas, sauf quand la cible est en bas (la barre du pouce) — alors en haut, pour ne pas la couvrir. */
    if (estEtroit()) {
      const enBas = rect ? rect.y + rect.h / 2 > window.innerHeight / 2 : false;
      return enBas ? { left: 12, right: 12, top: 'calc(env(safe-area-inset-top) + 12px)' } : { left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 12px)' };
    }
    if (!rect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: LARGEUR_CARTE };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cote = etape?.cote ?? 'auto';
    const hauteurCarte = 190;
    const placeDroite = vw - (rect.x + rect.w) - 16;
    const placeGauche = rect.x - 16;
    const placeBas = vh - (rect.y + rect.h) - 16;
    let choisi = cote;
    if (choisi === 'auto') {
      if (placeDroite >= LARGEUR_CARTE) choisi = 'droite';
      else if (placeGauche >= LARGEUR_CARTE) choisi = 'gauche';
      else if (placeBas >= hauteurCarte) choisi = 'bas';
      else choisi = 'haut';
    }
    const clampY = (y: number) => Math.min(Math.max(12, y), vh - hauteurCarte - 12);
    const clampX = (x: number) => Math.min(Math.max(12, x), vw - LARGEUR_CARTE - 12);
    if (choisi === 'droite') return { left: rect.x + rect.w + 14, top: clampY(rect.y), width: LARGEUR_CARTE };
    if (choisi === 'gauche') return { left: rect.x - LARGEUR_CARTE - 14, top: clampY(rect.y), width: LARGEUR_CARTE };
    if (choisi === 'bas') return { left: clampX(rect.x), top: rect.y + rect.h + 14, width: LARGEUR_CARTE };
    return { left: clampX(rect.x), top: Math.max(12, rect.y - hauteurCarte - 14), width: LARGEUR_CARTE };
  }, [rect, etape]);

  /* Le curseur vise le tiers bas-droit de la cible : c'est là qu'une main clique. */
  /* Sur une cible haute (le rail entier), il vise le haut : c'est la première tuile qu'on regarde. */
  const pointe = rect
    ? { x: rect.x + Math.min(rect.w * 0.62, rect.w - 18, 160), y: rect.y + Math.min(rect.h * 0.66, rect.h - 14, 52) }
    : { x: window.innerWidth - 80, y: window.innerHeight - 80 };

  if (!etape || !pret) return null;

  const surClicVoile = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    aller(e.clientX < window.innerWidth / 2 ? -1 : 1);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] select-none"
      onClick={surClicVoile}
      onWheel={(e) => e.preventDefault()}
      data-guide-overlay
    >
      {/* Le projecteur : un rectangle transparent, une ombre immense autour. Sans cible, le voile seul. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute border border-text-primary ${reduit ? '' : 'transition-[left,top,width,height] duration-300 ease-out'}`}
        style={{
          left: rect ? rect.x : '50%',
          top: rect ? rect.y : '50%',
          width: rect ? rect.w : 0,
          height: rect ? rect.h : 0,
          borderRadius: 6,
          borderColor: rect ? undefined : 'transparent',
          boxShadow: '0 0 0 200vmax color-mix(in srgb, var(--color-bg) 82%, transparent)',
        }}
      />

      {/* Le curseur simulé : il part du coin, glisse jusqu'à la cible et « clique ». */}
      {rect && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          initial={false}
          animate={{ x: pointe.x, y: pointe.y }}
          transition={reduit ? { duration: 0 } : { type: 'spring', stiffness: 110, damping: 20, mass: 0.9 }}
          onAnimationComplete={() => setArrive(true)}
        >
          {arrive && !reduit && (
            <motion.span
              className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-text-primary"
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          )}
          <svg width="22" height="26" viewBox="0 0 22 26" className="drop-shadow-[0_2px_4px_rgba(0,0,0,.9)]">
            <path d="M2 2 L2 20 L7 15.5 L10.5 23 L14 21.5 L10.5 14 L17 14 Z" fill="var(--color-text-primary)" stroke="var(--color-bg)" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}

      {/* La carte de l'étape */}
      <div
        ref={carte}
        role="dialog"
        aria-modal="true"
        aria-label={etape.titre}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="absolute border border-border-raised bg-elevated p-4 shadow-[0_34px_62px_-28px_rgba(0,0,0,1)] outline-none"
        style={position}
      >
        <span className="tnum block font-mono text-[10px] tracking-[0.16em] text-text-muted">
          {t('guide.etape', { n: index + 1, total })}
        </span>
        <p className="mt-2 text-[15px] font-bold leading-snug text-text-primary [text-wrap:balance]">{etape.titre}</p>
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{etape.texte}</p>
        <div className="mt-3.5 flex items-center gap-1.5" aria-hidden>
          {parcours.etapes.map((_, i) => (
            <span key={i} className={`h-1 flex-1 ${i <= index ? 'bg-text-primary' : 'bg-border-strong'}`} />
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onFin} className="min-h-11 px-2 text-[12.5px] text-text-muted hover:text-text-primary md:min-h-8">
            {t('guide.passer')}
          </button>
          <span className="flex-1" />
          {index > 0 && (
            <button
              type="button"
              onClick={() => aller(-1)}
              className="min-h-11 border border-border-strong px-3 text-[12.5px] font-semibold text-text-body hover:bg-surface-hover md:min-h-8"
            >
              {t('guide.precedent')}
            </button>
          )}
          <button
            type="button"
            onClick={() => aller(1)}
            className="min-h-11 bg-accent px-3.5 text-[12.5px] font-semibold text-bg hover:bg-accent-hover md:min-h-8"
          >
            {index + 1 >= total ? t('guide.terminer') : t('guide.suivant')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

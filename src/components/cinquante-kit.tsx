import React from 'react';
import { motion } from 'framer-motion';
import { EcranVide, useEtatEcran } from './EtatEcran';
import { staggerContainer, staggerItem } from '../lib/transitions';

/**
 * LA CHARPENTE DES QUARANTE-CINQ MODULES DU CHANTIER DES CINQUANTE
 * ════════════════════════════════════════════════════════════════
 *
 * Les quarante-cinq écrans des cahiers 6, 7 et 8 ont TOUS la même charpente,
 * relevée au pixel sur le HTML des cahiers (`34a` fait foi) :
 *
 *   en-tête (ScreenHeader)
 *   ─ 24 px ─
 *   la carte dominante   padding 30 / 32 / 26, #121212, bordure #262626,
 *                        liseré interne, ombre longue ; surtitre à gauche,
 *                        note mono 10 px à droite, 22 px sous la ligne
 *   ─ 24 px ─
 *   deux cartes calmes   grille `1fr 340px`, gouttière 18 ; à gauche
 *                        `20/22/18`, à droite `20/20/18` avec ses relevés
 *
 * Écrire cette charpente quarante-cinq fois, c'est garantir quarante-cinq
 * petites divergences : un 20 px ici, un 22 là, une gouttière de 16 ailleurs.
 * Le paquet l'a dit à propos de la barre latérale, et c'est vrai de tout ce
 * qui se répète : « la divergence entre deux copies est le défaut le plus
 * coûteux de ce projet ». La charpente vit donc ici, une fois.
 *
 * Ce qui N'EST PAS ici : l'instrument. Chaque module dessine le sien, avec sa
 * géométrie dérivée de ses données (`src/lib/cinquante/*`). La charpente ne
 * sait rien de ce qu'elle porte.
 */

/** L'écran : l'état vide déclaré (pour `check:signal`) et l'entrée en cascade. */
export function Ecran50({
  vide,
  premierJour = false,
  children,
}: {
  /** Aucune donnée : pas d'ambre, aucun chiffre à zéro (`27a`, `27b`). */
  vide: boolean;
  premierJour?: boolean;
  children: React.ReactNode;
}) {
  return (
    <EcranVide quand={vide} premierJour={premierJour}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6">
        {children}
      </motion.section>
    </EcranVide>
  );
}

/** Un bloc de l'écran, qui entre dans la cascade. */
export function Bloc({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

/** La ligne de tête d'une carte : surtitre à gauche, note technique à droite. */
function TeteCarte({ surtitre, note, marge = 'mb-[22px]' }: { surtitre: string; note?: React.ReactNode; marge?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${marge}`}>
      <span className="eyebrow text-text-secondary">{surtitre}</span>
      {note !== undefined && note !== null && note !== '' && (
        <span className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{note}</span>
      )}
    </div>
  );
}

/**
 * LA CARTE DOMINANTE — une par écran, jamais deux.
 *
 * `padding: 30px 32px 26px` et l'ombre longue de la variante large
 * (`0 34px 62px -28px`) : ce sont les valeurs de toutes les dominantes des
 * cahiers 6 à 8, qui ne varient pas d'un module à l'autre.
 */
export function Dominante({
  surtitre,
  note,
  children,
  className = '',
  ...reste
}: {
  surtitre: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>) {
  return (
    <motion.section
      variants={staggerItem}
      className={`panel-raised panel-raised-wide min-w-0 px-5 pb-[26px] pt-[30px] sm:px-8 ${className}`}
      {...(reste as Record<string, unknown>)}
    >
      <TeteCarte surtitre={surtitre} note={note} />
      {children}
    </motion.section>
  );
}

/**
 * LE PIED DE LA DOMINANTE — la phrase qui dit ce que l'instrument montre, et
 * au plus une action secondaire. Séparé par le filet `#262626` de la carte.
 */
export function PiedDominante({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-border-raised pt-5">
      <p className="min-w-[16rem] flex-1 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{children}</p>
      {action && <span className="flex-none">{action}</span>}
    </div>
  );
}

/** Les deux cartes calmes, sous la dominante : `1fr 340px`, gouttière 18. */
export function Calmes({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={staggerItem} className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
      {children}
    </motion.div>
  );
}

/** La carte calme de gauche : une liste, un tableau, un registre. */
export function CarteCalme({
  surtitre,
  note,
  children,
}: {
  surtitre: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel min-w-0 px-5 pb-[18px] pt-5 sm:px-[22px]">
      <TeteCarte surtitre={surtitre} note={note} />
      {children}
    </section>
  );
}

/** Un relevé de la carte de droite : libellé mono en capitales, chiffre mono 19 px. */
export interface Releve50 {
  label: string;
  valeur: React.ReactNode;
}

/**
 * La carte calme de droite : trois relevés au plus, et une phrase en pied.
 *
 * Sur un écran vide, la carte ne montre PAS ses relevés : trois zéros en mono
 * seraient lus comme un échec (`27b`). Elle garde sa phrase, en encre pleine.
 */
export function CarteReleves({
  surtitre,
  releves,
  children,
}: {
  surtitre: string;
  releves: Releve50[];
  /** La phrase de pied. */
  children?: React.ReactNode;
}) {
  const { vide } = useEtatEcran();
  return (
    <section className="panel flex min-w-0 flex-col px-5 pb-[18px] pt-5">
      <span className="eyebrow text-text-secondary">{surtitre}</span>
      {!vide && (
        <div className="mt-[18px] flex flex-col gap-4">
          {releves.map((r) => (
            <span key={r.label}>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{r.label}</span>
              <span className="tnum mt-1.5 block font-mono text-[19px] font-semibold tracking-[-0.03em] text-text-primary">
                {r.valeur}
              </span>
            </span>
          ))}
        </div>
      )}
      {children && <p className="mt-auto pt-[18px] text-[13px] leading-[1.55] text-text-secondary">{children}</p>}
    </section>
  );
}

/**
 * Une ligne à barre proportionnelle — le registre le plus fréquent des cartes
 * calmes (`minmax(0,1fr) 150px 96px`). La barre est un rapport, jamais une
 * largeur écrite à la main.
 */
export function LigneBarre({
  nom,
  part,
  valeur,
  derniere = false,
}: {
  nom: React.ReactNode;
  /** Entre 0 et 1. */
  part: number;
  valeur: React.ReactNode;
  derniere?: boolean;
}) {
  const p = Math.max(0, Math.min(1, Number.isFinite(part) ? part : 0));
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_minmax(48px,150px)_auto] items-center gap-3 py-[11px] sm:gap-4 ${
        derniere ? '' : 'border-b border-border-row'
      }`}
    >
      {/* Le nom va à la ligne plutôt que de se tronquer : dans une carte calme, c'est lui qu'on lit. */}
      <span className="min-w-0 text-[13.5px] leading-snug text-text-primary [overflow-wrap:anywhere]">{nom}</span>
      <span className="h-1.5 bg-[#191919]">
        <span className="block h-1.5 bg-[#4a4a48]" style={{ width: `${(p * 100).toFixed(1)}%` }} />
      </span>
      <span className="tnum whitespace-nowrap text-right font-mono text-[12px] font-medium text-text-secondary">{valeur}</span>
    </div>
  );
}

/** Une ligne de registre à colonnes libres (heure, nom, relevé…). */
export function LigneRegistre({
  colonnes,
  children,
  derniere = false,
}: {
  colonnes: string;
  children: React.ReactNode;
  derniere?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-4 py-[11px] ${derniere ? '' : 'border-b border-border-row'}`}
      style={{ gridTemplateColumns: colonnes }}
    >
      {children}
    </div>
  );
}

/** Le bouton secondaire des cahiers : 30 px, bordure `#3a3a3a`, encre `#e4e4e1`. */
export function BoutonSecondaire({
  children,
  onClick,
  disabled,
  type = 'button',
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex min-h-11 items-center justify-center gap-2 border border-border-strong px-[13px] text-[12.5px] font-semibold text-text-body transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[30px]"
    >
      {children}
    </button>
  );
}

/**
 * Le bouton primaire : `#f7f7f5` sur `#0a0a0a`, ombre de bouton — et, INACTIF,
 * fond `#242424`, encre sourde et AUCUNE ombre (README §3.2 bis) : c'est la
 * perte d'élévation qui le rend inactif à l'œil, pas seulement le gris.
 */
export function BoutonPrimaire({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 items-center justify-center gap-2 px-[13px] text-[12.5px] font-semibold transition-colors sm:min-h-[30px] ${
        disabled
          ? 'cursor-not-allowed bg-action-inactive text-action-inactive-ink'
          : 'bg-text-primary text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] hover:bg-accent-hover'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * LES HACHURES — et le piège qu'elles ont déjà tendu.
 *
 * `repeating-linear-gradient` et `linear-gradient` s'écrivent presque pareil
 * et ne font pas du tout la même chose : le second ne pose qu'une marque, au
 * ras du bord (README, contrôle 3). Toutes les hachures des quarante-cinq
 * modules passent donc par ici, et c'est toujours la version RÉPÉTÉE.
 */
export function hachure(couleur: string, pas = 7, trait = 3, angle = 135): string {
  return `repeating-linear-gradient(${angle}deg, ${couleur} 0 ${trait}px, transparent ${trait}px ${pas}px)`;
}

/** L'encre du surtitre d'une plaque ambre (`#3a2a0e`) — lisible sur `#d09a4a`, et seulement là. */
export const ENCRE_SURTITRE_PLAQUE = 'text-[#3a2a0e]';

/** Le relevé d'un en-tête d'écran : « 30 jours · 38 paniers · 22 payés ». */
export function noteTechnique(morceaux: Array<string | false | null | undefined>): string {
  return morceaux.filter(Boolean).join(' · ');
}

/**
 * Ce qu'on réécrit d'un enregistrement lu par `useCollection` : ses DONNÉES,
 * sans `id` ni `updatedAt`. Réécrire `updatedAt` dans les données ferait
 * mentir l'horodatage du serveur, qui décide des conflits.
 */
export function donnees<T extends { id: string; updatedAt?: string }>(r: T): Omit<T, 'id' | 'updatedAt'> {
  const reste: Record<string, unknown> = { ...r };
  delete reste.id;
  delete reste.updatedAt;
  return reste as Omit<T, 'id' | 'updatedAt'>;
}

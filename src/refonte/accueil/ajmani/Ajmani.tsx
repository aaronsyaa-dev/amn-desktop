import React, { useEffect, useRef, useState } from 'react';
import { motion, type TargetAndTransition, type Transition } from 'framer-motion';
import { useMouvement, type NiveauMouvement } from '../../../socle/mouvement';
import { POSES, type Emotion } from './expressions';
import { ATTACHES, CADRE, CADRE_TETE, TEINTES_AJMANI, pivot, type Teintes } from './briques/commun';
import { DefsAjmani, ECRAN, useIdsAjmani } from './briques/Defs';
import { Bras, Corps } from './briques/Corps';
import { Antenne, Cable, Ombre, TeteTele } from './briques/TeteTele';
import { Glitch, Visage } from './briques/Visage';
import { useClignement, useRegard } from './useVie';

/**
 * AJMANI — le guide de l'app, en 2D animée (SVG + framer-motion).
 * ═══════════════════════════════════════════════════════════════
 *
 * Un corps blanc d'un seul tenant, une très grosse tête-télé, de petits bras.
 * Il respire, cligne quand il veut (3 à 6 s, jamais régulier), suit la souris
 * des yeux, et fait quelques gestes : pointer, hausser les épaules, hocher la
 * tête, sautiller, saluer.
 *
 * ## Le réglage Mouvement (socle)
 *
 *   complet — tout ce qui précède ;
 *   reduit  — la pose et l'expression seulement : rien ne respire, ne cligne
 *             ni ne saute, les changements sont immédiats ;
 *   aucun   — une image fixe.
 *
 * Il ne prend jamais le focus et ne capte pas les clics : c'est un dessin
 * (`role="img"`). Qui veut le rendre cliquable l'enveloppe d'un bouton.
 *
 * Les briques (`briques/`) sont réutilisables telles quelles par les robots à
 * métiers (S4) : même repère, mêmes points d'attache, couleurs en paramètre.
 */

export type Geste = 'pointer' | 'hausser' | 'hocher' | 'sautiller' | 'saluer';

export interface AjmaniProps {
  emotion?: Emotion;
  /** Un geste ; changer `cleGeste` le rejoue. `pointer` est tenu tant qu'il est demandé. */
  geste?: Geste | null;
  cleGeste?: number;
  /** Vers où il pointe. */
  direction?: 'gauche' | 'droite';
  /** Hauteur rendue, en pixels. */
  taille?: number;
  /** `tete` : la petite version (appels, réactions) — la tête seule. */
  cadrage?: 'entier' | 'tete';
  /** Rebond d'arrivée au premier rendu. */
  entree?: boolean;
  /** `legere` retire la lueur ; par défaut, selon la puissance de l'appareil. */
  qualite?: 'haute' | 'legere';
  /** Force un niveau de mouvement (la page d'aperçu) ; sinon le réglage du poste. */
  mouvement?: NiveauMouvement;
  teintes?: Teintes;
  /** Posé au-dessus de la tête (les robots à métiers). */
  accessoire?: React.ReactNode;
  /** Écran éteint (`false`) : le passage à `true` l'allume d'un trait de lumière, comme un vieux téléviseur. */
  allume?: boolean;
  /** Le nom lu par un lecteur d'écran ; absent = purement décoratif. */
  titre?: string;
  className?: string;
}

/** Un appareil modeste : peu de cœurs, peu de mémoire, ou économie de données demandée. */
export function appareilModeste(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || Boolean(nav.connection?.saveData);
}

/** L'écart des bras au repos, selon l'émotion. */
const BRAS_REPOS: Record<Emotion, number> = {
  neutre: 16,
  curieux: 12,
  content: 22,
  'tres-content': 58,
  concentre: 10,
  surpris: 42,
  inquiet: 6,
  taquin: 20,
  fatigue: 4,
  alerte: 14,
};

const DOUX = [0.22, 1, 0.36, 1] as const;

export function Ajmani({
  emotion = 'neutre',
  geste = null,
  cleGeste = 0,
  direction = 'droite',
  taille = 180,
  cadrage = 'entier',
  entree = false,
  qualite,
  mouvement,
  teintes = TEINTES_AJMANI,
  accessoire,
  allume = true,
  titre,
  className,
}: AjmaniProps) {
  const niveauPoste = useMouvement();
  const niveau = mouvement ?? niveauPoste;
  const vivant = niveau === 'complet';
  const [modeste] = useState(appareilModeste);
  const q = qualite ?? (modeste ? 'legere' : 'haute');
  const ids = useIdsAjmani();
  const ref = useRef<SVGSVGElement>(null);
  const cligne = useClignement(vivant);
  const regardSouris = useRegard(ref, vivant);
  const pose = POSES[emotion];

  // Le grésillement se rejoue à chaque nouvelle émotion qui en porte un.
  const [cleGlitch, setCleGlitch] = useState(0);
  useEffect(() => {
    if (POSES[emotion].glitch) setCleGlitch((n) => n + 1);
  }, [emotion]);

  const fixe: Transition = { duration: 0 };
  const tVisage: Transition = vivant ? { duration: 0.4, ease: DOUX } : fixe;
  const tCligne: Transition = vivant ? { duration: 0.07 } : fixe;
  const tRessort: Transition = vivant ? { type: 'spring', stiffness: 210, damping: 13, mass: 0.8 } : fixe;

  /*
   * ── Les gestes ───────────────────────────────────────────────────────
   * Changer `cleGeste` remonte les groupes animés : ils repartent de la pose
   * de repos (leur `initial`) et rejouent le geste. Un `initial={false}` les
   * ferait sauter directement à la fin.
   */
  const sens = direction === 'droite' ? 1 : -1;
  const repos = BRAS_REPOS[emotion];
  let brasG: TargetAndTransition = { rotate: repos };
  let brasD: TargetAndTransition = { rotate: -repos };
  let tBras: Transition = tRessort;
  let tete: TargetAndTransition = { rotate: pose.tete, y: 0 };
  let tTete: Transition = tRessort;
  let saut: TargetAndTransition = { y: 0, scaleY: 1 };
  let tSaut: Transition = tRessort;
  let ombre: number | number[] = 1;
  let regard = regardSouris;

  if (geste === 'pointer') {
    // Tenu tant qu'il est demandé ; en mouvement réduit, la pose finale seulement.
    const cible = sens === 1 ? -108 : 108;
    if (sens === 1) brasD = vivant ? { rotate: [-repos, -6, -122, cible] } : { rotate: cible };
    else brasG = vivant ? { rotate: [repos, 6, 122, cible] } : { rotate: cible };
    tBras = vivant ? { duration: 0.7, times: [0, 0.22, 0.62, 1], ease: 'easeOut' } : fixe;
    tete = { rotate: pose.tete + 5 * sens, y: 0 };
    regard = { x: 5 * sens, y: -1 };
  } else if (vivant && geste === 'hausser') {
    brasG = { rotate: [repos, 74, 74, repos] };
    brasD = { rotate: [-repos, -74, -74, -repos] };
    tBras = { duration: 1.05, times: [0, 0.25, 0.72, 1], ease: 'easeInOut' };
    tete = { rotate: [pose.tete, pose.tete - 6, pose.tete - 6, pose.tete], y: [0, 4, 4, 0] };
    tTete = tBras;
  } else if (vivant && geste === 'hocher') {
    tete = { rotate: [pose.tete, pose.tete + 7, pose.tete - 2, pose.tete + 5, pose.tete], y: [0, 3, 0, 2, 0] };
    tTete = { duration: 0.75, ease: 'easeInOut' };
  } else if (vivant && geste === 'sautiller') {
    saut = { y: [0, 5, -20, 0, -6, 0], scaleY: [1, 0.93, 1.04, 0.95, 1.01, 1] };
    tSaut = { duration: 0.85, times: [0, 0.14, 0.42, 0.64, 0.82, 1], ease: ['easeOut', 'easeOut', 'easeIn', 'easeOut', 'easeIn'] };
    ombre = [1, 1.06, 0.68, 1.02, 0.9, 1];
    brasG = { rotate: [repos, repos - 6, 46, repos + 4, repos] };
    brasD = { rotate: [-repos, -repos + 6, -46, -repos - 4, -repos] };
    tBras = tSaut;
  } else if (vivant && geste === 'saluer') {
    brasD = { rotate: [-repos, -150, -122, -150, -122, -repos] };
    tBras = { duration: 1.4, times: [0, 0.22, 0.42, 0.6, 0.78, 1], ease: 'easeInOut' };
    tete = { rotate: [pose.tete, pose.tete - 4, pose.tete - 4, pose.tete], y: 0 };
    tTete = { duration: 1.4, ease: 'easeInOut' };
  }

  /* ── La respiration : seulement au repos, en mouvement complet ───────── */
  const respire = vivant && !geste;

  const vue = cadrage === 'tete' ? CADRE_TETE : { x: 0, y: 0, ...CADRE };
  const largeur = (taille * vue.largeur) / vue.hauteur;

  return (
    <motion.svg
      ref={ref}
      viewBox={`${vue.x} ${vue.y} ${vue.largeur} ${vue.hauteur}`}
      width={largeur}
      height={taille}
      role={titre ? 'img' : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
      focusable="false"
      className={className}
      style={{ overflow: 'visible', display: 'block' }}
      initial={entree && vivant ? { opacity: 0, y: 26 } : false}
      animate={entree && vivant ? { opacity: [0, 1, 1, 1], y: [26, 30, -8, 0] } : { opacity: 1, y: 0 }}
      transition={entree && vivant ? { duration: 0.95, times: [0, 0.2, 0.62, 1], ease: ['easeOut', 'easeOut', 'easeOut'] } : fixe}
    >
      <DefsAjmani ids={ids} teintes={teintes} qualite={q} />
      {cadrage === 'entier' && <Ombre echelle={ombre} transition={tSaut} />}
      <motion.g key={`saut-${cleGeste}`} initial={{ y: 0, scaleY: 1 }} animate={saut} transition={tSaut} style={pivot(100, ATTACHES.sol)}>
        {cadrage === 'entier' && <Cable teintes={teintes} />}
        <motion.g
          initial={false}
          animate={respire ? { scaleY: [1, 1.016, 1] } : { scaleY: 1 }}
          transition={respire ? { duration: 3.8, repeat: Infinity, ease: 'easeInOut' } : fixe}
          style={pivot(100, ATTACHES.sol)}
        >
          {cadrage === 'entier' && (
            <>
              <Corps ids={ids} teintes={teintes} />
              <Bras key={`g-${cleGeste}`} cote="gauche" ids={ids} teintes={teintes} initial={{ rotate: repos }} animate={brasG} transition={tBras} />
              <Bras key={`d-${cleGeste}`} cote="droit" ids={ids} teintes={teintes} initial={{ rotate: -repos }} animate={brasD} transition={tBras} />
            </>
          )}
          <motion.g
            initial={false}
            animate={respire ? { y: [0, -1.6, 0] } : { y: 0 }}
            transition={respire ? { duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.25 } : fixe}
          >
            <motion.g key={`tete-${cleGeste}`} initial={{ rotate: pose.tete, y: 0 }} animate={tete} transition={tTete} style={pivot(ATTACHES.cou.x, ATTACHES.cou.y)}>
              <TeteTele
                ids={ids}
                teintes={teintes}
                accessoire={accessoire}
                antenne={<Antenne teintes={teintes} torsion={pose.antenne} transition={tRessort} />}
              >
                {/* L'allumage : un trait horizontal qui s'étire, puis s'ouvre sur le visage. */}
                {allume && vivant && (
                  <motion.rect
                    x={ECRAN.x}
                    y={ECRAN.y}
                    width={ECRAN.largeur}
                    height={ECRAN.hauteur}
                    style={{ fill: teintes.visage, ...pivot(100, ECRAN.y + ECRAN.hauteur / 2) }}
                    initial={{ scaleX: 0, scaleY: 0.03, opacity: 0.9 }}
                    animate={{ scaleX: [0, 1, 1], scaleY: [0.03, 0.03, 1], opacity: [0.9, 0.9, 0] }}
                    transition={{ duration: 0.45, times: [0, 0.4, 1], ease: 'easeOut' }}
                  />
                )}
                <motion.g
                  initial={false}
                  animate={{ opacity: allume ? 1 : 0 }}
                  transition={vivant ? { duration: 0.25, delay: allume ? 0.18 : 0 } : fixe}
                >
                <motion.g
                  key={`glitch-${cleGlitch}`}
                  initial={false}
                  animate={vivant && pose.glitch && q === 'haute' ? { x: [0, -2.5, 2, -1, 0] } : { x: 0 }}
                  transition={vivant ? { duration: 0.45 } : fixe}
                >
                  <Visage ids={ids} teintes={teintes} pose={pose} cligne={cligne} regard={regard} qualite={q} transition={tVisage} transitionCligne={tCligne} />
                </motion.g>
                </motion.g>
                <Glitch teintes={teintes} actif={allume && vivant && pose.glitch && q === 'haute'} cle={cleGlitch} />
              </TeteTele>
            </motion.g>
          </motion.g>
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}

/** La petite version : la tête seule, pour les appels et les réactions importantes. */
export function AjmaniPetit(props: Omit<AjmaniProps, 'cadrage' | 'taille'> & { taille?: number }) {
  return <Ajmani {...props} cadrage="tete" taille={props.taille ?? 56} />;
}

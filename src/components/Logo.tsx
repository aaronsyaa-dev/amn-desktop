import React, { useId } from 'react';
import { EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';

/** Raison sociale affichée sous le logo. Une cliente n'a pas à voir la nôtre. */
const BRAND_NAME = IS_BUSINESS ? EDITION_PRODUCT_NAME : 'AMN DevSec';

/** Mot apposé au sigle : « Desktop » en interne, « Business » chez une cliente. */
const APP_WORD = IS_BUSINESS ? 'Business' : 'Desktop';

interface LogoProps {
  /** Show the "DEVSEC" tagline under the wordmark. */
  showTagline?: boolean;
  /** Append " Desktop" (the app name) after the wordmark, smaller and muted. */
  showAppName?: boolean;
  /** Rendered height in px; width scales with the aspect ratio. */
  height?: number;
  className?: string;
}

/**
 * LA MARQUE AMN, TRACÉE
 * ═════════════════════
 *
 * ## Pourquoi des traits et non du texte
 *
 * La marque fournie est monolinéaire : des segments parfaitement droits, à
 * sommets pointus, dans une graisse bien plus fine que tout ce que ce dépôt
 * embarque (Inter s'arrête à 400). Un `<text>` aurait donc rendu une AUTRE
 * lettre partout où la fonte manque — c'est-à-dire, au premier chargement,
 * chez la cliente. Tracée, elle est identique partout, à toute taille, sans
 * dépendre d'une fonte.
 *
 * C'est aussi la même géométrie que `images/icon.svg`, dont sortent l'icône du
 * bureau et celle du téléphone : un seul dessin, quatre destinations.
 *
 * ## Le dégradé descend
 *
 * Blanc en haut, gris en bas — comme le fichier fourni. L'ancien sigle
 * balayait de la gauche vers la droite ; ce n'est pas la même marque.
 */

/** Géométrie de « AMN » : repère de 274 de large, capitale de 80 (y 10 → 90). */
const MARK_W = 274;
const MARK_PATHS = [
  'M0 90 L42 10 L84 90', // A — les deux jambages
  'M11.6 68 L72.4 68', // A — la barre
  'M98 90 L98 10 L140 90 L182 10 L182 90', // M — fûts droits, V central jusqu'au pied
  'M190 90 L190 10 L274 90 L274 10', // N
];

const GRADIENT_STOPS = (
  <>
    <stop offset="0" stopColor="#ffffff" />
    <stop offset="0.5" stopColor="#c4c4c2" />
    <stop offset="1" stopColor="#6b6b69" />
  </>
);

/**
 * L'épaisseur du trait, en unités du repère, pour que le rendu tienne à
 * l'écran.
 *
 * Un trait fin est le caractère même de cette marque — mais un trait fin reste
 * fin en PROPORTION, pas en pixels : à 22 px de haut dans la barre repliée, il
 * tomberait sous le demi-pixel et s'afficherait gris pâle et flou, comme une
 * erreur d'affichage. On vise donc une épaisseur RENDUE, jamais inférieure à
 * environ un pixel, et proportionnelle au-delà. Grand, la marque est aussi fine
 * que le fichier fourni ; petit, elle s'épaissit juste ce qu'il faut pour
 * rester nette. C'est le même compromis que fait n'importe quelle identité
 * dessinée au trait.
 */
function strokeFor(renderedCapPx: number, unitsPerPx: number): number {
  const cible = Math.max(1.05, renderedCapPx * 0.042);
  return cible * unitsPerPx;
}

export function Logo({
  showTagline = true,
  showAppName = false,
  height = 40,
  className,
}: LogoProps) {
  const id = useId();
  const gradientId = `amn-gradient-${id}`;
  const viewBoxHeight = showTagline && !IS_BUSINESS ? 64 : 44;
  // Widen the canvas when the app name is appended so "Desktop" never clips.
  const viewBoxWidth = showAppName ? 232 : 148;
  const width = (height * viewBoxWidth) / viewBoxHeight;

  // La marque, posée de la ligne de tête (y=6) à la ligne de pied (y=38).
  const capHeight = 32;
  const echelle = capHeight / 80;
  const markWidth = MARK_W * echelle;
  const unitsPerPx = viewBoxHeight / height;
  const stroke = strokeFor(capHeight / unitsPerPx, unitsPerPx) / echelle;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={showAppName ? EDITION_PRODUCT_NAME : BRAND_NAME}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="8" x2="0" y2="94" gradientUnits="userSpaceOnUse">
          {GRADIENT_STOPS}
        </linearGradient>
      </defs>

      <g transform={`translate(0 ${6 - 10 * echelle}) scale(${echelle})`}>
        <g
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeMiterlimit={12}
        >
          {MARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>

      {showAppName && (
        <text
          x={markWidth + 12}
          y="38"
          fontFamily="Inter, sans-serif"
          fontSize="24"
          // Léger, et c'est la marque qui l'exige : « Business » en gras à côté
          // d'un tracé d'un pixel écrase le sigle et devient le mot qu'on lit
          // en premier. Le nom du produit accompagne la marque, il ne la
          // remplace pas.
          fontWeight={400}
          letterSpacing="0.5"
          fill="#9a9a97"
        >
          {APP_WORD}
        </text>
      )}

      {/*
        « DEVSEC » est notre raison sociale : elle n'a rien à faire sous le
        logo d'une organisation cliente, et encore moins sur un devis qu'elle
        imprime.
      */}
      {showTagline && !IS_BUSINESS && (
        <text
          x="2"
          y="59"
          fontFamily="Inter, sans-serif"
          fontSize="11"
          fontWeight={600}
          letterSpacing="7"
          fill="#616160"
        >
          DEVSEC
        </text>
      )}
    </svg>
  );
}

/**
 * La variante carrée, là où le sigle entier ne tient pas — barre repliée, rail
 * des organisations, voile de contexte.
 *
 * Elle ne montre que le « A », et c'est une décision, pas un raccourci :
 * « AMN » mesure 2,7 fois sa hauteur, donc dans un carré de 22 px il ferait
 * huit pixels de haut et ne se lirait plus. Une identité au trait a presque
 * toujours une variante petite ; celle-ci garde la lettre, le dégradé et la
 * pointe du dessin d'origine.
 */
export function LogoMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId();
  const gradientId = `amn-mark-${id}`;
  // Repère de 40 ; le A occupe 22 de haut, centré.
  const unitsPerPx = 40 / size;
  const stroke = strokeFor(22 / unitsPerPx, unitsPerPx);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="AMN"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="9" x2="0" y2="31" gradientUnits="userSpaceOnUse">
          {GRADIENT_STOPS}
        </linearGradient>
      </defs>
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9"
        fill="#131313"
        stroke="#2a2a2a"
        strokeWidth="1.5"
      />
      <g
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeMiterlimit={12}
      >
        <path d="M8.4 30 L20 9 L31.6 30" />
        <path d="M11.6 24.2 L28.4 24.2" />
      </g>
    </svg>
  );
}

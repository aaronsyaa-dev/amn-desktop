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

// Neutral graphite → white sweep (no blue/purple cast) to match the strict
// monochrome identity.
const GRADIENT_STOPS = (
  <>
    <stop offset="0" stopColor="#616160" />
    <stop offset="0.5" stopColor="#b6b6b3" />
    <stop offset="1" stopColor="#ffffff" />
  </>
);

/**
 * Full AMN DEVSEC wordmark, rebuilt as an inline SVG so it scales crisply,
 * adapts to the dark theme, and carries no baked-in black background. The
 * "AMN" letters sweep from muted graphite on the left to pure white on the
 * right, echoing the supplied brand mark; "DEVSEC" sits below in
 * wide-tracked grey.
 */
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
        <linearGradient id={gradientId} x1="0" y1="0" x2="148" y2="0" gradientUnits="userSpaceOnUse">
          {GRADIENT_STOPS}
        </linearGradient>
      </defs>
      <text x="0" y="40" fontFamily="Inter, sans-serif">
        <tspan
          fontSize="46"
          fontWeight={700}
          letterSpacing="-2"
          fill={`url(#${gradientId})`}
        >
          AMN
        </tspan>
        {showAppName && (
          <tspan
            dx="12"
            fontSize="25"
            fontWeight={600}
            letterSpacing="-0.5"
            fill="#9a9a97"
          >
            {APP_WORD}
          </tspan>
        )}
      </text>
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
 * Compact square monogram used where the full wordmark won't fit (e.g. the
 * collapsed sidebar rail). Keeps the graphite→white gradient identity.
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
        <linearGradient id={gradientId} x1="6" y1="34" x2="34" y2="6" gradientUnits="userSpaceOnUse">
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
      <text
        x="20"
        y="28.5"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="24"
        fontWeight={700}
        letterSpacing="-1"
        fill={`url(#${gradientId})`}
      >
        A
      </text>
    </svg>
  );
}

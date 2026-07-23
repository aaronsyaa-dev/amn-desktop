import React, { useId } from 'react';

interface LogoProps {
  /** Show the "DEVSEC" tagline under the wordmark. */
  showTagline?: boolean;
  /** Append " Desktop" (the app name) after the wordmark, smaller and muted. */
  showAppName?: boolean;
  /** Rendered height in px; width scales with the aspect ratio. */
  height?: number;
  className?: string;
}

const GRADIENT_STOPS = (
  <>
    <stop offset="0" stopColor="#5c5c6a" />
    <stop offset="0.5" stopColor="#b8b8c4" />
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
  const viewBoxHeight = showTagline ? 64 : 44;
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
      aria-label={showAppName ? 'AMN Desktop' : 'AMN DevSec'}
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
            fill="#b0b0bc"
          >
            Desktop
          </tspan>
        )}
      </text>
      {showTagline && (
        <text
          x="2"
          y="59"
          fontFamily="Inter, sans-serif"
          fontSize="11"
          fontWeight={600}
          letterSpacing="7"
          fill="#6b6b78"
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
        rx="11"
        fill="#101016"
        stroke="#2a2a36"
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

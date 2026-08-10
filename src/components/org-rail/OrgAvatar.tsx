import React from 'react';
import { orgInitials } from '../../state/OrgContextContext';

/**
 * L'icône d'une organisation : son logo, ou ses initiales.
 *
 * Le repli n'est pas décoratif — c'est le cas NORMAL au démarrage d'une
 * cliente, avant qu'un logo soit fourni. Il doit donc être lisible et stable :
 * mêmes dimensions, même graisse, pour qu'un rail à moitié illustré ne
 * ressemble pas à un rail à moitié cassé.
 */
export function OrgAvatar({
  name,
  logoDataUrl,
  size = 40,
  rounded = 'rounded-2xl',
}: {
  name: string;
  logoDataUrl?: string | null;
  size?: number;
  rounded?: string;
}) {
  const style = { width: size, height: size };

  if (logoDataUrl) {
    return (
      <img
        src={logoDataUrl}
        alt=""
        style={style}
        className={`${rounded} object-cover`}
        // Un logo cassé (data-URL tronquée) ne doit pas laisser un carré vide :
        // on le masque et le fond d'initiales derrière reprend la main.
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <span
      style={{ ...style, fontSize: Math.round(size * 0.34) }}
      className={`${rounded} flex items-center justify-center bg-surface-hover font-mono font-semibold uppercase leading-none tracking-tight text-text-secondary`}
      aria-hidden
    >
      {orgInitials(name)}
    </span>
  );
}

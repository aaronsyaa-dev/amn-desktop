import React from 'react';
import { ETIQUETTES, RAYON_ANNEAU, RAYON_ETIQUETTES, arcEcoule, heureDecimale, pointHeure, traitsDeLAnneau } from './temps';

/**
 * L'ANNEAU DES 24 HEURES (G09, `DayRing24`) — midi en haut, minuit en bas, 18 h à droite, 6 h à gauche.
 *
 * 24 traits de 1,4 px (11 px, 16 px aux repères 12, 18, 00, 06) : écoulés en « très discret », à venir presque
 * éteints, l'heure en cours en blanc sur 2,2 px. Par-dessus, l'arc fin de minuit à l'instant, puis le repère de
 * l'instant (10 px, halo de 4 px). Étiquettes « 12 », « 18 », « 00 », « 06 » à 326 px du centre.
 *
 * Décoratif (`aria-hidden`) : l'heure se lit dans `BigClock`. Le dessin est centré sur (0, 0) ; la feuille le pose
 * au centre de l'écran (720, 410 sur l'image).
 */
export function DayRing24({ maintenant }: { maintenant: Date }) {
  const traits = traitsDeLAnneau(maintenant);
  const arc = arcEcoule(maintenant);
  const instant = pointHeure(heureDecimale(maintenant), RAYON_ANNEAU);
  return (
    <div aria-hidden className="ve-anneau" data-veille="anneau">
      <svg className="ve-anneau__svg" viewBox="-360 -360 720 720" width="720" height="720" focusable="false">
        {traits.map((t) => (
          <line key={t.heure} x1={t.de.x} y1={t.de.y} x2={t.a.x} y2={t.a.y} className="ve-trait" data-etat={t.etat} data-long={t.long || undefined} />
        ))}
        {arc && <path d={arc} className="ve-arc" fill="none" />}
        <circle cx={instant.x} cy={instant.y} r="9" className="ve-instant__halo" />
        <circle cx={instant.x} cy={instant.y} r="5" className="ve-instant" />
      </svg>
      {ETIQUETTES.map((e) => {
        const p = pointHeure(e.heure, RAYON_ETIQUETTES);
        return (
          <span key={e.texte} className="ve-etiquette" style={{ left: `${p.x}px`, top: `${p.y}px` }}>
            {e.texte}
          </span>
        );
      })}
    </div>
  );
}

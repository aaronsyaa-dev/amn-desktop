import React from 'react';
import { Lock } from 'lucide-react';
import { BigClock } from './BigClock';
import { DayRing24 } from './DayRing24';
import { StatusPill } from './StatusPill';
import { WatchOrbit } from './WatchOrbit';
import type { EtatPastille } from './etat';
import { useMots } from './i18n';
import { heureVeille, jourVeille } from './temps';
import './veille.css';

/**
 * LA VUE DE L'ÉCRAN DE VEILLE (G09) — purement présentationnelle : tout arrive par les props, rien n'est lu de
 * l'espace. C'est ce que rendent l'écran (`EcranDeVeille`, avec les vraies sources) et l'aperçu de capture.
 *
 *   Z0–Z2  le fond : orbites, huit repères anonymes, balayage lent ; l'anneau des 24 heures
 *   Z3–Z5  l'heure, le jour, la pastille de La Garde (les trois seules choses lues par un lecteur d'écran)
 *   Z6     la marque (haut gauche)            Z7  « Espace verrouillé » — SEULEMENT si l'espace l'est vraiment
 *   Z8     le pied : les délais réels, la consigne de reprise, le chemin des réglages (rappel, inactif)
 *
 * Le dessin (Z0–Z5) est centré et mis à l'échelle (`echelle`) ; la marque et le pied gardent leurs marges de
 * 48 px. L'ensemble dérive d'un pixel par minute (`derive`, coupée en mouvement réduit par l'appelant).
 */
export interface VueVeilleProps {
  produit: string;
  maintenant: Date;
  etat: EtatPastille;
  /** L'heure de la prochaine ronde, ou `null` quand aucune n'est annoncée (rien n'est inventé). */
  ronde: Date | null;
  veilleMin: number;
  /** Le délai de verrouillage — seulement quand un verrouillage RÉEL s'applique ; sinon `null` et le pied n'en dit rien. */
  verrouApresMin: number | null;
  /** L'espace est réellement verrouillé (Z7). */
  verrouille: boolean;
  /** L'indice (0 à 7) du repère « en veille », tiré au hasard à chaque affichage. */
  repereEnVeille: number;
  derive?: { x: number; y: number };
  echelle?: number;
}

export function VueVeille({ produit, maintenant, etat, ronde, veilleMin, verrouApresMin, verrouille, repereEnVeille, derive = { x: 0, y: 0 }, echelle = 1 }: VueVeilleProps) {
  const { tm, langue } = useMots();
  const heure = heureVeille(maintenant, langue);
  const jour = jourVeille(maintenant, langue);
  const iso = `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`;
  const delais = verrouApresMin !== null && verrouApresMin > 0 ? `${tm('pied.veille', { n: veilleMin })} · ${tm('pied.verrou', { n: verrouApresMin })}` : tm('pied.veille', { n: veilleMin });
  return (
    <div className="ve-tout" style={derive.x || derive.y ? { transform: `translate(${derive.x}px, ${derive.y}px)` } : undefined}>
      <div className="ve-dessin" style={echelle !== 1 ? { transform: `scale(${echelle})` } : undefined}>
        <WatchOrbit repereEnVeille={repereEnVeille} />
        <DayRing24 maintenant={maintenant} />
        <BigClock heure={heure} iso={iso} jour={jour} />
        <div className="ve-ligne-pastille">
          <StatusPill etat={etat} ronde={ronde ? heureVeille(ronde, langue) : null} />
        </div>
      </div>

      <div aria-hidden className="ve-marque">
        <span className="ve-marque__logo">A</span>
        <span className="ve-marque__nom">{produit}</span>
      </div>
      {verrouille && (
        <p aria-hidden className="ve-verrou">
          <Lock size={14} aria-hidden />
          <span>{tm('verrou')}</span>
        </p>
      )}

      <div aria-hidden className="ve-pied">
        <p className="ve-pied__delais">{delais}</p>
        <p className="ve-pied__reprendre">{tm('reprendre')}</p>
        <p className="ve-pied__reglages">{tm('pied.reglages')}</p>
      </div>
    </div>
  );
}

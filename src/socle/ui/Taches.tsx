import React from 'react';
import { Check } from 'lucide-react';
import type { Famille } from '../familles';

/**
 * LA CASE À COCHER ET LA LIGNE DE TÂCHE.
 *
 * La case est un vrai `role="checkbox"` (clavier : Espace, Entrée) de 20 px.
 * `lecture` : on voit l'état, on ne le change pas (la tâche d'un autre) — la
 * case reste atteignable et l'annonce dit pourquoi.
 */
export interface CaseACocherProps {
  coche: boolean;
  onChange?: (coche: boolean) => void;
  /** Le nom accessible : « Cocher : Appeler le notaire ». */
  libelle: string;
  lecture?: boolean;
}

export function CaseACocher({ coche, onChange, libelle, lecture = false }: CaseACocherProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={coche}
      aria-disabled={lecture || undefined}
      aria-label={libelle}
      onClick={() => !lecture && onChange?.(!coche)}
      className="sc-case sc-focus"
    >
      {coche && <Check size={13} strokeWidth={3} aria-hidden />}
    </button>
  );
}

export interface LigneTacheProps {
  titre: string;
  /** Une précision : le statut, le client. */
  meta?: string;
  famille?: Famille;
  /** L'heure, dans une colonne de 44 px alignée sur toute la liste. */
  heure?: string;
  /** Réserve la colonne d'heure même sans heure, pour aligner les lignes entre elles. */
  avecColonneHeure?: boolean;
  fait: boolean;
  onCoche?: (coche: boolean) => void;
  libelleCase: string;
  lecture?: boolean;
  /** Ouvre la tâche. Absent : le titre est du texte. */
  onOuvrir?: () => void;
  /** À droite : responsable, boutons. */
  droite?: React.ReactNode;
}

export function LigneTache({ titre, meta, famille, heure, avecColonneHeure, fait, onCoche, libelleCase, lecture, onOuvrir, droite }: LigneTacheProps) {
  const corps = (
    <>
      <span className="sc-ligne__titre">{titre}</span>
      {(meta || famille) && (
        <span className="sc-ligne__meta">
          {famille && <span aria-hidden className="sc-point" data-taille="6" />}
          {meta && <span>{meta}</span>}
        </span>
      )}
    </>
  );
  return (
    <li data-famille={famille} data-fait={fait} className="sc-ligne group">
      <CaseACocher coche={fait} onChange={onCoche} libelle={libelleCase} lecture={lecture} />
      {(heure || avecColonneHeure) && <span className="sc-ligne__heure">{heure}</span>}
      {onOuvrir ? (
        <button type="button" onClick={onOuvrir} className="sc-ligne__corps sc-focus">
          {corps}
        </button>
      ) : (
        <span className="sc-ligne__corps">{corps}</span>
      )}
      {droite && <span className="sc-ligne__droite">{droite}</span>}
    </li>
  );
}

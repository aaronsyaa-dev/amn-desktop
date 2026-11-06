import React, { useId } from 'react';
import { Search, X } from 'lucide-react';
import { Raccourci } from '../Pastilles';
import { useSocleLangue } from '../../i18n';

/**
 * Un interrupteur (toggle) : 34 × 20, actif = fond `#2e4327` et pastille `#ededed`, inactif = fond `#242427` et
 * pastille `#8a8a8e`. Un vrai `role="switch"` ; le libellé est toujours dit (le bouton seul ne suffit pas).
 */
export function Interrupteur({ actif, onChange, libelle, disabled = false }: { actif: boolean; onChange?: (actif: boolean) => void; libelle: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={disabled}
      onClick={() => onChange?.(!actif)}
      className="sc-interrupteur sc-focus"
    >
      <span aria-hidden />
    </button>
  );
}

/** Un bouton carré de 34 × 34 qui ne porte qu'une icône : son nom accessible est obligatoire. */
export const BoutonIcone = React.forwardRef<HTMLButtonElement, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { libelle: string; icone: React.ReactNode }>(function BoutonIcone(
  { libelle, icone, type = 'button', className = '', ...reste },
  ref,
) {
  return (
    <button ref={ref} type={type} aria-label={libelle} title={libelle} className={`sc-bouton-icone sc-focus ${className}`.trim()} {...reste}>
      <span aria-hidden className="inline-flex">{icone}</span>
    </button>
  );
});

export interface SelecteurProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  etiquette: string;
  aide?: string;
  erreur?: string;
}

/** Une liste déroulante native, habillée comme `Saisie` : 40 px de haut, rayon 10, bordure `#5a5a60`. */
export const Selecteur = React.forwardRef<HTMLSelectElement, SelecteurProps>(function Selecteur({ etiquette, aide, erreur, id, className = '', children, ...reste }, ref) {
  const auto = useId();
  const idChamp = id ?? auto;
  const decrit = [aide ? `${idChamp}-aide` : null, erreur ? `${idChamp}-erreur` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="sc-champ">
      <label htmlFor={idChamp} className="sc-champ__etiquette">
        {etiquette}
      </label>
      <select ref={ref} id={idChamp} aria-invalid={erreur ? true : undefined} aria-describedby={decrit} data-socle="champ" className={`sc-selecteur ${className}`.trim()} {...reste}>
        {children}
      </select>
      {aide && (
        <p id={`${idChamp}-aide`} className="sc-champ__aide">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={`${idChamp}-erreur`} className="sc-champ__erreur">
          {erreur}
        </p>
      )}
    </div>
  );
});

export interface BoiteRechercheProps {
  valeur: string;
  onChange: (valeur: string) => void;
  /** Le nom accessible du champ (« Rechercher un client »). */
  libelle: string;
  placeholder?: string;
  /** 42 px, rayon 12 (panneau « Tous les modules ») au lieu de 34 px, rayon 10. */
  grande?: boolean;
  /** 34 px (défaut) ou 38 px (le champ de l'en-tête de page de D02, 270 × 38) : même rayon, mêmes couleurs. Sans effet avec `grande`. */
  hauteur?: 34 | 38;
  raccourci?: string;
  autoFocus?: boolean;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/** Le champ de recherche : loupe, texte, bouton d'effacement quand il y a un texte, raccourci éventuel. */
export function BoiteRecherche({ valeur, onChange, libelle, placeholder, grande = false, hauteur = 34, raccourci, autoFocus, className = '', inputRef, onKeyDown }: BoiteRechercheProps) {
  const { ts } = useSocleLangue();
  return (
    <div role="search" data-grande={grande || undefined} data-hauteur={!grande && hauteur === 38 ? '38' : undefined} className={`sc-boite-recherche ${className}`.trim()}>
      <Search aria-hidden size={grande ? 15 : 14} />
      <input
        ref={inputRef}
        type="search"
        value={valeur}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={libelle}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {valeur ? (
        <button type="button" aria-label={ts('recherche.effacer')} onClick={() => onChange('')} className="sc-boite-recherche__effacer sc-focus">
          <X aria-hidden size={14} />
        </button>
      ) : (
        raccourci && <Raccourci>{raccourci}</Raccourci>
      )}
    </div>
  );
}

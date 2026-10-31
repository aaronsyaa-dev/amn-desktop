import React, { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Famille } from '../../familles';
import { BarreProgression, type TonBarre } from '../Indicateurs';
import { PastilleEtat, PileAvatars, type EtatPastille } from '../Pastilles';
import { TexteTronque } from './TexteTronque';
import { formaterPourcent } from './logique/formats';
import { compterColonnes, deplacerDansGrille } from './logique/navigation';

/**
 * LA GRILLE DE CARTES (archétype « cards ») — des cartes de même hauteur, au bas de carte aligné.
 *
 * Mode d'emploi : `<GrilleCartes libelle="…">` reçoit des `<CarteModule titre description icone famille progression={{ libelle, valeur }}
 * personnes etat vers={…} />`. Trois colonnes (`colonnes={n}` pour une autre valeur), deux sous 1280 px de fenêtre ; la zone
 * défile en interne quand il y a plus de cartes que de place. Une carte est un lien (`vers` : routeur ; `href`), un bouton
 * (`onClick`) ou, sans rien de tout cela, un simple bloc. ← ↑ ↓ → passent d'une carte à l'autre, et la carte entière est
 * cliquable. Son titre est un titre de niveau 3 (`niveauTitre`) : les lecteurs d'écran parcourent la grille par ses titres.
 */

export interface GrilleCartesProps {
  /** Le nom de la liste pour les lecteurs d'écran. */
  libelle: string;
  /** 3 par défaut ; 2 sous 1280 px de fenêtre. */
  colonnes?: number;
  children: React.ReactNode;
  className?: string;
}

export function GrilleCartes({ libelle, colonnes = 3, children, className = '' }: GrilleCartesProps) {
  const liste = useRef<HTMLUListElement | null>(null);
  const n = Math.max(1, Math.floor(colonnes) || 1);
  const surTouche = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const cible = e.target as HTMLElement;
    if (!cible.hasAttribute?.('data-carte-module') || !liste.current) return;
    const cartes = Array.from(liste.current.querySelectorAll<HTMLElement>('[data-carte-module]'));
    const index = cartes.indexOf(cible);
    if (index < 0) return;
    const cols = compterColonnes(cartes.map((c) => c.getBoundingClientRect().top));
    const vers = deplacerDansGrille(index, cartes.length, cols, e.key, e.ctrlKey || e.metaKey);
    if (vers === null) return;
    e.preventDefault();
    cartes[vers]?.focus();
  };
  return (
    <div className={`sc-grille-cartes__zone sc-zone ${className}`.trim()}>
      <ul
        ref={liste}
        role="list"
        aria-label={libelle}
        onKeyDown={surTouche}
        className="sc-grille-cartes"
        style={{ '--sc-grille-colonnes': n, '--sc-grille-colonnes-etroit': Math.min(n, 2) } as React.CSSProperties}
      >
        {React.Children.toArray(children).map((c, i) => (
          <li key={React.isValidElement(c) && c.key != null ? c.key : i}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

export interface CarteModuleProps {
  titre: string;
  /** Trois lignes au plus, puis une ellipse et une info-bulle. */
  description?: string;
  /** Une icône lucide-react de 18 px : le carré de 38 px la teinte de la couleur de la famille. */
  icone: React.ReactNode;
  famille?: Famille;
  /** Le libellé (« Avancement »), la valeur de 0 à 1 et, au besoin, son texte ; le pourcentage s'écrit à la française. */
  progression?: { libelle: string; valeur: number; texte?: string; ton?: TonBarre };
  /** Les noms des responsables : une pile d'avatars. */
  personnes?: string[];
  /** Le nom accessible de la pile (« Responsables : … »). Obligatoire avec `personnes`. */
  libellePersonnes?: string;
  etat?: { etat: EtatPastille; libelle: string };
  /** Un lien du routeur. */
  vers?: string;
  /** Un lien ordinaire. */
  href?: string;
  /** Sans lien : un bouton. */
  onClick?: () => void;
  niveauTitre?: 2 | 3 | 4;
  locale?: string;
}

export function CarteModule({ titre, description, icone, famille, progression, personnes, libellePersonnes, etat, vers, href, onClick, niveauTitre = 3, locale }: CarteModuleProps) {
  const Titre = `h${niveauTitre}` as const;
  const idDescription = useId();
  const interactive = Boolean(vers || href || onClick);
  const contenuTitre = <TexteTronque as="span">{titre}</TexteTronque>;
  let lien: React.ReactNode = contenuTitre;
  if (vers) {
    lien = (
      <Link to={vers} data-carte-module="" aria-describedby={description ? idDescription : undefined} className="sc-carte-module__lien sc-focus">
        {contenuTitre}
      </Link>
    );
  } else if (href) {
    lien = (
      <a href={href} data-carte-module="" aria-describedby={description ? idDescription : undefined} className="sc-carte-module__lien sc-focus">
        {contenuTitre}
      </a>
    );
  } else if (onClick) {
    lien = (
      <button type="button" onClick={onClick} data-carte-module="" aria-describedby={description ? idDescription : undefined} className="sc-carte-module__lien sc-focus">
        {contenuTitre}
      </button>
    );
  }
  const texteProgression = progression ? (progression.texte ?? formaterPourcent(progression.valeur, locale)) : '';
  return (
    <article data-famille={famille} data-interactive={interactive || undefined} className="sc-carte-module">
      <div className="sc-carte-module__tete">
        <span aria-hidden className="sc-carte-module__icone">
          {icone}
        </span>
        <Titre className="sc-carte-module__titre">{lien}</Titre>
      </div>
      {description && (
        <TexteTronque as="p" lignes={3} className="sc-carte-module__description">
          {description}
        </TexteTronque>
      )}
      {description && (
        <span id={idDescription} hidden>
          {description}
        </span>
      )}
      {(progression || (personnes && personnes.length > 0) || etat) && (
        <div className="sc-carte-module__pied">
          {progression && (
            <>
              <span className="sc-carte-module__avancement">
                <span>{progression.libelle}</span>
                <b aria-hidden>{texteProgression}</b>
              </span>
              <BarreProgression valeur={progression.valeur} ton={progression.ton} libelle={progression.libelle} texte={texteProgression} />
            </>
          )}
          {((personnes && personnes.length > 0) || etat) && (
            <span className="sc-carte-module__bas">
              {personnes && personnes.length > 0 ? <PileAvatars noms={personnes} libelle={libellePersonnes ?? personnes.join(', ')} /> : <span />}
              {etat && <PastilleEtat etat={etat.etat}>{etat.libelle}</PastilleEtat>}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

import React, { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useSocleLangue } from '../../i18n';
import { EtatVide } from '../Etats';
import { BoiteRecherche, BoutonIcone, Onglets, SuggestionAjmani, type OngletDef } from '../controles';
import { TexteTronque } from './TexteTronque';
import { formaterHeure } from './logique/formats';
import { deplacerLineaire } from './logique/navigation';

/**
 * LE SCINDÉ (archétype « split ») — une liste de 380 px à gauche, le détail de l'élément choisi à droite, dans une seule carte.
 *
 * Mode d'emploi : `<Scinde liste={<ListeScindee libelle recherche ajouter onglets>{éléments}</ListeScindee>} detail={<DetailScinde titre meta actions suggestion>texte</DetailScinde>} />`
 * où chaque élément est `<ElementListe titre apercu heure nonLu actif onSelect />`. La liste est une suite de boutons (`aria-current`
 * dit lequel est ouvert) : une seule tabulation y entre, ↑ ↓ passent d'un élément à l'autre et l'ouvrent. Liste et détail défilent
 * chacun dans leur colonne. Sans élément choisi, `DetailScinde` accepte un état vide avec son action. Sous 900 px, le détail passe sous la liste.
 */

export function Scinde({ liste, detail, className = '' }: { liste: React.ReactNode; detail: React.ReactNode; className?: string }) {
  return (
    <div className={`sc-scinde sc-zone ${className}`.trim()}>
      {liste}
      {detail}
    </div>
  );
}

export interface ListeScindeeProps {
  /** Le nom de la liste pour les lecteurs d'écran. */
  libelle: string;
  recherche?: { valeur: string; onChange: (valeur: string) => void; libelle: string; placeholder?: string };
  /** Le « + » à droite de la recherche : créer un élément. */
  ajouter?: { libelle: string; onClick: () => void };
  onglets?: { libelle: string; onglets: OngletDef[]; actif: string; onChange: (cle: string) => void };
  /** Des `ElementListe`. */
  children?: React.ReactNode;
  /** Affiché à la place de la liste quand elle est vide : un `EtatVide` avec son action. */
  vide?: React.ReactNode;
}

export function ListeScindee({ libelle, recherche, ajouter, onglets, children, vide }: ListeScindeeProps) {
  const liste = useRef<HTMLUListElement | null>(null);
  const videListe = React.Children.count(children) === 0;

  // Une seule tabulation dans la liste : l'élément ouvert, ou le premier. Les autres s'atteignent aux flèches.
  useEffect(() => {
    const boutons = Array.from(liste.current?.querySelectorAll<HTMLElement>('[data-element-liste]') ?? []);
    if (boutons.length === 0) return;
    const courant = boutons.find((b) => b.getAttribute('aria-current') === 'true') ?? boutons[0];
    boutons.forEach((b) => {
      b.tabIndex = b === courant ? 0 : -1;
    });
  });

  const surTouche = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const cible = e.target as HTMLElement;
    if (!cible.hasAttribute?.('data-element-liste') || !liste.current) return;
    const items = Array.from(liste.current.querySelectorAll<HTMLElement>('[data-element-liste]'));
    const i = items.indexOf(cible);
    const vers = deplacerLineaire(i, items.length, e.key);
    if (vers === null) return;
    e.preventDefault();
    if (vers !== i) {
      items[vers].focus();
      items[vers].click();
    }
  };

  return (
    <div className="sc-liste-scindee">
      {(recherche || ajouter) && (
        <div className="sc-liste-scindee__entete">
          {recherche && (
            <div className="sc-liste-scindee__recherche">
              <BoiteRecherche valeur={recherche.valeur} onChange={recherche.onChange} libelle={recherche.libelle} placeholder={recherche.placeholder} />
            </div>
          )}
          {ajouter && <BoutonIcone libelle={ajouter.libelle} icone={<Plus />} onClick={ajouter.onClick} />}
        </div>
      )}
      {onglets && (
        <div className="sc-liste-scindee__onglets">
          <Onglets libelle={onglets.libelle} onglets={onglets.onglets} actif={onglets.actif} onChange={onglets.onChange} />
        </div>
      )}
      <div className="sc-liste-scindee__defile">
        {videListe && vide ? (
          <div className="sc-liste-scindee__vide">{vide}</div>
        ) : (
          <ul ref={liste} role="list" aria-label={libelle} onKeyDown={surTouche} className="sc-liste-scindee__liste">
            {children}
          </ul>
        )}
      </div>
    </div>
  );
}

export interface ElementListeProps {
  titre: string;
  /** Un aperçu d'une ligne. */
  apercu?: string;
  /** Une heure déjà écrite, ou une date (formatée à la française, `HH:mm`). */
  heure?: string | Date;
  /** Un point blanc devant le titre, et le mot « Non lu » pour les lecteurs d'écran. */
  nonLu?: boolean;
  /** L'élément ouvert dans le détail. */
  actif?: boolean;
  onSelect: () => void;
  locale?: string;
}

export function ElementListe({ titre, apercu, heure, nonLu = false, actif = false, onSelect, locale }: ElementListeProps) {
  const { ts } = useSocleLangue();
  const texteHeure = heure instanceof Date ? formaterHeure(heure, locale) : heure;
  return (
    <li>
      <button type="button" data-element-liste="" data-non-lu={nonLu || undefined} aria-current={actif ? 'true' : undefined} onClick={onSelect} className="sc-element-liste sc-focus">
        <span aria-hidden className="sc-element-liste__point" />
        <span className="sc-element-liste__corps">
          <span className="sc-element-liste__ligne">
            <TexteTronque className="sc-element-liste__titre">{titre}</TexteTronque>
            {texteHeure && <span className="sc-element-liste__heure">{texteHeure}</span>}
          </span>
          {apercu && <TexteTronque className="sc-element-liste__apercu">{apercu}</TexteTronque>}
        </span>
        {nonLu && <span className="sr-only">{ts('scinde.nonLu')}</span>}
      </button>
    </li>
  );
}

export interface DetailScindeProps {
  /** Le titre de l'élément (21 px, titre de niveau 2). Absent : on affiche `vide`. */
  titre?: string;
  /** Des faits courts avec leur icône (lucide-react) : l'auteur, la date, le client. */
  meta?: { icone: React.ReactNode; texte: string }[];
  /** Des boutons secondaires, à droite du titre. */
  actions?: React.ReactNode;
  /** Le texte : 13,5 px, interligne 1,65. */
  children?: React.ReactNode;
  /** Le bandeau de suggestion d'Ajmani : deux boutons, « Oui » en blanc (l'exception du socle) et « Non ». */
  suggestion?: { titre: string; texte: React.ReactNode; onOui: () => void; onNon: () => void; libelleOui?: string; libelleNon?: string };
  /** Aucun élément choisi : un état vide, avec son action. */
  vide?: { titre?: string; texte: string; action: React.ReactNode };
}

export function DetailScinde({ titre, meta, actions, children, suggestion, vide }: DetailScindeProps) {
  const { ts } = useSocleLangue();
  if (titre === undefined) {
    return <div className="sc-detail sc-detail--vide">{vide && <EtatVide titre={vide.titre} texte={vide.texte} action={vide.action} />}</div>;
  }
  return (
    <article aria-label={titre} className="sc-detail">
      <div className="sc-detail__defile">
        <header className="sc-detail__entete">
          <h2 className="sc-detail__titre">{titre}</h2>
          {actions && <div className="sc-detail__actions">{actions}</div>}
        </header>
        {meta && meta.length > 0 && (
          <ul role="list" className="sc-detail__meta">
            {meta.map((m, i) => (
              <li key={`${m.texte}-${i}`}>
                <span aria-hidden className="sc-detail__meta-icone">
                  {m.icone}
                </span>
                <span>{m.texte}</span>
              </li>
            ))}
          </ul>
        )}
        {children && <div className="sc-detail__texte">{children}</div>}
        {suggestion && (
          <SuggestionAjmani
            className="sc-detail__suggestion"
            titre={suggestion.titre}
            texte={suggestion.texte}
            primaire={{ libelle: suggestion.libelleOui ?? ts('scinde.oui'), onClick: suggestion.onOui }}
            secondaire={{ libelle: suggestion.libelleNon ?? ts('scinde.non'), onClick: suggestion.onNon }}
          />
        )}
      </div>
    </article>
  );
}

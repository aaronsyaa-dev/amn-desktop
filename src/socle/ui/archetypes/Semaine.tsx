import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Famille } from '../../familles';
import { useSocleLangue } from '../../i18n';
import { TexteTronque } from './TexteTronque';
import { formaterHeure } from './logique/formats';
import {
  PX_PAR_HEURE,
  hauteurGrille,
  heuresAffichees,
  joursConsecutifs,
  memeJour,
  placerEvenements,
  positionMaintenant,
  type Instant,
} from './logique/semaine';

/**
 * LA SEMAINE (archétype « week ») — une grille horaire de 46 px par heure, des jours en colonnes, des événements en blocs.
 *
 * Mode d'emploi : `<Semaine libelle="…" debut={lundiDeLaSemaine} heureDebut={8} heureFin={20} evenements={[{ id, titre, debut, fin, famille }]} />`.
 * Tout vient des props : le premier jour (`debut`, un `Date`), l'ouverture et la fermeture de la grille, les événements
 * (dates ou horodatages, jamais de texte en dur), la langue des noms de jours (`locale`, `fr-FR` par défaut).
 * `debutDeSemaine(date)` et `joursConsecutifs` (logique/semaine) aident à choisir `debut`. Les événements qui se chevauchent
 * se rangent côte à côte ; aujourd'hui porte une pastille blanche et la ligne « maintenant ». La carte est la seule zone qui défile.
 * Un événement avec `onOuvrir` (ou `onOuvrirEvenement`) est un bouton ; les événements hors de la plage sont comptés sous la grille.
 */

export interface EvenementSemaine {
  id: string;
  titre: string;
  debut: Instant;
  fin: Instant;
  /** Une précision courte (le lieu, le client). */
  detail?: string;
  /** La couleur du bloc : la famille du module d'où vient l'événement. */
  famille?: Famille;
  onOuvrir?: () => void;
}

export interface SemaineProps {
  libelle: string;
  /** Le premier jour affiché. */
  debut: Date;
  /** 7 par défaut. */
  nbJours?: number;
  /** Heure d'ouverture de la grille (8 = 8 h). */
  heureDebut: number;
  heureFin: number;
  evenements: readonly EvenementSemaine[];
  /** Pour figer l'heure (essais, captures). Sans lui, l'horloge du poste, relue chaque minute. */
  maintenant?: Date;
  onOuvrirEvenement?: (evenement: EvenementSemaine) => void;
  locale?: string;
  pxParHeure?: number;
  className?: string;
}

export function Semaine({ libelle, debut, nbJours = 7, heureDebut, heureFin, evenements, maintenant, onOuvrirEvenement, locale = 'fr-FR', pxParHeure = PX_PAR_HEURE, className = '' }: SemaineProps) {
  const { ts } = useSocleLangue();
  const corps = useRef<HTMLDivElement | null>(null);
  const [horloge, setHorloge] = useState(() => new Date());
  useEffect(() => {
    if (maintenant) return undefined;
    const minuteur = window.setInterval(() => setHorloge(new Date()), 60_000);
    return () => window.clearInterval(minuteur);
  }, [maintenant]);
  const ici = maintenant ?? horloge;

  const jours = useMemo(() => joursConsecutifs(debut, nbJours), [debut, nbJours]);
  const { placements, horsPlage } = useMemo(
    () => placerEvenements({ jours, heureDebut, heureFin, pxParHeure }, evenements),
    [jours, heureDebut, heureFin, pxParHeure, evenements],
  );
  const parId = useMemo(() => new Map(evenements.map((e) => [e.id, e])), [evenements]);
  const total = hauteurGrille(heureDebut, heureFin, pxParHeure);
  const maint = positionMaintenant(ici, jours, heureDebut, heureFin, pxParHeure);

  const formats = useMemo(
    () => ({
      court: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
      numero: new Intl.DateTimeFormat(locale, { day: 'numeric' }),
      long: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    }),
    [locale],
  );

  // À l'ouverture, la grille se cale un peu au-dessus de « maintenant » (sinon en haut).
  const hauteurMaintenant = maint?.haut;
  useEffect(() => {
    if (corps.current && hauteurMaintenant != null) corps.current.scrollTop = Math.max(0, hauteurMaintenant - 120);
    // seulement au premier affichage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heures = heuresAffichees(heureDebut, heureFin);
  const base = jours[0] ?? debut;

  return (
    <section aria-label={libelle} className={`sc-semaine sc-zone ${className}`.trim()} style={{ '--sc-semaine-jours': jours.length, '--sc-px-heure': `${pxParHeure}px` } as React.CSSProperties}>
      <div ref={corps} className="sc-semaine__corps">
        <div className="sc-semaine__tete">
          <span aria-hidden className="sc-semaine__coin" />
          {jours.map((j, i) => {
            const aujourdhui = memeJour(j, ici);
            return (
              <div key={i} aria-current={aujourdhui ? 'date' : undefined} data-aujourdhui={aujourdhui || undefined} className="sc-semaine__titre-jour">
                <span className="sc-semaine__nom-jour">{formats.court.format(j)}</span>
                <span className="sc-semaine__numero">{formats.numero.format(j)}</span>
                {aujourdhui && <span className="sr-only"> — {ts('semaine.aujourdhui')}</span>}
              </div>
            );
          })}
        </div>
        <div className="sc-semaine__grille" style={{ height: total }}>
          <div aria-hidden className="sc-semaine__heures">
            {heures.map((h, i) => (
              <span key={h} className="sc-semaine__heure" style={{ top: i * pxParHeure }}>
                {formaterHeure(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h), locale)}
              </span>
            ))}
          </div>
          {jours.map((j, i) => (
            <div key={i} role="group" aria-label={formats.long.format(j)} className="sc-semaine__jour">
              <ul role="list" className="sc-semaine__evenements">
                {placements
                  .filter((p) => p.jour === i)
                  .map((p) => {
                    const ev = parId.get(p.id);
                    if (!ev) return null;
                    const ouvrir = ev.onOuvrir ?? (onOuvrirEvenement ? () => onOuvrirEvenement(ev) : undefined);
                    const horaire = `${formaterHeure(ev.debut instanceof Date ? ev.debut : new Date(ev.debut), locale)}–${formaterHeure(ev.fin instanceof Date ? ev.fin : new Date(ev.fin), locale)}`;
                    const contenu = (
                      <>
                        <TexteTronque className="sc-semaine__evenement-titre">{ev.titre}</TexteTronque>
                        {p.hauteur >= 38 && <span className="sc-semaine__evenement-heure">{horaire}</span>}
                        {ev.detail && p.hauteur >= 58 && <TexteTronque className="sc-semaine__evenement-detail">{ev.detail}</TexteTronque>}
                      </>
                    );
                    const style = {
                      top: p.haut,
                      height: p.hauteur,
                      left: `calc(${(p.colonne / p.colonnes) * 100}% + 2px)`,
                      width: `calc(${(p.empan / p.colonnes) * 100}% - 4px)`,
                    } as React.CSSProperties;
                    return (
                      <li key={p.id} style={style} className="sc-semaine__emplacement">
                        {ouvrir ? (
                          <button type="button" onClick={ouvrir} data-famille={ev.famille} title={`${ev.titre} · ${horaire}`} className="sc-semaine__evenement sc-focus">
                            {contenu}
                          </button>
                        ) : (
                          <div data-famille={ev.famille} title={`${ev.titre} · ${horaire}`} className="sc-semaine__evenement">
                            {contenu}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
              {maint && maint.jour === i && (
                <div aria-hidden className="sc-semaine__maintenant" style={{ top: maint.haut }}>
                  <span />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {horsPlage.length > 0 && <p className="sc-semaine__note">{ts('semaine.horsPlage', { n: horsPlage.length })}</p>}
    </section>
  );
}

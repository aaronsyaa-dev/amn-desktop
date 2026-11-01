import React, { useId } from 'react';
import { Check } from 'lucide-react';
import { useSocleLangue } from '../../i18n';
import { AnneauProgression, BarreProgression } from '../Indicateurs';
import { CaseACocher } from '../Taches';

/**
 * Les quatre cartes ludiques du socle (§4). Au plus UNE par écran, toujours chiffrée, jamais de confettis, de point
 * perdu ni de message culpabilisant : « 1 sur 3 fait », « 12 sur 15 », « 5 jours de suite ».
 */

export interface LigneCase {
  id: string;
  libelle: string;
  fait: boolean;
}

/** `cases` : un titre, « n sur total fait », une barre, des lignes à cocher de 33 px. Tout fait : le titre change et la barre passe au vert. */
export function CarteCases({ titre, titreComplet, lignes, onChange, lecture = false }: { titre: string; titreComplet?: string; lignes: LigneCase[]; onChange?: (id: string, fait: boolean) => void; lecture?: boolean }) {
  const { ts } = useSocleLangue();
  const fait = lignes.filter((l) => l.fait).length;
  const complet = lignes.length > 0 && fait === lignes.length;
  const idTitre = useId();
  return (
    <section aria-labelledby={idTitre} data-socle="ludique" data-ludique="cases" className="sc-ludique">
      <div className="sc-ludique__entete">
        <h3 id={idTitre} className="sc-ludique__titre">
          {complet && titreComplet ? titreComplet : titre}
        </h3>
        <span className="sc-ludique__chiffre">{ts('ludique.xSurYFait', { x: fait, y: lignes.length })}</span>
      </div>
      <BarreProgression valeur={lignes.length ? fait / lignes.length : 0} ton={complet ? 'succes' : 'neutre'} libelle={titre} texte={ts('ludique.xSurYFait', { x: fait, y: lignes.length })} />
      <ul className="sc-ludique__lignes">
        {lignes.map((l) => (
          <li key={l.id} data-fait={l.fait}>
            <CaseACocher coche={l.fait} libelle={l.libelle} lecture={lecture} onChange={(v) => onChange?.(l.id, v)} />
            <span>{l.libelle}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `anneau` : un anneau de 72 px à gauche, un titre et un texte à droite. */
export function CarteAnneau({ titre, texte, valeur, centre }: { titre: string; texte: string; valeur: number; centre: React.ReactNode }) {
  const idTitre = useId();
  return (
    <section aria-labelledby={idTitre} data-socle="ludique" data-ludique="anneau" className="sc-ludique sc-ludique--anneau">
      <AnneauProgression valeur={valeur} libelle={titre} texte={texte} taille={72} epaisseur={8}>
        {centre}
      </AnneauProgression>
      <div>
        <h3 id={idTitre} className="sc-ludique__titre">
          {titre}
        </h3>
        <p className="sc-ludique__texte">{texte}</p>
      </div>
    </section>
  );
}

export interface JourDeSerie {
  /** La lettre affichée (« L », « M »…). */
  initiale: string;
  /** Le nom complet du jour, pour les lecteurs d'écran (« lundi »). */
  nom: string;
  fait: boolean;
}

/** `serie` : sept cases rondes de 24 px avec l'initiale du jour, et la phrase « n jours de suite ». Lecture seule. */
export function CarteSerie({ titre, jours, texte }: { titre: string; jours: JourDeSerie[]; texte?: string }) {
  const { ts } = useSocleLangue();
  const idTitre = useId();
  return (
    <section aria-labelledby={idTitre} data-socle="ludique" data-ludique="serie" className="sc-ludique">
      <h3 id={idTitre} className="sc-ludique__titre">
        {titre}
      </h3>
      <ol className="sc-ludique__serie">
        {jours.map((j, i) => (
          <li key={`${j.nom}-${i}`} aria-label={ts(j.fait ? 'ludique.jourFait' : 'ludique.jourPasFait', { jour: j.nom })}>
            <span aria-hidden className="sc-case sc-case--statique" data-taille="serie" data-fait={j.fait}>
              {j.fait && <Check size={13} strokeWidth={3} />}
            </span>
            <span aria-hidden className="sc-ludique__initiale">
              {j.initiale}
            </span>
          </li>
        ))}
      </ol>
      {texte && <p className="sc-ludique__texte">{texte}</p>}
    </section>
  );
}

/** `jalon` : « fait sur total » en grand, une barre de 8 px avec repères à 25, 50 et 75 %, et un texte. */
export function CarteJalon({ titre, fait, total, texte }: { titre: string; fait: number; total: number; texte?: string }) {
  const { ts } = useSocleLangue();
  const idTitre = useId();
  const chiffre = ts('ludique.xSurY', { x: fait, y: total });
  return (
    <section aria-labelledby={idTitre} data-socle="ludique" data-ludique="jalon" className="sc-ludique">
      <div className="sc-ludique__entete">
        <h3 id={idTitre} className="sc-ludique__titre">
          {titre}
        </h3>
        <span className="sc-ludique__chiffre sc-ludique__chiffre--grand">{chiffre}</span>
      </div>
      <BarreProgression valeur={total > 0 ? fait / total : 0} hauteur={8} reperes libelle={titre} texte={chiffre} />
      {texte && <p className="sc-ludique__texte">{texte}</p>}
    </section>
  );
}

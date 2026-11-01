import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { useFermetureEchap } from '../../lib/useFermetureEchap';
import { useSocleLangue } from '../i18n';
import type { GroupePropositions, Proposition } from './types';

/**
 * LA PALETTE ⌘J — un champ, une proposition, des suggestions.
 *
 * Champ vide : les suggestions du moment. Dès qu'on écrit : d'abord « Demander
 * à Ajmani : … » (la proposition, toujours là, jamais un cul-de-sac), puis les
 * modules que l'intention désigne. ↑ ↓ choisissent, Entrée valide, Échap
 * ferme ; le focus entre dans le champ et revient à ce qui a ouvert la
 * palette. Le calque (`.sc-voile` : position fixe, z-index 50) est celui que la
 * pile des calques reconnaît : un autre dialogue ne peut pas lui voler Échap.
 * Le focus entre par l'`autoFocus` du champ, pas par `useFocusALOuverture`, qui
 * le poserait sur la fenêtre et non sur le champ.
 *
 * Le motif ARIA est celui du « combobox » : le focus reste dans le champ,
 * `aria-activedescendant` désigne la ligne choisie.
 */
export interface PaletteAjmaniProps {
  ouverte: boolean;
  onFermer: () => void;
  /** Les suggestions du moment (champ vide). */
  suggestions: Proposition[];
  /** Les modules que l'intention désigne. */
  chercher: (texte: string) => Proposition[];
  /** Entrée sur « Demander à Ajmani ». */
  onDemander: (texte: string) => void;
}

export function PaletteAjmani({ ouverte, onFermer, suggestions, chercher, onDemander }: PaletteAjmaniProps) {
  const { ts } = useSocleLangue();
  const retour = useRef<HTMLElement | null>(null);
  useFermetureEchap(ouverte, onFermer);

  useEffect(() => {
    if (!ouverte) return undefined;
    retour.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (retour.current?.isConnected) retour.current.focus();
    };
  }, [ouverte]);

  if (typeof document === 'undefined' || !ouverte) return null;
  return createPortal(
    <Contenu onFermer={onFermer} suggestions={suggestions} chercher={chercher} onDemander={onDemander} titre={ts('palette.titre')} />,
    document.body,
  );
}

function Contenu({
  onFermer,
  suggestions,
  chercher,
  onDemander,
  titre,
}: {
  onFermer: () => void;
  suggestions: Proposition[];
  chercher: (texte: string) => Proposition[];
  onDemander: (texte: string) => void;
  titre: string;
}) {
  const { ts } = useSocleLangue();
  const idTitre = useId();
  const idListe = useId();
  const [texte, setTexte] = useState('');
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const requete = texte.trim();

  const groupes = useMemo<GroupePropositions[]>(() => {
    if (!requete) return suggestions.length > 0 ? [{ titre: ts('palette.suggestions'), propositions: suggestions }] : [];
    const demander: Proposition = { id: 'demander', libelle: ts('palette.demander', { texte: requete }), detail: ts('palette.demander.aide'), executer: () => onDemander(requete) };
    const trouves = chercher(requete);
    return [{ titre: '', propositions: [demander] }, ...(trouves.length > 0 ? [{ titre: ts('palette.resultats'), propositions: trouves }] : [])];
  }, [requete, suggestions, chercher, onDemander, ts]);

  const plat = useMemo(() => groupes.flatMap((g) => g.propositions), [groupes]);
  useEffect(() => setActif(0), [requete]);
  const idOption = (p: Proposition) => `${idListe}-${p.id}`;
  const courante = plat[Math.min(actif, plat.length - 1)];

  useEffect(() => {
    if (courante) document.getElementById(idOption(courante))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courante?.id]);

  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => (plat.length ? (i + 1) % plat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => (plat.length ? (i - 1 + plat.length) % plat.length : 0));
    } else if (e.key === 'Enter' && courante) {
      e.preventDefault();
      courante.executer();
    }
  };

  return (
    <div className="sc-voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer()} data-palette-ajmani>
      <div role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1} className="sc-palette">
        <h2 id={idTitre} className="sr-only">
          {titre}
        </h2>
        <div className="sc-palette__champ">
          <Search size={17} aria-hidden />
          <input
            ref={champ}
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={idListe}
            aria-autocomplete="list"
            aria-activedescendant={courante ? idOption(courante) : undefined}
            aria-label={ts('palette.champ')}
            placeholder={ts('palette.champ')}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={surTouche}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ul id={idListe} role="listbox" aria-label={ts('palette.liste')} className="sc-palette__liste">
          {groupes.map((g, gi) => (
            <React.Fragment key={`${g.titre}-${gi}`}>
              {g.titre && (
                <li role="presentation" className="sc-palette__groupe">
                  {g.titre}
                </li>
              )}
              {g.propositions.map((p) => (
                <li
                  key={p.id}
                  id={idOption(p)}
                  role="option"
                  aria-selected={p === courante}
                  data-famille={p.famille}
                  className="sc-option"
                  tabIndex={-1}
                  onMouseMove={() => setActif(plat.indexOf(p))}
                  onClick={p.executer}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') p.executer();
                  }}
                >
                  {p.famille && <span aria-hidden className="sc-point" />}
                  <span className="sc-option__texte">{p.libelle}</span>
                  {p.detail && <span className="sc-option__detail">{p.detail}</span>}
                  {p === courante && <CornerDownLeft size={14} aria-hidden />}
                </li>
              ))}
            </React.Fragment>
          ))}
        </ul>
        {requete && plat.length <= 1 && <p className="sc-palette__vide">{ts('palette.aucun')}</p>}
        <p className="sc-palette__aide">{ts('palette.aide')}</p>
      </div>
    </div>
  );
}

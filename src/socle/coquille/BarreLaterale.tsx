import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search } from 'lucide-react';
import { Avatar, Raccourci } from '../ui';
import { useSocleLangue } from '../i18n';
import type { FamilleLaterale, ModuleLateral, PersonneEnLigne } from './types';

/**
 * LA BARRE LATÉRALE — la seule navigation (252 px).
 *
 * Du haut en bas : la marque (logo « A » et le produit), la recherche ⌘K, les
 * sept familles — la famille où l'on est déroule ses modules sur un filet
 * vertical —, un séparateur, la Garde (huitième famille, édition interne), puis
 * en bas « Tous les modules (N) » et qui est en ligne.
 *
 * Les couleurs de famille ne sont que des pastilles de 7 px. Le module courant
 * porte `aria-current="page"`. Sous 900 px la barre est un tiroir : elle se
 * ferme sur Échap (géré par la coquille) et quand on choisit un module.
 *
 * Données et navigation arrivent par props : cette barre ne lit rien d'autre.
 */
export interface BarreLateraleProps {
  produit: string;
  familles: FamilleLaterale[];
  /** La huitième famille. `null` : elle n'existe pas dans cette édition. */
  garde: FamilleLaterale | null;
  nombreModules: number;
  routeTousLesModules: string;
  enLigne: PersonneEnLigne[];
  /** Faux : la personne a coupé sa présence — on le dit au lieu de montrer une liste vide. */
  presenceMontree: boolean;
  /** « ⌘ K » ou « Ctrl K ». */
  raccourciRecherche: string;
  onRecherche: () => void;
  /** Tiroir (sous 900 px). */
  ouvert: boolean;
  onFermer: () => void;
}

export const BarreLaterale = React.forwardRef<HTMLElement, BarreLateraleProps>(function BarreLaterale(
  { produit, familles, garde, nombreModules, routeTousLesModules, enLigne, presenceMontree, raccourciRecherche, onRecherche, ouvert, onFermer },
  ref,
) {
  const { ts } = useSocleLangue();
  const toutes = garde ? [...familles, garde] : familles;
  const actuelle = toutes.find((f) => f.active)?.cle;
  const [ouvertes, setOuvertes] = useState<Set<string>>(() => new Set(actuelle ? [actuelle] : []));
  // Entrer dans une famille par ailleurs (⌘K, un lien) la déroule : on voit toujours où l'on est.
  useEffect(() => {
    if (actuelle) setOuvertes((s) => (s.has(actuelle) ? s : new Set(s).add(actuelle)));
  }, [actuelle]);
  const basculer = (cle: string) =>
    setOuvertes((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const module = (m: ModuleLateral) => (
    <li key={m.cle}>
      <Link to={m.vers} onClick={onFermer} aria-current={m.courant ? 'page' : undefined} className="sc-module sc-focus">
        <span>{m.libelle}</span>
        {m.badge > 0 && (
          <span className="sc-compteur" title={ts('coquille.badge', { n: m.badge })}>
            {m.badge > 99 ? '99+' : m.badge}
            <span className="sr-only"> {ts('coquille.badge', { n: m.badge })}</span>
          </span>
        )}
      </Link>
    </li>
  );

  const groupe = (f: FamilleLaterale) => {
    const deployee = ouvertes.has(f.cle);
    const idSous = `sc-sous-${f.cle}`;
    return (
      <li key={f.cle} data-famille={f.famille}>
        <button
          type="button"
          aria-expanded={deployee}
          aria-controls={idSous}
          aria-label={ts(deployee ? 'coquille.famille.replier' : 'coquille.famille.deplier', { nom: f.nom })}
          data-active={f.cle === actuelle}
          onClick={() => basculer(f.cle)}
          className="sc-famille sc-focus"
        >
          <span aria-hidden className="sc-point" />
          <span className="sc-famille__nom">{f.nom}</span>
          {!deployee && f.badge > 0 && (
            <span className="sc-compteur" title={ts('coquille.badge', { n: f.badge })}>
              {f.badge > 99 ? '99+' : f.badge}
            </span>
          )}
        </button>
        {deployee && (
          <ul id={idSous} className="sc-sous">
            {f.modules.map(module)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside ref={ref} data-rail data-socle="lateral" data-ouvert={ouvert} aria-label={ts('coquille.nav')} className="sc-lateral">
      <div className="sc-marque">
        <span aria-hidden className="sc-marque__logo">
          A
        </span>
        <span>
          <span className="sc-marque__nom" style={{ display: 'block' }}>
            {produit}
          </span>
          <span className="sc-marque__sous" style={{ display: 'block' }}>
            {ts('coquille.produit.sous')}
          </span>
        </span>
      </div>

      <div data-guide="recherche">
        <button type="button" onClick={onRecherche} aria-label={ts('coquille.recherche.aide')} className="sc-recherche sc-focus">
          <Search size={15} aria-hidden />
          <span>{ts('coquille.recherche')}</span>
          <Raccourci>{raccourciRecherche}</Raccourci>
        </button>
      </div>

      <nav aria-label={ts('coquille.nav')} data-guide="epingles">
        <ul className="sc-liste">{familles.filter((f) => f.modules.length > 0).map(groupe)}</ul>
        {garde && garde.modules.length > 0 && (
          <ul className="sc-liste sc-liste--garde" data-guide="supervision">
            {groupe(garde)}
          </ul>
        )}
      </nav>

      <div className="sc-pied">
        <Link to={routeTousLesModules} onClick={onFermer} className="sc-tous sc-focus">
          <LayoutGrid size={15} aria-hidden />
          {ts('coquille.tous', { n: nombreModules })}
        </Link>

        <section aria-labelledby="sc-enligne" className="sc-enligne">
          <h2 id="sc-enligne" className="sc-enligne__titre">
            <i aria-hidden />
            {ts('coquille.enLigne')}
            {presenceMontree && enLigne.length > 0 && <span>· {enLigne.length}</span>}
          </h2>
          {!presenceMontree ? (
            <p className="sc-enligne__vide">{ts('coquille.presenceCoupee')}</p>
          ) : enLigne.length === 0 ? (
            <p className="sc-enligne__vide">{ts('coquille.personne')}</p>
          ) : (
            <ul>
              {enLigne.map((p) => (
                <li key={p.cle}>
                  <span className="sc-presence">
                    <Avatar nom={p.nom} taille={26} />
                  </span>
                  <span className="sc-enligne__texte">
                    <span className="sc-enligne__nom">{p.nom}</span>
                    <span className="sc-enligne__lieu">{ts('coquille.enLigne.sur', { lieu: p.lieu })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
});

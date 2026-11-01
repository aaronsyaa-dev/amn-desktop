import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search, ShieldCheck } from 'lucide-react';
import { Avatar, Raccourci } from '../ui';
import { useSocleLangue } from '../i18n';
import type { EtatGarde, FamilleLaterale, ModuleLateral, PersonneEnLigne } from './types';

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
  garde: FamilleLaterale | null;
  /** La pire situation ouverte à La Garde : le point de l'entrée « La Garde et la supervision ». */
  etatGarde?: EtatGarde;
  nombreModules: number;
  routeTousLesModules: string;
  enLigne: PersonneEnLigne[];
  presenceMontree: boolean;
  raccourciRecherche: string;
  onRecherche: () => void;
  ouvert: boolean;
  onFermer: () => void;
}

/** Le lien « + N autres » d'une famille : Tous les modules, avec la carte de cette famille en état actif. */
export function lienAutres(routeTousLesModules: string, cleFamille: string): string {
  return `${routeTousLesModules}?famille=${encodeURIComponent(cleFamille)}`;
}

export const BarreLaterale = React.forwardRef<HTMLElement, BarreLateraleProps>(function BarreLaterale(
  { produit, familles, garde, etatGarde = 'calme', nombreModules, routeTousLesModules, enLigne, presenceMontree, raccourciRecherche, onRecherche, ouvert, onFermer },
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

  const module = (m: ModuleLateral, ensemble = false) => (
    <li key={m.cle}>
      <Link to={m.vers} onClick={onFermer} aria-current={m.courant ? 'page' : undefined} data-ensemble={ensemble || undefined} className="sc-module sc-focus">
        <span>{ensemble ? ts('coquille.ensemble') : m.libelle}</span>
        {m.badge > 0 && (
          <span className="sc-compteur" title={ts('coquille.badge', { n: m.badge })}>
            {m.badge > 99 ? '99+' : m.badge}
            <span className="sr-only"> {ts('coquille.badge', { n: m.badge })}</span>
          </span>
        )}
      </Link>
    </li>
  );

  const groupe = (f: FamilleLaterale, estGarde = false) => {
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
          {estGarde ? <ShieldCheck aria-hidden size={15} className="sc-famille__bouclier" /> : <span aria-hidden className="sc-point" data-taille="8" />}
          <span className="sc-famille__nom">{f.nom}</span>
          {estGarde && (
            <span className="sc-famille__etat" data-etat={etatGarde}>
              <i aria-hidden />
              <span className="sr-only">{ts(etatGarde === 'critique' ? 'coquille.garde.etat.critique' : etatGarde === 'attention' ? 'coquille.garde.etat.attention' : 'coquille.garde.etat.calme')}</span>
            </span>
          )}
          {!deployee && f.badge > 0 && (
            <span className="sc-compteur" title={ts('coquille.badge', { n: f.badge })}>
              {f.badge > 99 ? '99+' : f.badge}
            </span>
          )}
        </button>
        {deployee && (
          <ul id={idSous} className="sc-sous">
            {f.ensemble && module(f.ensemble, true)}
            {f.modules.map((m) => module(m))}
            {(f.autres ?? 0) > 0 && (
              <li>
                <Link to={lienAutres(routeTousLesModules, f.cle)} onClick={onFermer} aria-label={ts('coquille.autres.aide', { n: f.autres ?? 0, nom: f.nom })} className="sc-module sc-module--autres sc-focus">
                  <span>{ts('coquille.autres', { n: f.autres ?? 0 })}</span>
                </Link>
              </li>
            )}
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
        <button type="button" onClick={onRecherche} aria-label={ts('coquille.recherche.aide')} aria-keyshortcuts="Control+K Meta+K" className="sc-recherche sc-focus">
          <Search size={14} aria-hidden />
          <span>{ts('coquille.recherche')}</span>
          <Raccourci>{raccourciRecherche}</Raccourci>
        </button>
      </div>

      <nav aria-label={ts('coquille.nav')} data-guide="epingles">
        <ul className="sc-liste">{familles.filter((f) => f.modules.length > 0 || f.ensemble).map((f) => groupe(f))}</ul>
        {garde && garde.modules.length > 0 && (
          <ul className="sc-liste sc-liste--garde" data-guide="supervision">
            {groupe(garde, true)}
          </ul>
        )}
      </nav>

      <div className="sc-pied">
        <Link to={routeTousLesModules} onClick={onFermer} className="sc-tous sc-focus">
          <LayoutGrid size={15} aria-hidden />
          <span>{ts('coquille.tous.court')}</span>
          <b className="sc-tous__nombre">{nombreModules}</b>
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
                  <Avatar nom={p.nom} taille={26} enLigne />
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

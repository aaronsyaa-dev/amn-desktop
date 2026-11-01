import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Circle,
  Euro,
  Layers,
  LayoutGrid,
  MessageSquare,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AnneauProgression, Avatar, LiveDot, Raccourci, type TonVivant } from '../ui';
import { useSocleLangue } from '../i18n';
import type { CarteAujourdhui, EtatGarde, FamilleLaterale, ModuleLateral } from './types';

/**
 * LA BARRE LATÉRALE v3 (01-SOCLE-DESIGN §0.1) — la seule navigation, 252 px.
 *
 * Du haut en bas : la marque (logo, « AMN Business », « Espace de l'équipe ») et le bouton qui replie la barre ;
 * la ligne de recherche (le champ ⌘K et, collé à droite, le bouton carré « Tous les modules (N) ») ; trois
 * sections nommées — ESPACE (les sept familles), SURVEILLANCE (La Garde, Cyber), ÉPINGLÉS (trois modules choisis
 * par la personne) — ; en bas, la carte « Aujourd'hui » (les chiffres de l'Accueil, le prochain rendez-vous, qui
 * est en ligne et où).
 *
 * Familles : 32 px, une icône de trait de 15 px en T3 et le libellé en T2. Plus aucune pastille de couleur : la
 * teinte de la famille ne colore que l'icône de la famille active. La famille où l'on est déroule au plus cinq
 * lignes (« Vue d'ensemble » d'abord, sauf Ma journée ; le module courant toujours visible) sur un filet, avec un
 * repère blanc posé sur le filet en face du module courant, puis « + N autres ». Les compteurs ne s'écrivent
 * plus ni sur les familles ni dans la sous-liste (images v3) : ils restent sur les épinglés et sur Cyber, et
 * l'Accueil les porte tous.
 *
 * Données et navigation arrivent par props : cette barre ne lit rien d'autre. Le module courant porte
 * `aria-current="page"`. Sous 900 px la barre est un tiroir (fermé sur Échap par la coquille, et au choix d'un
 * module).
 */
export interface BarreLateraleProps {
  produit: string;
  /** ESPACE : les sept familles. */
  familles: FamilleLaterale[];
  /** SURVEILLANCE : La Garde (huitième famille), ou `null` quand l'organisation n'a aucun de ses modules. */
  garde: FamilleLaterale | null;
  /** SURVEILLANCE : Cyber, toujours là (un lien vers ses écrans, et le compteur d'alertes ouvertes du SOC). */
  cyber: FamilleLaterale;
  /** ÉPINGLÉS : les modules choisis par la personne, sans le module ouvert (trois au plus sont montrés). */
  epingles: ModuleLateral[];
  /** La pire situation ouverte à La Garde : le voyant de la ligne « La Garde ». */
  etatGarde?: EtatGarde;
  nombreModules: number;
  routeTousLesModules: string;
  /** On est sur « Tous les modules » : le bouton carré est allumé. */
  tousLesModulesActif?: boolean;
  /** La carte « Aujourd'hui », ou `null` tant que l'Accueil n'a rien à dire. */
  aujourdhui: CarteAujourdhui | null;
  raccourciRecherche: string;
  onRecherche: () => void;
  /** Replier la barre (le bouton « panneau » du haut). */
  onReplier: () => void;
  ouvert: boolean;
  onFermer: () => void;
}

/** Les modules épinglés montrés dans la barre. */
export const EPINGLES_MONTRES = 3;
/** Les collègues montrés dans la carte « Aujourd'hui ». */
export const COLLEGUES_MONTRES = 2;

/** L'icône de trait de chaque famille (§0.1) : soleil, personnes, stylo, euro, bulle, calques, curseurs, bouclier, cible. */
export const ICONES_FAMILLE: Readonly<Record<string, LucideIcon>> = {
  jour: Sun,
  contacts: Users,
  ecrire: Pencil,
  argent: Euro,
  echanger: MessageSquare,
  creer: Layers,
  outils: SlidersHorizontal,
  garde: Shield,
  cyber: Target,
};
const iconeDe = (cle: string | undefined): LucideIcon => (cle ? ICONES_FAMILLE[cle] : undefined) ?? Circle;

/** Le lien « + N autres » d'une famille : Tous les modules, avec la carte de cette famille en état actif. */
export function lienAutres(routeTousLesModules: string, cleFamille: string): string {
  return `${routeTousLesModules}?famille=${encodeURIComponent(cleFamille)}`;
}

const TON_GARDE: Record<EtatGarde, TonVivant> = { calme: 'ok', attention: 'attention', critique: 'critique', inconnu: 'info' };

export const BarreLaterale = React.forwardRef<HTMLElement, BarreLateraleProps>(function BarreLaterale(
  {
    produit,
    familles,
    garde,
    cyber,
    epingles,
    etatGarde = 'calme',
    nombreModules,
    routeTousLesModules,
    tousLesModulesActif = false,
    aujourdhui,
    raccourciRecherche,
    onRecherche,
    onReplier,
    ouvert,
    onFermer,
  },
  ref,
) {
  const { ts } = useSocleLangue();
  const toutes = [...familles, ...(garde ? [garde] : []), cyber];
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

  const compteur = (n: number, aide: string, pastille = false) =>
    n > 0 ? (
      <span className="sc-compteur" data-pastille={pastille || undefined} title={aide}>
        {n > 99 ? '99+' : n}
        <span className="sr-only"> {aide}</span>
      </span>
    ) : null;

  const module = (m: ModuleLateral, ensemble = false) => (
    <li key={m.cle}>
      <Link to={m.vers} onClick={onFermer} aria-current={m.courant ? 'page' : undefined} data-ensemble={ensemble || undefined} className="sc-module sc-focus">
        <span className="sc-module__nom">{ensemble ? ts('coquille.ensemble') : m.libelle}</span>
      </Link>
    </li>
  );

  /** Ce qu'une famille écrit à droite : « veille » et le voyant de La Garde, le compteur de Cyber, le chevron de la famille ouverte. */
  const droite = (f: FamilleLaterale, deployee: boolean) => {
    if (f.cle === 'garde') {
      const etat = etatGarde;
      return (
        <span className="sc-famille__etat" data-etat={etat}>
          <span aria-hidden className="sc-famille__veille">
            {ts('coquille.garde.veille')}
          </span>
          <LiveDot ton={TON_GARDE[etat]} onde={etat !== 'inconnu'} halo={false} libelle={ts(etat === 'critique' ? 'coquille.garde.etat.critique' : etat === 'attention' ? 'coquille.garde.etat.attention' : etat === 'inconnu' ? 'coquille.garde.etat.inconnu' : 'coquille.garde.etat.calme')} />
        </span>
      );
    }
    if (f.compteur != null && f.compteur > 0) return compteur(f.compteur, f.compteurAide ?? ts('coquille.badge', { n: f.compteur }), true);
    if (deployee) return <ChevronDown aria-hidden size={15} strokeWidth={1.8} className="sc-famille__chevron" />;
    return null;
  };

  const groupe = (f: FamilleLaterale) => {
    const Icone = iconeDe(f.cle);
    const aSousListe = f.modules.length > 0 || Boolean(f.ensemble);
    const deployee = aSousListe && ouvertes.has(f.cle);
    const idSous = `sc-sous-${f.cle}`;
    const contenu = (
      <>
        <Icone aria-hidden size={15} strokeWidth={1.8} className="sc-famille__icone" />
        <span className="sc-famille__nom">{f.nom}</span>
        {droite(f, deployee)}
      </>
    );
    return (
      <li key={f.cle} data-famille={f.famille} data-cle={f.cle}>
        {aSousListe ? (
          <button
            type="button"
            aria-expanded={deployee}
            aria-controls={idSous}
            aria-label={ts(deployee ? 'coquille.famille.replier' : 'coquille.famille.deplier', { nom: f.nom })}
            data-active={f.cle === actuelle}
            onClick={() => basculer(f.cle)}
            className="sc-famille sc-focus"
          >
            {contenu}
          </button>
        ) : (
          <Link to={f.vers ?? routeTousLesModules} onClick={onFermer} aria-current={f.active ? 'page' : undefined} data-active={f.cle === actuelle} className="sc-famille sc-focus">
            {contenu}
          </Link>
        )}
        {deployee && (
          <ul id={idSous} className="sc-sous">
            {f.ensemble && module(f.ensemble, true)}
            {f.modules.map((m) => module(m))}
            {(f.autres ?? 0) > 0 && (
              <li>
                <Link to={lienAutres(routeTousLesModules, f.cle)} onClick={onFermer} aria-label={ts('coquille.autres.aide', { n: f.autres ?? 0, nom: f.nom })} className="sc-module sc-module--autres sc-focus">
                  <Plus aria-hidden size={11} strokeWidth={2} />
                  <span>{ts('coquille.autres', { n: f.autres ?? 0 })}</span>
                </Link>
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  const section = (id: string, titre: string, enfants: React.ReactNode, guide?: string) => (
    <section aria-labelledby={`sc-section-${id}`} className="sc-section" data-section={id} data-guide={guide}>
      <h2 id={`sc-section-${id}`} className="sc-section__titre">
        {titre}
      </h2>
      <ul className="sc-liste">{enfants}</ul>
    </section>
  );

  const montres = epingles.filter((m) => !m.courant).slice(0, EPINGLES_MONTRES);
  const libelleTous = ts('coquille.tous', { n: nombreModules });

  return (
    <aside ref={ref} data-rail data-socle="lateral" data-ouvert={ouvert} aria-label={ts('coquille.nav')} className="sc-lateral">
      <div className="sc-marque">
        <span aria-hidden className="sc-marque__logo">
          A
        </span>
        <span className="sc-marque__texte">
          <span className="sc-marque__nom">{produit}</span>
          <span className="sc-marque__sous">{ts('coquille.produit.sous')}</span>
        </span>
        <button type="button" onClick={onReplier} aria-label={ts('coquille.replier')} title={ts('coquille.replier')} className="sc-replier sc-focus">
          <PanelLeft aria-hidden size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="sc-recherche-ligne" data-guide="recherche">
        <button type="button" onClick={onRecherche} aria-label={ts('coquille.recherche.aide')} aria-keyshortcuts="Control+K Meta+K" className="sc-recherche sc-focus">
          <Search size={14} aria-hidden />
          <span className="sc-recherche__texte">{ts('coquille.recherche')}</span>
          <Raccourci>{raccourciRecherche}</Raccourci>
        </button>
        <Link to={routeTousLesModules} onClick={onFermer} aria-label={libelleTous} title={libelleTous} aria-current={tousLesModulesActif ? 'page' : undefined} className="sc-tous sc-focus">
          <LayoutGrid size={15} strokeWidth={1.8} aria-hidden />
        </Link>
      </div>

      <nav aria-label={ts('coquille.nav')} data-guide="epingles" className="sc-nav">
        {section('espace', ts('coquille.section.espace'), familles.filter((f) => f.modules.length > 0 || f.ensemble).map((f) => groupe(f)))}
        {section('surveillance', ts('coquille.section.surveillance'), [...(garde && garde.modules.length > 0 ? [groupe(garde)] : []), groupe(cyber)], 'supervision')}
        {montres.length > 0 &&
          section(
            'epingles',
            ts('coquille.section.epingles'),
            montres.map((m) => {
              const Icone = iconeDe(m.famille);
              return (
                <li key={m.cle}>
                  <Link to={m.vers} onClick={onFermer} className="sc-epingle sc-focus">
                    <Icone aria-hidden size={13} strokeWidth={1.8} className="sc-epingle__icone" />
                    <span className="sc-epingle__nom">{m.libelle}</span>
                    {m.badge > 0 && (
                      <span className="sc-epingle__compteur sc-nombre" title={ts('coquille.badge', { n: m.badge })}>
                        {m.badge > 99 ? '99+' : m.badge}
                        <span className="sr-only"> {ts('coquille.badge', { n: m.badge })}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            }),
          )}
      </nav>

      {aujourdhui && <CarteDuJour carte={aujourdhui} onFermer={onFermer} />}
    </aside>
  );
});

/**
 * LA CARTE « AUJOURD'HUI » (§0.1) — à la place de l'ancien bloc « En ligne ». L'anneau et « x sur y faites ·
 * série n j » sont les chiffres de l'Accueil ; puis le prochain rendez-vous (voyant bleu) ; puis les collègues en
 * ligne et le module où chacun se trouve — son libellé, jamais une adresse.
 */
function CarteDuJour({ carte, onFermer }: { carte: CarteAujourdhui; onFermer: () => void }) {
  const { ts } = useSocleLangue();
  const part = carte.total > 0 ? carte.faites / carte.total : 0;
  const progres = carte.total > 0 ? ts('coquille.jour.progres', { x: carte.faites, y: carte.total }) : ts('coquille.jour.rien');
  const detail = carte.serie > 0 ? `${progres} · ${ts('coquille.jour.serie', { n: carte.serie })}` : progres;
  const collegues = carte.collegues.slice(0, COLLEGUES_MONTRES);
  return (
    <section aria-labelledby="sc-aujourdhui" className="sc-aujourdhui" data-socle="aujourdhui">
      <Link to={carte.vers} onClick={onFermer} className="sc-aujourdhui__tete sc-focus">
        <AnneauProgression valeur={part} libelle={ts('coquille.jour.titre')} texte={progres} taille={34} epaisseur={4} ton="succes" piste="anneau" />
        <span className="sc-aujourdhui__textes">
          <span id="sc-aujourdhui" className="sc-aujourdhui__titre">
            {ts('coquille.jour.titre')}
          </span>
          <span className="sc-aujourdhui__detail">{detail}</span>
        </span>
      </Link>
      <div aria-hidden className="sc-aujourdhui__filet" />
      <div className="sc-aujourdhui__rdv">
        {carte.rendezVous ? (
          <>
            <LiveDot ton="info" halo={false} libelle={ts('coquille.jour.rdv')} />
            <span className="sc-aujourdhui__rdv-textes">
              <span className="sc-aujourdhui__rdv-titre">{carte.rendezVous.titre}</span>
              <span className="sc-aujourdhui__quand">
                {carte.rendezVous.heure} · {carte.rendezVous.dans}
              </span>
            </span>
          </>
        ) : (
          <span className="sc-aujourdhui__quand">{ts('coquille.jour.rdv.aucun')}</span>
        )}
      </div>
      {!carte.presenceMontree ? (
        <p className="sc-aujourdhui__vide">{ts('coquille.presenceCoupee.court')}</p>
      ) : collegues.length === 0 ? (
        <p className="sc-aujourdhui__vide">{ts('coquille.personne.court')}</p>
      ) : (
        <ul className="sc-aujourdhui__presence" aria-label={ts('coquille.enLigne')}>
          {collegues.map((p) => (
            <li key={p.cle}>
              <Avatar nom={p.nom} taille={20} enLigne />
              <span className="sr-only">{p.lieu ? ts('coquille.enLigne.personne', { nom: p.nom, lieu: p.lieu }) : p.nom}</span>
              {p.lieu && (
                <span aria-hidden className="sc-aujourdhui__lieu">
                  {p.lieu}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

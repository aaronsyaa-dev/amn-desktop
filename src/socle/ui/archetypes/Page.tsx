import React from 'react';
import { Bouton } from '../Bouton';
import { useSocleLangue } from '../../i18n';

/**
 * LE GABARIT DE PAGE (01-SOCLE-DESIGN §3) — l'ossature de chaque module.
 *
 * Mode d'emploi, dans la coquille (`src/socle/coquille`, réglée sur `largeur="pleine"` : elle pose déjà le rembourrage et la barre Ajmani) :
 *
 *   <Page>
 *     <PageHead titre="…" sousTitre="…" secondaires={[{ libelle: '…', onClick }]} primaire={{ libelle: '…', onClick }} />   // ou EnTeteDePage
 *     <RangeeKpi><TuileKpi … /><TuileKpi … /></RangeeKpi>            // 1 à 4 tuiles, sans trou
 *     <DispositionPage droite={<><CarteCases … /><Carte … /><SuggestionAjmani … /></>}>
 *       <Tableau libelle="…" colonnes={…} lignes={…} cleLigne={…} />   // ou GrilleCartes, Kanban, Scinde, Semaine
 *     </DispositionPage>
 *   </Page>
 *
 * Hors coquille (bac à sable, page seule), `<Page autonome>` pose le rembourrage `24px 40px 0` lui-même : le
 * parent doit alors avoir une hauteur (par exemple `100dvh`). La page ne défile jamais en entier au bureau ;
 * ce qui est long défile dans sa carte. Sous 1280 px de fenêtre, la colonne droite passe sous le contenu.
 * Un seul bouton primaire par page : `PageHead` n'en accepte qu'un, par construction.
 */

export interface PageProps {
  children: React.ReactNode;
  /** Sans coquille : la page pose elle-même son rembourrage et devient le `<main>`. */
  autonome?: boolean;
  className?: string;
}

export function Page({ children, autonome = false, className = '' }: PageProps) {
  const Balise = autonome ? 'main' : 'div';
  return (
    <Balise data-socle-page="" data-autonome={autonome || undefined} className={`sc-page ${className}`.trim()}>
      {children}
    </Balise>
  );
}

export interface ActionPage {
  libelle: string;
  onClick?: () => void;
  /** Une icône de 14 px (lucide-react). */
  icone?: React.ReactNode;
  raccourci?: string;
  disabled?: boolean;
  chargement?: boolean;
  /** Une info-bulle sur le bouton (dite aussi quand il est inactif : « choisissez un métier d'abord »). */
  infobulle?: string;
}

export interface PageHeadProps {
  /** Le titre de la page : le seul `h1` de l'écran. */
  titre: string;
  sousTitre?: React.ReactNode;
  /** Le bouton blanc plein de la page. Un seul, par construction. */
  primaire?: ActionPage;
  /** Les autres boutons (bordure grise, 31 px de haut comme H40), de gauche à droite, avant le primaire. */
  secondaires?: ActionPage[];
  /** Un contrôle posé avant les boutons (un segmenté, un sélecteur). Jamais un second bouton primaire. */
  extra?: React.ReactNode;
  /**
   * « Des contrôles à la place des boutons » (D02 : un segmenté et un champ de recherche) : rendus seuls, dans
   * `.sc-page__controles`, sans groupe d'actions. Exclusif de `primaire` et `secondaires`.
   */
  controles?: React.ReactNode;
  /** Une classe de l'écran sur le `<header>` : ses cotes propres (hauteur, alignement) vivent dans sa feuille. */
  className?: string;
  /** Des attributs de données posés sur le `h1` (`data-guide` d'une visite guidée). */
  attributsTitre?: Record<`data-${string}`, string>;
}

/** Nom de fiche de l'en-tête de page (le §3 du socle). */
export type EnTeteDePageProps = PageHeadProps;

function BoutonAction({ action, variante }: { action: ActionPage; variante: 'primaire' | 'secondaire' }) {
  const bouton = (
    <Bouton variante={variante} icone={action.icone} raccourci={action.raccourci} disabled={action.disabled} chargement={action.chargement} onClick={action.onClick}>
      {action.libelle}
    </Bouton>
  );
  return action.infobulle ? <span title={action.infobulle}>{bouton}</span> : bouton;
}

/**
 * L'EN-TÊTE DE PAGE (`PageHead`, 01-SOCLE-DESIGN §3) : titre de 28 px / 600 (`letter-spacing` −.02 em, interligne
 * 1,1), sous-titre de 13,5 px T4 à 7 px, et à droite les actions de la page (au plus un primaire, des secondaires
 * de 31 px, écart de 9) ou, à leur place, des contrôles (`controles`). `EnTeteDePage` est son nom français.
 */
export function PageHead({ titre, sousTitre, primaire, secondaires = [], extra, controles, className, attributsTitre }: PageHeadProps) {
  const { ts } = useSocleLangue();
  const aDesActions = Boolean(primaire) || secondaires.length > 0 || Boolean(extra);
  return (
    <header className={['sc-page__entete', className].filter(Boolean).join(' ')}>
      <div className="sc-page__titres">
        <h1 className="sc-page__titre" {...attributsTitre}>
          {titre}
        </h1>
        {sousTitre && <p className="sc-page__sous-titre">{sousTitre}</p>}
      </div>
      {controles && <div className="sc-page__controles">{controles}</div>}
      {!controles && aDesActions && (
        <div role="group" aria-label={ts('page.actions')} className="sc-page__actions">
          {extra}
          {secondaires.map((a, i) => (
            <BoutonAction key={`${a.libelle}-${i}`} action={a} variante="secondaire" />
          ))}
          {primaire && <BoutonAction action={primaire} variante="primaire" />}
        </div>
      )}
    </header>
  );
}

/** L'alias français de `PageHead`. */
export const EnTeteDePage = PageHead;

/**
 * La rangée de tuiles KPI : quatre colonnes égales, écart de 14. Avec une, deux ou trois tuiles, la rangée se
 * partage quand même toute la largeur (jamais de trou à droite). Passez les tuiles en enfants directs.
 */
export function RangeeKpi({ children, libelle }: { children: React.ReactNode; libelle?: string }) {
  const colonnes = Math.min(4, Math.max(1, React.Children.toArray(children).length));
  return (
    <div role={libelle ? 'group' : undefined} aria-label={libelle} className="sc-rangee-kpi" style={{ '--sc-kpi-colonnes': colonnes } as React.CSSProperties}>
      {children}
    </div>
  );
}

export interface ColonneDroiteProps {
  children: React.ReactNode;
  /** 340 px par défaut ; 360 ou 400 pour les fiches qui le demandent. */
  largeur?: number;
  /** Le nom de la région pour les lecteurs d'écran. */
  libelle?: string;
}

/**
 * La colonne droite : jusqu'à trois cartes empilées (ludique, information, suggestion d'Ajmani), écart de 14.
 * La dernière carte s'étire pour que le bas de la colonne rejoigne celui de la zone principale.
 */
export function ColonneDroite({ children, largeur = 340, libelle }: ColonneDroiteProps) {
  const { ts } = useSocleLangue();
  return (
    <aside aria-label={libelle ?? ts('page.droite')} className="sc-colonne-droite" style={{ '--sc-colonne-droite': `${largeur}px` } as React.CSSProperties}>
      {children}
    </aside>
  );
}

export interface DispositionPageProps {
  /** La zone principale : un tableau, une grille de cartes, un tableau de bord, une semaine… */
  children: React.ReactNode;
  /** Les cartes de la colonne droite (elle est posée pour vous). Absent : la zone principale prend toute la largeur. */
  droite?: React.ReactNode;
  largeurDroite?: number;
  libelleDroite?: string;
}

/** Zone principale + colonne droite. Sous 1280 px de fenêtre, la colonne droite passe sous le contenu, cartes côte à côte. */
export function DispositionPage({ children, droite, largeurDroite, libelleDroite }: DispositionPageProps) {
  return (
    <div className="sc-disposition" data-avec-droite={droite ? 'true' : undefined}>
      <div className="sc-disposition__contenu">{children}</div>
      {droite && (
        <ColonneDroite largeur={largeurDroite} libelle={libelleDroite}>
          {droite}
        </ColonneDroite>
      )}
    </div>
  );
}

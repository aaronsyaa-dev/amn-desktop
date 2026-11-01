import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ListFilter } from 'lucide-react';
import { useSocleLangue } from '../../i18n';
import { Bouton } from '../Bouton';
import { Chargement, EtatVide, Squelette } from '../Etats';
import { BarreProgression, type TonBarre } from '../Indicateurs';
import { Avatar, PastilleEtat, PileAvatars, type EtatPastille } from '../Pastilles';
import { CaseACocher } from '../Taches';
import { BoiteRecherche, Interrupteur, Onglets, Tag, type OngletDef } from '../controles';
import type { Famille } from '../../familles';
import { TexteTronque } from './TexteTronque';
import { dateIso, formaterDate, formaterMontant, formaterPourcent } from './logique/formats';
import { deplacerLineaire } from './logique/navigation';
import { ariaSort, filtrerLignes, prochainTri, regrouperLignes, trierLignes, type TriTableau, type ValeurTri } from './logique/tableau';

/**
 * LE TABLEAU (archétype « table », 01-SOCLE-DESIGN §4 et §5) — une carte, des onglets, une barre d'outils, une
 * tête de 36 px, des lignes de 54 px qui se partagent la hauteur restante.
 *
 * Mode d'emploi : `<Tableau libelle="…" cleLigne={(l) => l.id} lignes={lignes} colonnes={colonnes} vide={{ texte, action }} />`.
 * Chaque colonne dit sa piste de grille (`largeur: '2fr'`, `'120px'`), sa `valeur` (ce qui sert au tri et à la
 * recherche) et sa `cellule` : `(l) => <CelluleEtat etat="succes">…</CelluleEtat>`. La première colonne est
 * l'en-tête de ligne (nom + sous-titre, `CelluleNom`). La carte défile en interne, la tête reste en haut. Au
 * clavier : une seule tabulation entre dans le tableau, ↑ ↓ passent d'une ligne à l'autre, Entrée l'ouvre.
 * L'état vide demande son action ; le chargement garde la forme des lignes (squelettes).
 */

export type Alignement = 'debut' | 'fin' | 'centre';

export interface ColonneTableau<L> {
  cle: string;
  titre: string;
  /** La piste de la grille : `2fr`, `120px`, `minmax(0, 1.4fr)`. Défaut : `minmax(0, 1fr)`. */
  largeur?: string;
  /** `fin` pour les montants. */
  alignement?: Alignement;
  /** Le titre se lit mais ne s'affiche pas (colonne de cases ou de boutons). */
  titreCache?: boolean;
  /** Ce qui sert au tri et à la recherche. Sans `valeur`, la colonne ne se trie pas. */
  valeur?: (ligne: L) => ValeurTri;
  /** `false` pour retirer le tri d'une colonne qui a une `valeur`. */
  triable?: boolean;
  cellule: (ligne: L) => React.ReactNode;
}

export interface EtatVideTableau {
  titre?: string;
  texte: string;
  /** Obligatoire : un tableau vide offre toujours une suite (règle §7.3). */
  action: React.ReactNode;
}

export interface TableauProps<L> {
  /** Le nom du tableau pour les lecteurs d'écran. */
  libelle: string;
  colonnes: ColonneTableau<L>[];
  lignes: readonly L[];
  cleLigne: (ligne: L) => string;
  /** La clé de la ligne ouverte ou sélectionnée : dégradé blanc à 4 %. */
  ligneActive?: string | null;
  /** Entrée, ou un clic sur la ligne (hors contrôles). */
  onOuvrir?: (ligne: L) => void;
  onglets?: { libelle: string; onglets: OngletDef[]; actif: string; onChange: (cle: string) => void };
  recherche?: { valeur: string; onChange: (valeur: string) => void; libelle?: string; placeholder?: string; /** Le filtrage est fait en amont : le tableau n'y touche pas. */ externe?: boolean };
  filtrer?: { onClick: () => void; libelle?: string };
  /** À droite de la barre d'outils : « 7 sur 24 · 3 840 € ». */
  resume?: React.ReactNode;
  /** Tri piloté de l'extérieur ; sans lui, le tableau garde son tri. */
  tri?: TriTableau | null;
  onTri?: (tri: TriTableau | null) => void;
  triInitial?: TriTableau | null;
  groupe?: { cle: (ligne: L) => string; libelle: (cle: string, n: number) => React.ReactNode; ordre?: string[] };
  chargement?: boolean;
  /** Le nombre de lignes de squelette (6 par défaut). */
  lignesSquelette?: number;
  vide: EtatVideTableau;
  /** Quand la recherche ne trouve rien alors qu'il y a des lignes. Par défaut, `vide`. */
  aucunResultat?: EtatVideTableau;
  /** Le texte cherché dans une ligne ; par défaut, les `valeur` de ses colonnes. */
  texteLigne?: (ligne: L) => string;
  locale?: string;
  className?: string;
}

const TRACE_DEFAUT = 'minmax(0, 1fr)';

function valeurEnTexte(v: ValeurTri): string {
  if (v === null || v === undefined) return '';
  return v instanceof Date ? v.toISOString() : String(v);
}

function IconeTri({ sens }: { sens: 'ascending' | 'descending' | 'none' }) {
  if (sens === 'ascending') return <ChevronUp aria-hidden size={13} />;
  if (sens === 'descending') return <ChevronDown aria-hidden size={13} />;
  return <ChevronsUpDown aria-hidden size={13} className="sc-tableau__tri-neutre" />;
}

/** Des lignes de squelette de la même forme que celles du tableau : un carré et deux traits, puis un trait par colonne. */
function SqueletteLignesTableau<L>({ colonnes, nombre }: { colonnes: ColonneTableau<L>[]; nombre: number }) {
  const largeurs = ['62%', '44%', '78%'];
  return (
    <>
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="sc-tableau__rangee" data-squelette="">
          {colonnes.map((c, j) => (
            <div key={c.cle} className="sc-tableau__cellule" data-alignement={c.alignement}>
              {j === 0 ? (
                <span className="sc-tableau__nom">
                  <Squelette largeur={32} hauteur={32} rayon={9} />
                  <span className="sc-tableau__nom-texte">
                    <Squelette largeur="68%" hauteur={11} />
                    <Squelette largeur="42%" hauteur={9} />
                  </span>
                </span>
              ) : (
                !c.titreCache && <Squelette largeur={largeurs[(i + j) % 3]} hauteur={11} />
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function Tableau<L>({
  libelle,
  colonnes,
  lignes,
  cleLigne,
  ligneActive,
  onOuvrir,
  onglets,
  recherche,
  filtrer,
  resume,
  tri: triControle,
  onTri,
  triInitial = null,
  groupe,
  chargement = false,
  lignesSquelette = 6,
  vide,
  aucunResultat,
  texteLigne,
  locale = 'fr-FR',
  className = '',
}: TableauProps<L>) {
  const { ts } = useSocleLangue();
  const idBase = useId();
  const [triInterne, setTriInterne] = useState<TriTableau | null>(triInitial);
  const tri = triControle !== undefined ? triControle : triInterne;
  const [rang, setRang] = useState(0);
  const corpsRef = useRef<HTMLDivElement | null>(null);

  const changerTri = (cle: string) => {
    const suivant = prochainTri(tri, cle);
    if (triControle === undefined) setTriInterne(suivant);
    onTri?.(suivant);
  };

  const valeurDe = useCallback((l: L, cle: string) => colonnes.find((c) => c.cle === cle)?.valeur?.(l), [colonnes]);
  const textePar = useCallback(
    (l: L) => texteLigne?.(l) ?? colonnes.map((c) => valeurEnTexte(c.valeur?.(l))).join(' '),
    [colonnes, texteLigne],
  );

  const affichees = useMemo(() => {
    const filtrees = recherche && !recherche.externe ? filtrerLignes(lignes, recherche.valeur, textePar) : [...lignes];
    return trierLignes(filtrees, tri, valeurDe, locale);
  }, [lignes, recherche, tri, textePar, valeurDe, locale]);
  const groupes = useMemo(() => (groupe ? regrouperLignes(affichees, groupe.cle, groupe.ordre) : null), [affichees, groupe]);
  const plat = useMemo(() => (groupes ? groupes.flatMap((g) => g.lignes) : affichees), [groupes, affichees]);

  const rangTabulation = Math.min(rang, Math.max(0, plat.length - 1));
  const gabarit = colonnes.map((c) => c.largeur ?? TRACE_DEFAUT).join(' ');
  const idOnglet = onglets ? `${idBase}-tableau` : undefined;

  const surTouche = (e: React.KeyboardEvent<HTMLDivElement>, i: number, ligne: L) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter') {
      if (onOuvrir) {
        e.preventDefault();
        onOuvrir(ligne);
      }
      return;
    }
    const vers = deplacerLineaire(i, plat.length, e.key);
    if (vers === null) return;
    e.preventDefault();
    setRang(vers);
    corpsRef.current?.querySelector<HTMLElement>(`[data-rang="${vers}"]`)?.focus();
  };

  const surClic = (e: React.MouseEvent<HTMLDivElement>, i: number, ligne: L) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    setRang(i);
    onOuvrir?.(ligne);
  };

  let compteur = -1;
  const rendreLigne = (ligne: L) => {
    compteur += 1;
    const i = compteur;
    const cle = cleLigne(ligne);
    const active = ligneActive != null && ligneActive === cle;
    return (
      <div
        key={cle}
        role="row"
        aria-rowindex={i + 2}
        aria-selected={ligneActive !== undefined ? active : undefined}
        data-rang={i}
        data-active={active || undefined}
        data-ouvrable={onOuvrir ? 'true' : undefined}
        tabIndex={i === rangTabulation ? 0 : -1}
        onFocus={(e) => e.target === e.currentTarget && setRang(i)}
        onKeyDown={(e) => surTouche(e, i, ligne)}
        onClick={onOuvrir ? (e) => surClic(e, i, ligne) : undefined}
        className="sc-tableau__rangee sc-focus"
      >
        {colonnes.map((c, j) => (
          <div key={c.cle} role={j === 0 ? 'rowheader' : 'gridcell'} data-alignement={c.alignement} className="sc-tableau__cellule">
            {c.cellule(ligne)}
          </div>
        ))}
      </div>
    );
  };

  const filtreActif = Boolean(recherche?.valeur.trim()) && lignes.length > 0;
  const modeleVide = filtreActif ? (aucunResultat ?? vide) : vide;
  const etat = chargement ? 'chargement' : plat.length === 0 ? 'vide' : 'lignes';
  const aUneBarre = Boolean(recherche || filtrer || resume);

  const corps = (
    <>
      {aUneBarre && (
        <div className="sc-tableau__barre">
          {recherche && (
            <div className="sc-tableau__recherche">
              <BoiteRecherche valeur={recherche.valeur} onChange={recherche.onChange} libelle={recherche.libelle ?? ts('tableau.recherche')} placeholder={recherche.placeholder} />
            </div>
          )}
          {filtrer && (
            <Bouton variante="secondaire" icone={<ListFilter />} onClick={filtrer.onClick}>
              {filtrer.libelle ?? ts('tableau.filtrer')}
            </Bouton>
          )}
          {resume && (
            <span role="status" className="sc-tableau__resume">
              {resume}
            </span>
          )}
        </div>
      )}
      <div className="sc-tableau__defile" data-etat={etat}>
        <div role="grid" aria-label={libelle} aria-rowcount={plat.length + 1} aria-colcount={colonnes.length} aria-busy={chargement || undefined} className="sc-tableau__grille">
          <div role="rowgroup" className="sc-tableau__tete">
            <div role="row" aria-rowindex={1} className="sc-tableau__rangee sc-tableau__rangee--tete">
              {colonnes.map((c) => {
                const triable = c.valeur !== undefined && c.triable !== false;
                const sens = ariaSort(c.cle, tri);
                return (
                  <div key={c.cle} role="columnheader" aria-sort={triable ? sens : undefined} data-alignement={c.alignement} className="sc-tableau__titre">
                    {triable ? (
                      <button type="button" onClick={() => changerTri(c.cle)} title={ts('tableau.trier', { colonne: c.titre })} className="sc-tableau__tri sc-focus">
                        <span className={c.titreCache ? 'sr-only' : undefined}>{c.titre}</span>
                        <IconeTri sens={sens} />
                      </button>
                    ) : c.titreCache ? (
                      <span className="sr-only">{c.titre}</span>
                    ) : (
                      c.titre
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {etat === 'lignes' && (
            <div role="rowgroup" ref={corpsRef} className="sc-tableau__corps">
              {groupes
                ? groupes.map((g) => (
                    <React.Fragment key={g.cle}>
                      <div role="row" className="sc-tableau__groupe">
                        <div role="gridcell" aria-colspan={colonnes.length}>
                          {groupe?.libelle(g.cle, g.lignes.length)}
                        </div>
                      </div>
                      {g.lignes.map(rendreLigne)}
                    </React.Fragment>
                  ))
                : plat.map(rendreLigne)}
            </div>
          )}
        </div>
        {etat === 'chargement' && (
          <Chargement libelle={ts('tableau.chargement')}>
            <div className="sc-tableau__corps">
              <SqueletteLignesTableau colonnes={colonnes} nombre={lignesSquelette} />
            </div>
          </Chargement>
        )}
        {etat === 'vide' && (
          <div className="sc-tableau__vide">
            <EtatVide titre={modeleVide.titre} texte={modeleVide.texte} action={modeleVide.action} />
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`sc-tableau sc-zone ${className}`.trim()} style={{ '--sc-colonnes': gabarit } as React.CSSProperties}>
      {onglets && (
        <div className="sc-tableau__onglets">
          <Onglets libelle={onglets.libelle} onglets={onglets.onglets} actif={onglets.actif} onChange={onglets.onChange} idBase={idOnglet} />
        </div>
      )}
      {onglets ? (
        <div role="tabpanel" id={`${idOnglet}-panneau-${onglets.actif}`} aria-labelledby={`${idOnglet}-onglet-${onglets.actif}`} className="sc-tableau__panneau">
          {corps}
        </div>
      ) : (
        <div className="sc-tableau__panneau">{corps}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────  Les cellules typées  ───────────────────────────── */

/** Nom + sous-titre, avec un rond (personne) ou un carré arrondi (organisation, client) à gauche. `visuel` remplace l'avatar. */
export function CelluleNom({ nom, sousTitre, avatar = 'carre', visuel, taille = 32 }: { nom: string; sousTitre?: string; avatar?: 'rond' | 'carre' | false; visuel?: React.ReactNode; taille?: number }) {
  return (
    <span className="sc-tableau__nom">
      {visuel ?? (avatar && <Avatar nom={nom} forme={avatar} taille={taille} />)}
      <span className="sc-tableau__nom-texte">
        <TexteTronque className="sc-tableau__nom-principal">{nom}</TexteTronque>
        {sousTitre && <TexteTronque className="sc-tableau__nom-sous">{sousTitre}</TexteTronque>}
      </span>
    </span>
  );
}

/** Un texte courant (T2, 13 px) sur une ligne ; `attenue` pour T4. */
export function CelluleTexte({ children, attenue = false }: { children: string; attenue?: boolean }) {
  return <TexteTronque className={attenue ? 'sc-tableau__texte sc-tableau__texte--attenue' : 'sc-tableau__texte'}>{children}</TexteTronque>;
}

/** La pastille d'état : un point, un mot. */
export function CelluleEtat({ etat, children, allegee = false }: { etat: EtatPastille; children: React.ReactNode; allegee?: boolean }) {
  return (
    <PastilleEtat etat={etat} allegee={allegee}>
      {children}
    </PastilleEtat>
  );
}

/** Une barre de progression et sa valeur (« 72 % » par défaut, à la française). `valeur` va de 0 à 1. */
export function CelluleProgression({ valeur, libelle, texte, ton, locale }: { valeur: number; libelle: string; texte?: string; ton?: TonBarre; locale?: string }) {
  const affiche = texte ?? formaterPourcent(valeur, locale);
  return (
    <span className="sc-tableau__progression">
      <BarreProgression valeur={valeur} libelle={libelle} texte={affiche} ton={ton} />
      <span aria-hidden className="sc-tableau__progression-valeur">
        {affiche}
      </span>
    </span>
  );
}

/** Une ou plusieurs personnes : un avatar, ou une pile. `libelle` dit leurs noms aux lecteurs d'écran. */
export function CelluleAvatar({ noms, libelle, max = 3, taille = 24 }: { noms: string[]; libelle: string; max?: number; taille?: number }) {
  return <PileAvatars noms={noms} max={max} taille={taille} libelle={libelle} />;
}

/** Un montant aligné à droite (réglez la colonne sur `alignement: 'fin'`). `etat` le colore ; `libelleEtat` le dit sans couleur. */
export function CelluleMontant({ valeur, devise = 'EUR', etat, libelleEtat, texte, locale }: { valeur: number; devise?: string; etat?: EtatPastille; libelleEtat?: string; texte?: string; locale?: string }) {
  return (
    <span data-etat={etat} className="sc-tableau__montant" title={libelleEtat}>
      {texte ?? formaterMontant(valeur, devise, locale)}
      {libelleEtat && <span className="sr-only"> — {libelleEtat}</span>}
    </span>
  );
}

export function CelluleTag({ children, famille, etat }: { children: React.ReactNode; famille?: Famille; etat?: EtatPastille }) {
  return (
    <Tag famille={famille} etat={etat}>
      {children}
    </Tag>
  );
}

/** Une date en T4. `texte` remplace le format par défaut (« 31 oct. »). */
export function CelluleDate({ date, texte, options, locale }: { date: Date | number | string; texte?: string; options?: Intl.DateTimeFormatOptions; locale?: string }) {
  return (
    <time dateTime={dateIso(date)} className="sc-tableau__date">
      {texte ?? formaterDate(date, options, locale)}
    </time>
  );
}

export function CelluleCase({ coche, onChange, libelle, lecture }: { coche: boolean; onChange?: (coche: boolean) => void; libelle: string; lecture?: boolean }) {
  return <CaseACocher coche={coche} onChange={onChange} libelle={libelle} lecture={lecture} />;
}

export function CelluleInterrupteur({ actif, onChange, libelle, disabled }: { actif: boolean; onChange?: (actif: boolean) => void; libelle: string; disabled?: boolean }) {
  return <Interrupteur actif={actif} onChange={onChange} libelle={libelle} disabled={disabled} />;
}

/** Un élément avec une icône (lucide-react) devant : un type de fichier, un canal. */
export function CelluleIcone({ icone, children }: { icone: React.ReactNode; children: string }) {
  return (
    <span className="sc-tableau__icone">
      <span aria-hidden className="sc-tableau__icone-puce">
        {icone}
      </span>
      <TexteTronque className="sc-tableau__texte">{children}</TexteTronque>
    </span>
  );
}

/** Un bouton de ligne (secondaire, jamais le blanc plein de la page). */
export function CelluleBouton({ libelle, onClick, icone, disabled }: { libelle: string; onClick: () => void; icone?: React.ReactNode; disabled?: boolean }) {
  return (
    <Bouton variante="secondaire" icone={icone} onClick={onClick} disabled={disabled}>
      {libelle}
    </Bouton>
  );
}

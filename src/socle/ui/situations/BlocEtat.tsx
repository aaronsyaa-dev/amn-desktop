import React from 'react';
import { CircleAlert, Download, Lock, RotateCcw, Search, Send, Undo2, Users, Wifi, Plus } from 'lucide-react';
import { useSocleLangue } from '../../i18n';
import type { Famille } from '../../familles';
import { Bouton } from '../Bouton';
import { propsBouton } from './statique';

/**
 * LE BLOC D'ÉTAT — la colonne centrée de « quand il n'y a rien » (H43, modèles 1, 3, 4, 5, et l'erreur de chargement).
 *
 * Une tuile d'icône de 48 px, un titre, un texte de 240 px au plus, et des boutons à 8 px l'un de l'autre.
 * LA RÈGLE : jamais de zone morte. `actions` est donc OBLIGATOIRE — un état sans bouton ne compile pas.
 *
 * `taille="compact"` : le `StateBlock` de la v3 (H43 en situation, au centre d'une carte de contenu) — tuile de 36 px
 * (rayon 10, glyphe de 16), titre 13,5 px / 600, texte 12 px T4 (300 px au plus), boutons compacts de 25 px. La taille
 * standard reste celle des écrans qui l'emploient déjà.
 *
 * Le ton colore l'icône ET sa tuile (la couleur de l'icône à 13 %) ; il ne porte jamais le sens à lui seul,
 * l'icône et le titre le disent aussi.
 *
 *   famille   — la couleur de la famille du module (`famille="contacts"`, ou `data-famille` d'un parent) ;
 *   attention — ambre : quelque chose d'anormal mais sans gravité (hors connexion) ;
 *   neutre    — gris : ni bon ni mauvais (accès réservé, aucun résultat) ;
 *   critique  — rouge : ça a cassé (erreur de chargement).
 *
 * Les dérivés (`EtatVideInvitation`, `EtatHorsConnexion`, `EtatAccesRefuse`, `EtatAucunResultat`,
 * `EtatErreurChargement`) portent les textes de la fiche ; leurs noms d'objets, de personnes et de recherches
 * sont des variables — rien n'est écrit en dur. `statique` en fait un aperçu : boutons `aria-disabled`, sans action.
 */
export type TonEtat = 'famille' | 'attention' | 'neutre' | 'critique';

export interface BlocEtatProps {
  /** Le glyphe (lucide, 20 px, trait 1,7). Décoratif : le titre dit déjà la situation. `null` : pas de tuile (v3, facultative). */
  icone: React.ReactNode | null;
  ton?: TonEtat;
  /** La famille dont on prend la couleur quand `ton="famille"`. À défaut, celle du `data-famille` d'un parent. */
  famille?: Famille;
  titre: string;
  texte?: string;
  /** Au moins un bouton : c'est la règle « jamais de zone morte ». */
  actions: React.ReactNode;
  /** Le niveau du titre dans la page (3 par défaut : le bloc vit sous un titre de section). */
  niveauTitre?: 2 | 3 | 4 | 5 | 6;
  /** `status` ou `alert` quand le bloc apparaît après coup (hors connexion, erreur) : il est alors annoncé. */
  annonce?: 'status' | 'alert';
  /** `compact` : les cotes v3 (tuile 36, titre 13,5, texte 12, boutons de 25 px). */
  taille?: TailleEtat;
  className?: string;
}

export type TailleEtat = 'standard' | 'compact';

export function BlocEtat({ icone, ton = 'neutre', famille, titre, texte, actions, niveauTitre = 3, annonce, taille = 'standard', className }: BlocEtatProps) {
  const Titre = `h${niveauTitre}` as 'h3';
  return (
    <div role={annonce} data-ton={ton} data-famille={famille} data-taille={taille === 'compact' ? 'compact' : undefined} className={['sc-bloc-etat', className].filter(Boolean).join(' ')}>
      {icone !== null && (
        <span aria-hidden className="sc-bloc-etat__icone">
          {icone}
        </span>
      )}
      <Titre className="sc-bloc-etat__titre">{titre}</Titre>
      {texte && <p className="sc-bloc-etat__texte">{texte}</p>}
      <div className="sc-bloc-etat__actions">{actions}</div>
    </div>
  );
}

const ICONE = { size: 20, strokeWidth: 1.7 } as const;

/** Les props communes aux dérivés. */
interface Commun {
  /** Aperçu : les boutons restent atteignables au clavier mais ne font rien (`aria-disabled`). */
  statique?: boolean;
  niveauTitre?: BlocEtatProps['niveauTitre'];
  taille?: TailleEtat;
  className?: string;
}

/* ── Modèle 1 — vide, avec une invitation ─────────────────────────────────── */

export type EtatVideInvitationProps = Commun & {
  /** L'objet au singulier et en minuscules : « client », « projet », « dossier ». */
  objet: string;
  /** L'icône du module (son glyphe), à défaut des utilisateurs. */
  icone?: React.ReactNode;
  /** La famille du module : elle donne sa couleur à l'icône. */
  famille?: Famille;
} & (
    | { lectureSeule?: false; onAjouter: () => void; onImporter?: () => void }
    // Un module en lecture seule ne propose pas d'ajouter : il garde pourtant une action.
    | { lectureSeule: true; onAide: () => void }
  );

export function EtatVideInvitation(props: EtatVideInvitationProps) {
  const { ts } = useSocleLangue();
  const { objet, icone, famille, statique, niveauTitre, taille, className } = props;
  const params = { objet };
  let texte: string;
  let actions: React.ReactNode;
  if (props.lectureSeule) {
    texte = ts('etat.vide.texteLecture');
    actions = (
      <Bouton variante="primaire" taille="petit" {...propsBouton(statique, props.onAide)}>
        {ts('etat.vide.aide')}
      </Bouton>
    );
  } else {
    texte = ts(props.onImporter ? 'etat.vide.texte' : 'etat.vide.texteSeul', params);
    actions = (
      <>
        <Bouton variante="primaire" taille="petit" icone={<Plus size={14} strokeWidth={2} />} {...propsBouton(statique, props.onAjouter)}>
          {ts('etat.vide.ajouter')}
        </Bouton>
        {props.onImporter && (
          <Bouton variante="secondaire" taille="petit" icone={taille === 'compact' ? <Download size={13} strokeWidth={1.9} /> : undefined} {...propsBouton(statique, props.onImporter)}>
            {ts('etat.vide.importer')}
          </Bouton>
        )}
      </>
    );
  }
  return (
    <BlocEtat
      ton="famille"
      famille={famille}
      icone={icone ?? <Users aria-hidden {...ICONE} />}
      titre={ts('etat.vide.titre', params)}
      texte={texte}
      actions={actions}
      niveauTitre={niveauTitre}
      taille={taille}
      className={className}
    />
  );
}

/* ── Modèle 3 — connexion perdue ──────────────────────────────────────────── */

export type EtatHorsConnexionProps = Commun & {
  /** « Réessayer » teste la connexion tout de suite. */
  onReessayer: () => void;
};

export function EtatHorsConnexion({ onReessayer, statique, niveauTitre, taille, className }: EtatHorsConnexionProps) {
  const { ts } = useSocleLangue();
  return (
    <BlocEtat
      ton="attention"
      icone={<Wifi aria-hidden {...ICONE} />}
      titre={ts('etat.hors.titre')}
      texte={ts('etat.hors.texte')}
      annonce={statique ? undefined : 'status'}
      niveauTitre={niveauTitre}
      taille={taille}
      className={className}
      actions={
        <Bouton variante="secondaire" taille="petit" icone={<RotateCcw size={14} strokeWidth={1.9} />} {...propsBouton(statique, onReessayer)}>
          {ts('etat.hors.reessayer')}
        </Bouton>
      }
    />
  );
}

/* ── Modèle 4 — accès non autorisé ────────────────────────────────────────── */

export type EtatAccesRefuseProps = Commun & {
  /** Le prénom du propriétaire ou de l'administrateur qui peut accorder l'accès (« l'administrateur » s'il y en a plusieurs). */
  prenom: string;
  onDemander: () => void;
  /** La demande est partie : le bouton devient « Demande envoyée » (inactif) et le texte dit que la personne est prévenue. */
  demandeEnvoyee?: boolean;
};

/** « l'administrateur » devient « L'administrateur » en début de phrase. */
function capitaliser(texte: string): string {
  return texte ? texte.charAt(0).toLocaleUpperCase() + texte.slice(1) : texte;
}

export function EtatAccesRefuse({ prenom, onDemander, demandeEnvoyee = false, statique, niveauTitre, taille, className }: EtatAccesRefuseProps) {
  const { ts } = useSocleLangue();
  return (
    <BlocEtat
      ton="neutre"
      icone={<Lock aria-hidden {...ICONE} />}
      titre={ts('etat.acces.titre')}
      // L'écran ne révèle RIEN du contenu de la page : ni son nom, ni ce qu'elle contient.
      texte={demandeEnvoyee ? ts('etat.acces.prevenu', { prenom: capitaliser(prenom) }) : ts('etat.acces.texte', { prenom })}
      annonce={statique ? undefined : 'status'}
      niveauTitre={niveauTitre}
      taille={taille}
      className={className}
      actions={
        demandeEnvoyee ? (
          <Bouton variante="primaire" taille="petit" disabled icone={<Send size={14} strokeWidth={1.9} />}>
            {ts('etat.acces.envoye')}
          </Bouton>
        ) : (
          <Bouton variante="primaire" taille="petit" icone={<Send size={14} strokeWidth={1.9} />} {...propsBouton(statique, onDemander)}>
            {ts('etat.acces.demander')}
          </Bouton>
        )
      }
    />
  );
}

/* ── Modèle 5 — aucun résultat ────────────────────────────────────────────── */

export type EtatAucunResultatProps = Commun & {
  /** Ce que la personne a cherché, tel quel. */
  terme: string;
  /** `null` : pas de tuile (v3 : le champ de recherche juste au-dessus dit déjà qu'on cherche). */
  icone?: React.ReactNode | null;
  /** Une icône de 13 px devant « Voir {X} » (v3 : le document). */
  iconeAction?: React.ReactNode;
} & (
    // Un élément proche existe (tolérance aux fautes de frappe) : on le propose.
    | { proche: string; onVoirProche: () => void; onEffacer?: never }
    // Sinon : on propose d'effacer la recherche.
    | { proche?: undefined; onEffacer: () => void; onVoirProche?: never }
  );

export function EtatAucunResultat(props: EtatAucunResultatProps) {
  const { ts } = useSocleLangue();
  const { terme, statique, niveauTitre, taille, className } = props;
  return (
    <BlocEtat
      ton="neutre"
      icone={props.icone === undefined ? <Search aria-hidden {...ICONE} /> : props.icone}
      titre={ts('etat.aucun.titre', { terme })}
      texte={props.proche !== undefined ? ts('etat.aucun.proche', { proche: props.proche }) : ts('etat.aucun.sans')}
      niveauTitre={niveauTitre}
      taille={taille}
      className={className}
      actions={
        props.proche !== undefined ? (
          <Bouton variante="primaire" taille="petit" icone={props.iconeAction} {...propsBouton(statique, props.onVoirProche)}>
            {ts('etat.aucun.voir', { proche: props.proche })}
          </Bouton>
        ) : (
          <Bouton variante="primaire" taille="petit" {...propsBouton(statique, props.onEffacer)}>
            {ts('etat.aucun.effacer')}
          </Bouton>
        )
      }
    />
  );
}

/* ── Erreur de chargement (proposition de la rubrique 8) ──────────────────── */

export type EtatErreurChargementProps = Commun & {
  /** Les objets au pluriel, sans déterminant : « clients ». */
  objets: string;
  /** L'accord du participe : « chargés » (masculin, défaut) ou « chargées » (« Les prévisions n'ont pas pu être chargées »). */
  genre?: 'masculin' | 'feminin';
  onReessayer: () => void;
  /** Ce qui suit « Réessayer » sur la même ligne (v3 : « nouvel essai dans 20 s »). */
  apres?: React.ReactNode;
  /** L'icône (v3 : le triangle d'alerte) ; à défaut, le cercle. */
  icone?: React.ReactNode;
};

export function EtatErreurChargement({ objets, genre = 'masculin', onReessayer, apres, icone, statique, niveauTitre, taille, className }: EtatErreurChargementProps) {
  const { ts } = useSocleLangue();
  return (
    <BlocEtat
      ton="critique"
      icone={icone ?? <CircleAlert aria-hidden {...ICONE} />}
      titre={ts(genre === 'feminin' ? 'etat.erreur.titre.f' : 'etat.erreur.titre', { objets })}
      texte={ts('etat.erreur.texte')}
      annonce={statique ? undefined : 'alert'}
      niveauTitre={niveauTitre}
      taille={taille}
      className={className}
      actions={
        <>
          <Bouton variante="secondaire" taille="petit" icone={taille === 'compact' ? <Undo2 size={13} strokeWidth={1.9} /> : <RotateCcw size={14} strokeWidth={1.9} />} {...propsBouton(statique, onReessayer)}>
            {ts('etat.erreur.reessayer')}
          </Bouton>
          {apres}
        </>
      }
    />
  );
}

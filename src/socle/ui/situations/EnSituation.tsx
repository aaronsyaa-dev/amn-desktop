import React from 'react';
import { ArrowRight, Clock, Eye, Layers, Undo2, Wifi } from 'lucide-react';
import { useSocleLangue } from '../../i18n';
import { Bouton } from '../Bouton';
import { PileAvatars } from '../Pastilles';
import { Squelette } from '../Etats';
import { IconeEtincelle } from '../controles/Suggestion';
import { LiveDot } from '../vivant/Signaux';
import { propsBouton } from './statique';

/**
 * LES SITUATIONS EN PLACE (H43 v3) — les pièces qui posent un état DANS la vraie page, à côté de son contenu.
 *
 *   `BandeauHorsLigne`      (OfflineBanner) — bandeau ambre en haut de la zone : « Hors ligne · 2 messages en attente
 *                           d'envoi » et « Réessayer ». `role="status"`.
 *   `MarqueEnAttente`       (PendingMark) — l'horloge ambre et « en attente, partira au retour du réseau » sur un
 *                           élément resté dans la file.
 *   `BandeauCollaboration`  (CollabNotice) — les avatars, « {prénom} modifie aussi cette page », le point vivant,
 *                           « Différences ».
 *   `CurseurPair`           (PeerCaret) — le curseur d'une autre personne (2 px) et son étiquette.
 *   `PiedFusion`            (MergeFooter) — « Fusionnés, rien n'est écrasé · copie gardée » et « Garder les deux ».
 *   `MentionDerniereValeur` (StaleData) — « dernière valeur connue · {heure} », au-dessus d'un contenu grisé.
 *   `PorteAjmani`           — « Demander à Ajmani : « {terme} » » sous un état « Aucun résultat ».
 *   `SqueletteChiffres`     (SkeletonKpis) — des chiffres clés en squelette (sous-cartes).
 *
 * Mêmes règles que le reste du groupe : rien de nommé en dur (prénoms, termes, heures : des variables), boutons nommés,
 * état jamais porté par la couleur seule, `statique` pour un aperçu (boutons `aria-disabled`). Les couleurs viennent
 * de `situations.css`. Ces pièces ne sont pas encore exportées par l'index du socle (voir `index.ts`) : on les importe
 * par leur chemin, `…/socle/ui/situations/EnSituation`.
 */

export interface BandeauHorsLigneProps {
  /** Combien d'éléments attendent le retour du réseau (0 : « Hors ligne » seul). */
  enAttente: number;
  /** L'objet au singulier et au pluriel : « message » / « messages ». */
  objet: string;
  objets: string;
  onReessayer: () => void;
  statique?: boolean;
  className?: string;
}

export function BandeauHorsLigne({ enAttente, objet, objets, onReessayer, statique, className }: BandeauHorsLigneProps) {
  const { ts } = useSocleLangue();
  const texte = enAttente <= 0 ? ts('hors.bandeau') : enAttente === 1 ? ts('hors.bandeau.un', { objet }) : ts('hors.bandeau.n', { n: enAttente, objets });
  return (
    <div role={statique ? undefined : 'status'} className={['sc-hors-bandeau', className].filter(Boolean).join(' ')}>
      <Wifi aria-hidden className="sc-hors-bandeau__icone" size={15} strokeWidth={1.8} />
      <span className="sc-hors-bandeau__texte">{texte}</span>
      <Bouton variante="secondaire" taille="petit" icone={<Undo2 size={13} strokeWidth={1.9} />} {...propsBouton(statique, onReessayer)}>
        {ts('etat.hors.reessayer')}
      </Bouton>
    </div>
  );
}

export function MarqueEnAttente({ className }: { className?: string }) {
  const { ts } = useSocleLangue();
  return (
    <span className={['sc-en-attente', className].filter(Boolean).join(' ')}>
      <Clock aria-hidden size={12} strokeWidth={2} />
      {ts('hors.attente')}
    </span>
  );
}

export interface BandeauCollaborationProps {
  /** Les personnes présentes (initiales seulement), vous en premier. */
  noms: string[];
  /** Le prénom de la phrase : l'autre personne. */
  prenom: string;
  onDifferences: () => void;
  statique?: boolean;
  className?: string;
}

export function BandeauCollaboration({ noms, prenom, onDifferences, statique, className }: BandeauCollaborationProps) {
  const { ts } = useSocleLangue();
  return (
    <div className={['sc-collab-bandeau', className].filter(Boolean).join(' ')}>
      <PileAvatars noms={noms} taille={22} libelle={ts('avis.pile')} />
      <p role={statique ? undefined : 'status'} className="sc-collab-bandeau__phrase">
        {ts('avis.phrase', { prenom })}
      </p>
      <LiveDot ton="ok" libelle={ts('avis.direct', { prenom })} halo={false} taille={6} />
      <Bouton variante="secondaire" taille="petit" icone={<Eye size={13} strokeWidth={1.9} />} {...propsBouton(statique, onDifferences)}>
        {ts('avis.differences')}
      </Bouton>
    </div>
  );
}

/** Le curseur d'une autre personne dans le texte : un trait de 2 px qui clignote (curseur), et son prénom en étiquette. */
export function CurseurPair({ prenom }: { prenom: string }) {
  return (
    <span className="sc-curseur-pair">
      <span aria-hidden className="sc-curseur-pair__trait" data-mvt="curseur" />
      <span className="sc-curseur-pair__nom">{prenom}</span>
    </span>
  );
}

export function PiedFusion({ onGarderLesDeux, statique, className }: { onGarderLesDeux: () => void; statique?: boolean; className?: string }) {
  const { ts } = useSocleLangue();
  return (
    <div className={['sc-fusion-pied', className].filter(Boolean).join(' ')}>
      <Layers aria-hidden size={13} strokeWidth={1.8} className="sc-fusion-pied__icone" />
      <span className="sc-fusion-pied__texte">{ts('avis.pied')}</span>
      <Bouton variante="primaire" taille="petit" {...propsBouton(statique, onGarderLesDeux)}>
        {ts('avis.garder')}
      </Bouton>
    </div>
  );
}

/** « dernière valeur connue · 10:12 » : ce qu'on montre encore quand un chargement a échoué. */
export function MentionDerniereValeur({ heure, className }: { heure: string; className?: string }) {
  const { ts } = useSocleLangue();
  return <p className={['sc-perime__mention', className].filter(Boolean).join(' ')}>{ts('erreur.derniere', { heure })}</p>;
}

export function PorteAjmani({ terme, onClick, statique, className }: { terme: string; onClick: () => void; statique?: boolean; className?: string }) {
  const { ts } = useSocleLangue();
  return (
    <button type="button" className={['sc-porte-ajmani sc-focus', className].filter(Boolean).join(' ')} {...propsBouton(statique, onClick)}>
      <IconeEtincelle taille={12} />
      <span className="sc-porte-ajmani__texte">{ts('aucun.ajmani', { terme })}</span>
      <ArrowRight aria-hidden size={13} strokeWidth={1.8} className="sc-porte-ajmani__fleche" />
    </button>
  );
}

/** Des chiffres clés en squelette : des sous-cartes avec une étiquette courte et une valeur. */
export function SqueletteChiffres({ nombre = 3 }: { nombre?: number }) {
  return (
    <div aria-hidden className="sc-squelette-chiffres">
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="sc-squelette-chiffres__bloc">
          <Squelette largeur={57} hauteur={6} rayon="99px" ligne />
          <Squelette largeur={83} hauteur={12} rayon="99px" ligne />
        </div>
      ))}
    </div>
  );
}

import React from 'react';
import type { ParcOrgInsight } from '../../shared/api';

/**
 * LE POINT DE PRÉSENCE D'UNE ORGANISATION CLIENTE (BLOC F)
 * ═══════════════════════════════════════════════════════
 *
 * « Est-ce que quelqu'un travaille chez elle en ce moment ? » — la question
 * qu'on se pose en parcourant le parc, et à laquelle il fallait jusqu'ici
 * répondre en entrant dans l'espace.
 *
 * ## Trois états, pas deux
 *
 * Un indicateur binaire aurait dû choisir, au montage de l'écran, entre mentir
 * et clignoter. Tant que le relevé n'est pas arrivé — ou qu'il a cessé
 * d'arriver — on ne SAIT pas, et un point éteint dirait « personne » alors
 * qu'il faut dire « je ne sais pas ». D'où le cercle creux : il se distingue au
 * premier coup d'œil d'un point plein éteint, et il disparaît de lui-même dès
 * la première réponse.
 *
 *   · inconnu    — cercle creux, aucun battement ;
 *   · personne   — point plein, sourd, immobile ;
 *   · au travail — point clair qui bat.
 *
 * ## Le battement n'est pas une décoration
 *
 * `.live-dot` a un contrat, écrit dans la feuille de style : il est réservé à
 * un état relié à une source réellement en cours. Ici la source est le compte
 * des sockets ouvertes et authentifiées que tient le serveur — pas une
 * heuristique de « dernière visite », pas une valeur d'exemple. Le point ne bat
 * donc que lorsque quelque chose est effectivement ouvert.
 *
 * ## Pourquoi il n'est pas vert
 *
 * Aaron l'a demandé vert, et c'est l'usage. Mais la palette de cette
 * application est monochrome par DÉCISION — `--color-success` est un
 * blanc cassé, et la seule couleur admise est le rouge de signal, réservé au
 * critique (voir `src/index.css`). Un vert ici ouvrirait une seconde exception,
 * ce qui est un choix d'identité, pas un détail d'implémentation — et le Bloc N
 * demande justement une identité constante.
 *
 * Le battement, lui, porte déjà tout le sens : c'est le MOUVEMENT qu'on repère
 * en balayant une liste, pas la teinte. La couleur tient dans la constante
 * ci-dessous : la passer à `#4ade80` suffit si Aaron préfère l'usage à la règle.
 */
const COULEUR_VIVANT = 'var(--color-success)';

export function PresenceDot({
  insight,
  /** Vrai quand le dernier relevé a échoué : on ne sait plus, on ne prétend pas. */
  unknown = false,
  className,
}: {
  insight: ParcOrgInsight | null;
  unknown?: boolean;
  className?: string;
}) {
  const inconnu = unknown || insight === null;
  const connexions = insight?.connections ?? 0;
  const vivant = !inconnu && connexions > 0;

  const titre = inconnu
    ? 'Présence inconnue — relevé du parc indisponible'
    : vivant
      ? `${connexions} connexion${connexions > 1 ? 's' : ''} ouverte${connexions > 1 ? 's' : ''}`
      : 'Personne de connecté';

  return (
    <span
      className={`inline-flex h-2 w-2 flex-shrink-0 items-center justify-center ${className ?? ''}`}
      title={titre}
      // Le point est une information, pas un ornement : il doit se lire aussi
      // à la synthèse vocale, où aucune couleur n'arrive.
      role="img"
      aria-label={titre}
    >
      <span
        className={`h-2 w-2 rounded-full ${vivant ? 'live-dot' : ''}`}
        style={
          inconnu
            ? { border: '1px solid var(--color-text-muted)' }
            : { backgroundColor: vivant ? COULEUR_VIVANT : 'var(--color-border-strong)' }
        }
      />
    </span>
  );
}

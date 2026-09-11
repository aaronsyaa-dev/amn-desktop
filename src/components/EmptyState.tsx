import React from 'react';

/**
 * L'ÉTAT VIDE — combattre le vide, pas le décorer (BLOC A)
 * ════════════════════════════════════════════════════════
 *
 * Le retour qui a motivé ce composant portait sur l'Agenda — sept colonnes
 * « Rien de prévu » côte à côte — mais le défaut était partout : une grande
 * boîte centrée, une icône, un titre, deux phrases, un bouton. Répétée d'écran
 * en écran, cette forme produit exactement l'inverse de ce qu'elle cherche :
 * elle donne au VIDE la surface d'un contenu.
 *
 * Trois règles, et rien d'autre :
 *
 *   1. **Le vide ne prend pas la place d'un contenu.** Pas de hauteur minimale,
 *      pas de cadre, pas d'icône décorative. Ce qui n'existe pas n'occupe pas.
 *
 *   2. **Une phrase, une action.** La phrase dit ce qui manque ; l'action dit
 *      comment le faire exister. Un état vide sans action est une impasse, un
 *      état vide avec trois actions est un menu.
 *
 *   3. **On ne répète pas une absence.** Quand plusieurs zones d'un écran sont
 *      vides, une seule parle — la principale. Les autres se taisent (voir
 *      `quiet`), parce que la deuxième fois qu'on lit « aucun élément », le
 *      message n'informe plus, il pèse.
 *
 * Ce composant N'AJOUTE PAS de décoration : il en retire. Il existe pour que la
 * même retenue s'applique aux trente écrans sans être réécrite trente fois — et
 * pour qu'on ne puisse plus, par distraction, remettre une grande boîte vide.
 */
export function EmptyState({
  children,
  action,
  quiet = false,
  muted = false,
}: {
  /** Ce qui manque, en une phrase. Pas de titre séparé : la phrase suffit. */
  children: React.ReactNode;
  /** Le geste qui fait exister la chose. Un seul. */
  action?: { label: string; onClick: () => void };
  /**
   * Version SECONDAIRE — un panneau vide dans un écran qui, lui, a du contenu.
   * Une phrase et une action textuelle, rien de plus.
   */
  quiet?: boolean;
  /**
   * Version MUETTE — une zone vide dans un écran DÉJÀ vide ailleurs. La même
   * phrase, sans action : la deuxième invitation d'un écran annule la première.
   *
   * ÉCART ASSUMÉ AVEC LE COMPOSANT D'AVANT, ET C'EST UNE MESURE, PAS UN GOÛT.
   * La version muette baissait l'opacité à 60 %. À 13 px sur le nouveau fond
   * #060606, `--color-text-secondary` à 60 % tombe à ~3,4:1 — sous le seuil
   * WCAG AA (4,5) pour du texte courant, c'est-à-dire illisible pour une partie
   * des gens. Se taire ne veut pas dire devenir illisible : on garde l'encre
   * pleine et on retire l'ACTION à la place. C'est ce qui distingue vraiment
   * une zone qui se tait d'une zone qui invite.
   */
  muted?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
      <p className={`text-[13.5px] leading-[1.7] ${muted || quiet ? 'text-text-muted' : 'text-text-secondary'}`}>
        {children}
      </p>
      {action && !muted && (
        /*
          `-my-2 py-2` : le lien mesurait 15 px de haut.

          C'est l'UNIQUE action d'un écran vide — donc, très souvent, le premier
          geste que quelqu'un fait dans un module qu'il découvre, et sur
          téléphone. Quinze pixels se ratent au doigt (WCAG 2.5.8 en demande 24),
          et rater sa première tentative sur une page qui ne propose qu'une seule
          chose laisse croire que le bouton ne marche pas.

          La marge négative rend au voisinage ce que le rembourrage prend : la
          zone tactile passe à 31 px, l'écran ne bouge pas d'un pixel. Corrigé
          ici plutôt que dans chaque appelant — cet état vide est partagé par
          tous les modules.
        */
        <button
          type="button"
          onClick={action.onClick}
          className="-my-2 py-2 font-mono text-[10px] uppercase tracking-wider text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Le premier pas d'un module JAMAIS utilisé — à ne pas confondre avec l'absence
 * ordinaire ci-dessus.
 *
 * La distinction est réelle et vaut d'être tenue : « aucune facture ce
 * trimestre » est une information sur une période, « vous n'avez jamais émis de
 * facture » est un module qui n'a pas démarré. Le second mérite d'expliquer à
 * quoi sert l'écran ; le premier n'a rien à expliquer et doit rester bref.
 *
 * Même retenue de forme malgré tout : pas de cadre, deux phrases au plus.
 * L'ILLUSTRATION (L'Automatique, Bloc 4) est un trait, pas un décor : le glyphe
 * du module, en filet, à la taille du titre — il dit « c'est ici que ça se
 * passe » sans donner au vide la surface d'un contenu. Aucune image, aucune
 * couleur : un état vide illustré reste un état vide.
 */
export function FirstRun({
  title,
  children,
  action,
  icone: Icone,
  amorces,
}: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  /** Le glyphe du module (lucide), en filet. Optionnel : sans lui, rien ne change. */
  icone?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /**
   * DEUX OU TROIS AMORCES NOMMÉES — et seulement si le module a de VRAIS
   * gabarits (système de design, §5.1). Une amorce n'est pas un deuxième
   * bouton : c'est un départ déjà rempli, qui dit ce que le module produit.
   * Jamais inventées pour meubler : sans gabarit réel, on n'en passe pas.
   */
  amorces?: { label: string; onClick: () => void }[];
}) {
  return (
    <div className="max-w-xl py-8">
      {Icone && (
        <span
          className="mb-4 inline-flex h-11 w-11 items-center justify-center border border-border-section text-text-muted"
          aria-hidden
        >
          <Icone size={20} strokeWidth={1.9} />
        </span>
      )}
      {/*
        Le titre dit CE QUE LE MODULE FAIT, à l'échelle d'un titre de carte
        (26 px) : c'est l'objet de l'écran, pas une note de bas de page. Un état
        vide en 15 px se lit comme une erreur ; en 26, comme une invitation.
      */}
      <p className="text-[26px] font-bold leading-[1.1] tracking-[-0.028em] text-text-primary">{title}</p>
      <p className="mt-3 text-[14.5px] leading-[1.7] text-text-secondary [text-wrap:pretty]">{children}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
        >
          {action.label}
        </button>
      )}
      {amorces && amorces.length > 0 && (
        <div className="mt-5 flex flex-col border-t border-border pt-1">
          {amorces.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="group flex min-h-11 items-center justify-between gap-4 border-b border-border py-2.5 text-left text-[13.5px] text-text-secondary transition-colors last:border-b-0 hover:text-text-primary md:min-h-0"
            >
              <span className="truncate">{a.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted transition-colors group-hover:text-text-secondary">
                →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

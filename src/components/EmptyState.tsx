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
}: {
  /** Ce qui manque, en une phrase. Pas de titre séparé : la phrase suffit. */
  children: React.ReactNode;
  /** Le geste qui fait exister la chose. Un seul. */
  action?: { label: string; onClick: () => void };
  /**
   * Version muette, pour les zones SECONDAIRES d'un écran déjà vide ailleurs.
   * Le texte reste lisible (et lu par un lecteur d'écran), il cesse simplement
   * de réclamer l'attention une seconde fois.
   */
  quiet?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 ${quiet ? 'opacity-60' : ''}`}>
      <p className="text-[13px] leading-relaxed text-text-secondary">{children}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="font-mono text-[10px] uppercase tracking-wider text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary"
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
 * Même retenue de forme malgré tout : pas de cadre, pas d'icône, deux phrases
 * au plus.
 */
export function FirstRun({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="max-w-lg py-6">
      <p className="text-[15px] font-medium text-text-primary">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{children}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';

/**
 * LE FORMULAIRE COURT — en place, sous l'en-tête, jamais en fenêtre.
 * ═════════════════════════════════════════════════════════════════
 *
 * Système de design, §5.2 : moins de cinq champs s'ouvrent DANS l'écran, pas
 * par-dessus. Une fenêtre modale pour trois champs coûte deux choses — elle
 * cache la liste qu'on est en train d'enrichir (or on écrit souvent en la
 * regardant), et elle promet un engagement que le geste n'a pas.
 *
 * Conséquence assumée, écrite ici pour qu'on ne la « corrige » pas plus tard :
 * PAS DE RACCOURCI ÉCHAP. Le hook `useFermetureEchap` ne vaut que pour ce qui
 * se pose par-dessus l'écran ; Échap sur un formulaire en place fermerait
 * quelque chose que la personne ne perçoit pas comme une fenêtre, et lui
 * ferait perdre sa saisie sans qu'elle comprenne pourquoi.
 *
 * `empeche` porte l'autre règle du paquet : « sans intitulé, l'enregistrement
 * reste inactif ». Le bouton primaire est désactivé ET la raison est écrite à
 * côté — un bouton grisé sans explication est une impasse.
 */
export function FormulaireEnPlace({
  titre,
  note,
  empeche,
  onEnregistrer,
  onFermer,
  libelleEnregistrer = 'Enregistrer',
  libelleFermer = 'Fermer',
  children,
}: {
  /** Ce que le formulaire crée : « Nouveau contrat », « Nouvelle dépense ». */
  titre: string;
  /** Une précision de comportement, à droite de l'en-tête. Optionnelle. */
  note?: string;
  /**
   * Ce qui manque pour pouvoir enregistrer, en clair. Présent = le bouton
   * primaire est inactif et cette phrase dit pourquoi. Absent = on peut
   * enregistrer.
   */
  empeche?: string;
  onEnregistrer: () => void;
  onFermer: () => void;
  libelleEnregistrer?: string;
  libelleFermer?: string;
  /** Les champs, posés par l'appelant dans la grille qui lui convient. */
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="panel-raised mb-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-raised px-5 py-3.5">
        <p className="eyebrow">{titre}</p>
        {note && <p className="eyebrow text-text-muted">{note}</p>}
      </header>

      <div className="p-5">{children}</div>

      <footer className="flex flex-wrap items-center gap-3 px-5 pb-5">
        <button
          type="button"
          onClick={onEnregistrer}
          disabled={Boolean(empeche)}
          className="bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-[#2b2b2b] disabled:text-text-muted"
        >
          {libelleEnregistrer}
        </button>
        <button
          type="button"
          onClick={onFermer}
          className="border border-border-strong px-4 py-2.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
        >
          {libelleFermer}
        </button>
        {empeche && <p className="eyebrow ml-auto text-text-muted">{empeche}</p>}
      </footer>
    </motion.section>
  );
}

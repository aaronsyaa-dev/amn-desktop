import React from 'react';
import { motion } from 'framer-motion';
import { Undo2 } from 'lucide-react';

/**
 * LES MESSAGES SYSTÈME — trois formes, trois raisons (système de design, §5.3).
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ce sont les moments où l'application répond « non », « c'est fait » ou
 * « pas maintenant ». Ils étaient écrits au cas par cas, et se ressemblaient
 * tous : une phrase grise quelque part, parfois une fenêtre. Le paquet de
 * design les range en trois formes, et c'est la forme qui porte le sens.
 */

/**
 * LE REFUS — dire ce qui bloque ET qui le bloque, à l'endroit du geste.
 *
 * Le modèle est `6e` : « la camionnette est déjà prise par samir, 13:30 →
 * 15:00 », avec deux créneaux libres proposés. Trois exigences, et elles
 * tiennent ensemble :
 *
 *   · À L'ENDROIT DU GESTE. Pas un toast en bas à droite qu'on lit après avoir
 *     quitté le formulaire : la personne est là, la réponse aussi.
 *   · RIEN N'A ÉTÉ ENREGISTRÉ. Un refus qui laisse une trace à moitié écrite
 *     est pire qu'un refus.
 *   · UNE SORTIE. Un refus sans issue est un mur ; les `issues` sont les
 *     chemins réels — et seulement réels : jamais une suggestion inventée pour
 *     adoucir le non.
 *
 * Le rouge est réservé au critique : un refus n'est pas une panne, c'est une
 * réponse. Il se pose donc en filet ambre — ce qui demande une décision.
 */
export function Refus({
  quoi,
  parQui,
  issues,
}: {
  /** Ce qui bloque, en une phrase, à la voix active. */
  quoi: string;
  /** Qui (ou quoi) le bloque, et depuis quand. Optionnel mais presque toujours dû. */
  parQui?: string;
  /** Les sorties réelles. Deux ou trois ; aucune si vraiment aucune n'existe. */
  issues?: { label: string; onClick: () => void }[];
}) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="border border-signal-line bg-signal-muted px-4 py-3"
    >
      <p className="text-[14px] leading-[1.6] text-text-primary">{quoi}</p>
      {parQui && <p className="mt-1 font-mono text-[11.5px] text-text-secondary">{parQui}</p>}
      {issues && issues.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {issues.map((issue) => (
            <button
              key={issue.label}
              type="button"
              onClick={issue.onClick}
              className="min-h-11 border border-border-strong px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary md:min-h-0"
            >
              {issue.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * LA CONFIRMATION — jamais une fenêtre pour une action réversible.
 *
 * Une bande discrète, et l'annulation offerte tant qu'elle vaut. La règle du
 * paquet est nette : demander « êtes-vous sûr ? » avant un geste qu'on peut
 * défaire apprend à cliquer « oui » sans lire, et c'est ce réflexe-là qui fait
 * perdre des données le jour où la question compte vraiment.
 *
 * Pour l'irréversible, le dépôt a déjà `ConfirmDelete` — deux temps, sur
 * place. Cette bande ne le remplace pas : elle couvre l'autre moitié.
 */
export function BandeConfirmation({
  children,
  onAnnuler,
  libelleAnnuler = 'Annuler',
}: {
  /** Ce qui vient de se faire, au passé, en une phrase. */
  children: React.ReactNode;
  /** Défaire. Absent = rien à défaire, et la bande le dit en se taisant. */
  onAnnuler?: () => void;
  libelleAnnuler?: string;
}) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-4 border border-border bg-sunken px-4 py-2.5"
    >
      <p className="flex-1 text-[13.5px] text-text-secondary">{children}</p>
      {onAnnuler && (
        <button
          type="button"
          onClick={onAnnuler}
          className="-my-2 flex min-h-11 items-center gap-1.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text-primary md:min-h-0"
        >
          <Undo2 size={12} strokeWidth={2.1} />
          {libelleAnnuler}
        </button>
      )}
    </motion.div>
  );
}

/**
 * L'ÉTAT HORS-LIGNE — l'état, ce qui continue, ce qui attend.
 *
 * Trois informations, et pas une de moins : dire « hors ligne » seul laisse
 * croire que l'application est morte, alors qu'elle écrit toujours en local et
 * enverra à la reprise. Le dépôt a déjà la file d'envoi (`EnvoiEnAttente`) —
 * cette bande est sa voix quand un écran veut l'afficher lui-même.
 */
export function BandeHorsLigne({
  continue: ceQuiContinue,
  attend,
}: {
  /** Ce qui fonctionne quand même. */
  continue: string;
  /** Ce qui est en attente d'un retour du réseau, chiffré si possible. */
  attend?: string;
}) {
  return (
    <div role="status" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-border bg-sunken px-4 py-2.5">
      <span className="eyebrow text-text-secondary">Hors ligne</span>
      <span className="text-[13.5px] text-text-secondary">{ceQuiContinue}</span>
      {attend && <span className="ml-auto font-mono text-[11.5px] text-text-muted">{attend}</span>}
    </div>
  );
}

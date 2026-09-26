import React from 'react';
import { Link } from 'react-router-dom';
import { Plug } from 'lucide-react';
import { Bloc } from './cinquante-kit';

/**
 * LE BRANCHEMENT QUI MANQUE — dit, au lieu d'être tu.
 *
 * Une quinzaine de modules ne se remplissent pas à la main : ils lisent une
 * source extérieure (la ligne téléphonique pour Standard, le relevé bancaire
 * pour Rapprochement, les comptes de réseaux sociaux pour Planificateur…).
 * Tant que cette source n'est pas reliée, l'écran reste vide — et une cliente
 * qui l'ouvre ne voyait qu'une phrase du genre « Aucun appel pour l'instant »,
 * comme si c'était à elle d'attendre un appel.
 *
 * Ce bloc dit trois choses : d'où le module tire ses données, que ce
 * branchement n'est pas fait, et comment le demander (le message part par
 * Assistance, déjà rédigé). Il ne s'affiche que sur un écran vide.
 */
export function BranchementManquant({ module, source, enAttendant }: { module: string; source: string; enAttendant?: string }) {
  const objet = `Brancher ${module}`;
  const texte = `Bonjour, je voudrais utiliser ${module}. D’après l’écran, il se remplit à partir de ${source}. Pouvez-vous me dire comment le brancher pour mon espace ?`;
  return (
    <Bloc>
      <section className="panel flex flex-wrap items-start gap-4 px-5 py-4" data-branchement-manquant aria-label={`${module} : branchement à faire`}>
        <span className="flex h-9 w-9 flex-none items-center justify-center border border-border-strong text-text-secondary" aria-hidden>
          <Plug size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1.5 text-text-secondary">Branchement à faire</p>
          <p className="max-w-[70ch] text-[13.5px] leading-[1.6] text-text-body">
            {module} se remplit tout seul à partir de {source}. Ce branchement n’est pas encore fait pour votre espace : tant
            qu’il manque, cet écran reste vide.{enAttendant ? ` ${enAttendant}` : ''}
          </p>
          <Link
            to={`/assistance?objet=${encodeURIComponent(objet)}&texte=${encodeURIComponent(texte)}`}
            className="mt-3 inline-flex min-h-11 items-center border border-border-strong px-[13px] text-[12.5px] font-semibold text-text-body transition-colors hover:bg-surface-hover sm:min-h-[30px]"
          >
            Demander le branchement
          </Link>
        </div>
      </section>
    </Bloc>
  );
}

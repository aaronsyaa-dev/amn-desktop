import React from 'react';
import { Link } from 'react-router-dom';
import { Film } from 'lucide-react';
import { isModuleEnabled } from '../data/spaces';
import { useModulesOuverts } from '../state/useModulesOuverts';

/**
 * « NOUVEAU MODULE » — Production vidéo, mis en avant sur l'Accueil.
 *
 * Demande d'origine (Syraagensy) : qu'une organisation à qui ce module vient
 * d'être ouvert le découvre depuis l'Accueil, pas en tombant dessus par
 * hasard dans la barre latérale. `isModuleEnabled` est LA même garde que
 * partout ailleurs : rien ne s'affiche chez une organisation qui ne l'a pas.
 *
 * Même mécanique que `CarteDecouvrir` (`useModulesOuverts`) : pleine tant que
 * personne n'a ouvert Production vidéo, puis une ligne discrète — jamais
 * retirée tout à fait, pour que le module reste trouvable depuis l'Accueil
 * même après la première visite.
 */
export function CarteNouveauModuleVideo() {
  const ouvertures = useModulesOuverts();
  if (!isModuleEnabled('videoProductions')) return null;
  const dejaVu = Boolean(ouvertures.videoProductions);

  if (dejaVu) {
    return (
      <Link
        to="/productions-video"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border bg-surface px-4 py-2.5 transition-colors hover:bg-surface-hover"
        data-carte-nouveau-module="videoProductions-ligne"
      >
        <Film size={15} strokeWidth={2} className="flex-none text-text-secondary" aria-hidden />
        <span className="text-[13px] text-text-secondary">Production vidéo</span>
        <span className="text-[13px] text-text-muted">— suivre une vidéo, de l’idée à la publication</span>
      </Link>
    );
  }

  return (
    <Link
      to="/productions-video"
      className="group flex items-start gap-4 border border-border-strong bg-surface p-5 transition-colors hover:bg-surface-hover"
      data-carte-nouveau-module="videoProductions-pleine"
      aria-label="Ouvrir le nouveau module Production vidéo"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center border border-border-strong bg-bg text-text-primary" aria-hidden>
        <Film size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-1.5">Nouveau module</p>
        <h2 className="text-[17px] font-semibold leading-snug text-text-primary">Production vidéo</h2>
        <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-text-secondary">
          Une fiche par vidéo, de l’idée à la publication : synopsis, jour de tournage, texte à
          lire, inspiration photo, statut et personne à contacter — tout au même endroit.
        </p>
        <span className="mt-3.5 inline-flex h-9 items-center bg-accent px-4 text-[13px] font-semibold text-bg transition-colors group-hover:bg-accent-hover">
          Ouvrir Production vidéo
        </span>
      </div>
    </Link>
  );
}

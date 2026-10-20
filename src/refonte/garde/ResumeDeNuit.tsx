import React from 'react';
import { useGardeLangue } from './i18n';
import { useResumeDeNuit } from './donnees';
import type { TonPhrase } from './resume';

/**
 * LE RÉSUMÉ DE LA NUIT (S3) — un bloc de phrases courtes.
 *
 * Sobre : pas de carte imposée (l'appelant l'habille, bureau ou salle), pas
 * d'animation, pas d'ambre. Une pastille par phrase dit son ton ; le rouge
 * n'apparaît que pour le critique.
 *
 * L'EMPLACEMENT D'AJMANI : le composant d'Ajmani vient de la session S2,
 * pas encore fusionnée. `ajmani` reçoit ce composant le jour où le CO le
 * branche ; d'ici là l'emplacement est rendu vide et ne prend aucune place.
 */
const PASTILLE: Record<TonPhrase, string> = {
  critique: 'bg-etat-danger',
  serieux: 'bg-etat-attention',
  info: 'bg-socle-texte-discret',
  calme: 'bg-etat-succes',
};

export function ResumeDeNuit({ depuis, ajmani, titre = true, compact = false }: { depuis?: Date | null; ajmani?: React.ReactNode; titre?: boolean; compact?: boolean }) {
  const { tg } = useGardeLangue();
  const { resume, erreur } = useResumeDeNuit(depuis);
  const id = React.useId();

  return (
    <section aria-labelledby={titre ? id : undefined} aria-label={titre ? undefined : tg('resume.titre')} className="min-w-0">
      {titre && (
        <h2 id={id} className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-socle-texte-discret">
          {tg('resume.titre')}
        </h2>
      )}
      <div data-emplacement="ajmani" className="empty:hidden mb-3">
        {ajmani}
      </div>
      {!resume ? (
        <p className="text-[13px] text-socle-texte-doux">{erreur ? tg('resume.indisponible') : tg('resume.chargement')}</p>
      ) : (
        <>
          <p className={`${compact ? 'text-[15px]' : 'text-[17px]'} font-medium leading-snug ${resume.ton === 'critique' ? 'text-danger-ink' : 'text-socle-texte'}`}>{resume.phrases[0].texte}</p>
          <ul className={`${compact ? 'mt-2 space-y-1' : 'mt-3 space-y-1.5'}`}>
            {resume.phrases.slice(1).map((p) => (
              <li key={p.cle} className="flex items-baseline gap-2.5">
                <span aria-hidden className={`inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full ${PASTILLE[p.ton]}`} />
                <span className={`${compact ? 'text-[13px]' : 'text-[14px]'} leading-[1.5] ${p.ton === 'critique' ? 'text-danger-ink' : p.ton === 'calme' || p.ton === 'info' ? 'text-socle-texte-doux' : 'text-socle-texte'}`}>{p.texte}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

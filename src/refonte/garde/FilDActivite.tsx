import React, { useEffect, useState } from 'react';
import { useMouvement } from '../../socle/mouvement';
import { useGardeLangue } from './i18n';
import { useFilDActivite } from './donnees';
import { depuisQuand } from './fil';
import { styleEquipe } from './equipes';

/**
 * LE FIL D'ACTIVITÉ DE LA GARDE (S3) — une ligne par équipe.
 *
 * Il montre que la Garde existe sans jamais forcer l'attention :
 *   · une ligne par équipe, toujours le même nombre : rien ne défile ;
 *   · `aria-live="off"` : un lecteur d'écran ne l'annonce pas à chaque ronde ;
 *   · seule la pastille d'une équipe en ronde respire, et seulement en
 *     mouvement complet (le réglage Mouvement du socle) ;
 *   · une garde en échec passe en jaune paille (`etat-attention`), pas en
 *     ambre : elle prévient, elle ne demande pas de décision.
 */
export function FilDActivite({ titre = true, compact = false }: { titre?: boolean; compact?: boolean }) {
  const { tg, tc, langue } = useGardeLangue();
  const { lignes, pret } = useFilDActivite();
  const anime = useMouvement() === 'complet';
  const id = React.useId();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <section aria-labelledby={titre ? id : undefined} aria-label={titre ? undefined : tg('fil.aria')} className="min-w-0">
      {titre && (
        <h2 id={id} className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-socle-texte-discret">
          {tg('fil.titre')}
        </h2>
      )}
      {!pret ? (
        <p className="text-[13px] text-socle-texte-doux">{tg('fil.vide')}</p>
      ) : (
        <ul aria-live="off" className={compact ? 'space-y-2' : 'divide-y divide-socle-bord'}>
          {lignes.map((l) => (
            <li key={l.equipe} style={styleEquipe(l.equipe)} className={`grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-x-3 ${compact ? '' : 'py-2.5'}`}>
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${l.etat === 'ronde' && anime ? 'sv-souffle-calme' : ''}`}
                style={{
                  background: l.etat === 'echec' ? 'var(--color-etat-attention)' : l.etat === 'repos' ? 'transparent' : 'var(--equipe)',
                  border: l.etat === 'repos' ? '1px solid var(--equipe)' : undefined,
                  opacity: l.etat === 'recent' ? 0.7 : 1,
                }}
              />
              <span className="min-w-0">
                <span className="text-[12.5px] font-semibold text-[var(--equipe-texte)]">{l.nom}</span>
                {!compact && l.gardes > 0 && <span className="ml-2 font-mono text-[10.5px] text-socle-texte-discret">{tc('fil.gardes', l.gardes)}</span>}
                <span className={`block truncate ${compact ? 'text-[12.5px]' : 'text-[13px]'} leading-[1.5] ${l.etat === 'echec' ? 'text-etat-attention-texte' : l.etat === 'repos' ? 'text-socle-texte-discret' : 'text-socle-texte-doux'}`} title={l.texte}>
                  {l.texte}
                </span>
              </span>
              <span className="whitespace-nowrap font-mono text-[10.5px] tabular-nums text-socle-texte-discret">{depuisQuand(l.at, maintenant, langue)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

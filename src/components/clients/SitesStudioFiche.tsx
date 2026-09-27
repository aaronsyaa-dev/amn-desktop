import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { stripMeta, useCollection, useSync } from '../../state/SyncContext';
import type { PieceStudio } from '../../bureaux/donnees/types';
import { plaque } from '../../bureaux/donnees/studio';
import { hoteDe, maquetteDe } from '../../bureaux/studio/maquette';

/**
 * LES SITES DU STUDIO, SUR LA FICHE CLIENT — l'autre bout du lien pièce ↔ cliente.
 *
 * Dans le Studio, une pièce (un site) se relie à une fiche de l'onglet Clients.
 * Ici, la fiche montre ses sites — la pièce, le site en ligne — et permet d'en
 * relier un depuis ce côté-ci : une seule donnée (`clientId` de la pièce), lue
 * des deux côtés, jamais recopiée.
 */
export function SitesStudioFiche({ recordId }: { recordId: string }) {
  const pieces = useCollection<PieceStudio>('studioPieces');
  const { upsert } = useSync();
  const [choix, setChoix] = useState('');
  const siens = useMemo(() => pieces.filter((p) => p.clientId === recordId).sort((a, b) => a.numero - b.numero), [pieces, recordId]);
  const autres = useMemo(
    () => pieces.filter((p) => p.clientId !== recordId && typeof p.numero === 'number').sort((a, b) => a.numero - b.numero),
    [pieces, recordId],
  );
  if (siens.length === 0 && autres.length === 0) return null;
  const relier = (id: string, oui: boolean) => {
    const p = pieces.find((x) => x.id === id);
    if (!p) return;
    void upsert('studioPieces', id, { ...(stripMeta(p) as unknown as PieceStudio), clientId: oui ? recordId : null } as unknown as Record<string, unknown>);
  };
  return (
    <div data-sites-studio>
      <h3 className="eyebrow mb-3 text-text-secondary">Sites au Studio</h3>
      {siens.length === 0 ? (
        <p className="text-xs text-text-muted">Aucun site du Studio n’est encore relié à cette fiche.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {siens.map((p) => {
            const lien = maquetteDe(p).lien;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-xs">
                <span className="font-mono text-[10px] text-text-muted">{plaque(p.numero)}</span>
                <span className="min-w-0 flex-1 truncate text-text-primary">{p.quoi}</span>
                {lien && (
                  <a href={lien} target="_blank" rel="noopener noreferrer" className="text-text-secondary underline underline-offset-2 hover:text-text-primary">
                    {hoteDe(lien)} ↗
                  </a>
                )}
                <Link to={`/studio/pieces/${p.id}/croquis`} className="text-text-secondary underline underline-offset-2 hover:text-text-primary">
                  Ouvrir la pièce
                </Link>
                <button
                  type="button"
                  onClick={() => relier(p.id, false)}
                  className="min-h-8 px-1 text-text-muted underline underline-offset-2 hover:text-text-primary"
                  aria-label={`Délier ${plaque(p.numero)} de cette fiche`}
                >
                  Délier
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {autres.length > 0 && (
        <form
          className="mt-2.5 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (choix) relier(choix, true);
            setChoix('');
          }}
        >
          <select
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
            aria-label="Relier un site du Studio à cette fiche"
            className="input-focus min-h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary"
          >
            <option value="">Relier un site du Studio…</option>
            {autres.map((p) => (
              <option key={p.id} value={p.id}>
                {plaque(p.numero)} · {p.orgNom} · {p.quoi}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!choix} className="min-h-9 rounded-lg border border-border px-3 text-xs text-text-primary disabled:opacity-50">
            Relier
          </button>
        </form>
      )}
    </div>
  );
}

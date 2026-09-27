import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudio, LIBELLE_ETAT, type Piece } from '../donnees/studio';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { useClients, type SyncedClient } from '../../state/useClients';
import { type Brouillon, NouvellePiece, VIERGE, nomFiche } from './NouvellePiece';
import { hoteDe, ideesDe, maquetteDe } from './maquette';
import { useEcrirePiece } from './commun';

/**
 * STUDIO · LES SITES PAR CLIENTE — organiser les sites de chaque cliente.
 *
 * La façade range les pièces par numéro ; ici, par cliente : chaque fiche de
 * l'onglet Clients avec ses sites, puis les sites qui ne sont encore reliés à
 * aucune fiche — chacun avec de quoi le relier. Aucune donnée nouvelle : c'est
 * le `clientId` de la pièce, le même que lit la fiche client (« Sites au
 * Studio »). Ajouter un site pour une cliente ouvre une pièce déjà reliée.
 */
const plat = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase()
    .trim();

export function StudioParCliente() {
  const s = useStudio();
  const { clients } = useClients();
  const ecrire = useEcrirePiece();
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const fiches = useMemo(() => new Map(clients.map((c) => [c.recordId, c])), [clients]);
  const groupes = useMemo(() => {
    const par = new Map<string, { fiche: SyncedClient; pieces: Piece[] }>();
    const libres: Piece[] = [];
    for (const p of s.pieces) {
      const f = p.clientId ? fiches.get(p.clientId) : undefined;
      if (!f) {
        libres.push(p);
        continue;
      }
      const g = par.get(f.recordId) ?? { fiche: f, pieces: [] };
      g.pieces.push(p);
      par.set(f.recordId, g);
    }
    return { relies: [...par.values()].sort((a, b) => nomFiche(a.fiche).localeCompare(nomFiche(b.fiche), 'fr')), libres };
  }, [s.pieces, fiches]);
  const triees = useMemo(() => [...clients].sort((a, b) => nomFiche(a).localeCompare(nomFiche(b), 'fr')), [clients]);
  const n = groupes.relies.length;

  return (
    <>
      <EnTete
        surtitre={`Studio · sites par cliente · ${s.pieces.length} site${s.pieces.length > 1 ? 's' : ''}`}
        titre={
          n
            ? `${n} cliente${n > 1 ? 's' : ''} avec des sites${groupes.libres.length ? `, ${groupes.libres.length} site${groupes.libres.length > 1 ? 's' : ''} à relier` : ''}.`
            : 'Aucun site n’est encore relié à une fiche client.'
        }
        lede="Chaque site (une pièce du Studio) se relie à une fiche de l’onglet Clients. La fiche montre ensuite ses sites, et le Studio les range ici."
        actions={
          brouillon ? undefined : (
            <button type="button" className="bx-btn2" onClick={() => setBrouillon(VIERGE)}>
              Ajouter un site
            </button>
          )
        }
      />
      <NouvellePiece pieces={s.pieces} b={brouillon} setB={setBrouillon} sansListe />
      {s.pieces.length === 0 && !brouillon && (
        <Invitation
          titre="Pas encore de site."
          texte="Ajoutez le premier site d’une cliente : sa fiche, ce qu’on y construit, et le lien de sa maquette en ligne."
        />
      )}
      <div className="flex flex-col gap-[18px]">
        {groupes.relies.map(({ fiche, pieces }) => (
          <Carte
            key={fiche.recordId}
            titre={`${nomFiche(fiche)}${fiche.company.trim() ? ` · ${fiche.name}` : ''}`}
            droite={`${pieces.length} site${pieces.length > 1 ? 's' : ''}`}
          >
            <ul>
              {pieces.map((p) => (
                <LigneSite key={p.id} p={p} />
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-4">
              <button type="button" className="bx-lien" onClick={() => setBrouillon({ ...VIERGE, clientId: fiche.recordId })}>
                Ajouter un site pour {nomFiche(fiche)}
              </button>
              <Link to="/clients" state={{ focusClientId: fiche.id }} className="bx-lien">
                Ouvrir sa fiche client
              </Link>
            </div>
          </Carte>
        ))}
        {groupes.libres.length > 0 && (
          <Carte titre="Sites à relier à une fiche client" droite={groupes.libres.length}>
            <ul>
              {groupes.libres.map((p) => (
                <LigneSite
                  key={p.id}
                  p={p}
                  relier={
                    <>
                      {(() => {
                        const suggeree = triees.find((c) => plat(nomFiche(c)) === plat(p.orgNom));
                        return suggeree ? (
                          <button type="button" className="bx-lien" onClick={() => ecrire(p.id, () => ({ clientId: suggeree.recordId }))}>
                            Relier à {nomFiche(suggeree)}
                          </button>
                        ) : null;
                      })()}
                      <select
                        value=""
                        onChange={(e) => e.target.value && ecrire(p.id, () => ({ clientId: e.target.value }))}
                        aria-label={`Relier ${p.plaque} (${p.orgNom}) à une fiche client`}
                        className="h-8 max-w-[220px] border border-[#2a2826] bg-transparent px-2 text-[12px] text-text-primary outline-none focus:border-[#8a8a87]"
                      >
                        <option value="">Relier à une fiche…</option>
                        {triees.map((c) => (
                          <option key={c.recordId} value={c.recordId}>
                            {c.company.trim() ? `${c.company} · ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                    </>
                  }
                />
              ))}
            </ul>
            {triees.length === 0 && (
              <p className="mt-3 text-[12.5px] text-text-muted">
                L’onglet Clients n’a encore aucune fiche.{' '}
                <Link to="/clients" className="bx-lien">
                  Créer une fiche client
                </Link>
              </p>
            )}
          </Carte>
        )}
      </div>
    </>
  );
}

function LigneSite({ p, relier }: { p: Piece; relier?: React.ReactNode }) {
  const lien = maquetteDe(p).lien;
  const idees = ideesDe(p);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[#1f1e1c] py-2.5 last:border-b-0">
      <span className="border border-[#2a2826] px-[5px] py-[2px] font-mono text-[9.5px] font-semibold tracking-[0.1em] text-text-muted">{p.plaque}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-text-primary">{p.quoi}</span>
        <span className="block truncate text-[11.5px] text-text-muted">
          {p.orgNom} · {LIBELLE_ETAT[p.etat].toLowerCase()}
          {idees ? ` · ${idees} idée${idees > 1 ? 's' : ''}` : ''}
        </span>
      </span>
      {relier}
      {lien ? (
        <a href={lien} target="_blank" rel="noopener noreferrer" className="bx-lien">
          {hoteDe(lien)} ↗
        </a>
      ) : (
        <span className="text-[11.5px] text-text-muted">pas encore en ligne</span>
      )}
      <Link to={`/studio/pieces/${p.id}/croquis`} className="bx-lien">
        Maquettes et idées
      </Link>
    </li>
  );
}

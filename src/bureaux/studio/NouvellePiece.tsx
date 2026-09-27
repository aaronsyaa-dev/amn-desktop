import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { uid, useSync } from '../../state/SyncContext';
import { useSourceBureaux } from '../donnees/source';
import type { Piece } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, Ligne } from '../ui/kit';
import { useClients } from '../../state/useClients';
import { lienPropre } from './maquette';
import { useEcrirePiece } from './commun';

/**
 * STUDIO · OUVRIR UNE PIÈCE — et voir les sites qui n'en ont pas.
 *
 * L'audit avant vente l'a trouvé : la façade disait « une pièce se crée pour
 * chaque site ou application confié », mais rien ne permettait d'en créer
 * une. Seul le jeu de démonstration en posait ; Mohamed ne voyait donc ni ses
 * vrais sites, ni de quoi les ajouter.
 *
 * Deux choses ici :
 *   · le formulaire — la cliente (parmi les organisations, ou un nom libre),
 *     ce qu'on y construit, et le site suivi s'il existe déjà dans le Parc ;
 *   · la liste des sites suivis qui n'ont pas encore de pièce, chacun avec
 *     « Ouvrir sa pièce » qui pré-remplit le formulaire.
 * La pièce créée s'ouvre sur son mur (onglet Croquis).
 */

const champ = 'h-9 w-full border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]';

export interface Brouillon {
  /** Présent : on modifie cette pièce au lieu d'en ouvrir une. */
  id?: string;
  /** La fiche de l'onglet Clients (son identifiant d'enregistrement). */
  clientId: string;
  orgId: string;
  orgNom: string;
  quoi: string;
  siteId: string;
  url: string;
}
export const VIERGE: Brouillon = { clientId: '', orgId: '', orgNom: '', quoi: '', siteId: '', url: '' };

const plat = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/** Le nom qu'une fiche client donne à ses sites : sa société, sinon son nom. */
export const nomFiche = (c: { name: string; company: string }) => c.company.trim() || c.name.trim();

/** `b` : le brouillon ouvert (null = formulaire fermé). L'accueil le tient, pour que son en-tête puisse l'ouvrir. */
export function NouvellePiece({ pieces, b, setB, sansListe = false }: { pieces: Piece[]; b: Brouillon | null; setB: (b: Brouillon | null) => void; sansListe?: boolean }) {
  const src = useSourceBureaux();
  const { upsert } = useSync();
  const navigate = useNavigate();
  const { clients, updateClient } = useClients();
  const ecrire = useEcrirePiece();
  const fiches = useMemo(() => [...clients].sort((x, y) => nomFiche(x).localeCompare(nomFiche(y), 'fr')), [clients]);

  const organisations = useMemo(() => [...src.organisations].sort((x, y) => x.name.localeCompare(y.name, 'fr')), [src.organisations]);
  /* Un site a déjà sa pièce quand elle le nomme (siteId), ou quand l'adresse de la pièce est la sienne. */
  const lies = useMemo(() => {
    const hote = (u: string | null | undefined) => (u ?? '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    const hotes = new Set(pieces.map((p) => hote(p.url)).filter(Boolean));
    return new Set(src.sites.filter((s) => pieces.some((p) => p.siteId === s.id) || hotes.has(hote(s.url || s.name))).map((s) => s.id));
  }, [pieces, src.sites]);
  const sansPiece = useMemo(() => src.sites.filter((s) => !lies.has(s.id)), [src.sites, lies]);
  const nomOrg = (id: string | null | undefined) => organisations.find((o) => o.id === id)?.name ?? '';

  const ouvrirPour = (siteId: string) => {
    const s = src.sites.find((x) => x.id === siteId);
    setB({ ...VIERGE, siteId, url: s?.url ?? '', orgId: s?.clientOrgId ?? '', quoi: s ? `site ${s.name}` : '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fiche = b?.clientId ? fiches.find((c) => c.recordId === b.clientId) ?? null : null;
  const nom = b ? (fiche ? nomFiche(fiche) : b.orgId ? nomOrg(b.orgId) : b.orgNom.trim()) : '';
  const lien = b?.url.trim() ? lienPropre(b.url) : null;
  const manque = !b ? null : !nom ? 'Choisissez la cliente, ou écrivez son nom.' : !b.quoi.trim() ? 'Dites ce qu’on y construit.' : b.url.trim() && !lien ? 'Le lien n’est pas une adresse web complète.' : null;

  const creer = () => {
    if (!b || manque) return;
    const existante = b.id ? pieces.find((p) => p.id === b.id) : null;
    const id = existante?.id ?? uid('piece');
    // L'organisation suit la fiche client quand une organisation porte le même nom : les deux vues restent d'accord.
    const orgId = b.orgId || (fiche ? (organisations.find((o) => plat(o.name) === plat(nomFiche(fiche)))?.id ?? '') : '') || src.sites.find((s) => s.id === b.siteId)?.clientOrgId || null;
    const champs = { clientId: fiche?.recordId ?? null, orgId: orgId || null, orgNom: nom, quoi: b.quoi.trim(), siteId: b.siteId || null, url: lien };
    if (existante) {
      ecrire(id, () => champs);
    } else {
      const piece: PieceStudio = { numero: Math.max(0, ...pieces.map((p) => p.numero)) + 1, ...champs, enLigneLe: null };
      void upsert('studioPieces', id, piece as unknown as Record<string, unknown>);
    }
    // Le site suivi rejoint aussi la fiche dans l'onglet Clients (ses sites liés), s'il n'y est pas déjà.
    if (fiche && b.siteId && !fiche.linkedSiteIds.includes(b.siteId)) void updateClient(fiche.id, { linkedSiteIds: [...fiche.linkedSiteIds, b.siteId] }).catch(() => {});
    setB(null);
    if (!existante) navigate(`/studio/pieces/${id}/croquis`);
  };

  return (
    <>
      {b ? (
        <Carte pad="p-5" className="mb-[18px]" titre={b.id ? 'Modifier la pièce' : 'Ouvrir une pièce'} droite="un site par pièce : une porte dans la barre, une fenêtre dans la façade">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
              Cliente (fiche de l’onglet Clients)
              <select value={b.clientId ? `c:${b.clientId}` : b.orgId ? `o:${b.orgId}` : ''} onChange={(e) => {
                const v = e.target.value;
                setB({ ...b, clientId: v.startsWith('c:') ? v.slice(2) : '', orgId: v.startsWith('o:') ? v.slice(2) : '' });
              }} className={champ}>
                <option value="">Autre (nom libre)</option>
                {fiches.length > 0 && (
                  <optgroup label="Fiches clients">
                    {fiches.map((c) => (
                      <option key={c.recordId} value={`c:${c.recordId}`}>
                        {c.company.trim() ? `${c.company} · ${c.name}` : c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {organisations.length > 0 && (
                  <optgroup label="Organisations clientes">
                    {organisations.map((o) => (
                      <option key={o.id} value={`o:${o.id}`}>
                        {o.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            {!b.orgId && !b.clientId && (
              <label className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
                Son nom
                <input value={b.orgNom} onChange={(e) => setB({ ...b, orgNom: e.target.value })} placeholder="Boulangerie Keller" className={champ} />
              </label>
            )}
            <label className="flex flex-col gap-1 text-[11.5px] text-text-secondary md:col-span-2">
              Ce qu’on y construit
              <input value={b.quoi} onChange={(e) => setB({ ...b, quoi: e.target.value })} placeholder="site vitrine, 6 pages" className={champ} />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
              Site suivi (facultatif)
              <select
                value={b.siteId}
                onChange={(e) => {
                  const s = src.sites.find((x) => x.id === e.target.value);
                  setB({ ...b, siteId: e.target.value, url: b.url || s?.url || '', orgId: b.orgId || s?.clientOrgId || '' });
                }}
                className={champ}
              >
                <option value="">Aucun pour l’instant</option>
                {src.sites
                  .filter((s) => !lies.has(s.id) || s.id === b.siteId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.clientOrgId ? ` · ${nomOrg(s.clientOrgId)}` : ''}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-text-secondary">
              Lien du site ou de la maquette en ligne (facultatif)
              <input value={b.url} onChange={(e) => setB({ ...b, url: e.target.value })} placeholder="https://keller.vercel.app" inputMode="url" className={champ} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button type="button" className="bx-btn" disabled={Boolean(manque)} onClick={creer}>
              {b.id ? 'Enregistrer' : 'Ouvrir la pièce'}
            </button>
            <button type="button" className="bx-btn2" onClick={() => setB(null)}>
              Annuler
            </button>
            {manque && <span className="text-[12px] text-text-muted">{manque}</span>}
          </div>
        </Carte>
      ) : null}
      {!sansListe && sansPiece.length > 0 && (
        <div className="mt-[18px]">
          <Carte titre="Sites suivis sans pièce" droite={sansPiece.length}>
            {sansPiece.slice(0, 8).map((s) => (
              <Ligne
                key={s.id}
                a={s.state?.status === 'online' ? 'EN LIGNE' : s.state?.lastSeenAt ? 'VU' : '—'}
                b={`${s.name}${s.clientOrgId ? ` · ${nomOrg(s.clientOrgId)}` : ' · cliente non rattachée'}`}
                c={
                  <button type="button" className="bx-lien" onClick={() => ouvrirPour(s.id)}>
                    Ouvrir sa pièce
                  </button>
                }
              />
            ))}
            {sansPiece.length > 8 && <p className="mt-2 text-[12px] text-text-muted">Et {sansPiece.length - 8} autres, dans le formulaire.</p>}
          </Carte>
        </div>
      )}
    </>
  );
}

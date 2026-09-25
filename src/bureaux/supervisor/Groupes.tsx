import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import type { DossierOrg } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { libelleSuivi } from './Horizon';
import { enLettres } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * SUPERVISOR · LES GROUPES — plusieurs organisations qui vont ensemble : les
 * boutiques d'un même réseau, les cabinets d'un même associé, un quartier.
 * Un groupe se lit comme une petite tour : la somme des poids de ses
 * membres, et qui les suit. Le groupe est un champ du dossier interne de
 * chaque organisation (`orgDossier.groupe`) — jamais visible de la cliente.
 *
 * L'ambre : dans le groupe qui la contient, la ligne de l'organisation que
 * l'horizon désigne (la plus lourde sans personne).
 */
export function SupervisorGroupes() {
  const m = useSupervisor();
  const { user } = useAuth();
  const { upsert } = useSync();
  const [orgId, setOrgId] = useState('');
  const [groupe, setGroupe] = useState('');
  const groupes = useMemo(
    () =>
      [...m.groupes.entries()]
        .map(([nom, ids]) => {
          const orgs = ids.map((id) => m.orgs.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => Boolean(o)).sort((a, b) => b.poids - a.poids);
          return { nom, orgs, poids: orgs.reduce((s, o) => s + o.poids, 0) };
        })
        .sort((a, b) => b.poids - a.poids || a.nom.localeCompare(b.nom, 'fr')),
    [m.groupes, m.orgs],
  );
  const seules = m.orgs.filter((o) => !m.dossiers.get(o.id)?.groupe);
  const ranger = () => {
    if (!orgId || !groupe.trim()) return;
    const d = (m.dossiers.get(orgId) ?? {}) as DossierOrg & { id?: string };
    const { id: _id, ...reste } = d;
    void upsert('orgDossier', orgId, { ...reste, groupe: groupe.trim(), updatedBy: user?.email ?? '' });
    setOrgId('');
  };
  const sortir = (id: string) => {
    const d = (m.dossiers.get(id) ?? {}) as DossierOrg & { id?: string };
    const { id: _id, groupe: _g, ...reste } = d;
    void upsert('orgDossier', id, { ...reste, updatedBy: user?.email ?? '' });
  };
  const vide = m.pret && groupes.length === 0;
  const champ = 'h-9 border border-[#2b2b2b] bg-[#141414] px-2.5 text-[13px] text-[#f7f7f5] outline-none focus:border-[#8a8a87]';
  return (
    <EcranVide quand={vide} premierJour={vide}>
      <EnTete
        surtitre={`Supervisor · Groupes${groupes.length ? ` · ${groupes.length}` : ''}`}
        titre={groupes.length ? `${enLettres(groupes.length, true)} groupe${groupes.length > 1 ? 's' : ''}, ${seules.length} organisation${seules.length > 1 ? 's' : ''} seule${seules.length > 1 ? 's' : ''}.` : 'Aucun groupe encore.'}
        lede="Un groupe réunit des organisations qui vont ensemble — un réseau, un associé, un quartier. Il se lit comme une tour : la somme de leurs poids."
      />
      <Carte dominante pad="p-6" titre="Ranger une organisation dans un groupe">
        <div className="flex flex-wrap items-center gap-2.5">
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={champ} aria-label="L’organisation">
            <option value="">Choisir une organisation…</option>
            {m.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
                {m.dossiers.get(o.id)?.groupe ? ` (${m.dossiers.get(o.id)!.groupe})` : ''}
              </option>
            ))}
          </select>
          <input list="groupes-connus" value={groupe} onChange={(e) => setGroupe(e.target.value)} placeholder="Le groupe" aria-label="Le groupe" className={`${champ} w-[240px]`} />
          <datalist id="groupes-connus">
            {groupes.map((g) => (
              <option key={g.nom} value={g.nom} />
            ))}
          </datalist>
          <button type="button" className="bx-btn" disabled={!orgId || !groupe.trim()} onClick={ranger}>
            Ranger
          </button>
        </div>
      </Carte>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        {vide && <Invitation titre="Les groupes naissent ici." texte="Rangez une première organisation dans un groupe : il apparaît, avec la somme de ses poids." />}
        {groupes.map((g) => (
          <Carte key={g.nom} titre={`Groupe ${g.nom}`} droite={`poids ${g.poids} · ${g.orgs.length} organisation${g.orgs.length > 1 ? 's' : ''}`}>
            {g.orgs.map((o) => {
              const ambre = m.ambre?.id === o.id;
              return (
                <div key={o.id} className="flex items-center gap-3 border-b border-[#1a1a1a] py-2.5" style={ambre ? { background: 'rgba(208,154,74,.06)', boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 8 } : undefined} data-signal-groupe={ambre ? 'groupes-ambre' : undefined}>
                  <span className="w-7 font-mono text-[12px] font-semibold tabular-nums" style={{ color: ambre ? AMBRE : '#e4e4e1' }}>{o.poids}</span>
                  <Link to={`/supervisor/dossiers/${o.id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#f7f7f5] hover:underline">
                    {o.nom}
                  </Link>
                  <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em]" style={{ color: ambre ? AMBRE : '#a3a3a0' }}>{libelleSuivi(o)}</span>
                  <button type="button" onClick={() => sortir(o.id)} className="text-[11.5px] text-[#9a9a97] underline decoration-[#4a4a48] underline-offset-2 hover:text-[#e4e4e1]">
                    Sortir du groupe
                  </button>
                </div>
              );
            })}
          </Carte>
        ))}
      </div>
    </EcranVide>
  );
}

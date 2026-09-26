import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AMBRE, ROUGE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { useCyber } from '../donnees/cyber';
import { useSourceBureaux } from '../donnees/source';
import { horizon as calculer, type OrgPoints } from '../donnees/parc';
import { serie, useReleves } from '../donnees/releves';
import { Carte, Chargement, EnTete } from '../ui/kit';
import { libelleSuivi } from './Horizon';
import { BasculeVue } from './Accueil';
import { UserAvatar } from '../../components/UserAvatar';
import { enLettres, ilYA } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * SUPERVISOR · LA GRILLE — cahier 12, `46b`.
 *
 * La même liste que l'horizon, dans le même ordre : une ligne de 44 px par
 * organisation et sept colonnes de santé. Les tours en tête, puis le plateau,
 * puis deux groupes repliés — rien n'est chargé qu'on ne demande.
 * L'ambre : la ligne de l'organisation sans personne la plus lourde.
 * Le rouge : le repère critique sur la jauge de posture, une fois.
 */

type Filtre = 'toutes' | 'humain' | 'personne' | 'moi' | 'critique' | 'groupes';
const PLATEAU_MONTRE = 2;

export function SupervisorGrille() {
  const m = useSupervisor();
  const cyber = useCyber();
  const src = useSourceBureaux();
  const releves = useReleves();
  const { user } = useAuth();
  const moi = user?.email?.toLowerCase() ?? '';
  const [filtre, setFiltre] = useState<Filtre>('humain');
  const [q, setQ] = useState('');
  const [plateauOuvert, setPlateauOuvert] = useState(false);
  const [ligneOuverte, setLigneOuverte] = useState(false);

  const scores = useMemo(() => new Map(cyber.orgs.map((o) => [o.id, o])), [cyber.orgs]);
  const filtres: Record<Filtre, (o: OrgPoints) => boolean> = {
    toutes: () => true,
    humain: (o) => o.poids > 0 && o.suivi.type !== 'garde',
    personne: (o) => o.poids > 0 && o.suivi.type === 'personne',
    moi: (o) => o.suivi.type === 'humain' && o.suivi.email.toLowerCase() === moi,
    critique: (o) => o.points.critique > 0,
    groupes: (o) => Boolean(m.dossiers.get(o.id)?.groupe),
  };
  const compte = (f: Filtre) => m.orgs.filter(filtres[f]).length;
  const plie = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const liste = m.orgs.filter(filtres[filtre]).filter((o) => !q.trim() || plie(o.nom).includes(plie(q.trim())));
  const h = calculer(liste);
  const tours = (h.tours ?? liste.filter((o) => o.points.critique > 0 || o.suivi.type === 'personne')).slice();
  const plateau = h.plateau;
  const ligne = h.ligne;
  const maxPoids = Math.max(1, ...m.orgs.map((o) => o.poids));
  const n = m.orgs.length;

  const dispo = (id: string) => serie(releves, 30, 1, (r) => (r.orgs[id] ? !r.orgs[id].enPanne : null), m.maintenant);

  const ligneOrg = (o: OrgPoints) => (
    <LigneOrg
      key={o.id}
      o={o}
      max={maxPoids}
      ambre={m.ambre?.id === o.id}
      rouge={m.rouge?.id === o.id}
      groupe={m.dossiers.get(o.id)?.groupe ?? null}
      score={scores.get(o.id)?.score ?? null}
      dispo={dispo(o.id)}
      demandes={src.supports.filter((s) => s.orgId === o.id && s.kind === 'message' && s.status === 'pending').length + src.modulesDemandes.filter((d) => d.orgId === o.id && d.status === 'pending').length}
      placesDemandees={src.supports.filter((s) => s.orgId === o.id && s.kind === 'seat' && s.status === 'pending').length}
      garde={(src.accueil?.pile.dossiers ?? []).filter((d) => d.orgId === o.id).length}
      maintenant={m.maintenant}
    />
  );

  if (!m.pret) {
    return (
      <>
        <EnTete surtitre="Supervisor · Mur de situation · vue grille" titre="La grille se remplit." />
        <Carte dominante>
          <Chargement texte="Pesée des organisations" compte={src.organisations.length ? { n: 0, sur: src.organisations.length } : null} />
        </Carte>
      </>
    );
  }

  return (
    <EcranVide quand={n === 0} premierJour={n === 0}>
      <EnTete surtitre="Supervisor · Mur de situation · vue grille" titre={`${n <= 20 ? enLettres(n, true) : n} organisation${n > 1 ? 's' : ''}, les plus demandeuses d’abord.`} />
      <Carte dominante pad="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <BasculeVue vue="grille" />
          {(
            [
              ['toutes', 'Toutes'],
              ['humain', 'Demandent un humain'],
              ['personne', 'Sans personne'],
              ['moi', 'Suivies par moi'],
              ['critique', 'Au critique'],
              ['groupes', 'Groupes'],
            ] as [Filtre, string][]
          ).map(([f, l]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtre === f}
              onClick={() => setFiltre(f)}
              className="flex h-8 items-center gap-2 border px-3 text-[12.5px] font-semibold"
              style={{ borderColor: filtre === f ? '#8a8a87' : '#2b2b2b', color: filtre === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', background: filtre === f ? '#1a1a1a' : 'transparent' }}
            >
              {l}
              {compte(f) > 0 && <span className="font-mono text-[10.5px] font-medium text-text-secondary">{compte(f)}</span>}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher une organisation…"
            aria-label="Chercher une organisation"
            className="ml-auto h-8 w-[240px] border border-[#2b2b2b] bg-transparent px-3 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#252525] font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                <th className="py-3 pl-2.5 font-normal">Poids</th>
                <th className="py-3 font-normal">Organisation</th>
                <th className="py-3 font-normal">Suivi</th>
                <th className="py-3 font-normal">Posture</th>
                <th className="py-3 font-normal">Dispo · 30 j</th>
                <th className="py-3 font-normal">Demandes</th>
                <th className="py-3 font-normal">Places</th>
                <th className="py-3 font-normal">Desktop</th>
                <th className="py-3 pr-2.5 font-normal">Garde</th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[13px] text-text-secondary">
                    {q ? 'Aucune organisation de ce nom dans ce filtre.' : 'Aucune organisation dans ce filtre.'}
                  </td>
                </tr>
              )}
              {tours.map(ligneOrg)}
              {plateau.length > 0 && (
                <tr>
                  <td colSpan={9} className="pb-1 pl-2.5 pt-4 font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                    Le plateau · {plateau.length}
                  </td>
                </tr>
              )}
              {(plateauOuvert ? plateau : plateau.slice(0, PLATEAU_MONTRE)).map(ligneOrg)}
              {!plateauOuvert && plateau.length > PLATEAU_MONTRE && (
                <Repli onClick={() => setPlateauOuvert(true)} titre={`${plateau.length - PLATEAU_MONTRE} autres avec ${Math.min(...plateau.slice(PLATEAU_MONTRE).map((o) => o.poids))} à ${Math.max(...plateau.slice(PLATEAU_MONTRE).map((o) => o.poids))} points`} n={plateau.length - PLATEAU_MONTRE} note="triées par poids" />
              )}
              {ligne.length > 0 && !ligneOuverte && <Repli onClick={() => setLigneOuverte(true)} titre="La ligne d’horizon" n={ligne.length} note="sans rien à traiter · la Garde les tient" />}
              {ligneOuverte && ligne.map(ligneOrg)}
            </tbody>
          </table>
        </div>
      </Carte>
    </EcranVide>
  );
}

function Repli({ onClick, titre, n, note }: { onClick: () => void; titre: string; n: number; note: string }) {
  return (
    <tr className="border-t border-border bg-[#0f0f0f]">
      <td colSpan={9}>
        <button type="button" onClick={onClick} className="flex h-11 w-full items-center gap-3 px-2.5 text-left hover:bg-white/[0.02]">
          <ChevronRight size={14} className="text-text-secondary" aria-hidden />
          <span className="text-[13.5px] font-semibold text-text-primary">{titre}</span>
          <span className="font-mono text-[11px] text-text-secondary">{n}</span>
          <span className="text-[12px] text-text-muted">{note}</span>
        </button>
      </td>
    </tr>
  );
}

function LigneOrg({
  o,
  max,
  ambre,
  rouge,
  groupe,
  score,
  dispo,
  demandes,
  placesDemandees,
  garde,
  maintenant,
}: {
  o: OrgPoints;
  max: number;
  ambre: boolean;
  rouge: boolean;
  groupe: string | null;
  score: number | null;
  dispo: (boolean | null)[];
  demandes: number;
  placesDemandees: number;
  garde: number;
  maintenant: number;
}) {
  const places = o.org.formula?.seats ?? o.org.seats ?? null;
  const desktop = o.org.lastActivityAt
    ? maintenant - Date.parse(o.org.lastActivityAt) > 7 * 86_400_000
      ? `${Math.round((maintenant - Date.parse(o.org.lastActivityAt)) / 86_400_000)} j sans ouverture`
      : ilYA(o.org.lastActivityAt, maintenant)
    : o.points.arrivee
      ? 'arrivée, pas encore activée'
      : 'jamais ouvert';
  const qui = o.suivi.type === 'humain' ? o.suivi.email : null;
  return (
    <tr
      className="h-11 border-b border-[#1a1a1a] hover:bg-white/[0.02]"
      style={ambre ? { background: 'rgba(208,154,74,.06)', boxShadow: `inset 2px 0 0 ${AMBRE}` } : undefined}
      data-signal-groupe={ambre ? 'grille-ambre' : undefined}
    >
      <td className="pl-2.5">
        <span className="flex items-center gap-2.5">
          <span className="relative h-[3px] w-[34px] bg-[#2b2b2b]" aria-hidden>
            <span className="absolute inset-y-0 left-0" style={{ width: `${Math.max(o.poids ? 6 : 0, (o.poids / max) * 100)}%`, background: ambre ? AMBRE : '#8a8a87' }} />
          </span>
          <span className="w-6 font-mono text-[12px] font-semibold tabular-nums" style={{ color: ambre ? AMBRE : 'var(--color-text-body)' }}>{o.poids}</span>
        </span>
      </td>
      <td className="max-w-[220px] py-1.5">
        <Link to={`/supervisor/dossiers/${o.id}`} className="block truncate text-[13.5px] font-semibold text-text-primary hover:underline">
          {o.nom}
        </Link>
        {groupe && <span className="block truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Groupe {groupe}</span>}
      </td>
      <td>
        <span className="flex items-center gap-2">
          {qui && <UserAvatar email={qui} size={18} />}
          <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em]" style={{ color: ambre ? AMBRE : 'var(--color-text-secondary)' }}>{libelleSuivi(o)}</span>
        </span>
      </td>
      <td>
        {score === null ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="flex items-center gap-2.5">
            <span className="w-6 font-mono text-[12px] font-semibold tabular-nums text-text-primary">{score}</span>
            <span className="relative h-[3px] w-[60px] bg-[#2b2b2b]" aria-hidden>
              <span className="absolute inset-y-0 left-0 bg-[#8a8a87]" style={{ width: `${score}%` }} />
              {rouge && <span className="absolute -top-[5px] h-[13px] w-[3px] -translate-x-1/2" style={{ left: `${score}%`, background: ROUGE.trait }} />}
            </span>
          </span>
        )}
      </td>
      <td>
        {dispo.every((d) => d === null) ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="flex h-[14px] items-end gap-px" aria-label={`${dispo.filter((d) => d === false).length} jour(s) de panne sur 30`}>
            {dispo.map((d, i) => (
              <span key={i} className="w-[2px]" style={{ height: d === false ? 4 : 14, background: d === null ? 'var(--color-border)' : d ? 'var(--color-trait-sourd)' : 'var(--color-border-strong)' }} />
            ))}
          </span>
        )}
      </td>
      <td className="font-mono text-[12px] tabular-nums" style={{ color: demandes ? 'var(--color-text-body)' : 'var(--color-text-muted)' }}>{demandes || '—'}</td>
      <td className="whitespace-nowrap font-mono text-[12px] tabular-nums text-text-body">
        {o.org.userCount} / {places ?? '∞'}
        {placesDemandees > 0 && <span className="text-text-secondary"> · +{placesDemandees} demande{placesDemandees > 1 ? 's' : ''}</span>}
      </td>
      <td className="max-w-[170px] truncate text-[12px] text-text-secondary">{desktop}</td>
      <td className="pr-2.5 font-mono text-[12px] text-text-secondary">{garde ? `${garde} ouv.` : '—'}</td>
    </tr>
  );
}

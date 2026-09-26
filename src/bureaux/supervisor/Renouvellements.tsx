import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { stripMeta, useCollection, useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import type { DossierOrg } from '../donnees/types';
import { Carte, Chargement, EnTete, Invitation } from '../ui/kit';
import { jourMois } from '../format';

/**
 * SUPERVISOR · LES RENOUVELLEMENTS DU PARC (cahier 15, `51c` · 04).
 *
 * Les contrats qui arrivent à échéance dans les 120 jours, triés par ce
 * qu'ils rapportent. Le contrat vit au dossier interne de chaque cliente
 * (`orgDossier.contrat`) : son échéance, son montant annuel, et s'il se
 * reconduit seul ou doit être confirmé.
 *
 * L'ambre : le plus gros contrat à confirmer dans les trente jours — c'est
 * le seul qui partira si personne ne décroche le téléphone.
 */

const HORIZON_J = 120;
const eur = (n: number) => `${n.toLocaleString('fr-FR')} €`;

export function SupervisorRenouvellements() {
  const m = useSupervisor();
  const { user } = useAuth();
  const { upsert } = useSync();
  const brutes = useCollection<DossierOrg>('orgDossier');
  const [pose, setPose] = useState<{ orgId: string; echeance: string; montant: string; reconduction: 'tacite' | 'a_confirmer' } | null>(null);

  if (!m.pret) {
    return (
      <>
        <EnTete surtitre="Supervisor · Renouvellements du parc" titre="Les contrats se relisent." />
        <Chargement texte="Lecture des dossiers" />
      </>
    );
  }
  const jours = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00`) - m.maintenant) / 86_400_000);
  const contrats = m.orgs
    .map((o) => ({ o, c: m.dossiers.get(o.id)?.contrat ?? null }))
    .filter((x): x is { o: (typeof m.orgs)[number]; c: NonNullable<DossierOrg['contrat']> } => Boolean(x.c?.echeance))
    .map((x) => ({ ...x, j: jours(x.c.echeance) }));
  const aVenir = contrats.filter((x) => x.j >= -7 && x.j <= HORIZON_J).sort((a, b) => b.c.montantAnnuel - a.c.montantAnnuel);
  const ambre = aVenir.filter((x) => x.j <= 30 && x.c.reconduction === 'a_confirmer').sort((a, b) => b.c.montantAnnuel - a.c.montantAnnuel)[0] ?? null;
  const sansContrat = m.orgs.filter((o) => !m.dossiers.get(o.id)?.contrat && o.statut !== 'suspended' && o.org.plan !== 'internal');
  const total = aVenir.reduce((t, x) => t + x.c.montantAnnuel, 0);

  const ecrire = (orgId: string, contrat: DossierOrg['contrat']) => {
    const brute = brutes.find((d) => d.id === orgId);
    void upsert('orgDossier', orgId, { ...(brute ? stripMeta(brute) : {}), contrat, updatedBy: user?.email ?? '' });
  };
  const reconduire = (orgId: string, c: NonNullable<DossierOrg['contrat']>) => {
    const d = new Date(`${c.echeance}T12:00:00`);
    d.setFullYear(d.getFullYear() + 1);
    ecrire(orgId, { ...c, echeance: d.toISOString().slice(0, 10), reconduitLe: new Date().toISOString() });
  };

  const titre = !contrats.length
    ? 'Aucun contrat n’est encore au dossier.'
    : ambre
      ? `${ambre.o.nom} : ${eur(ambre.c.montantAnnuel)} à confirmer d’ici ${ambre.j <= 0 ? 'aujourd’hui' : `${ambre.j} jour${ambre.j > 1 ? 's' : ''}`}.`
      : aVenir.length
        ? `${aVenir.length} contrat${aVenir.length > 1 ? 's' : ''} arrive${aVenir.length > 1 ? 'nt' : ''} à échéance, rien à confirmer ce mois-ci.`
        : `Aucun contrat n’arrive à échéance dans les ${HORIZON_J} jours.`;

  return (
    <>
      <EnTete surtitre="Supervisor · Dossiers clients · Renouvellements" titre={titre} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <Carte dominante pad="p-6" titre={`Les échéances · ${HORIZON_J} jours`} droite={aVenir.length ? `${eur(total)} par an en jeu` : ''}>
          {aVenir.length === 0 ? (
            <Invitation titre="Rien n’arrive à échéance." texte="Les contrats se notent au dossier de chaque cliente : leur échéance, leur montant annuel, et s’ils se reconduisent seuls." />
          ) : (
            aVenir.map((x) => {
              const estAmbre = ambre?.o.id === x.o.id;
              const largeur = Math.max(4, (x.c.montantAnnuel / aVenir[0].c.montantAnnuel) * 100);
              return (
                <div key={x.o.id} className="grid grid-cols-[170px_minmax(0,1fr)_120px] items-center gap-4 border-b border-border py-3" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 10, background: 'rgba(208,154,74,.05)' } : undefined} data-signal-groupe={estAmbre ? 'renouvellement-ambre' : undefined}>
                  <Link to={`/supervisor/dossiers/${x.o.id}`} className="min-w-0 hover:underline">
                    <span className="block truncate text-[13.5px] font-semibold text-text-primary">{x.o.nom}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: estAmbre ? AMBRE : 'var(--color-text-muted)' }}>
                      {x.c.reconduction === 'tacite' ? 'reconduction tacite' : 'à confirmer'}
                    </span>
                  </Link>
                  <span className="h-[8px] bg-[#1c1c1c]" aria-hidden>
                    <span className="block h-full" style={{ width: `${largeur}%`, background: estAmbre ? AMBRE : 'var(--color-trait-sourd)' }} />
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-[12px] tabular-nums text-text-primary">{eur(x.c.montantAnnuel)}</span>
                    <span className="block font-mono text-[10px] tabular-nums text-text-muted">{x.j < 0 ? `échu depuis ${-x.j} j` : x.j === 0 ? 'aujourd’hui' : `le ${jourMois(x.c.echeance)}`}</span>
                  </span>
                </div>
              );
            })
          )}
        </Carte>
        <div className="flex flex-col gap-[18px] self-start">
          {ambre && (
            <Carte titre={ambre.o.nom} droite={`${eur(ambre.c.montantAnnuel)} par an`}>
              <p className="text-[13.5px] leading-relaxed text-text-body">Le contrat s’arrête le {jourMois(ambre.c.echeance)} s’il n’est pas confirmé. {m.dossiers.get(ambre.o.id)?.contact?.nom ? `Le contact : ${m.dossiers.get(ambre.o.id)!.contact!.nom}.` : ''}</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button type="button" className="bx-btn2" onClick={() => reconduire(ambre.o.id, ambre.c)}>
                  Confirmé, reconduit un an
                </button>
                <Link to={`/supervisor/dossiers/${ambre.o.id}`} className="bx-btn2">
                  Le dossier
                </Link>
              </div>
            </Carte>
          )}
          <Carte titre="Poser un contrat" droite={sansContrat.length ? `${sansContrat.length} sans contrat` : ''}>
            {pose ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const montant = Number(pose.montant.replace(/\s/g, '').replace(',', '.'));
                  if (!pose.orgId || !pose.echeance || !(montant > 0)) return;
                  ecrire(pose.orgId, { echeance: pose.echeance, montantAnnuel: Math.round(montant), reconduction: pose.reconduction });
                  setPose(null);
                }}
              >
                <select value={pose.orgId} onChange={(e) => setPose({ ...pose, orgId: e.target.value })} aria-label="La cliente" className="h-9 border border-[#2b2b2b] bg-[#111] px-2 text-[13px] text-text-primary">
                  <option value="">La cliente…</option>
                  {m.orgs.filter((o) => o.org.plan !== 'internal').map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nom}
                    </option>
                  ))}
                </select>
                <input type="date" value={pose.echeance} onChange={(e) => setPose({ ...pose, echeance: e.target.value })} aria-label="Échéance" className="h-9 border border-[#2b2b2b] bg-transparent px-2 text-[13px] text-text-primary [color-scheme:dark]" />
                <input value={pose.montant} onChange={(e) => setPose({ ...pose, montant: e.target.value })} inputMode="decimal" placeholder="montant annuel (€)" aria-label="Montant annuel" className="h-9 border border-[#2b2b2b] bg-transparent px-2 font-mono text-[13px] text-text-primary placeholder:text-text-muted" />
                <select value={pose.reconduction} onChange={(e) => setPose({ ...pose, reconduction: e.target.value as 'tacite' | 'a_confirmer' })} aria-label="Reconduction" className="h-9 border border-[#2b2b2b] bg-[#111] px-2 text-[13px] text-text-primary">
                  <option value="a_confirmer">à confirmer</option>
                  <option value="tacite">tacite</option>
                </select>
                <button type="submit" className="bx-btn">
                  Poser
                </button>
              </form>
            ) : (
              <button type="button" className="bx-btn2" onClick={() => setPose({ orgId: sansContrat[0]?.id ?? '', echeance: '', montant: '', reconduction: 'a_confirmer' })}>
                Noter un contrat
              </button>
            )}
          </Carte>
        </div>
      </div>
    </>
  );
}

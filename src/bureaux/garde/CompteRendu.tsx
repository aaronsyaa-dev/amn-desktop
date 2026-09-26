import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { garde, nomDeCleDeGarde } from '../../lib/garde';
import type { GardeAgent, GardeDefinitionAgent, GardeDossier, GardeJournalEntree } from '../../shared/garde';
import { AMBRE, ROUGE } from '../jetons';
import { useGardeBureau } from '../donnees/gardeBureau';
import { useSourceBureaux } from '../donnees/source';
import { Carte, Chargement, EnTete, Invitation } from '../ui/kit';
import { hhmm, jourCourt } from '../format';

/**
 * LA GARDE · LE COMPTE RENDU D'UN CHEF — pourquoi j'ai fait ça (cahier 14,
 * `50a`).
 *
 * Un chef ne dit pas seulement ce qu'il a fait : il déroule son raisonnement
 * dans l'ordre — ce qu'il a vu, la règle qui s'applique, ce qu'il a fait, et
 * pourquoi il écrit à un humain. Chaque affirmation a sa preuve, en lignes de
 * journal. Tout vient du dossier de la pile et du journal de la Garde : rien
 * n'est rédigé par un modèle (« déterministe · aucun modèle »).
 *
 * L'ambre : la raison d'écrire et la question posée — une seule région, la
 * fin du raisonnement. Ouvrir un compte rendu le marque lu (`suivis`,
 * `lu:<dossier>`), pour les deux postes.
 */

type Regle = { cle: string; description: string; parametres: Record<string, unknown> };
const capitale = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const sansPoint = (s: string) => s.trim().replace(/[.\s]+$/, '');
const valeur = (v: unknown) => (typeof v === 'number' && v >= 3_600_000 && v % 3_600_000 === 0 ? `${v / 3_600_000} h` : typeof v === 'number' && v >= 60_000 && v % 60_000 === 0 ? `${v / 60_000} min` : String(v));

export function GardeCompteRendu() {
  const { id } = useParams();
  const g = useGardeBureau();
  const src = useSourceBureaux();
  const connus = new Set((src.salle?.agents ?? []).map((a) => a.key));
  const { user } = useAuth();
  const { upsert } = useSync();
  const suivis = useCollection<{ par?: string }>('suivis');
  const [etat, setEtat] = useState<{ d: GardeDossier | null; journal: GardeJournalEntree[]; regle: Regle | null; agent: (GardeAgent & { definition?: Pick<GardeDefinitionAgent, 'regles'> | null }) | null } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tranche, setTranche] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    // La Salle d'abord : elle dit quelles gardes existent encore.
    if (!src.pret) return;
    let vivant = true;
    setEtat(null);
    setTranche(null);
    (async () => {
      try {
        const pile = await garde.pile(100);
        const d = pile.dossiers.find((x) => x.id === id) ?? null;
        if (!d) {
          if (vivant) setEtat({ d: null, journal: [], regle: null, agent: null });
          return;
        }
        const depuis = new Date(Date.parse(d.depuis) - 3 * 86_400_000).toISOString();
        const [parAgent, fiche] = await Promise.all([
          garde.journal({ agent: d.agent, ...(d.orgId ? { org: d.orgId } : {}), since: depuis, limit: 80 }).catch(() => [] as GardeJournalEntree[]),
          // Une garde renommée ou retirée depuis : on ne la demande pas au serveur, son nom se lit dans sa clé.
          connus.size === 0 || connus.has(d.agent) ? garde.agent(d.agent).catch(() => null) : Promise.resolve(null),
        ]);
        // Rien sous ce nom de garde : les lignes de son équipe chez la même organisation.
        const journal = parAgent.length || !d.orgId ? parAgent : await garde.journal({ equipe: d.equipe, org: d.orgId, since: depuis, limit: 80 }).catch(() => [] as GardeJournalEntree[]);
        const remonte = journal.find((e) => e.resultat === 'remonte' && e.regle) ?? journal.find((e) => e.regle) ?? null;
        const cle = remonte?.regle?.split(':').pop() ?? null;
        const def = cle ? fiche?.definition?.regles?.[cle] : null;
        const regle = cle && def ? { cle: remonte!.regle!, description: def.description, parametres: { ...def.parametres, ...((fiche?.agent.parametres?.[cle] as Record<string, unknown> | undefined) ?? {}) } } : null;
        if (vivant) setEtat({ d, journal, regle, agent: fiche ? { ...fiche.agent, definition: fiche.definition } : null });
      } catch (e) {
        if (vivant) setErreur(e instanceof Error ? e.message : 'La Garde n’a pas répondu.');
      }
    })();
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, src.pret]);

  // Ouvrir le compte rendu, c'est l'avoir lu.
  useEffect(() => {
    if (etat?.d && user?.email && !suivis.some((s) => s.id === `lu:${etat.d!.id}`)) {
      void upsert('suivis', `lu:${etat.d.id}`, { par: user.email, at: new Date().toISOString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat?.d?.id, user?.email]);

  const chef = g.chefs.find((c) => c.key === etat?.d?.equipe) ?? null;
  const autres = g.comptesRendus.filter((x) => x.id !== id).slice(0, 6);
  const lu = (x: GardeDossier) => Boolean(x.prisPar) || suivis.some((s) => s.id === `lu:${x.id}`);

  if (erreur) {
    return (
      <>
        <EnTete surtitre="La Garde · compte rendu" titre="La Garde n’a pas répondu." lede={erreur} />
        <Link to="/garde/organigramme" className="bx-lien">
          Revenir à l’organigramme
        </Link>
      </>
    );
  }
  if (!etat) {
    return (
      <>
        <EnTete surtitre="La Garde · compte rendu" titre="Le chef rassemble ses preuves." />
        <Chargement texte="Lecture du dossier et du journal" />
      </>
    );
  }
  const d = etat.d;
  if (!d) {
    return (
      <>
        <EnTete surtitre="La Garde · compte rendu" titre="Ce compte rendu n’attend plus personne." lede="Le dossier a été tranché ou s’est résolu seul depuis ; le journal de la Garde en garde la trace." />
        <Link to="/garde/organigramme" className="bx-lien">
          Revenir à l’organigramme
        </Link>
      </>
    );
  }

  const agentNom = etat.agent?.nom ?? src.salle?.agents.find((a) => a.key === d.agent)?.nom ?? nomDeCleDeGarde(d.agent);
  const faits = etat.journal.filter((e) => e.resultat === 'regle' && e.createdAt >= d.depuis).slice(0, 3);
  const preuves = [...etat.journal].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-6);
  const question = d.options.length > 1 ? `${capitale(d.options.slice(0, -1).join(', '))}, ou ${d.options[d.options.length - 1]} ?` : d.options.length === 1 ? `${capitale(d.options[0])} ?` : `Que faire${d.orgNom ? ` pour ${d.orgNom}` : ''} ?`;
  const critique = d.gravite === 'critique';
  const decider = async (option: string) => {
    setEnvoi(true);
    try {
      await garde.deciderDossier(d.id, option);
      setTranche(option);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'La décision n’est pas partie.');
    } finally {
      setEnvoi(false);
    }
  };
  const titre = tranche ? `Tranché : ${tranche}.` : d.sansRecommandation || !d.recommandation ? 'Aucune règle ne tranche. Le chef vous demande.' : 'Le chef a une recommandation. Il attend votre accord.';
  const etapes: { cle: string; titre: string; detail: string; ambre?: boolean }[] = [
    { cle: 'Ce que j’ai vu', titre: sansPoint(capitale(d.titre)), detail: `La garde ${agentNom} l’a relevé à sa ronde de ${hhmm(d.depuis)}${d.vues > 1 ? `, et ${d.vues - 1} fois depuis` : ''}.` },
    etat.regle
      ? { cle: 'La règle', titre: sansPoint(capitale(etat.regle.description)), detail: [etat.regle.cle, ...Object.entries(etat.regle.parametres).slice(0, 2).map(([k, v]) => `${k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} ${valeur(v)}`)].join(' · ') }
      : { cle: 'La règle', titre: 'Aucune règle ne couvre ce cas', detail: `${d.famille} · le chef remonte ce qu’il ne sait pas régler seul` },
    faits.length
      ? { cle: 'Ce que j’ai fait', titre: sansPoint(capitale(faits[0].pourquoi || faits[0].action)), detail: faits.length > 1 ? `Puis : ${faits.slice(1).map((f) => f.pourquoi || f.action).join(' ; ')}.` : 'Le reste attend votre décision.' }
      : { cle: 'Ce que j’ai fait', titre: 'Rien encore : je n’agis pas sans vous', detail: d.recommandation ? `Ma recommandation : ${sansPoint(d.recommandation)}.` : 'Je n’ai pas de recommandation à vous faire.' },
    { cle: 'Pourquoi je vous écris', titre: d.contexte ? sansPoint(capitale(d.contexte.split(/(?<=[.;])\s/)[0])) : 'La règle me demande de remonter ce cas', detail: d.sansRecommandation ? 'Je ne tranche pas entre les options.' : `${d.n > 1 ? `${d.n} remontées` : 'Une remontée'}${d.orgNom ? ` chez ${d.orgNom}` : ''}, depuis ${jourCourt(d.depuis).toLowerCase()} ${hhmm(d.depuis)}.`, ambre: true },
  ];

  return (
    <>
      <EnTete surtitre={`La Garde · ${chef?.titre ?? 'un chef'} · compte rendu`} titre={titre} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <Carte dominante pad="p-6" className="self-start" titre={`Compte rendu · ${chef?.titre ?? d.equipe} · ${jourCourt(d.depuis).toLowerCase()} ${hhmm(d.depuis)}`} droite={<span className="flex items-center gap-3">{critique && <span className="font-bold" style={{ color: ROUGE.texte }}>Critique</span>}déterministe · aucun modèle</span>}>
          <div data-signal-groupe={tranche ? undefined : 'compte-rendu'}>
            {etapes.map((e) => (
              <div key={e.cle} className="grid grid-cols-[120px_minmax(0,1fr)] gap-5 border-b border-[#1d1d1d] py-4">
                <span className="font-mono text-[9.5px] font-medium uppercase leading-[1.8] tracking-[0.14em]" style={{ color: e.ambre && !tranche ? AMBRE : 'var(--color-text-muted)' }}>
                  {e.cle}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold leading-snug text-text-primary">{e.titre}</span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-text-secondary">{e.detail}</span>
                </span>
              </div>
            ))}
          </div>
          <span className="mt-5 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">Les preuves</span>
          <div className="mt-2 border border-border-raised bg-sunken px-4 py-3 font-mono text-[11.5px] leading-[1.9] text-text-body">
            {preuves.length === 0 ? (
              <span className="text-text-secondary">Aucune ligne de journal pour ce dossier : la remontée seule en garde la trace.</span>
            ) : (
              preuves.map((e) => (
                <span key={e.id} className="block truncate">
                  {e.createdAt.slice(8, 10)}/{e.createdAt.slice(5, 7)} {hhmm(e.createdAt)} · {e.action}
                  {e.ressource ? ` · ${e.ressource}` : ''} · {e.pourquoi || e.resultat}
                </span>
              ))
            )}
          </div>
          {tranche ? (
            <div className="mt-5 border border-border-raised px-4 py-3.5">
              <span className="block text-[14px] font-semibold text-text-primary">Décision transmise au chef : {tranche}.</span>
              <span className="mt-1 block text-[12.5px] text-text-secondary">Elle est au journal, et le dossier quitte la pile.</span>
            </div>
          ) : (
            <>
              <div className="mt-5 px-4 py-3.5" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.07)', boxShadow: '0 0 30px -14px rgba(208,154,74,.6)' }} data-signal-groupe="compte-rendu">
                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBRE }}>
                  La question à l’humain
                </span>
                <span className="mt-1.5 block text-[15px] font-semibold text-text-primary">{question}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {d.options.map((o, i) => (
                  <button key={o} type="button" disabled={envoi} className={i === 0 ? 'bx-btn' : 'bx-btn2'} onClick={() => void decider(o)}>
                    {capitale(o)}
                  </button>
                ))}
                <Link to={`/garde/bureaux/${encodeURIComponent(d.equipe)}`} className="bx-btn2">
                  Changer la règle
                </Link>
              </div>
            </>
          )}
        </Carte>

        <Carte className="self-start" titre="Les autres comptes rendus" droite="en attente">
          {autres.length === 0 ? (
            <p className="text-[13px] text-text-secondary">Aucun autre compte rendu n’attend.</p>
          ) : (
            autres.map((x) => (
              <Link key={x.id} to={`/garde/compte-rendu/${encodeURIComponent(x.id)}`} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[#1d1d1d] py-3 hover:bg-white/[0.02]">
                <span className="font-mono text-[10.5px] uppercase text-text-muted">{jourCourt(x.depuis).split(' ')[0]}</span>
                <span className="text-[13px] leading-snug text-text-body">
                  {g.chefs.find((c) => c.key === x.equipe)?.nom ?? x.equipe} · {sansPoint(x.titre)}
                </span>
                <span className="font-mono text-[10px] uppercase text-text-muted">{lu(x) ? 'lu' : 'à lire'}</span>
              </Link>
            ))
          )}
          {g.comptesRendus.length === 0 && !g.pret && <Invitation titre="La pile se lit." texte="Les comptes rendus arrivent avec elle." />}
        </Carte>
      </div>
    </>
  );
}

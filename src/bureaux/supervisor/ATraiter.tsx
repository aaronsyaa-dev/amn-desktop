import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSync } from '../../state/SyncContext';
import { bridge } from '../../lib/bridge';
import { garde } from '../../lib/garde';
import { AMBRE, ROUGE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { useSourceBureaux } from '../donnees/source';
import { DELAI_PROMIS_MS, LIBELLE_TYPE, texteReste, type ElementFile, type TypeFile } from '../donnees/file';
import { Carte, Chargement, EnTete, Stat } from '../ui/kit';
import { UserAvatar } from '../../components/UserAvatar';
import { deNom, duree, ilYA, prenomDe } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * SUPERVISOR · À TRAITER — les mèches (cahier 12, `46c`).
 *
 * Tout ce qui attend un humain, d'où que ça vienne. Chaque élément porte une
 * mèche de 150 px : sa longueur est le délai promis pour son type, la partie
 * brûlée en pointillé, la partie restante en trait plein, l'étincelle au
 * point de combustion. La file se trie par TEMPS RESTANT, jamais par date
 * d'arrivée. L'ambre : la mèche et le « reste » du premier délai qui tombera
 * sans personne. Le rouge : l'étiquette CRITIQUE ; un critique pris garde une
 * mèche grise.
 */

const MECHE = 150;
const MONTRES = 8;
const PLACES = [1, 2, 5, 10, 25];

type Onglet = 'tout' | 'demande' | 'jeton' | 'incident' | 'alerte' | 'arrivee';
const ONGLETS: [Onglet, string, TypeFile[]][] = [
  ['tout', 'Tout', []],
  ['demande', 'Demandes', ['demande']],
  ['jeton', 'Jetons', ['jeton']],
  ['incident', 'Incidents', ['incident', 'critique']],
  ['alerte', 'Alertes', ['alerte']],
  ['arrivee', 'Arrivées', ['arrivee']],
];

export function SupervisorATraiter() {
  const m = useSupervisor();
  const src = useSourceBureaux();
  const [onglet, setOnglet] = useState<Onglet>('tout');
  const [tout, setTout] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(null);
  const liste = m.file.filter((x) => onglet === 'tout' || ONGLETS.find((o) => o[0] === onglet)![2].includes(x.type));
  const montres = tout ? liste : liste.slice(0, MONTRES);
  const reste = liste.slice(montres.length);
  const ambre = m.fileAmbre;
  const courant = liste.find((x) => x.cle === choisi) ?? ambre ?? liste[0] ?? null;
  useEffect(() => {
    if (choisi && !m.file.some((x) => x.cle === choisi)) setChoisi(null);
  }, [m.file, choisi]);

  const titre = ambre
    ? `${ambre.type === 'jeton' ? 'Le jeton' : ambre.type === 'demande' ? 'La demande' : ambre.type === 'arrivee' ? 'L’arrivée' : ambre.type === 'alerte' ? 'L’alerte' : ambre.type === 'incident' ? 'L’incident' : 'Le critique'} ${deNom(ambre.orgNom)} ${ambre.resteMs >= 0 ? `tombe dans ${duree(ambre.resteMs).replace(' min', ' minutes')}` : `a dépassé son délai de ${duree(ambre.resteMs)}`}.`
    : m.file.length
      ? 'Tout ce qui attend a quelqu’un.'
      : 'Rien n’attend un humain.';

  if (!m.pret) {
    return (
      <>
        <EnTete surtitre="Supervisor · À traiter" titre="La file se remplit." />
        <Carte dominante>
          <Chargement texte="Lecture des demandes, incidents et alertes" />
        </Carte>
      </>
    );
  }
  return (
    <EcranVide quand={m.file.length === 0} premierJour={false}>
      <EnTete surtitre={`Supervisor · À traiter${m.file.length ? ` · ${m.file.length}` : ''}`} titre={titre} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Carte dominante pad="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {ONGLETS.map(([cle, nom, types]) => {
              const n = cle === 'tout' ? m.file.length : m.file.filter((x) => types.includes(x.type)).length;
              return (
                <button key={cle} type="button" aria-pressed={onglet === cle} onClick={() => setOnglet(cle)} className="flex h-8 items-center gap-2 border px-3 text-[12.5px] font-semibold" style={{ borderColor: onglet === cle ? '#8a8a87' : '#2b2b2b', color: onglet === cle ? '#f7f7f5' : '#a3a3a0' }}>
                  {nom}
                  {n > 0 && <span className="font-mono text-[10.5px] font-medium text-[#a3a3a0]">{n}</span>}
                </button>
              );
            })}
            <span className="ml-2 max-w-[140px] font-mono text-[9.5px] uppercase leading-snug tracking-[0.14em] text-[#9a9a97]">Triée par temps restant</span>
          </div>
          {liste.length === 0 ? (
            <p className="py-8 text-[13px] text-[#a3a3a0]">Rien de ce type n’attend.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#252525] font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9a9a97]">
                  <th className="py-2.5 pl-3 font-normal">Type</th>
                  <th className="py-2.5 font-normal">Organisation</th>
                  <th className="py-2.5 font-normal">La mèche</th>
                  <th className="py-2.5 font-normal">Qui</th>
                </tr>
              </thead>
              <tbody>
                {montres.map((x) => (
                  <LigneFile key={x.cle} x={x} ambre={ambre?.cle === x.cle} choisi={courant?.cle === x.cle} onChoisir={() => setChoisi(x.cle)} />
                ))}
              </tbody>
            </table>
          )}
          {reste.length > 0 && (
            <button type="button" onClick={() => setTout(true)} className="mt-3 text-[12px] text-[#a3a3a0] hover:text-[#f7f7f5]">
              + {reste.length} élément{reste.length > 1 ? 's' : ''} plus loin dans la file · {resume(reste)}
            </button>
          )}
        </Carte>
        {courant && <Detail x={courant} ambre={ambre?.cle === courant.cle} relire={() => void src.recharger()} />}
      </div>
      <div className="mt-[18px]">
        <Carte titre="Les délais · ce que la mèche mesure" droite="la mèche brûle de gauche à droite">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {(['critique', 'jeton', 'incident', 'alerte', 'demande', 'arrivee'] as TypeFile[]).map((t) => (
              <Stat key={t} l={t === 'jeton' ? 'Jeton de places' : LIBELLE_TYPE[t].toLowerCase()} v={duree(DELAI_PROMIS_MS[t])} />
            ))}
          </div>
        </Carte>
      </div>
    </EcranVide>
  );
}


function resume(liste: ElementFile[]): string {
  const c = new Map<TypeFile, number>();
  for (const x of liste) c.set(x.type, (c.get(x.type) ?? 0) + 1);
  return [...c.entries()].map(([t, n]) => `${n} ${LIBELLE_TYPE[t].toLowerCase()}${n > 1 && !/s$/.test(t) ? 's' : ''}`).join(', ');
}

function Meche({ x, ambre }: { x: ElementFile; ambre: boolean }) {
  const pris = Boolean(x.qui);
  const pos = Math.min(1, Math.max(0, x.brule)) * MECHE;
  const couleur = ambre ? AMBRE : x.type === 'critique' && pris ? '#6b6b68' : '#e4e4e1';
  return (
    <span className="relative inline-block h-3 align-middle" style={{ width: MECHE }} aria-hidden>
      <span className="absolute left-0 top-1/2 border-t border-dotted" style={{ width: pos, borderColor: '#4a4a48' }} />
      <span className="absolute top-1/2 h-px -translate-y-1/2" style={{ left: pos, right: 0, background: couleur }} />
      <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pos, background: couleur, boxShadow: ambre ? '0 0 10px rgba(208,154,74,.9)' : undefined }} />
    </span>
  );
}

function Etiquette({ type }: { type: TypeFile }) {
  const critique = type === 'critique';
  return (
    <span className="inline-block border px-1.5 py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.12em]" style={{ borderColor: critique ? ROUGE.bordure : '#2b2b2b', color: critique ? ROUGE.texte : '#a3a3a0', background: critique ? ROUGE.fond : 'transparent' }}>
      {LIBELLE_TYPE[type]}
    </span>
  );
}

function LigneFile({ x, ambre, choisi, onChoisir }: { x: ElementFile; ambre: boolean; choisi: boolean; onChoisir: () => void }) {
  return (
    <tr
      onClick={onChoisir}
      className="cursor-pointer border-b border-[#1a1a1a] hover:bg-white/[0.02]"
      style={{ background: choisi ? '#161616' : undefined, boxShadow: choisi ? 'inset 2px 0 0 #f7f7f5' : undefined }}
    >
      <td className="py-3.5 pl-3">
        <Etiquette type={x.type} />
      </td>
      <td className="max-w-[200px] py-3.5">
        <button type="button" onClick={onChoisir} className="block text-left text-[13.5px] font-semibold text-[#f7f7f5]" aria-pressed={choisi}>
          {x.orgNom}
        </button>
        <span className="block truncate text-[12px] text-[#9a9a97]">{x.phrase}</span>
      </td>
      <td className="whitespace-nowrap py-3.5" data-signal-groupe={ambre ? 'file-ambre' : undefined}>
        <Meche x={x} ambre={ambre} />
        <span className="ml-3 font-mono text-[11px] font-semibold tabular-nums" style={{ color: ambre ? AMBRE : '#e4e4e1' }}>
          {texteReste(x.resteMs)}
        </span>
      </td>
      <td className="whitespace-nowrap py-3.5 pr-3" data-signal-groupe={ambre ? 'file-ambre' : undefined}>
        {x.qui ? (
          <span className="flex items-center gap-2">
            <UserAvatar email={x.qui} size={18} />
            <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-[#a3a3a0]">SUIVI</span>
          </span>
        ) : (
          <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em]" style={{ color: ambre ? AMBRE : '#e4e4e1' }}>
            PERSONNE
          </span>
        )}
      </td>
    </tr>
  );
}

/** L'élément choisi : sa phrase, ses chiffres, ses gestes. */
function Detail({ x, ambre, relire }: { x: ElementFile; ambre: boolean; relire: () => void }) {
  const src = useSourceBureaux();
  const org = x.orgId ? src.organisations.find((o) => o.id === x.orgId) ?? null : null;
  const places = org?.seats ?? org?.formula?.seats ?? null;
  const apres = placesApres(org?.userCount ?? 0, places);
  return (
    <Carte pad="p-6" className="self-start">
      <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#a3a3a0]">
        {x.type === 'jeton' ? 'Jeton de places' : LIBELLE_TYPE[x.type].toLowerCase()} · {x.orgNom}
      </span>
      <h2 className="mt-3 text-[19px] font-semibold leading-snug text-[#f7f7f5]">{x.phrase}</h2>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#a3a3a0]">
        {x.detail ? `${x.detail.slice(0, 280)}${x.detail.length > 280 ? '…' : ''} ` : ''}Arrivé {ilYA(x.depuis)}.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        {x.type === 'jeton' && org && (
          <>
            <Stat l="Places" v={`${org.userCount} / ${places ?? '∞'}`} />
            <Stat l="Après" v={apres ? `${apres}` : '—'} />
          </>
        )}
        <Stat l="Délai" v={duree(DELAI_PROMIS_MS[x.type])} />
        <Stat l={x.resteMs >= 0 ? 'Reste' : 'Dépassé de'} v={duree(x.resteMs)} couleur={ambre ? AMBRE : undefined} />
      </div>
      <div className="mt-5">
        <GestesElement x={x} relire={relire} />
      </div>
      {x.orgId && (
        <div className="mt-4">
          <Link to={`/supervisor/dossiers/${x.orgId}`} className="bx-lien">
            Ouvrir le dossier
          </Link>
        </div>
      )}
    </Carte>
  );
}

/** La prochaine marche de places au-dessus de ce qui est occupé (1, 2, 5, 10, 25). */
export const placesApres = (occupees: number, places: number | null) => PLACES.find((p) => p > Math.max(occupees, places ?? 0)) ?? null;

/**
 * LES GESTES D'UN ÉLÉMENT DE LA FILE — les mêmes dans la file et dans le
 * dossier de la cliente : valider ou refuser un jeton, répondre à une
 * demande, clore une demande de module, se l'attribuer.
 */
export function GestesElement({ x, relire, compact = false }: { x: ElementFile; relire: () => void; compact?: boolean }) {
  const { user } = useAuth();
  const { upsert } = useSync();
  const src = useSourceBureaux();
  const [etat, setEtat] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const org = x.orgId ? src.organisations.find((o) => o.id === x.orgId) ?? null : null;
  const places = org?.seats ?? org?.formula?.seats ?? null;
  const apres = useMemo(() => (org ? placesApres(org.userCount, places) : null), [org, places]);
  const geste = async (quoi: () => Promise<unknown>, fait: string) => {
    setEnCours(true);
    setEtat(null);
    try {
      await quoi();
      setEtat(fait);
      relire();
    } catch (e) {
      setEtat(e instanceof Error ? e.message : 'Le geste a été refusé.');
    } finally {
      setEnCours(false);
    }
  };
  const admin = bridge().remote.admin;
  const attribuer = () =>
    geste(async () => {
      if (!user?.email) return;
      await upsert('suivis', x.cle, { par: user.email, at: new Date().toISOString() });
      if (x.source.kind === 'dossier') await garde.prendre(x.source.dossier.id, true);
      if (x.source.kind === 'incident') await bridge().remote.acknowledgeIncident(x.source.incident.id);
    }, 'Il vous est attribué.');

  let gestes: React.ReactNode = null;
  if (x.source.kind === 'support' && x.source.demande.kind === 'seat') {
    const d = x.source.demande;
    gestes = (
      <>
        <button type="button" disabled={enCours || !apres || !x.orgId} className={`bx-btn ${compact ? '' : 'w-full'}`} onClick={() => geste(async () => {
          await admin.updateOrganization(x.orgId!, { seats: apres });
          await admin.answerSupportRequest(d.id, { status: 'answered', reply: `Vos places passent à ${apres}.` });
        }, `Les places passent à ${apres}.`)}>
          {apres ? `Passer à ${apres} places` : 'Valider'}
        </button>
        <div className={compact ? 'contents' : 'grid grid-cols-2 gap-2'}>
          <button type="button" disabled={enCours} className="bx-btn2" onClick={() => geste(() => admin.answerSupportRequest(d.id, { status: 'closed', reply: 'Demande refusée pour le moment.' }), 'Refusée.')}>
            Refuser
          </button>
          <button type="button" disabled={enCours || Boolean(x.qui)} className="bx-btn2" onClick={attribuer}>
            Me l’attribuer
          </button>
        </div>
      </>
    );
  } else if (x.source.kind === 'support') {
    const d = x.source.demande;
    gestes = <Reponse onRepondre={(texte) => geste(() => admin.answerSupportRequest(d.id, { status: 'answered', reply: texte }), 'Réponse envoyée.')} onAttribuer={attribuer} pris={Boolean(x.qui)} enCours={enCours} />;
  } else if (x.source.kind === 'module') {
    const d = x.source.demande;
    gestes = (
      <>
        <button type="button" disabled={enCours} className={`bx-btn ${compact ? '' : 'w-full'}`} onClick={() => geste(() => admin.resolveModuleRequest(d.id, { status: 'done' }), 'Marquée comme faite.')}>
          Marquer comme faite
        </button>
        <div className={compact ? 'contents' : 'grid grid-cols-2 gap-2'}>
          <button type="button" disabled={enCours} className="bx-btn2" onClick={() => geste(() => admin.resolveModuleRequest(d.id, { status: 'declined' }), 'Refusée.')}>
            Refuser
          </button>
          <button type="button" disabled={enCours || Boolean(x.qui)} className="bx-btn2" onClick={attribuer}>
            Me l’attribuer
          </button>
        </div>
      </>
    );
  } else {
    gestes = (
      <button type="button" disabled={enCours || Boolean(x.qui)} className={`bx-btn ${compact ? '' : 'w-full'}`} onClick={attribuer}>
        {x.qui ? `Suivi par ${prenomDe(x.qui)}` : 'Me l’attribuer'}
      </button>
    );
  }
  return (
    <>
      <div className={compact ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2'}>{gestes}</div>
      {etat && (
        <p className="mt-3 text-[12.5px] text-[#e4e4e1]" role="status">
          {etat}
        </p>
      )}
    </>
  );
}

function Reponse({ onRepondre, onAttribuer, pris, enCours }: { onRepondre: (t: string) => void; onAttribuer: () => void; pris: boolean; enCours: boolean }) {
  const [t, setT] = useState('');
  return (
    <>
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={3} placeholder="Votre réponse à la cliente…" aria-label="Votre réponse à la cliente" className="w-full resize-none border border-[#2b2b2b] bg-transparent p-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
      <button type="button" disabled={enCours || !t.trim()} className="bx-btn w-full" onClick={() => onRepondre(t.trim())}>
        Répondre
      </button>
      <button type="button" disabled={enCours || pris} className="bx-btn2" onClick={onAttribuer}>
        Me l’attribuer
      </button>
    </>
  );
}

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSync } from '../../state/SyncContext';
import { bridge } from '../../lib/bridge';
import { NAV_SECTIONS } from '../../data/navigation';
import { PALIER_PRIX_EUR, nomPalier } from '../../lib/paliers';
import { AMBRE } from '../jetons';
import { useSourceBureaux } from '../donnees/source';
import { useSupervisor } from '../donnees/useSupervisor';
import { CAS_D_USAGE, chercher, limiteDeLaPaire, type Lecture, type LigneGrille, type ModuleCatalogue } from '../donnees/chercheur';
import type { DossierOrg } from '../donnees/types';
import { Carte, EnTete, Ligne } from '../ui/kit';
import { deNom, enLettres } from '../format';

/**
 * SUPERVISOR · LE CHERCHEUR DE MODULES — cahier 12, `46f` et `46h`.
 *
 * La phrase de la cliente, telle quelle, en 19 px. Les idées qu'il en tire,
 * en étiquettes ; ce qu'il ignore, dit. La grille d'appariement : une case
 * pleine porte la raison, une case vide en pointillé dit que le module ne le
 * fait pas. L'ambre : la ligne du module qui couvre toutes les idées et son
 * « n / n » — ou, quand un mot a deux sens, la question à poser à la
 * cliente, jamais un module.
 */

const EXEMPLE = 'il me manque un truc pour suivre mes livraisons avec photo du colis';

function catalogue(): ModuleCatalogue[] {
  const vus = new Set<string>();
  const r: ModuleCatalogue[] = [];
  for (const s of NAV_SECTIONS) {
    if ((s.space ?? 'workspace') !== 'workspace') continue;
    for (const it of s.items) {
      if (vus.has(it.key)) continue;
      vus.add(it.key);
      r.push({ cle: it.key, nom: it.label, famille: s.label });
    }
  }
  return r;
}
const HINTS = new Map(NAV_SECTIONS.flatMap((s) => s.items.map((i) => [i.key, i.hint] as [string, string])));

export function SupervisorChercheur() {
  const [params] = useSearchParams();
  const orgId = params.get('org');
  const src = useSourceBureaux();
  const m = useSupervisor();
  const org = orgId ? src.organisations.find((o) => o.id === orgId) ?? null : null;
  const [phrase, setPhrase] = useState(EXEMPLE);
  const [saisie, setSaisie] = useState(EXEMPLE);
  const [lecture, setLecture] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const cat = useMemo(catalogue, []);
  const usage = useMemo(() => {
    const u = new Map<string, number>();
    for (const o of src.organisations) for (const k of o.modules ?? o.formula?.modules ?? cat.map((c) => c.cle)) u.set(k, (u.get(k) ?? 0) + 1);
    return u;
  }, [src.organisations, cat]);
  const r = useMemo(() => chercher(phrase, cat, usage), [phrase, cat, usage]);
  const lectures = lecture ? r.lectures.filter((l) => l.lettre === lecture) : r.lectures;
  const ambigu = r.ambigu && !lecture;
  const principale = lectures[0] ?? null;
  const ambreLigne = !ambigu ? principale?.complet ?? null : null;
  const courant = (choisi ? lectures.flatMap((l) => l.lignes).find((x) => x.cle === choisi) : null) ?? ambreLigne ?? principale?.lignes[0] ?? null;

  const titre = !r.idees.length && !r.ambigu
    ? 'Le chercheur n’a rien reconnu dans cette phrase.'
    : ambigu
      ? `Deux lectures possibles. ${r.lectures.filter((l) => l.complet).length === 1 ? 'Une seule a un module qui répond.' : r.lectures.some((l) => l.complet) ? 'Chacune a son module.' : 'Aucune n’a de module qui réponde seul.'}`
      : 'Trouver le module d’après ce que la cliente a dit';
  const ecartes = [...new Map(lectures.flatMap((l) => l.ecartes).map((x) => [x.cle, x])).values()].slice(0, 4);

  return (
    <>
      <EnTete surtitre={`Supervisor · Chercheur${org ? ` · depuis le dossier ${deNom(org.name)}` : ''}`} titre={titre} />
      <Carte dominante pad="p-7">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPhrase(saisie.trim() || EXEMPLE);
            setLecture(null);
            setChoisi(null);
          }}
          className="flex items-center gap-4 border border-[#2b2b2b] bg-[#0f0f0f] px-5 py-4"
        >
          <Search size={16} className="flex-none text-text-secondary" aria-hidden />
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            aria-label="La phrase de la cliente, telle quelle"
            className="min-w-0 flex-1 bg-transparent text-[19px] font-semibold text-text-primary outline-none placeholder:text-text-muted"
            placeholder="La phrase de la cliente, telle quelle…"
          />
          <span className="flex-none font-mono text-[10px] tracking-[0.12em] text-text-muted">{Object.keys(CAS_D_USAGE).length} MODULES DÉCRITS</span>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">Ce que la phrase demande</span>
          {r.idees.map((i) => (
            <span key={i.cle} className="border border-border-strong px-2.5 py-1 text-[12.5px] font-semibold text-text-primary">
              {i.mot}
            </span>
          ))}
          {r.ambigu && (
            <span className="border border-dashed border-[#8a8a87] px-2.5 py-1 text-[12.5px] font-semibold text-text-primary">
              {r.ambigu.mot} <span className="ml-1 font-mono text-[9.5px] tracking-[0.1em] text-text-secondary">2 LECTURES</span>
            </span>
          )}
          {r.ignores.length > 0 && <span className="text-[12px] text-text-muted">{r.ignores.map((x) => `« ${x} »`).join(', ')} : ignorés</span>}
          {r.inconnus.length > 0 && <span className="text-[12px] text-text-muted">· je ne sais pas relier {r.inconnus.map((x) => `« ${x} »`).join(', ')}</span>}
        </div>
        {ambigu && r.ambigu && (
          <div className="mt-5 flex flex-wrap items-center gap-5 p-5" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)', boxShadow: '0 0 30px -14px rgba(208,154,74,.7)' }} data-signal-groupe="chercheur-question">
            <div className="min-w-0 flex-1">
              <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: AMBRE }}>
                À demander à la cliente
              </span>
              <span className="mt-2.5 block text-[16.5px] font-semibold text-text-primary">« {r.ambigu.mot.split(' ')[0].replace(/^./, (c) => c.toUpperCase())} », pour elle, c’est lequel ?</span>
              <span className="mt-1.5 block text-[12.5px] leading-relaxed text-text-secondary">Le mot a deux sens, et ils mènent à des modules différents. Le chercheur ne choisit pas à sa place : il montre les deux lectures, la plus probable d’abord.</span>
            </div>
            <div className="flex flex-col gap-2">
              {r.lectures.map((l) => (
                <button key={l.lettre} type="button" className="bx-btn2 justify-start" onClick={() => setLecture(l.lettre)}>
                  {l.lettre} · {l.libelle}
                </button>
              ))}
            </div>
          </div>
        )}
        {lecture && r.ambigu && (
          <p className="mt-4 text-[12.5px] text-text-secondary">
            Lecture {lecture} retenue.{' '}
            <button type="button" className="font-semibold text-text-body underline decoration-trait-sourd underline-offset-4" onClick={() => setLecture(null)}>
              Revoir les deux lectures
            </button>
          </p>
        )}
        {lectures.map((l) => (
          <GrilleLecture key={l.lettre} l={l} titre={r.lectures.length > 1 ? l : null} ambre={ambreLigne?.cle ?? null} choisi={courant?.cle ?? null} onChoisir={setChoisi} />
        ))}
      </Carte>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        {ecartes.length > 0 || lectures.some((l) => !l.complet) ? (
          <Carte titre="Écartés, et pourquoi" droite="une seule idée couverte">
            {ecartes.length === 0 && <p className="text-[13px] text-text-secondary">Aucun module écarté.</p>}
            {ecartes.map((x) => {
              const idees = lectures[0]?.idees ?? [];
              const k = x.cases.findIndex(Boolean);
              const autres = idees.filter((_, j) => j !== k).map((i) => i.mot);
              return <Ligne key={x.cle} colonnes="74px minmax(0,1fr) auto" a={x.nom.slice(0, 6).toUpperCase()} b={`${x.nom} : ${x.cases[k]?.raison ?? ''}, mais rien pour ${autres.join(', ')}`} c={`${x.couvre} / ${idees.length}`} />;
            })}
          </Carte>
        ) : (
          courant && <Apercu m={courant} hint={HINTS.get(courant.cle) ?? ''} />
        )}
        {ecartes.length > 0 || lectures.some((l) => !l.complet) ? (
          <Carte titre="Le verdict" droite="à dire à la cliente">
            {lectures.map((l) => (
              <p key={l.lettre} className="mb-3 text-[13.5px] leading-relaxed text-text-body">
                {lectures.length > 1 && <b className="text-text-primary">Lecture {l.lettre} : </b>}
                {verdict(l)}
              </p>
            ))}
          </Carte>
        ) : org && courant ? (
          <PourElle orgId={org.id} orgNom={org.name} module={courant} dossier={m.dossiers.get(org.id) ?? {}} />
        ) : (
          <Carte titre="Pour une cliente">
            <p className="text-[13px] leading-relaxed text-text-secondary">Ouvert depuis le dossier d’une cliente, le chercheur dit ce que l’installation suppose pour elle : sa formule, ses modules liés, ses places.</p>
          </Carte>
        )}
      </div>
      {(ecartes.length > 0 || lectures.some((l) => !l.complet)) && courant && (
        <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          <Apercu m={courant} hint={HINTS.get(courant.cle) ?? ''} />
          {org && <PourElle orgId={org.id} orgNom={org.name} module={courant} dossier={m.dossiers.get(org.id) ?? {}} />}
        </div>
      )}
    </>
  );
}

function verdict(l: Lecture): string {
  if (l.complet) {
    const reserves = l.complet.cases.filter((c) => c?.reserve).map((c) => c!.reserve);
    return `${l.complet.nom} répond${reserves.length ? `, avec ${reserves.length > 1 ? `${enLettres(reserves.length)} réserves` : 'une réserve'} — ${reserves.join(' ; ')}.` : '.'}`;
  }
  if (l.paire) {
    const limite = limiteDeLaPaire(l);
    return `Aucun module ne répond seul. ${l.paire[0].nom} et ${l.paire[1].nom}, installés ensemble, couvrent tout${limite ? `, mais ${limite}` : ''}.`;
  }
  const manquent = l.idees.filter((_, k) => !l.lignes.some((x) => x.cases[k]) && !l.ecartes.some((x) => x.cases[k])).map((i) => `« ${i.mot} »`);
  return `Aucun module ne répond seul, et aucune combinaison ne couvre tout${manquent.length ? ` : rien ne fait ${manquent.join(', ')}` : ''}.`;
}

function GrilleLecture({ l, titre, ambre, choisi, onChoisir }: { l: Lecture; titre: Lecture | null; ambre: string | null; choisi: string | null; onChoisir: (cle: string) => void }) {
  const n = l.idees.length;
  const colonnes = `minmax(160px,1.4fr) repeat(${n}, minmax(96px,1fr)) 70px`;
  return (
    <div className="mt-6">
      {titre && (
        <p className="mb-2 text-[13px] text-text-secondary">
          <b className="font-mono text-[11px] tracking-[0.12em] text-text-primary">LECTURE {l.lettre}</b> &nbsp;{l.libelle}
          {l.pourquoi ? ` — ${l.pourquoi}` : ''}
        </p>
      )}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 160 + n * 100 + 70 }}>
          <div className="grid gap-2 border-b border-[#252525] px-3 pb-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted" style={{ gridTemplateColumns: colonnes }}>
            <span>Module</span>
            {l.idees.map((i) => (
              <span key={i.cle} className="truncate">
                {i.mot}
              </span>
            ))}
            <span className="text-right">Couvre</span>
          </div>
          {l.lignes.length === 0 && <p className="px-3 py-5 text-[13px] text-text-secondary">Aucun module ne couvre deux de ces idées.</p>}
          {l.lignes.slice(0, 6).map((x) => (
            <LigneModule key={x.cle} x={x} n={n} colonnes={colonnes} ambre={ambre === x.cle} choisi={choisi === x.cle} onChoisir={() => onChoisir(x.cle)} />
          ))}
          {!l.complet && l.lignes.length > 0 && n >= 2 && <p className="px-3 pt-3 text-[13px] font-semibold text-text-primary">Aucun module ne fait tout : {l.idees.map((i) => i.mot).join(', ')}.</p>}
        </div>
      </div>
    </div>
  );
}

function LigneModule({ x, n, colonnes, ambre, choisi, onChoisir }: { x: LigneGrille; n: number; colonnes: string; ambre: boolean; choisi: boolean; onChoisir: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onChoisir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChoisir()}
      className="grid cursor-pointer items-stretch gap-2 border-b border-[#1a1a1a] px-3 py-2.5 hover:bg-white/[0.02]"
      style={{ gridTemplateColumns: colonnes, background: ambre ? 'rgba(208,154,74,.06)' : choisi ? 'var(--color-surface-hover)' : undefined, boxShadow: ambre ? `inset 2px 0 0 ${AMBRE}` : choisi ? 'inset 2px 0 0 var(--color-text-primary)' : undefined }}
      data-signal-groupe={ambre ? 'chercheur-ligne' : undefined}
    >
      <span className="self-center">
        <span className="block text-[13.5px] font-semibold text-text-primary">{x.nom}</span>
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{x.famille}</span>
      </span>
      {x.cases.map((c, k) =>
        c ? (
          <span key={k} className="min-h-[44px] px-2.5 py-2" style={{ background: '#1a1a1a', border: c.reserve ? '1px dashed #8a8a87' : '1px solid #2b2b2b' }}>
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px]" style={{ background: c.reserve ? 'transparent' : 'var(--color-text-body)', border: c.reserve ? '1px solid var(--color-text-body)' : undefined }} aria-hidden />
              {c.reserve && <span className="font-mono text-[9px] font-semibold tracking-[0.12em] text-text-body">RÉSERVE</span>}
            </span>
            <span className="mt-1 block text-[11.5px] leading-snug text-text-body">{c.raison}</span>
            {c.reserve && <span className="block text-[11px] leading-snug text-text-secondary">{c.reserve}</span>}
          </span>
        ) : (
          <span key={k} className="min-h-[44px] border border-dashed border-[#2b2b2b]" aria-label="ne le fait pas" />
        ),
      )}
      <span className="self-center text-right">
        <span className="block font-mono text-[17px] font-semibold tabular-nums" style={{ color: ambre ? AMBRE : 'var(--color-text-body)' }}>
          {x.couvre} / {n}
        </span>
        {x.reserves > 0 && <span className="block font-mono text-[9.5px] tracking-[0.1em] text-text-secondary">{x.reserves} RÉSERVE{x.reserves > 1 ? 'S' : ''}</span>}
      </span>
    </div>
  );
}

function Apercu({ m, hint }: { m: LigneGrille; hint: string }) {
  const cas = CAS_D_USAGE[m.cle] ?? {};
  return (
    <Carte titre={`Aperçu · ${m.nom}`} droite={`${m.famille} · ${m.organisations} organisation${m.organisations > 1 ? 's' : ''}`}>
      <p className="text-[14px] leading-relaxed text-text-body">{hint}.</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {Object.values(cas).map((r, i) => (
          <li key={i} className="border border-[#2b2b2b] px-2 py-1 text-[11.5px] text-text-secondary">
            {typeof r === 'string' ? r : r.raison}
          </li>
        ))}
      </ul>
    </Carte>
  );
}

function PourElle({ orgId, orgNom, module, dossier }: { orgId: string; orgNom: string; module: LigneGrille; dossier: DossierOrg }) {
  const src = useSourceBureaux();
  const { user } = useAuth();
  const { upsert } = useSync();
  const [etat, setEtat] = useState<string | null>(null);
  const org = src.organisations.find((o) => o.id === orgId);
  if (!org) return null;
  const ouverts = org.modules ?? null;
  const installe = ouverts === null || ouverts.includes(module.cle);
  const compatible = org.formula?.modules === null || org.formula?.modules === undefined || org.formula.modules.includes(module.cle);
  const lies = (ouverts ?? [])
    .filter((k) => k !== module.cle && CAS_D_USAGE[k] && Object.keys(CAS_D_USAGE[k]).some((c) => Object.keys(CAS_D_USAGE[module.cle] ?? {}).includes(c)))
    .map((k) => NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.key === k)?.label ?? k);
  const places = org.seats ?? org.formula?.seats ?? null;
  const installer = async () => {
    try {
      await bridge().remote.admin.setOrganizationModule(orgId, module.cle, true);
      setEtat(`${module.nom} est ouvert sur son desktop.`);
      void src.recharger();
    } catch (e) {
      setEtat(e instanceof Error ? e.message : 'Refusé par le serveur.');
    }
  };
  const proposer = async () => {
    const texte = `Bonjour, pour ce que vous nous avez décrit, le module « ${module.nom} » devrait convenir. Voulez-vous que nous l’ouvrions sur votre espace ?`;
    try {
      await navigator.clipboard?.writeText(texte);
    } catch {
      /* le presse-papiers peut être refusé : le texte reste noté au dossier */
    }
    const { id: _i, ...reste } = dossier as DossierOrg & { id?: string };
    await upsert('orgDossier', orgId, { ...reste, echanges: [...(dossier.echanges ?? []), { id: `x${Date.now()}`, sens: 'envoye', resume: `Module proposé : ${module.nom}`, par: user?.email ?? '', at: new Date().toISOString() }] });
    setEtat('Le message est copié, prêt à envoyer ; la proposition est notée au dossier.');
  };
  return (
    <Carte titre={`Pour ${orgNom}`} droite={`formule ${PALIER_PRIX_EUR[org.plan] ? `${PALIER_PRIX_EUR[org.plan]} €` : nomPalier(org.plan)} · ${places ?? '∞'} places`}>
      <Ligne colonnes="minmax(0,1fr) auto" a="" b="Compatible avec sa formule" c={compatible ? 'oui' : 'hors formule'} />
      <Ligne colonnes="minmax(0,1fr) auto" a="" b="Modules liés déjà installés" c={lies.length ? lies.slice(0, 3).join(', ') : 'aucun'} />
      <Ligne colonnes="minmax(0,1fr) auto" a="" b="Places nécessaires" c="aucune de plus" />
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button type="button" className="bx-btn" disabled={installe} onClick={() => void installer()}>
          {installe ? 'Déjà sur son desktop' : 'Installer sur son desktop'}
        </button>
        <button type="button" className="bx-btn2" onClick={() => void proposer()}>
          Le lui proposer
        </button>
      </div>
      {etat && (
        <p className="mt-3 text-[12.5px] text-text-body" role="status">
          {etat}
        </p>
      )}
    </Carte>
  );
}

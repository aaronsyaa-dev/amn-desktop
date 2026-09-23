import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, HeartHandshake, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useInvoices } from '../state/useInvoices';
import { formatCents } from '../lib/money';
import { codeParrain, primeDue } from '../lib/parrainage';

type ReferralStatus = 'invite' | 'venu' | 'recompense';
interface ReferralData {
  referrer: string;
  referred: string;
  status: ReferralStatus;
  reward: string;
  createdAt: string;
  updatedAt: string;
  /** Le code du parrain utilisé par ce filleul (fusion « parrainage par code »). */
  code?: string;
  /** La prime promise pour ce filleul, figée le jour où il vient. */
  primeCents?: number;
}
/** Le barème du programme : un enregistrement `programme` dans la même collection. */
interface ProgrammeParrainage {
  kind: 'programme';
  primeCents: number;
}
const ID_PROGRAMME = 'programme';
const SUITE: Record<ReferralStatus, ReferralStatus | null> = { invite: 'venu', venu: 'recompense', recompense: null };

/**
 * LE PARRAINAGE — qui a amené qui, et ce qu'on lui doit.
 *
 * Pour qui : toute activité qui vit du bouche-à-oreille et qui promet
 * « une remise pour ton amie » sans jamais tenir le compte. Ce que ça règle :
 * trois états — invitée, venue, récompensée — et le nom de la récompense
 * promise. On sait qui parraine le plus, et à qui on doit encore quelque
 * chose. Pas de code promo, pas de site : un registre honnête.
 */
/**
 * L'ARBRE DE FILIATION — l'objet dominant du Parrainage (`23c`)
 * ════════════════════════════════════════════════════════════
 *
 * Qui a amené qui, sur deux générations, avec sous chaque nom LE CHIFFRE
 * D'AFFAIRES PORTÉ PAR SA BRANCHE.
 *
 * Une liste de codes de parrainage ne dit pas qu'un client discret a déclenché
 * une lignée entière. L'arbre le montre, et la valeur d'un parrain se lit à la
 * TAILLE DE SA DESCENDANCE, pas à ses propres factures — c'est la règle du
 * paquet et c'est aussi le seul calcul qui rende le module utile : quelqu'un
 * qui achète peu et amène beaucoup vaut plus qu'un gros client isolé.
 *
 * ARBITRAGE SUR L'APPARIEMENT. Le modèle garde des NOMS en texte libre
 * (« Camille R. »), pas des identifiants de fiche : le parrainage se note
 * souvent avant que la personne soit cliente. Le chiffre d'affaires est donc
 * rapproché par le nom, en comparaison insensible à la casse et aux accents.
 * C'est fragile et c'est dit ici plutôt que caché : un filleul dont le nom ne
 * correspond à aucune fiche compte pour zéro, et l'écran le montre à zéro
 * plutôt que de l'omettre — une branche amputée serait pire qu'une branche
 * incomplète visible.
 */
/* Trois lignes par nœud depuis la fusion « parrainage par code » : le nom, la branche, puis le code et la prime due. */
const NOEUD_H = 64;
const RANGEE = 80;

function cleNom(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface NoeudParrainage {
  nom: string;
  /** Le CA propre de la personne, en centimes. */
  propre: number;
  /** Le CA de sa descendance, en centimes — JAMAIS le sien. */
  branche: number;
  enfants: NoeudParrainage[];
}

/**
 * Construit l'arbre et calcule les branches. Renvoie les racines — les gens
 * qui parrainent sans avoir été parrainés eux-mêmes.
 */
function construireArbre(
  liens: { referrer: string; referred: string }[],
  caParNom: Map<string, number>,
): NoeudParrainage[] {
  const enfantsDe = new Map<string, string[]>();
  const estFilleul = new Set<string>();
  const tousLesNoms = new Map<string, string>();
  for (const l of liens) {
    const p = cleNom(l.referrer);
    const f = cleNom(l.referred);
    if (!p || !f || p === f) continue;
    tousLesNoms.set(p, l.referrer.trim());
    tousLesNoms.set(f, l.referred.trim());
    enfantsDe.set(p, [...(enfantsDe.get(p) ?? []), f]);
    estFilleul.add(f);
  }

  /* `vus` coupe les cycles : deux personnes qui se parrainent mutuellement
     feraient tourner la récursion sans fin, et ça s'écrit en deux lignes de
     saisie. */
  const bati = (cle: string, vus: Set<string>, profondeur: number): NoeudParrainage => {
    const enfants =
      profondeur >= 2
        ? []
        : (enfantsDe.get(cle) ?? [])
            .filter((c) => !vus.has(c))
            .map((c) => bati(c, new Set([...vus, c]), profondeur + 1));
    return {
      nom: tousLesNoms.get(cle) ?? cle,
      propre: caParNom.get(cle) ?? 0,
      /* LE CA DE BRANCHE EST LA SOMME DE LA DESCENDANCE, pas le sien. */
      branche: enfants.reduce((n, e) => n + e.propre + e.branche, 0),
      enfants,
    };
  };

  return [...enfantsDe.keys()]
    .filter((p) => !estFilleul.has(p))
    .map((p) => bati(p, new Set([p]), 0))
    .sort((a, b) => b.branche - a.branche);
}

function ArbreDeFiliation({
  racines,
  formatCents,
  dueDe,
  pied,
}: {
  racines: NoeudParrainage[];
  formatCents: (c: number) => string;
  /** La prime due à ce parrain — 0 s'il n'en attend aucune. */
  dueDe: (nom: string) => number;
  pied?: React.ReactNode;
}) {
  /* La racine la plus lourde porte l'ambre. `racines` arrive déjà triée. */
  const laPlusLourde = racines[0]?.branche > 0 ? racines[0].nom : null;

  /* Chaque racine occupe autant de rangées que sa descendance en a besoin. */
  const rangees: { noeud: NoeudParrainage; colonne: 0 | 1 | 2; y: number; parentY: number | null }[] = [];
  let y = 0;
  for (const racine of racines) {
    const yRacineDebut = y;
    if (racine.enfants.length === 0) {
      rangees.push({ noeud: racine, colonne: 0, y, parentY: null });
      y += RANGEE;
      continue;
    }
    for (const enfant of racine.enfants) {
      const yEnfant = y;
      rangees.push({ noeud: enfant, colonne: 1, y: yEnfant, parentY: null });
      for (const petit of enfant.enfants) {
        y += RANGEE;
        rangees.push({ noeud: petit, colonne: 2, y, parentY: yEnfant });
      }
      y += RANGEE;
    }
    const yRacine = (yRacineDebut + y - RANGEE) / 2;
    rangees.push({ noeud: racine, colonne: 0, y: yRacine, parentY: null });
    /* Les traits racine → 1ʳᵉ génération se tracent depuis ce y-là. */
    for (const r of rangees) {
      if (r.colonne === 1 && r.y >= yRacineDebut && r.y < y) r.parentY = yRacine;
    }
  }
  const hauteur = Math.max(RANGEE, y) + 26;
  const centre = (haut: number) => haut + NOEUD_H / 2;

  return (
    <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
      <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="eyebrow text-text-secondary">Qui a amené qui</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
          {racines.length} PARRAIN{racines.length > 1 ? 'S' : ''} · DEUX GÉNÉRATIONS
        </span>
      </div>

      <div className="relative" style={{ height: `${hauteur}px` }}>
        {/* Les connecteurs, en viewBox comme partout : les nœuds sont en
            pourcentages, donc les traits doivent l'être aussi. */}
        <svg
          viewBox={`0 0 1000 ${hauteur}`}
          preserveAspectRatio="none"
          className="absolute left-0 top-0 w-full"
          style={{ height: `${hauteur}px` }}
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth={1.4}
          aria-hidden
        >
          {rangees
            .filter((r) => r.colonne > 0 && r.parentY !== null)
            .map((r, i) => {
              const xDepart = r.colonne === 1 ? 255 : 605;
              const xCoude = r.colonne === 1 ? 292 : 642;
              const xArrivee = r.colonne === 1 ? 330 : 680;
              return (
                <path
                  key={i}
                  d={`M${xDepart} ${centre(r.parentY as number)} H${xCoude} V${centre(r.y)} H${xArrivee}`}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </svg>

        {rangees.map((r, i) => {
          const ambre = r.colonne === 0 && r.noeud.nom === laPlusLourde;
          const gauche = r.colonne === 0 ? '0%' : r.colonne === 1 ? '33%' : '68%';
          const largeur = r.colonne === 0 ? '25.5%' : r.colonne === 1 ? '28%' : '30%';
          return (
            <div
              key={`${r.noeud.nom}-${i}`}
              data-signal-groupe={ambre ? 'branche-la-plus-lourde' : undefined}
              className={`absolute box-border px-3 py-2 ${
                ambre
                  ? 'bg-signal shadow-[0_0_30px_-6px_var(--color-signal-glow)]'
                  : 'border border-[#2b2b2b] bg-[#171717]'
              }`}
              style={{ left: gauche, top: `${r.y}px`, width: largeur, height: `${NOEUD_H}px` }}
            >
              <span
                className={`block truncate text-[12.5px] font-semibold ${
                  ambre ? 'text-signal-ink' : 'text-text-primary'
                }`}
              >
                {r.noeud.nom}
              </span>
              <span
                className={`tnum mt-0.5 block truncate font-mono text-[9.5px] tracking-[0.1em] ${
                  ambre ? 'text-[#3a2a0e]' : 'text-text-muted'
                }`}
              >
                {r.noeud.branche > 0
                  ? `${formatCents(r.noeud.branche).toUpperCase()} DE BRANCHE`
                  : r.noeud.propre > 0
                    ? `${formatCents(r.noeud.propre).toUpperCase()} EN PROPRE`
                    : 'PAS ENCORE CLIENT'}
              </span>
              {r.noeud.enfants.length > 0 && (
                <span
                  className={`tnum mt-0.5 block truncate font-mono text-[9.5px] tracking-[0.1em] ${ambre ? 'text-[#3a2a0e]' : 'text-text-muted'}`}
                  title="Le code du parrain, et la prime qu’on lui doit"
                >
                  {codeParrain(r.noeud.nom)}
                  {dueDe(r.noeud.nom) > 0 ? ` · PRIME DUE ${formatCents(dueDe(r.noeud.nom)).toUpperCase()}` : ''}
                </span>
              )}
            </div>
          );
        })}

        <span className="absolute bottom-0 left-0 font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
          LE PARRAIN
        </span>
        <span className="absolute bottom-0 font-mono text-[9.5px] tracking-[0.1em] text-text-muted" style={{ left: '33%' }}>
          1ʳᵉ GÉNÉRATION
        </span>
        {rangees.some((r) => r.colonne === 2) && (
          <span className="absolute bottom-0 font-mono text-[9.5px] tracking-[0.1em] text-text-muted" style={{ left: '68%' }}>
            2ᵉ GÉNÉRATION
          </span>
        )}
      </div>

      {racines[0] && racines[0].branche > 0 && (
        <p className="mt-5 border-t border-border-raised pt-[22px] text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
          {racines[0].nom} facture{' '}
          <strong className="font-semibold text-text-primary">{formatCents(racines[0].propre)}</strong> en propre
          {racines[0].propre > 0 ? '' : ' (rien)'}, et sa descendance en apporte{' '}
          <strong className="font-semibold text-text-primary">{formatCents(racines[0].branche)}</strong>.
          La valeur d’un parrain ne se lit pas sur ses propres factures.
        </p>
      )}
      {pied}
    </section>
  );
}

export function ReferralsScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<ReferralData>('referrals');
  const [ouvert, setOuvert] = useState(false);
  const [referrer, setReferrer] = useState('');
  const [referred, setReferred] = useState('');
  const [reward, setReward] = useState('');
  const [codeSaisi, setCodeSaisi] = useState('');
  const [bareme, setBareme] = useState<string | null>(null);

  /* Le barème du programme vit à part ; tout le reste est un lien parrain → filleul. */
  const programme = (brutes as Array<ReferralData | ProgrammeParrainage>).find((r): r is ProgrammeParrainage & { id: string } => (r as { id?: string }).id === ID_PROGRAMME) ?? null;
  const liens = useMemo(() => brutes.filter((r) => (r as { id?: string }).id !== ID_PROGRAMME && typeof r.referrer === 'string'), [brutes]);
  const lignes = useMemo(() => [...liens].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [liens]);
  /* Un code saisi retrouve son parrain, même si le nom a été écrit autrement. */
  const parrainDuCode = (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return null;
    return liens.map((l) => l.referrer).find((n) => codeParrain(n) === c) ?? null;
  };
  const dues = lignes.filter((r) => r.status === 'venu').length;
  /*
    LE CA PAR NOM, rapproché depuis les factures émises. Voir l'en-tête de
    `ArbreDeFiliation` pour pourquoi c'est un rapprochement par NOM et ce que
    ça coûte.
  */
  const { invoices } = useInvoices();
  const caParNom = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of invoices) {
      if (f.status === 'draft' || f.status === 'cancelled') continue;
      const nom = cleNom(f.billTo?.name ?? '');
      if (!nom) continue;
      const total = (f.lines ?? []).reduce((n, l) => n + l.quantity * l.unitPriceCents, 0);
      m.set(nom, (m.get(nom) ?? 0) + total);
    }
    return m;
  }, [invoices]);

  const racines = useMemo(() => construireArbre(liens, caParNom), [liens, caParNom]);

  const meilleurs = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of liens) if (r.status !== 'invite') m.set(r.referrer, (m.get(r.referrer) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [liens]);

  const ajouter = async () => {
    const parrain = referrer.trim() || parrainDuCode(codeSaisi) || '';
    if (!parrain || !referred.trim()) return;
    const now = new Date().toISOString();
    await upsert('referrals', uid('par'), { referrer: parrain, referred: referred.trim(), status: 'invite', reward: reward.trim(), createdAt: now, updatedAt: now, code: codeParrain(parrain) });
    setReferrer(''); setReferred(''); setReward(''); setCodeSaisi(''); setOuvert(false);
  };
  /* La prime se FIGE quand le filleul vient : c'est la promesse de ce jour-là. */
  const avancer = (r: ReferralData & { id: string }) =>
    SUITE[r.status] &&
    upsert('referrals', r.id, {
      ...r,
      status: SUITE[r.status] as ReferralStatus,
      updatedAt: new Date().toISOString(),
      ...(SUITE[r.status] === 'venu' && r.primeCents === undefined && programme ? { primeCents: programme.primeCents } : {}),
    });
  const enregistrerBareme = async () => {
    const cents = Math.round((Number((bareme ?? '').replace(',', '.')) || 0) * 100);
    if (cents <= 0) return;
    await upsert('referrals', ID_PROGRAMME, { kind: 'programme', primeCents: cents });
    setBareme(null);
  };
  /* Un filleul venu AVANT que la prime soit définie doit la prime du barème : elle n'a pas encore été versée. */
  const dueDe = (nom: string) => primeDue(liens.map((l) => ({ ...l, primeCents: l.primeCents ?? programme?.primeCents })), nom);
  const statut = (s: ReferralStatus) => t(`parrainage.statut.${s}` as Parameters<typeof t>[0]);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('parrainage.titre') })}
          title={t('parrainage.titre')}
          description={dues > 0 ? t('parrainage.dues', { n: dues }) : t('parrainage.description')}
          stats={[
            { label: t('parrainage.stat.parrainages'), value: lignes.length },
            { label: t('parrainage.stat.venus'), value: lignes.filter((r) => r.status !== 'invite').length },
            { label: t('parrainage.stat.dues'), value: dues, emphasis: dues > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('parrainage.ajouter')}
            </button>
          }
        />
      </motion.div>

      {/* ── L'OBJET DOMINANT : l'arbre de filiation ────────────────────── */}
      {racines.length > 0 && (
        <motion.div variants={staggerItem}>
          <ArbreDeFiliation
            racines={racines}
            formatCents={formatCents}
            dueDe={dueDe}
            pied={
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[12.5px] text-text-muted">
                {bareme === null ? (
                  <>
                    <span>
                      {programme
                        ? `Prime : ${formatCents(programme.primeCents)} par filleul venu. Chaque parrain a son code ; un filleul qui le donne retrouve son parrain.`
                        : 'Aucune prime définie : les codes tracent qui a amené qui, sans rien devoir.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBareme(programme ? String(programme.primeCents / 100).replace('.', ',') : '')}
                      className="flex min-h-11 items-center border border-border-strong px-3 font-semibold text-text-body hover:bg-surface-hover md:min-h-[30px]"
                    >
                      {programme ? 'Modifier la prime' : 'Définir une prime'}
                    </button>
                  </>
                ) : (
                  <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void enregistrerBareme(); }}>
                    <input value={bareme} onChange={(e) => setBareme(e.target.value)} inputMode="decimal" autoFocus aria-label="Prime par filleul venu, en euros" placeholder="Prime en €" className="input-focus min-h-11 w-32 border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-[30px]" />
                    <button type="submit" className="flex min-h-11 items-center bg-text-primary px-3 font-semibold text-[#0a0a0a] md:min-h-[30px]">Enregistrer</button>
                    <button type="button" onClick={() => setBareme(null)} className="flex min-h-11 items-center px-2 text-text-secondary hover:text-text-primary md:min-h-[30px]">{t('chrome.fermer')}</button>
                  </form>
                )}
              </div>
            }
          />
        </motion.div>
      )}

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
          <input value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder={t('parrainage.champParrain')} aria-label={t('parrainage.champParrain')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={referred} onChange={(e) => setReferred(e.target.value)} placeholder={t('parrainage.champFilleul')} aria-label={t('parrainage.champFilleul')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder={t('parrainage.champRecompense')} aria-label={t('parrainage.champRecompense')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input
            value={codeSaisi}
            onChange={(e) => {
              setCodeSaisi(e.target.value);
              const p = parrainDuCode(e.target.value);
              if (p) setReferrer(p);
            }}
            placeholder="Code donné par le filleul (facultatif)"
            aria-label="Code donné par le filleul"
            className="input-focus min-h-11 border border-border bg-bg px-3 font-mono text-sm uppercase text-text-primary outline-none sm:col-span-3"
          />
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button type="submit" disabled={!(referrer.trim() || parrainDuCode(codeSaisi)) || !referred.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('parrainage.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {lignes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('parrainage.vide.titre')} action={{ label: t('parrainage.vide.action'), onClick: () => setOuvert(true) }}>{t('parrainage.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <ul className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
            {lignes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <HeartHandshake size={18} className="flex-shrink-0 text-text-muted" />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">{r.referrer} <span className="text-text-muted">→</span> {r.referred}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {r.code ?? codeParrain(r.referrer)} · {r.reward || t('parrainage.sansRecompense')}
                      {r.primeCents ? ` · prime ${formatCents(r.primeCents)}${r.status === 'recompense' ? ' versée' : ' due'}` : ''} · {relativeTime(r.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${r.status === 'recompense' ? 'border-success/40 text-success' : r.status === 'venu' ? 'border-warning/40 text-warning' : 'border-border text-text-muted'}`}>{statut(r.status)}</span>
                  {SUITE[r.status] && (
                    <button type="button" onClick={() => void avancer(r)} className="flex min-h-11 items-center gap-1 border border-border-strong px-2.5 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                      {statut(SUITE[r.status] as ReferralStatus)} <ArrowRight size={11} />
                    </button>
                  )}
                  <button type="button" onClick={() => void remove('referrals', r.id)} aria-label={t('parrainage.supprimer')} title={t('parrainage.supprimer')} className="flex min-h-11 items-center px-2 text-text-muted hover:text-danger md:min-h-0"><Trash2 size={12} /></button>
                </div>
              </li>
            ))}
          </ul>
          {meilleurs.length > 0 && (
            <aside className="rounded-xl border border-border bg-surface p-4">
              <p className="eyebrow mb-2">{t('parrainage.meilleurs')}</p>
              <ol className="flex flex-col gap-1.5">
                {meilleurs.map(([nom, n]) => (
                  <li key={nom} className="flex items-center justify-between text-sm"><span className="truncate text-text-primary">{nom}</span><span className="tnum font-mono text-xs text-text-muted">{n}</span></li>
                ))}
              </ol>
            </aside>
          )}
        </motion.div>
      )}
    </motion.section>
  );
}

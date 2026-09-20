import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarOff, Check, Plus, X } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type LeaveKind = 'conge' | 'maladie' | 'teletravail' | 'autre';
type LeaveStatus = 'pending' | 'approved' | 'declined';
interface LeaveData {
  email: string;
  from: string;
  to: string;
  kind: LeaveKind;
  note: string;
  status: LeaveStatus;
  decidedBy: string | null;
  createdAt: string;
}
type Absence = LeaveData & { id: string };
/** Le droit à congés d'une personne pour une année. Voir `leaveQuotas`. */
interface LeaveQuotaData {
  email: string;
  days: number;
  year: number;
}
const KINDS: LeaveKind[] = ['conge', 'maladie', 'teletravail', 'autre'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const JOUR_MS = 86_400_000;

/*
  ═════════════════════════════════════════════════════════════════════
  LE CARNET À SOUCHES — pourquoi des tickets plutôt qu'un solde chiffré
  ═════════════════════════════════════════════════════════════════════

  « 18 jours restants » et « 6 jours restants » sont deux lignes de texte de
  la même longueur, à la même place, dans la même encre. Il faut LIRE les deux
  nombres et les comparer de tête pour voir qu'une personne est très en
  retard. Cinq carnets côte à côte se comparent sans lire : celui qui déborde
  déborde.

  `TICKET_H` est volontairement petit. Le nombre de tickets est le NOMBRE DE
  JOURS RÉEL, jamais une échelle : vingt-cinq jours font vingt-cinq tickets, et
  c'est cette absence de mise à l'échelle qui rend deux carnets comparables.
  Une hauteur de ticket qui s'adapterait au total ferait exactement le
  contraire.

  L'empilement est `column-reverse` : les souches arrachées restent EN BAS, au
  talon, et les tickets encore détachables sont en haut. C'est le sens dans
  lequel un carnet s'use.
*/
const TICKET_H = 5;
const TICKET_ECART = 2;
/** En dessous de ce retard, on ne montre personne du doigt : c'est du bruit. */
const RETARD_MIN = 3;

interface Carnet {
  email: string;
  nom: string;
  total: number;
  pris: number;
  reste: number;
  /** Jours qui auraient dû être pris à ce stade de l'année, arrondis. */
  attendu: number;
  /** `attendu − pris` : positif quand la personne est en retard. */
  retard: number;
  /** Ce qui est déjà posé devant elle, ou rien. */
  note: string;
}

/** Les jours OUVRÉS d'une plage, bornes comprises — un congé ne mange pas les dimanches. */
function joursOuvres(du: string, au: string, borneBasse: string, borneHaute: string): number {
  const debut = Math.max(Date.parse(`${du}T00:00:00`), Date.parse(`${borneBasse}T00:00:00`));
  const fin = Math.min(Date.parse(`${au}T00:00:00`), Date.parse(`${borneHaute}T00:00:00`));
  let n = 0;
  for (let t = debut; t <= fin; t += JOUR_MS) {
    const j = new Date(t).getDay();
    if (j >= 1 && j <= 5) n += 1;
  }
  return n;
}

/** La part de l'année écoulée, entre 0 et 1 — sert à dire qui est en retard. */
function partDeLAnneeEcoulee(maintenant: Date): number {
  const debut = new Date(maintenant.getFullYear(), 0, 1).getTime();
  const fin = new Date(maintenant.getFullYear() + 1, 0, 1).getTime();
  return Math.min(1, Math.max(0, (maintenant.getTime() - debut) / (fin - debut)));
}

/**
 * LES ABSENCES — congés, maladie, télétravail, et les carnets de chacun.
 *
 * Pour qui : une équipe où l'absence se dit à l'oral et se découvre le jour
 * même. Ce que ça règle : une demande datée, validée par qui gère, lisible
 * par tous — et le solde de congés, qui est la question qu'on pose vraiment.
 *
 * ## Ce qui domine : cinq carnets côte à côte
 *
 * L'écran portait une frise de quinze jours, qui répondait bien à « quand
 * l'équipe sera-t-elle mince ». C'était une bonne question, mais pas celle de
 * ce module : c'est le Planning d'équipe qui couvre la charge au jour le jour,
 * et deux écrans voisins qui répondent à la même chose sont un écran de trop.
 * Ce que seul ce module sait, c'est où en est CHACUN de son droit.
 *
 * Voir l'en-tête des constantes pour le carnet lui-même : pourquoi des
 * tickets, pourquoi pas d'échelle, et pourquoi l'empilement part du bas.
 *
 * ## Le droit à congés : un écart assumé avec la version précédente
 *
 * Cet écran affirmait qu'un compteur de jours « serait une paie, et ce n'en
 * est pas une ». La crainte était juste, la conclusion trop large : un droit
 * à congés est une donnée d'organisation. Il n'y a ici ni acquisition
 * mensuelle, ni ancienneté, ni conversion en argent — un nombre de jours par
 * personne, saisi à la main, dans `leaveQuotas`.
 *
 * Et AUCUNE valeur par défaut : sans droit saisi, pas de carnet et pas de
 * solde. Un « 25 » inventé afficherait un reste faux avec l'aplomb d'un reste
 * vrai, ce qui est pire que de ne rien afficher.
 *
 * ## L'ambre : le carnet de la personne en retard
 *
 * Le carnet ENTIER est une seule région ambre. « En retard » est mesuré, pas
 * décrété : on compare ce qui est pris à ce qui devrait l'être à ce stade de
 * l'année, et on ne montre personne du doigt en dessous de trois jours
 * d'écart. Quand personne n'est en retard, l'écran n'a aucun ambre.
 */
export function LeavesScreen() {
  const { t, langue } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const { membres } = useMembers();
  const brutes = useCollection<LeaveData>('leaves');
  const quotas = useCollection<LeaveQuotaData>('leaveQuotas');
  const [ouvert, setOuvert] = useState(false);
  const [kind, setKind] = useState<LeaveKind>('conge');
  const [from, setFrom] = useState(aujourdhui());
  const [to, setTo] = useState(aujourdhui());
  const [note, setNote] = useState('');
  const [droitsOuverts, setDroitsOuverts] = useState(false);
  const moi = user?.email ?? '';
  const admin = isAdminRole(role);
  const jour = aujourdhui();
  const annee = new Date().getFullYear();

  const absences = useMemo(() => [...brutes].sort((a, b) => a.from.localeCompare(b.from)), [brutes]);
  const absentsAujourdhui = absences.filter((a) => a.status === 'approved' && a.from <= jour && a.to >= jour);
  const enAttente = absences.filter((a) => a.status === 'pending');
  const aVenir = absences.filter((a) => a.status === 'approved' && a.to >= jour);
  const passees = absences.filter((a) => a.status !== 'pending' && a.to < jour);

  const libelleKind = (k: LeaveKind) => t(`absences.type.${k}` as Parameters<typeof t>[0]);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const dates = (a: LeaveData) => {
    const f = new Date(`${a.from}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const d = new Date(`${a.to}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return a.from === a.to ? f : `${f} → ${d}`;
  };

  /*
    LES CARNETS. Un par personne QUI A UN DROIT SAISI pour l'année en cours —
    les autres n'ont pas de carnet, et l'écran le dit plutôt que d'en inventer
    un. Seuls les congés comptent : un arrêt maladie et une journée à distance
    ne se retirent d'aucun carnet.
  */
  const debutAnnee = `${annee}-01-01`;
  const finAnnee = `${annee}-12-31`;
  const carnets = useMemo<Carnet[]>(() => {
    const part = partDeLAnneeEcoulee(new Date());
    return membres
      .map((m) => {
        const droit = quotas.find((q) => q.email === m.email && q.year === annee);
        if (!droit || droit.days <= 0) return null;
        const pris = absences
          .filter((a) => a.email === m.email && a.kind === 'conge' && a.status === 'approved')
          .reduce((n, a) => n + joursOuvres(a.from, a.to, debutAnnee, finAnnee), 0);
        const devant = absences
          .filter((a) => a.email === m.email && a.kind === 'conge' && a.status === 'approved' && a.from > jour)
          .sort((a, b) => a.from.localeCompare(b.from))[0];
        const attendu = Math.round(droit.days * part);
        return {
          email: m.email,
          nom: profileFor(m.email).name,
          total: droit.days,
          pris,
          reste: Math.max(0, droit.days - pris),
          attendu,
          retard: attendu - pris,
          note: devant ? t('absences.dejaPose', { dates: dates(devant) }) : t('absences.rienDePose'),
        };
      })
      .filter((c): c is Carnet => c !== null)
      .sort((a, b) => b.retard - a.retard || a.nom.localeCompare(b.nom, 'fr'));
  }, [membres, quotas, absences, annee, debutAnnee, finAnnee, jour, profileFor, t]);

  const enRetard = carnets.filter((c) => c.retard >= RETARD_MIN);
  const carnetAmbre = enRetard[0] ?? null;
  const halo = useHaloSignal(Boolean(carnetAmbre));

  /*
    LA FERMETURE D'ATELIER, DÉDUITE ET NON DÉCLARÉE.

    Le modèle n'a pas de type « fermeture ». Il n'en a pas besoin : une
    fermeture EST le jour où tout le monde est en congé en même temps. On
    cherche donc les jours du trimestre à venir couverts par un congé validé
    de CHAQUE personne, et on en fait des plages contiguës.
  */
  const fermetures = useMemo(() => {
    if (membres.length === 0) return [];
    const emails = membres.map((m) => m.email);
    const debut = Date.parse(`${jour}T00:00:00`);
    const plages: { du: string; au: string }[] = [];
    let courante: { du: string; au: string } | null = null;
    for (let i = 0; i < 92; i += 1) {
      const d = new Date(debut + i * JOUR_MS).toISOString().slice(0, 10);
      const tous = emails.every((e) =>
        absences.some((a) => a.email === e && a.status === 'approved' && a.from <= d && a.to >= d),
      );
      if (tous) {
        if (courante) courante.au = d;
        else courante = { du: d, au: d };
      } else if (courante) {
        plages.push(courante);
        courante = null;
      }
    }
    if (courante) plages.push(courante);
    return plages;
  }, [membres, absences, jour]);

  /* Ce qui est posé sur le trimestre à venir — congés validés seulement. */
  const finDuTrimestre = new Date(Date.parse(`${jour}T00:00:00`) + 92 * JOUR_MS).toISOString().slice(0, 10);
  const posees = absences.filter((a) => a.status === 'approved' && a.from <= finDuTrimestre && a.to >= jour);

  const totalPris = carnets.reduce((n, c) => n + c.pris, 0);
  const totalDroit = carnets.reduce((n, c) => n + c.total, 0);
  const totalReste = carnets.reduce((n, c) => n + c.reste, 0);

  const demander = async () => {
    if (!moi || !from || !to || to < from) return;
    await upsert('leaves', uid('leave'), { email: moi, from, to, kind, note: note.trim(), status: admin ? 'approved' : 'pending', decidedBy: admin ? moi : null, createdAt: new Date().toISOString() });
    setNote('');
    setOuvert(false);
  };
  const decider = (a: Absence, status: LeaveStatus) => upsert('leaves', a.id, { ...a, status, decidedBy: moi });
  const poserLeDroit = (email: string, days: number) =>
    upsert('leaveQuotas', `quota-${email}`, { email, days: Math.max(0, Math.round(days)), year: annee });

  const Ligne = ({ a }: { a: Absence }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 bg-surface px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar email={a.email} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">
            {profileFor(a.email).name} <span className="text-text-muted">· {libelleKind(a.kind)}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {dates(a)}
            {a.note && <span className="normal-case tracking-normal"> · {a.note}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${a.status === 'approved' ? 'border-success/40 text-success' : a.status === 'declined' ? 'border-border text-text-muted' : 'border-warning/40 text-warning'}`}>
          {t(`absences.statut.${a.status}` as Parameters<typeof t>[0])}
        </span>
        {a.status === 'pending' && admin && a.email !== moi && (
          <>
            <button type="button" onClick={() => void decider(a, 'approved')} className="flex min-h-11 items-center gap-1 border border-border-strong px-2.5 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5"><Check size={12} /> {t('absences.valider')}</button>
            <button type="button" onClick={() => void decider(a, 'declined')} className="flex min-h-11 items-center gap-1 border border-border px-2.5 text-xs text-text-muted hover:text-text-primary md:min-h-0 md:py-1.5"><X size={12} /> {t('absences.refuser')}</button>
          </>
        )}
        {(a.email === moi || admin) && a.status !== 'approved' && (
          <button type="button" onClick={() => void remove('leaves', a.id)} className="border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-danger">{t('absences.retirer')}</button>
        )}
      </div>
    </li>
  );

  const vide = absences.length === 0 && !ouvert;

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('collectif.surtitre', { module: t('absences.titre') })}
            title={t('absences.titre')}
            description={absentsAujourdhui.length > 0 ? t('absences.aujourdhui', { noms: absentsAujourdhui.map((a) => profileFor(a.email).name).join(', ') }) : t('absences.toutLeMonde')}
            phraseVide={t('absences.vide.phrase')}
            stats={[
              { label: t('absences.stat.absents'), value: absentsAujourdhui.length, emphasis: absentsAujourdhui.length > 0 },
              { label: t('absences.stat.aValider'), value: enAttente.length, emphasis: admin && enAttente.length > 0 },
              { label: t('absences.stat.aVenir'), value: aVenir.length },
            ]}
            actions={
              <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Plus size={16} strokeWidth={2} /> {t('absences.demander')}
              </button>
            }
          />
        </motion.div>

        {ouvert && (
          <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void demander(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                {t('absences.champType')}
                <select value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                  {KINDS.map((k) => <option key={k} value={k}>{libelleKind(k)}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                {t('absences.champDu')}
                <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                {t('absences.champAu')}
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
              </label>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('absences.champNote')} aria-label={t('absences.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="bg-accent px-4 py-2 text-sm font-semibold text-bg">{admin ? t('absences.enregistrer') : t('absences.envoyer')}</button>
              <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
            </div>
          </motion.form>
        )}

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('absences.vide.titre')} action={{ label: t('absences.vide.action'), onClick: () => setOuvert(true) }}>{t('absences.vide.texte')}</FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : les carnets à souches ═══ */}
            <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">{t('absences.lesCarnets', { annee })}</p>
                {admin && (
                  <button type="button" onClick={() => setDroitsOuverts((v) => !v)} className="font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary">
                    {t('absences.reglerLesDroits')}
                  </button>
                )}
              </div>

              {carnets.length === 0 ? (
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-text-secondary">{t('absences.aucunDroitSaisi')}</p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {carnets.map((c) => {
                    const ambre = carnetAmbre?.email === c.email;
                    return (
                      <article
                        key={c.email}
                        data-signal-groupe={ambre ? 'carnet-en-retard' : undefined}
                        className={`flex flex-col gap-2.5 p-3 ${ambre ? 'bg-signal text-signal-ink' : 'border border-border bg-surface'}`}
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar email={c.email} size={22} surAmbre={ambre} />
                          <span className={`min-w-0 truncate text-sm font-semibold ${ambre ? '' : 'text-text-primary'}`}>{c.nom}</span>
                        </div>
                        <p className={`font-mono text-[10px] font-bold uppercase tracking-wider ${ambre ? 'opacity-80' : 'text-text-muted'}`}>
                          {t('absences.prisSurTotal', { pris: c.pris, total: c.total })}
                        </p>

                        {/*
                          LA PILE. `flex-col-reverse` : le premier élément du
                          tableau se rend EN BAS. Les souches arrachées sont
                          donc écrites en premier et restent au talon, les
                          tickets encore détachables montent au-dessus.
                        */}
                        <div className="flex flex-col-reverse" style={{ gap: TICKET_ECART }}>
                          {Array.from({ length: c.total }, (_, i) => {
                            const souche = i < c.pris;
                            return (
                              <span
                                key={i}
                                aria-hidden
                                style={{
                                  height: TICKET_H,
                                  backgroundColor: souche
                                    ? ambre
                                      ? 'rgba(8, 8, 8, 0.22)'
                                      : 'var(--color-sunken)'
                                    : ambre
                                      ? 'var(--color-signal-ink)'
                                      : 'var(--color-text-body)',
                                  borderTop: souche
                                    ? ambre
                                      ? '1px dashed rgba(8, 8, 8, 0.45)'
                                      : '1px dashed var(--color-border-strong)'
                                    : 'none',
                                }}
                              />
                            );
                          })}
                        </div>

                        <p className={`text-[23px] font-semibold tabular-nums leading-none ${ambre ? '' : 'text-text-primary'}`}>
                          {c.reste}
                          <span className="ml-1 text-[11px] font-normal">{t('absences.joursRestants')}</span>
                        </p>
                        <p className={`text-[11px] leading-snug ${ambre ? 'opacity-85' : 'text-text-muted'}`}>
                          {ambre ? t('absences.enRetardDe', { n: c.retard }) : c.note}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}

              {droitsOuverts && admin && (
                <div className="mt-5 border-t border-border-strong pt-4">
                  <p className="eyebrow mb-3">{t('absences.droitsDeLAnnee', { annee })}</p>
                  <ul className="flex flex-wrap gap-3">
                    {membres.map((m) => {
                      const droit = quotas.find((q) => q.email === m.email && q.year === annee);
                      return (
                        <li key={m.id} className="flex items-center gap-2">
                          <UserAvatar email={m.email} size={22} />
                          <label className="flex items-center gap-2 text-sm text-text-secondary">
                            <span className="max-w-[9rem] truncate">{profileFor(m.email).name}</span>
                            <input
                              type="number"
                              min={0}
                              max={366}
                              defaultValue={droit?.days ?? ''}
                              aria-label={t('absences.droitDe', { nom: profileFor(m.email).name })}
                              onBlur={(e) => e.target.value !== '' && void poserLeDroit(m.email, Number(e.target.value))}
                              className="input-focus min-h-11 w-20 border border-border bg-bg px-2 text-sm text-text-primary outline-none"
                            />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </motion.section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — ce qui est posé sur le trimestre, fermetures comprises. */}
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('absences.leTrimestre')}</p>
                {fermetures.length > 0 && (
                  <p className="border-b border-border px-4 py-3 text-sm leading-relaxed text-text-body">
                    {t('absences.fermetureAtelier', {
                      dates: fermetures
                        .map((f) => (f.du === f.au ? dates({ from: f.du, to: f.au } as LeaveData) : dates({ from: f.du, to: f.au } as LeaveData)))
                        .join(', '),
                    })}
                  </p>
                )}
                {posees.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-text-muted">{t('absences.rienSurLeTrimestre')}</p>
                ) : (
                  <ul className="flex flex-col gap-px bg-border">
                    {posees.map((a) => <Ligne key={a.id} a={a} />)}
                  </ul>
                )}
              </motion.section>

              {/* À DROITE — les trois chiffres du droit collectif. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('absences.leCompteCollectif')}</p>
                {carnets.length === 0 ? (
                  <p className="text-sm leading-relaxed text-text-secondary">{t('absences.aucunDroitSaisiCourt')}</p>
                ) : (
                  <dl className="flex flex-col gap-3">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('absences.prisSurLeTotal')}</dt>
                      <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{totalPris} / {totalDroit}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('absences.aSolderAvantDecembre')}</dt>
                      <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{totalReste}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('absences.personnesEnRetard')}</dt>
                      <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{enRetard.length}</dd>
                    </div>
                  </dl>
                )}
              </motion.aside>
            </div>

            {/* LES DEMANDES À VALIDER — la décision de qui gère, sans ambre :
                l'ambre de cet écran est sur le carnet, et il n'y en a qu'un. */}
            {admin && enAttente.length > 0 && (
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('absences.stat.aValider')}</p>
                <ul className="flex flex-col gap-px bg-border">
                  {enAttente.map((a) => <Ligne key={a.id} a={a} />)}
                </ul>
              </motion.section>
            )}

            <motion.section variants={staggerItem}>
              <p className="eyebrow mb-2 flex items-center gap-2"><CalendarOff size={12} /> {t('absences.leRegistre')}</p>
              <ul className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
                {[...(admin ? [] : enAttente), ...aVenir, ...passees].map((a) => <Ligne key={a.id} a={a} />)}
              </ul>
            </motion.section>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}

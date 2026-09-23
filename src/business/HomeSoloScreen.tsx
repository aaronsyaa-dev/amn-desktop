import React, { useEffect, useMemo, useState } from 'react';
import { isModuleEnabled } from '../data/spaces';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useClients } from '../state/useClients';
import { useCollection } from '../state/SyncContext';
import { appointmentEnd, useAppointments, type Appointment } from '../state/useAppointments';
import { capitaliserPhrase, longDayLabel, dayKey } from '../lib/calendar';
import { useAttention } from '../state/useAttention';
import type { AttentionItem } from '../lib/attention';
import { Majordome } from './Majordome';
import { homeWelcome, parcSerein } from '../lib/homeGreetings';
import { useLangue } from '../i18n';
import type { SharedTaskStatus } from '../shared/api';
import { useInvoices, isoDay } from '../state/useInvoices';
import { EcranVide } from '../components/EtatEcran';
import { enjeuDuJour } from '../lib/enjeu';
import { PremierJour } from '../components/etats/EtatsTransverses';

/**
 * ACCUEIL — L'AXE DE LA JOURNÉE (système de design, `12a`)
 * ═══════════════════════════════════════════════════════
 *
 * L'objet dominant de cet écran est un AXE TEMPOREL PROPORTIONNEL, et c'est
 * la seule chose qui compte dans sa composition : chaque rendez-vous y occupe
 * sa vraie place et sa vraie durée, et l'heure qu'il est se lit à la position
 * d'un trait, pas dans un libellé.
 *
 * Ce que l'instrument remplace. L'écran posait auparavant un cadran de
 * progression (« 62 % de la journée ») à côté d'une carte « Maintenant ». Les
 * deux disaient la même chose deux fois, et aucune des deux ne répondait à la
 * question qu'on se pose en ouvrant l'Accueil : est-ce que mon après-midi est
 * plein ou vide, et qu'est-ce qui reste. Un pourcentage ne montre pas un trou
 * de deux heures entre 14 h et 16 h ; un axe le montre sans un mot.
 *
 * LES TROIS RÈGLES DE GÉOMÉTRIE, et pourquoi elles ne sont pas négociables :
 *
 *   1. L'axe se resserre sur la JOURNÉE OUVRÉE (08 → 20), pas sur 24 h. Sur
 *      24 h, un créneau de 45 min fait 3 % de la largeur — illisible, donc
 *      inutile.
 *   2. Les positions se DÉDUISENT des horaires (voir `place()`), jamais
 *      posées à la main. Un bloc dont la position est écrite en dur ment dès
 *      que la donnée change, et c'est le défaut le plus grave qu'un
 *      instrument puisse avoir.
 *   3. Les graduations sont en POSITIONS ABSOLUES calculées (0 / 16,67 /
 *      33,33 / 50 / 66,67 / 83,33 / 100 %), jamais en cellules `flex` : en
 *      `flex`, l'erreur d'arrondi s'accumule d'une cellule à l'autre et la
 *      graduation « 14 » finit décalée du trait de 14 h.
 *
 * L'AMBRE. Un seul bloc au maximum, et ce n'est PAS le prochain rendez-vous
 * par défaut : c'est celui qui porte un enjeu non tranché — le rendez-vous
 * d'un client dont un devis attend une réponse, ou dont une facture est en
 * retard. Si aucun rendez-vous du jour ne porte d'enjeu, l'écran n'a pas
 * d'ambre, et c'est normal. Le relevé du prochain rendez-vous, sous l'axe,
 * reste en encre claire même quand il s'agit du même rendez-vous : c'est la
 * même donnée rappelée, pas un deuxième signal.
 */

/** L'axe couvre la journée ouvrée. Douze heures, douze colonnes égales. */
const AXE_DEBUT = 8;
const AXE_FIN = 20;
const AXE_HEURES = AXE_FIN - AXE_DEBUT;

/** Les graduations : toutes les deux heures, aux positions calculées. */
const GRADUATIONS = Array.from({ length: AXE_HEURES / 2 + 1 }, (_, i) => {
  const heure = AXE_DEBUT + i * 2;
  return { heure, pct: ((heure - AXE_DEBUT) / AXE_HEURES) * 100 };
});

/**
 * L'heure décimale d'un instant, ramenée à l'axe. C'est la seule fonction qui
 * convertit du temps en pourcentage, et tout l'instrument en dépend : le
 * trait de l'heure courante, les blocs, les graduations.
 */
function pctDe(date: Date): number {
  const heures = date.getHours() + date.getMinutes() / 60;
  return ((heures - AXE_DEBUT) / AXE_HEURES) * 100;
}

/**
 * La place d'un rendez-vous sur l'axe : son bord gauche et sa largeur, en
 * pourcentage. Un créneau de 45 min occupe 6,25 % (0,75 h / 12 h), une heure
 * 8,33 % — c'est la proportion qui fait l'instrument, pas une catégorie de
 * taille. Un rendez-vous qui déborde de l'axe est rogné à ses bords plutôt
 * qu'écarté : une réunion de 19 h 30 à 21 h existe, et sa moitié visible dit
 * qu'elle mord sur la soirée.
 */
function place(rdv: Appointment): { gauche: number; largeur: number } | null {
  const debut = new Date(rdv.startAt);
  const fin = new Date(appointmentEnd(rdv));
  const g = pctDe(debut);
  const d = pctDe(fin);
  if (d <= 0 || g >= 100) return null;
  const gauche = Math.max(0, g);
  const largeur = Math.min(100, d) - gauche;
  return largeur > 0 ? { gauche, largeur } : null;
}

function heureCourte(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** « 1 H », « 45 MIN » — la durée gravée sur le bloc ambre, en mono. */
function dureeGravee(min: number): string {
  if (min >= 60 && min % 60 === 0) return `${min / 60} H`;
  if (min >= 60) return `${Math.floor(min / 60)} H ${min % 60}`;
  return `${min} MIN`;
}

function dansCombien(iso: string, maintenant: Date): string {
  const delta = new Date(iso).getTime() - maintenant.getTime();
  if (delta <= 0) return 'en cours';
  const min = Math.round(delta / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h} h` : `${h} h ${String(min % 60).padStart(2, '0')}`;
}

interface TacheLigne {
  status?: string;
}

/** Ce que l'Accueil lit du stock : juste de quoi reconnaître une rupture. */
interface ArticleStock {
  name: string;
  quantity?: number;
  minQuantity?: number | null;
}

export function HomeSoloScreen() {
  const { user, org } = useAuth();
  const { appointments } = useAppointments();
  const { clients, quotes } = useClients();
  const tasks = useCollection<TacheLigne>('tasks');
  const attention = useAttention();
  const { langue } = useLangue();
  const serein = parcSerein({ attentions: attention.items.length, regarde: attention.checkedAt !== null });

  /* L'heure qu'il est bouge : le trait se déplace, le compte à rebours décroît. */
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const cleDuJour = dayKey(maintenant);
  const duJour = useMemo(
    () =>
      appointments
        .filter((a) => dayKey(new Date(a.startAt)) === cleDuJour)
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [appointments, cleDuJour],
  );

  const prochain = useMemo(
    () => duJour.find((a) => new Date(appointmentEnd(a)).getTime() > maintenant.getTime()) ?? null,
    [duJour, maintenant],
  );

  const { invoices } = useInvoices();
  const jourIso = isoDay(maintenant);

  /*
    L'ENJEU NON TRANCHÉ — ce qui décide de l'ambre, et rien d'autre.

    Le paquet de design est explicite : « pas le prochain par défaut, mais
    celui qui porte un enjeu non tranché ». Traduit dans le vrai modèle de
    données, un rendez-vous porte un enjeu quand son client a soit un devis
    parti et sans réponse, soit une facture échue. Ce sont les deux seules
    choses qui, dans ce produit, attendent une décision d'un tiers et que le
    rendez-vous du jour permet justement de trancher en main propre.

    S'il n'y en a aucun, `enJeu` vaut `null` et l'écran n'a pas d'ambre. C'est
    prévu, pas un oubli : un après-midi sans enjeu ne doit rien signaler.
  */
  const enJeu = useMemo(() => enjeuDuJour(duJour, quotes, invoices, jourIso, maintenant), [duJour, quotes, invoices, jourIso, maintenant]);

  /* La phrase du relevé : ce qui se joue au prochain rendez-vous, s'il se joue quelque chose. */
  const phraseProchain = useMemo(() => {
    if (!prochain) return '';
    if (enJeu && enJeu.rdv.id === prochain.id) {
      if (enJeu.motif === 'devis') {
        return enJeu.jours !== null
          ? `Un devis attend une réponse depuis ${enJeu.jours} jour${enJeu.jours > 1 ? 's' : ''}.`
          : 'Un devis attend une réponse.';
      }
      return enJeu.jours !== null
        ? `Une facture est échue depuis ${enJeu.jours} jour${enJeu.jours > 1 ? 's' : ''}.`
        : 'Une facture est échue.';
    }
    return prochain.notes?.trim() || prochain.location?.trim() || '';
  }, [prochain, enJeu]);

  /*
    LES TROIS CHOSES À TRAITER — la carte calme de gauche, sans ambre.

    Deux sources, et c'est voulu. Le moteur d'attention (`lib/attention.ts`)
    fournit les factures en retard, les devis sans réponse, les tâches
    dormantes. Les RUPTURES DE STOCK viennent directement de la collection
    parce que le moteur n'en produit pas : il n'a pas de règle `stock`. C'est
    une lacune réelle du produit, pas un choix de composition — le système de
    design réserve le rouge aux ruptures de stock (« ce n'est pas de la
    signalisation, c'est un état de fait », `27e`), or cet écran n'avait aucun
    moyen d'en montrer une. Elles sont donc lues ici, et signalées comme
    telles. Les faire remonter dans le moteur serait le bon endroit à terme ;
    ce serait une modification de son contrat, contrôlé par `check:attention`,
    et donc un autre chantier que celui-ci.
  */
  const articlesStock = useCollection<ArticleStock>('stockItems');
  const ruptures = useMemo<AttentionItem[]>(
    () =>
      articlesStock
        .filter((a) => typeof a.minQuantity === 'number' && a.minQuantity !== null && (a.quantity ?? 0) <= 0)
        .slice(0, 2)
        .map((a) => ({
          key: `stock-${a.name}`,
          kind: 'invoice-overdue' as AttentionItem['kind'],
          severity: 'critical' as const,
          title: a.name,
          evidence: `Stock épuisé · seuil ${a.minQuantity ?? 0}`,
          action: 'rupture',
          to: '/stock',
          weight: 10_000,
        })),
    [articlesStock],
  );
  const aTraiter = useMemo(() => [...ruptures, ...attention.items].slice(0, 3), [ruptures, attention.items]);
  const totalATraiter = ruptures.length + attention.items.length;
  const plusLourd = useMemo(() => Math.max(1, ...aTraiter.map((i) => i.weight)), [aTraiter]);

  /* La semaine en sept barres d'heures occupées, le jour courant en encre claire. */
  const semaine = useMemo(() => {
    const lundi = new Date(maintenant);
    lundi.setHours(0, 0, 0, 0);
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
    const jours = Array.from({ length: 7 }, (_, i) => {
      const j = new Date(lundi);
      j.setDate(lundi.getDate() + i);
      const cle = dayKey(j);
      const minutes = appointments
        .filter((a) => dayKey(new Date(a.startAt)) === cle)
        .reduce((s, a) => s + Math.max(0, a.durationMin), 0);
      return { cle, lettre: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i], minutes, courant: cle === cleDuJour };
    });
    const plafond = Math.max(60, ...jours.map((j) => j.minutes));
    return { jours, plafond, total: jours.reduce((s, j) => s + j.minutes, 0) };
  }, [appointments, cleDuJour, maintenant]);

  const minutesOccupees = duJour.reduce((s, a) => s + Math.max(0, a.durationMin), 0);
  const traitPct = Math.min(100, Math.max(0, pctDe(maintenant)));
  const heureDansLAxe = traitPct > 0 && traitPct < 100;
  const rienDuTout = appointments.length === 0 && tasks.length === 0 && clients.length === 0;

  return (
    <EcranVide quand={rienDuTout} premierJour={rienDuTout}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="eyebrow mb-2.5">{org?.name ?? 'Votre activité'}</p>
            <h1 className="text-[26px] font-bold leading-none tracking-[-0.03em] text-text-primary sm:text-[33px]">
              {homeWelcome(user?.name?.split(' ')[0] ?? '', maintenant, serein, langue)}
            </h1>
            <p className="mt-2.5 max-w-[70ch] text-[14.5px] leading-[1.65] text-text-secondary [text-wrap:pretty]">
              {rienDuTout
                ? 'Rien n’est encore entré : la journée se remplira au fur et à mesure.'
                : phraseDuJour(duJour.length, minutesOccupees, totalATraiter)}
            </p>
            <p className="mt-1.5 font-mono text-[11px] tracking-[0.06em] text-text-muted">
              {capitaliserPhrase(longDayLabel(maintenant))}
            </p>
          </div>
          {isModuleEnabled('agenda') && !rienDuTout && (
            <Link
              to="/agenda"
              className="inline-flex h-[38px] flex-none items-center bg-accent px-4 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
            >
              Ouvrir l’agenda
            </Link>
          )}
        </header>

        {rienDuTout ? (
          /*
            LE PREMIER JOUR (`27b`) — le cas le plus difficile : tout est vide
            à la fois. L'axe garde ses graduations ET son trait d'heure
            courante, aux positions que `pctDe` donnera aux vrais rendez-vous ;
            une seule invitation sous lui ; les deux cartes calmes disent ce
            qu'elles contiendront, sans action et SANS AUCUN CHIFFRE À ZÉRO.
          */
          <PremierJour
            hauteurAxe={104 + 26}
            phraseAxe="La journée n’a rien encore. L’axe est déjà là : chaque rendez-vous s’y posera à sa vraie heure et à sa vraie durée, et le trait avancera dessus."
            titre="Votre journée se lira ici"
            phrase="Posez le premier rendez-vous : l’axe le montrera à sa place, et tout le reste de l’écran se remplira à partir de là."
            action={{ label: 'Poser un rendez-vous', onClick: () => { window.location.hash = '#/agenda'; } }}
            calmes={[
              {
                titre: 'Ce qui appellera',
                phrase:
                  'Les devis sans réponse, les factures en retard et les stocks qui manquent viendront ici — un par ligne, avec ce qui les a déclenchés.',
              },
              {
                titre: 'La semaine',
                phrase:
                  'Dès que des rendez-vous seront posés, la semaine se dessinera en dessous, jour par jour.',
              },
            ]}
            axe={
              <div className="relative h-full">
                <div
                  className="relative h-[104px] border border-dashed border-border-strong"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px calc(100% / 12))',
                  }}
                >
                  {heureDansLAxe && (
                    <div
                      className="absolute -top-[9px] -bottom-[9px] w-[2px] bg-current"
                      style={{ left: `${traitPct}%` }}
                      aria-hidden
                    />
                  )}
                </div>
                {/* Les graduations, aux MÊMES positions calculées : quand le
                    premier rendez-vous arrivera, il tombera là où l'écran
                    l'avait annoncé. */}
                <div className="relative mt-3 h-[14px] font-mono text-[9.5px] tracking-[0.08em]">
                  {GRADUATIONS.map(({ heure, pct }, i) => (
                    <span
                      key={heure}
                      className="absolute"
                      style={{ left: `${pct}%`, transform: i === 0 ? 'none' : i === GRADUATIONS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
                    >
                      {String(heure).padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            }
          />
        ) : (
          <>
            {/* ── L'OBJET DOMINANT : l'axe de la journée ─────────────────── */}
            <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
              <div className="mb-[22px] flex items-baseline justify-between">
                <span className="eyebrow text-text-secondary">
                  La journée · {String(AXE_DEBUT).padStart(2, '0')} → {AXE_FIN}
                </span>
                {/* Pas de « 0 ENTRÉE · 0 MIN » : un compteur à zéro se lit
                    comme un échec là où une phrase se lit comme un fait. */}
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                  {duJour.length === 0
                    ? 'RIEN DE POSÉ'
                    : `${duJour.length} ENTRÉE${duJour.length > 1 ? 'S' : ''} · ${dureeGravee(minutesOccupees)} OCCUPÉE${minutesOccupees >= 120 ? 'S' : ''}`}
                </span>
              </div>

              <div
                className="relative h-[104px] border border-border-raised bg-sunken"
                style={{
                  /* Les douze colonnes de l'axe — une heure chacune, dessinées
                     par le fond lui-même plutôt que par douze éléments vides. */
                  backgroundImage:
                    'repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px calc(100% / 12))',
                }}
              >
                {duJour.map((rdv) => {
                  const pos = place(rdv);
                  if (!pos) return null;
                  const passe = new Date(appointmentEnd(rdv)).getTime() <= maintenant.getTime();
                  const ambre = enJeu?.rdv.id === rdv.id;
                  return (
                    <div
                      key={rdv.id}
                      data-signal-groupe={ambre ? 'rdv-en-jeu' : undefined}
                      className={`absolute overflow-hidden box-border ${
                        ambre
                          ? 'top-[6px] bottom-[6px] bg-signal px-2 py-2.5 shadow-[0_0_26px_-4px_var(--color-signal-glow)]'
                          : passe
                            ? 'top-3 bottom-3 border border-[#2b2b2b] bg-[#1a1a1a] px-2.5 py-[9px]'
                            : 'top-3 bottom-3 border border-border-sheet bg-[#101010] px-2.5 py-[9px]'
                      }`}
                      style={{ left: `${pos.gauche}%`, width: `${pos.largeur}%` }}
                      title={`${heureCourte(rdv.startAt)} · ${rdv.title || 'Rendez-vous'}`}
                    >
                      <span
                        className={`tnum block font-mono ${
                          ambre
                            ? 'text-[11px] font-bold text-signal-ink'
                            : passe
                              ? 'text-[10px] font-medium text-text-muted'
                              : 'text-[10px] font-medium text-text-secondary'
                        }`}
                      >
                        {heureCourte(rdv.startAt)}
                      </span>
                      {ambre ? (
                        <span className="mt-1 block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-signal-ink">
                          {dureeGravee(rdv.durationMin)}
                        </span>
                      ) : (
                        pos.largeur >= 10 && (
                          <span className="mt-1.5 block truncate text-[12.5px] font-semibold text-text-secondary">
                            {rdv.clientName || rdv.title || 'Rendez-vous'}
                          </span>
                        )
                      )}
                    </div>
                  );
                })}

                {/* Le trait de l'heure qu'il est, à sa position réelle, et sa
                    pastille qui bat. Absent hors de la journée ouvrée : à
                    22 h, un trait collé au bord droit mentirait. */}
                {heureDansLAxe && (
                  <>
                    <div
                      className="absolute -top-[9px] -bottom-[9px] w-[2px] bg-text-primary"
                      style={{ left: `${traitPct}%` }}
                    />
                    <div
                      className="pouls-vivant absolute -top-[15px] h-[7px] w-[7px] -translate-x-1/2 bg-text-primary"
                      style={{ left: `${traitPct}%` }}
                      aria-hidden
                    />
                  </>
                )}
              </div>

              {/* Les graduations : positions absolues calculées, jamais des
                  cellules flex — l'erreur d'arrondi s'accumulerait. */}
              <div className="relative mt-3 h-[14px] font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
                {GRADUATIONS.map(({ heure, pct }, i) => (
                  <span
                    key={heure}
                    className="absolute"
                    style={
                      i === 0
                        ? { left: 0 }
                        : i === GRADUATIONS.length - 1
                          ? { right: 0 }
                          : { left: `${pct}%`, transform: 'translateX(-50%)' }
                    }
                  >
                    {String(heure).padStart(2, '0')}
                  </span>
                ))}
              </div>

              {/* Le relevé du prochain rendez-vous — attaché à son bloc, dans
                  la même carte, et en encre claire même si c'est le même que
                  le bloc ambre : c'est un rappel, pas un deuxième signal. */}
              {prochain ? (
                <div className="mt-6 flex flex-wrap items-center gap-x-[26px] gap-y-4 border-t border-border-raised pt-[22px]">
                  <span className="flex-none">
                    <span className="eyebrow block text-text-muted">Prochain</span>
                    <span className="tnum mt-[9px] block font-mono text-[40px] font-bold leading-[.95] tracking-[-0.045em] text-text-primary">
                      {heureCourte(prochain.startAt)}
                    </span>
                  </span>
                  <span className="hidden w-px self-stretch bg-border-raised sm:block" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[20px] font-bold tracking-[-0.02em] text-text-primary">
                      {prochain.clientName || prochain.title || 'Rendez-vous'}
                    </span>
                    {phraseProchain && (
                      <span className="mt-[7px] block text-[13.5px] leading-[1.55] text-text-secondary">
                        {phraseProchain}
                      </span>
                    )}
                  </span>
                  <span className="flex-none text-right">
                    <span className="block font-mono text-[10px] tracking-[0.12em] text-text-muted">DANS</span>
                    <span className="tnum mt-1.5 block font-mono text-[21px] font-semibold text-text-primary">
                      {dansCombien(prochain.startAt, maintenant)}
                    </span>
                  </span>
                  <Link
                    to={enJeu?.rdv.id === prochain.id && enJeu.motif === 'devis' ? '/clients' : '/agenda'}
                    className="flex h-[38px] flex-none items-center bg-accent px-4 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
                  >
                    {enJeu?.rdv.id === prochain.id && enJeu.motif === 'devis' ? 'Ouvrir le devis' : 'Ouvrir l’agenda'}
                  </Link>
                </div>
              ) : (
                <p className="mt-6 border-t border-border-raised pt-[22px] text-[13.5px] leading-[1.55] text-text-secondary">
                  {duJour.length > 0
                    ? 'Plus rien après celui-ci : la journée est derrière vous.'
                    : 'Rien de posé aujourd’hui. L’axe reste ouvert.'}
                </p>
              )}
            </section>

            {/* ── AUTOUR : deux cartes calmes, sans ambre ────────────────── */}
            <div className="grid grid-cols-1 items-stretch gap-[18px] lg:grid-cols-[1fr_340px]">
              <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
                <div className="mb-[18px] flex items-baseline justify-between">
                  <span className="eyebrow text-text-secondary">À traiter</span>
                  {/* « 3 SUR 6 » et non « 3 CHOSES » quand la liste est
                      tronquée : le sous-titre de l'écran annonce le total, et
                      deux comptes différents pour la même chose font douter
                      des deux. */}
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                    {aTraiter.length === 0
                      ? 'RIEN'
                      : totalATraiter > aTraiter.length
                        ? `${aTraiter.length} SUR ${totalATraiter}`
                        : `${aTraiter.length} CHOSE${aTraiter.length > 1 ? 'S' : ''}`}
                  </span>
                </div>
                {aTraiter.length > 0 ? (
                  <div className="flex flex-col gap-3.5">
                    {aTraiter.map((item) => (
                      <LigneATraiter key={item.key} item={item} plusLourd={plusLourd} />
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-[13.5px] leading-[1.7] text-text-secondary">
                    Rien ne traîne : aucune facture en retard, aucun devis sans réponse.
                  </p>
                )}
              </section>

              <section className="panel flex flex-col px-5 pb-[18px] pt-5">
                <div className="mb-5 flex items-baseline justify-between">
                  <span className="eyebrow text-text-secondary">La semaine</span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                    {Math.round(semaine.total / 60)} H
                  </span>
                </div>
                <div className="flex h-[96px] items-end gap-[9px]">
                  {semaine.jours.map((j, i) => (
                    <span
                      key={`${j.cle}-${i}`}
                      className={`flex-1 ${j.courant ? 'bg-text-primary' : 'bg-border-strong'}`}
                      style={{ height: `${Math.max(4, (j.minutes / semaine.plafond) * 96)}px` }}
                      title={`${j.lettre} · ${Math.round(j.minutes / 60)} h`}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex gap-[9px] font-mono text-[9.5px] tracking-[0.08em]">
                  {semaine.jours.map((j, i) => (
                    <span
                      key={`${j.cle}-l-${i}`}
                      className={`flex-1 text-center ${j.courant ? 'text-text-primary' : 'text-text-muted'}`}
                    >
                      {j.lettre}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <Majordome attentions={attention.items.length} />
          </>
        )}
      </div>
    </EcranVide>
  );
}

/** La phrase de sous-titre, écrite sur ce que l'écran montre réellement. */
function phraseDuJour(nbRdv: number, minutes: number, nbAttentions: number): string {
  const morceaux: string[] = [];
  if (nbRdv === 0) morceaux.push('Aucun rendez-vous aujourd’hui');
  else if (nbRdv === 1) morceaux.push('Un rendez-vous aujourd’hui');
  else morceaux.push(`${nbRdv} rendez-vous aujourd’hui`);
  if (minutes >= 60) morceaux.push(`${Math.round(minutes / 60)} h d’occupé`);
  if (nbAttentions === 1) morceaux.push('une chose à traiter');
  else if (nbAttentions > 1) morceaux.push(`${nbAttentions} choses à traiter`);
  return `${morceaux.join(', ')}.`;
}

/**
 * Une ligne d'« À traiter » : un nom, un sous-titre, une barre proportionnelle
 * et un verdict. La barre est la seule chose qui compare : elle se déduit du
 * poids que le moteur d'attention a déjà calculé, pas d'un jugement posé ici.
 *
 * Le rouge n'est pas une décoration de gravité : il est réservé aux ruptures
 * de stock, qui sont un état de fait et non une signalisation (voir `27e`).
 */
/**
 * LE VERDICT, EN TROIS MOTS — et pourquoi ce n'est pas `item.action`.
 *
 * La colonne de droite fait 96 px : elle tient « retard 68 j », pas
 * « Relancer ou passer en perte ». Le moteur d'attention écrit deux choses
 * différentes — `evidence` est le chiffre qui a déclenché l'alerte,
 * `action` est la phrase qui dit quoi faire. C'est le chiffre qui va dans la
 * colonne, parce que c'est lui qui se compare d'une ligne à l'autre ; la
 * phrase d'action vit au bout du lien, dans le module concerné.
 *
 * Le nombre est relu depuis `evidence` plutôt que recalculé : deux calculs de
 * la même ancienneté finissent toujours par diverger d'un jour.
 */
function verdictCourt(item: AttentionItem): string {
  /* La rupture de stock ne vient pas du moteur : elle a son verdict à elle. */
  if (item.key.startsWith('stock-')) return 'rupture';
  const jours = item.evidence.match(/(\d+)\s*jour/i)?.[1];
  switch (item.kind) {
    case 'invoice-overdue':
      return jours ? `retard ${jours} j` : 'en retard';
    case 'invoice-due-soon':
      return jours ? `dans ${jours} j` : 'à échoir';
    case 'task-stale':
    case 'client-silent':
      return jours ? `${jours} j` : 'sans suite';
    case 'certificate-expired':
      return 'expiré';
    case 'certificate-expiring':
      return jours ? `dans ${jours} j` : 'à renouveler';
    case 'certificate-unknown':
      return 'inconnu';
    case 'incident-critical':
      return 'critique';
    case 'incident-stale':
      return jours ? `${jours} j` : 'sans suite';
    case 'scan-regression':
      return 'régression';
    default:
      return item.action || item.evidence;
  }
}

function LigneATraiter({ item, plusLourd }: { item: AttentionItem; plusLourd: number }) {
  const rupture = item.key.startsWith('stock-');
  const part = Math.max(0.08, Math.min(1, item.weight / plusLourd));
  return (
    <Link to={item.to} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 transition-opacity hover:opacity-80 sm:grid-cols-[1fr_132px_96px]">
      <span className="min-w-0">
        {/* Au téléphone, le nom va à la ligne plutôt que de se réduire à trois lettres. */}
        <span className="block text-[14px] font-semibold text-text-primary [overflow-wrap:anywhere] sm:truncate">{item.title}</span>
        <span className="mt-[3px] block text-[12.5px] text-text-secondary [overflow-wrap:anywhere] sm:truncate">
          {item.amountCents !== undefined
            ? `${item.evidence} · ${(item.amountCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
            : item.evidence}
        </span>
      </span>
      <span className={`order-last col-span-2 h-1.5 sm:order-none sm:col-span-1 ${rupture ? 'bg-[#2a0f0c]' : 'bg-[#191919]'}`}>
        <span
          className={`block h-1.5 ${rupture ? 'bg-danger' : item.severity === 'critical' ? 'bg-text-primary' : 'bg-[#4a4a48]'}`}
          style={{ width: `${part * 100}%` }}
        />
      </span>
      <span
        className={`tnum whitespace-nowrap text-right font-mono text-[13px] font-semibold sm:truncate ${
          rupture ? 'text-danger-ink' : item.severity === 'critical' ? 'text-text-primary' : 'text-text-secondary'
        }`}
      >
        {verdictCourt(item)}
      </span>
    </Link>
  );
}

export type { SharedTaskStatus };

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { FirstRun } from '../components/EmptyState';
import { useClients } from '../state/useClients';
import { useAppointments } from '../state/useAppointments';
import { formatCents } from '../lib/money';
import { useLangue } from '../i18n';
import type { Client, Quote } from '../shared/api';
import { DevisDepuisBrief } from '../components/DevisDepuisBrief';
import type { EntreeCatalogue } from '../lib/devisBrief';
import { useInvoices } from '../state/useInvoices';
import { useCollection } from '../state/SyncContext';
import { useToast } from '../state/ToastContext';

/**
 * DEVIS — Clients & revenus · `13a`
 * ═════════════════════════════════
 *
 * OÙ CET ÉCRAN VIT, ET POURQUOI IL A DÉMÉNAGÉ
 * ───────────────────────────────────────────
 *
 * `MODULES.md` est net : « Devis n'est pas un module de premier niveau : il
 * vit dans Facturation et le fil d'Ariane doit dire *Facturation · Devis*. La
 * barre latérale met Facturation en actif, pas une entrée Devis. »
 *
 * Le produit, lui, rangeait les devis dans la fiche client — un bloc par
 * client, sans vue d'ensemble. Les deux ont raison sur des choses
 * différentes, et aucune des deux n'annule l'autre :
 *
 *   • La fiche client garde son bloc. C'est là qu'on ÉCRIT un devis, parce
 *     qu'un devis s'écrit pour quelqu'un et qu'on a sa fiche sous les yeux.
 *   • Cet écran-ci ne se lit pas par client : il regarde les devis PARTIS,
 *     tous ensemble, sur un axe de trente jours. C'est la question « à qui
 *     dois-je relancer aujourd'hui », et elle n'a pas de réponse dans une
 *     fiche à la fois.
 *
 * `MODULES.md` a donc raison sur le rattachement, et il est suivi : la route
 * est `/facturation/devis`, le fil d'Ariane dit « Facturation · Devis », la
 * barre latérale garde Facturation en actif (son `isActive` compare par
 * préfixe de chemin), et AUCUNE entrée « Devis » n'est ajoutée à la barre.
 *
 * L'OBJET DOMINANT — LA RÉGLETTE D'ATTENTE
 * ────────────────────────────────────────
 *
 * Une réglette par devis envoyé, sur un axe commun de trente jours, dont la
 * longueur est le TEMPS ÉCOULÉ DEPUIS L'ENVOI. Un cran vertical fixe à dix
 * jours marque le moment où l'on relance. On ne lit pas « 12 jours », on VOIT
 * une barre qui a franchi le cran — et c'est tout l'objet du module : la
 * comparaison entre devis se fait à l'œil, sur un axe partagé, pas en
 * comparant des nombres écrits côte à côte.
 *
 * Le jour d'envoi se lit dans `Quote.sentAt`, et pas ailleurs : `updatedAt`
 * est réécrit à chaque correction de titre — l'utiliser remettrait « sans
 * réponse depuis douze jours » à zéro pour une faute d'orthographe corrigée,
 * c'est-à-dire effacerait exactement ce qu'on regarde.
 */

/* L'axe, en dur : trente jours, cran de relance à dix. */
const AXE_JOURS = 30;
const CRAN_JOUR = 10;
const CRAN_PCT = (CRAN_JOUR / AXE_JOURS) * 100;

/**
 * LA GRILLE PARTAGÉE.
 *
 * Les réglettes ET la légende de l'axe sont posées sur ces colonnes-là,
 * cellules vides comprises. C'est la règle §0.6 du système de design : une
 * rangée de graduations partage la `grid-template-columns` de ce qu'elle
 * gradue, jamais des marges recalculées à la main — sinon le « 10 J » se
 * retrouve à un endroit et le cran à un autre, et personne ne comprend
 * pourquoi.
 */
const COLONNES = 'grid-cols-[minmax(0,1fr)_minmax(0,3fr)_64px] md:grid-cols-[210px_minmax(0,1fr)_64px]';

function joursDepuis(jour: string, maintenant: Date): number {
  const d = new Date(jour);
  if (Number.isNaN(d.getTime())) return 0;
  const debut = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const auj = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
  return Math.max(0, Math.round((auj - debut) / 86_400_000));
}

interface Reglette {
  quote: Quote;
  client: Client | undefined;
  jours: number;
  /** La part de l'axe occupée, bornée : rien ne sort jamais de l'axe. */
  part: number;
  franchi: boolean;
  /** Au-delà de trente jours la réglette est pleine — le chevron le dit. */
  deborde: boolean;
}

export function QuotesScreen() {
  useLangue();
  const navigate = useNavigate();
  const { clients, quotes, createQuote } = useClients();
  const { appointments } = useAppointments();
  const { invoices } = useInvoices();
  const kits = useCollection<{ product: string; sellPriceCents: number | null; createdAt?: string }>('boms');
  const forfaits = useCollection<{ label: string; amountCents: number; currency?: string; createdAt?: string }>('subscriptions');
  const { notify } = useToast();
  /* LA PORTE « DEPUIS UN BRIEF » (fusion « Devis générés à partir d'un brief ») : ouverte, elle porte l'ambre de l'écran. */
  const [briefOuvert, setBriefOuvert] = useState(false);
  /*
    LE CATALOGUE RÉEL — ce que l'organisation a déjà chiffré ou facturé, le
    plus récent d'abord : c'est là que le brief trouve ses prix, et nulle part
    ailleurs. Un forfait en devise n'y entre pas (son prix n'est pas en euros).
  */
  const catalogue = useMemo<EntreeCatalogue[]>(() => {
    const e: Array<EntreeCatalogue & { le: string }> = [];
    for (const f of invoices) {
      if (f.status === 'draft' || f.status === 'cancelled' || f.kind === 'creditNote') continue;
      for (const l of f.lines ?? []) if (l.label && l.unitPriceCents > 0) e.push({ libelle: l.label, prixCents: l.unitPriceCents, source: 'facture', le: f.issuedAt || '' });
    }
    for (const q of quotes) if (q.title && q.priceEuro > 0) e.push({ libelle: q.title, prixCents: Math.round(q.priceEuro * 100), source: 'devis', le: q.sentAt ?? q.createdAt });
    for (const k of kits) if (k.product && k.sellPriceCents) e.push({ libelle: k.product, prixCents: k.sellPriceCents, source: 'kit', le: k.createdAt ?? '' });
    for (const a of forfaits) if (a.label && a.amountCents > 0 && (!a.currency || a.currency === 'EUR')) e.push({ libelle: a.label, prixCents: a.amountCents, source: 'forfait', le: a.createdAt ?? '' });
    return e.sort((a, b) => b.le.localeCompare(a.le));
  }, [invoices, quotes, kits, forfaits]);

  const maintenant = useMemo(() => new Date(), []);

  /*
    Les devis PARTIS et sans réponse. Un brouillon n'attend rien de personne,
    un devis accepté ou refusé a reçu sa réponse : ni l'un ni l'autre n'a de
    temps d'attente à mesurer. Un devis envoyé sans `sentAt` (écrit avant que
    le champ existe) est compté à part plutôt que posé à zéro jour — zéro
    jour voudrait dire « parti aujourd'hui », ce qui est faux.
  */
  const enAttente = useMemo(
    () => quotes.filter((q) => q.status === 'sent'),
    [quotes],
  );
  const sansDate = useMemo(() => enAttente.filter((q) => !q.sentAt), [enAttente]);

  const reglettes = useMemo<Reglette[]>(
    () =>
      enAttente
        .filter((q) => !!q.sentAt)
        .map((q) => {
          const jours = joursDepuis(q.sentAt as string, maintenant);
          return {
            quote: q,
            client: clients.find((c) => c.id === q.clientId),
            jours,
            part: Math.min(100, (jours / AXE_JOURS) * 100),
            franchi: jours >= CRAN_JOUR,
            deborde: jours > AXE_JOURS,
          };
        })
        .sort((a, b) => b.jours - a.jours),
    [enAttente, clients, maintenant],
  );

  /*
    L'AMBRE VA À UNE SEULE RÉGLETTE — la plus ancienne de celles qui ont
    franchi le cran. Les autres franchies ne sont pas laissées muettes pour
    autant : leur remplissage passe au gris clair. C'est le CRAN qui dit
    qu'elles sont dépassées, pas une seconde couleur, et l'écran garde donc
    une seule région ambre.
  */
  const aRelancer = briefOuvert ? null : (reglettes.find((r) => r.franchi) ?? null);
  const halo = useHaloSignal(!!aRelancer);

  /*
    LE RENDEZ-VOUS DU JOUR. `MODULES.md` pose la question à trancher « sachant
    qu'un rendez-vous physique est prévu le jour même » : ce fait est LU dans
    l'agenda, jamais écrit en dur. S'il n'y en a pas, la carte le dit et la
    question change de forme — un écran qui affirmerait un rendez-vous
    inexistant ferait prendre une décision sur une chose fausse.
  */
  const rdvDuJour = useMemo(() => {
    if (!aRelancer?.client) return null;
    const jour = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`;
    return (
      appointments.find(
        (a) =>
          a.status === 'scheduled' &&
          a.clientId === aRelancer.client?.id &&
          a.startAt.startsWith(jour),
      ) ?? null
    );
  }, [appointments, aRelancer, maintenant]);

  /* Les vingt-quatre derniers devis, du plus récent au plus ancien. */
  const derniers = useMemo(
    () =>
      [...quotes]
        .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt))
        .slice(0, 24),
    [quotes],
  );
  const tranches = useMemo(() => {
    const acceptes = derniers.filter((q) => q.status === 'accepted').length;
    const refuses = derniers.filter((q) => q.status === 'refused').length;
    return { acceptes, refuses, tranches: acceptes + refuses };
  }, [derniers]);

  /* Le montant en jeu, et les moyennes — sur les devis réellement partis. */
  const enJeuCents = useMemo(
    () => enAttente.reduce((n, q) => n + Math.round(q.priceEuro * 100), 0),
    [enAttente],
  );
  const moyennes = useMemo(() => {
    const partis = quotes.filter((q) => q.status !== 'draft');
    const panier = partis.length
      ? Math.round(partis.reduce((n, q) => n + q.priceEuro * 100, 0) / partis.length)
      : 0;
    const attente = reglettes.length
      ? Math.round(reglettes.reduce((n, r) => n + r.jours, 0) / reglettes.length)
      : 0;
    return { panier, attente, partis: partis.length };
  }, [quotes, reglettes]);

  const vide = enAttente.length === 0;

  const ouvrirLaFiche = (clientId: number) =>
    navigate('/clients', { state: { focusClientId: clientId } });

  return (
    <EcranVide quand={vide} premierJour={quotes.length === 0}>
      <section className="flex flex-col gap-6">
        <ScreenHeader
          /* LE FIL D'ARIANE : « Facturation · Devis », comme `MODULES.md` l'exige. */
          eyebrow="Facturation · Devis"
          title="Devis"
          description="Ce qui est parti et n’a pas encore répondu, sur un axe de trente jours."
          phraseVide={
            quotes.length === 0
              ? 'Aucun devis écrit pour l’instant. Le premier s’écrit depuis la fiche d’un client.'
              : 'Aucun devis en attente de réponse — tout ce qui est parti a été tranché.'
          }
          stats={[
            { label: 'En attente', value: enAttente.length },
            { label: 'Montant en jeu', value: formatCents(enJeuCents) },
            {
              label: 'À relancer',
              value: reglettes.filter((r) => r.franchi).length,
              emphasis: !!aRelancer,
              title: `Envoyés depuis plus de ${CRAN_JOUR} jours sans réponse.`,
            },
          ]}
          actions={
            <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBriefOuvert((v) => !v)}
              aria-expanded={briefOuvert}
              className="flex h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover md:h-9"
            >
              <FileText size={16} strokeWidth={1.9} />
              Depuis un brief
            </button>
            <button
              type="button"
              onClick={() => navigate('/facturation')}
              className="flex h-11 items-center gap-2 border border-border px-3 text-sm font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9"
            >
              <ArrowLeft size={16} strokeWidth={1.9} />
              Facturation
            </button>
            </span>
          }
        />

        {briefOuvert && (
          <DevisDepuisBrief
            clients={clients}
            catalogue={catalogue}
            onFermer={() => setBriefOuvert(false)}
            onCreer={async (d) => {
              await createQuote({ clientId: d.clientId, title: d.title, detail: d.detail, trackerTier: '', priceEuro: d.priceEuro });
              setBriefOuvert(false);
              notify({ title: 'Devis créé en brouillon', body: `${d.title} — sur la fiche du client, chaque ligne reliée à sa phrase du brief.` });
            }}
          />
        )}

        {vide ? (
          <FirstRun title="Rien n’attend de réponse">
            Un devis apparaît ici le jour où il part. Il s’écrit depuis la fiche du client
            concerné — c’est là qu’on a son adresse, son historique et ce qu’il a déjà accepté.
          </FirstRun>
        ) : (
          <>
            {/* ───────────────────────── L'OBJET DOMINANT : LES RÉGLETTES ── */}
            <div className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="eyebrow">Temps d’attente · {reglettes.length} devis partis</p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                  le cran marque le jour de la relance
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {reglettes.map((r) => {
                  const signal = r === aRelancer;
                  return (
                    <div key={r.quote.id} className={`grid items-center gap-x-4 ${COLONNES}`}>
                      <button
                        type="button"
                        onClick={() => r.client && ouvrirLaFiche(r.client.id)}
                        className="min-w-0 text-left transition-colors hover:text-text-primary"
                      >
                        <p className="truncate text-[14.5px] font-semibold text-text-primary">
                          {r.client?.name ?? 'Client retiré'}
                        </p>
                        <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                          {r.quote.title || 'sans intitulé'}
                        </p>
                      </button>

                      {/* LA PISTE. Le cran est posé en pourcentage DANS la piste :
                          il tombe donc au même endroit sur toutes les réglettes,
                          quelle que soit la largeur de la colonne. */}
                      <div className="relative h-6 w-full bg-sunken">
                        <span
                          className={`absolute inset-y-0 left-0 block ${signal ? `bg-signal ${halo}` : r.franchi ? 'bg-[#4a4a48]' : 'bg-[#2b2b2b]'}`}
                          style={{ width: `${r.part}%` }}
                          data-signal-groupe={signal ? 'relance' : undefined}
                        />
                        <span
                          aria-hidden
                          className="absolute inset-y-0 w-px bg-border-strong"
                          style={{ left: `${CRAN_PCT}%` }}
                        />
                        {/* Au-delà de trente jours la barre est pleine : le chevron
                            dit que l'axe s'arrête là, pas l'attente. */}
                        {r.deborde && (
                          <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[11px] text-text-primary">
                            ›
                          </span>
                        )}
                      </div>

                      <p
                        className={`tnum text-right font-mono text-[13px] font-semibold ${signal ? 'text-signal' : 'text-text-secondary'}`}
                        data-signal-groupe={signal ? 'relance' : undefined}
                      >
                        {r.jours} j
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* ── LA LÉGENDE DE L'AXE — même grille, cellules vides comprises. */}
              <div className={`mt-2 grid gap-x-4 ${COLONNES}`}>
                <span aria-hidden />
                <div className="relative h-4">
                  {[
                    { pct: 0, texte: '0 J', ancre: 'left' as const },
                    { pct: CRAN_PCT, texte: `${CRAN_JOUR} J · RELANCE`, ancre: 'centre' as const },
                    { pct: (20 / AXE_JOURS) * 100, texte: '20 J', ancre: 'centre' as const },
                    { pct: 100, texte: `${AXE_JOURS} J`, ancre: 'right' as const },
                  ].map((g) => (
                    <span
                      key={g.texte}
                      className="absolute top-0 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted"
                      style={{
                        left: g.ancre === 'right' ? undefined : `${g.pct}%`,
                        right: g.ancre === 'right' ? 0 : undefined,
                        transform: g.ancre === 'centre' ? 'translateX(-50%)' : undefined,
                      }}
                    >
                      {g.texte}
                    </span>
                  ))}
                </div>
                <span aria-hidden />
              </div>

              {sansDate.length > 0 && (
                <p className="mt-5 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                  {sansDate.length} devis {sansDate.length > 1 ? 'partis' : 'parti'} sans date
                  d’envoi enregistrée — écrits avant que le produit ne note ce jour-là. Ils ne
                  figurent pas sur l’axe : les poser à zéro jour les ferait passer pour partis
                  aujourd’hui.
                </p>
              )}
            </div>

            {/* ─────────────────────────── LA QUESTION À TRANCHER ── */}
            {aRelancer && (
              <div className="panel px-5 py-4">
                <p className="eyebrow mb-3">Ce qu’il y a à décider</p>
                <p className="text-[15px] leading-[1.7] text-text-primary">
                  {aRelancer.client?.name ?? 'Ce client'} n’a pas répondu depuis{' '}
                  <span className="tnum font-mono font-semibold">{aRelancer.jours}</span> jours sur{' '}
                  {formatCents(Math.round(aRelancer.quote.priceEuro * 100))}.
                  {rdvDuJour ? (
                    <>
                      {' '}Un rendez-vous est déjà prévu avec lui aujourd’hui
                      {rdvDuJour.location ? ` (${rdvDuJour.location})` : ''} : la question n’est
                      pas d’écrire, c’est d’en parler de vive voix et de repartir avec une
                      réponse.
                    </>
                  ) : (
                    <>
                      {' '}Rien n’est prévu avec lui aujourd’hui dans l’agenda : la relance passe
                      donc par un mot écrit, ou par un appel décidé maintenant.
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
              {/* ─────────────────── LES VINGT-QUATRE DERNIERS, EN BANDE D'ÉTATS ── */}
              <div className="panel px-5 py-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="eyebrow">Les {derniers.length} derniers devis</p>
                  <p className="tnum font-mono text-[13px] font-semibold text-text-primary">
                    {tranches.tranches > 0 ? `${tranches.acceptes}/${tranches.tranches}` : '—'}
                    <span className="ml-2 font-normal text-[10px] uppercase tracking-[0.2em] text-text-muted">
                      acceptés sur tranchés
                    </span>
                  </p>
                </div>
                <div className="flex gap-1">
                  {derniers.map((q) => (
                    <span
                      key={q.id}
                      title={`${q.title || 'sans intitulé'} · ${q.status}`}
                      className={`h-8 flex-1 ${
                        q.status === 'accepted'
                          ? 'bg-[#4a4a48]'
                          : q.status === 'refused'
                            ? 'bg-[#2b2b2b]'
                            : 'border border-dashed border-border-strong'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                  <span>■ accepté · {tranches.acceptes}</span>
                  <span>■ refusé · {tranches.refuses}</span>
                  <span>▢ en attente · {derniers.length - tranches.tranches}</span>
                </div>
              </div>

              {/* ─────────────────────────── LE MONTANT EN JEU ET LES MOYENNES ── */}
              <div className="panel flex flex-col px-5 py-4">
                <p className="eyebrow mb-2">Montant en jeu</p>
                <p className="tnum font-mono text-[27px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                  {formatCents(enJeuCents)}
                </p>
                <div className="mt-4 flex flex-col divide-y divide-border-row">
                  <div className="flex items-baseline justify-between gap-4 py-2">
                    <span className="text-[12.5px] text-text-secondary">Panier moyen</span>
                    <span className="tnum font-mono text-[13px] text-text-primary">
                      {moyennes.partis > 0 ? formatCents(moyennes.panier) : '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2">
                    <span className="text-[12.5px] text-text-secondary">Attente moyenne</span>
                    <span className="tnum font-mono text-[13px] text-text-primary">
                      {reglettes.length > 0 ? `${moyennes.attente} j` : '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2">
                    <span className="text-[12.5px] text-text-secondary">Devis partis</span>
                    <span className="tnum font-mono text-[13px] text-text-primary">
                      {moyennes.partis}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-text-muted">
                  Un devis s’écrit et se modifie depuis la fiche de son client — cet écran le
                  regarde attendre, il ne le rédige pas.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </EcranVide>
  );
}

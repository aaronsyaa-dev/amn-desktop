import React, { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Play, Plus, ReceiptEuro, Trash2 } from 'lucide-react';
import { useTimeTracking } from '../state/useTimeTracking';
import { useProjects } from '../state/useProjects';
import { useClients } from '../state/useClients';
import { useInvoices, partyFromClient } from '../state/useInvoices';
import { useToast } from '../state/ToastContext';
import { isModuleEnabled } from '../data/spaces';
import {
  dayOf,
  formatClock,
  formatDayHeading,
  formatDuration,
  formatStopwatch,
  durationMs,
  isRunning,
  weekStart,
  type TimeEntry,
} from '../state/timeEngine';
import { ProjectPicker, ProjectTag } from '../components/projects/ProjectPicker';
import { ManualEntryDialog } from '../components/time/ManualEntryDialog';
import { TimeInvoiceDialog } from '../components/time/TimeInvoiceDialog';
import { uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { FirstRun } from '../components/EmptyState';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useLangue, t as tr } from '../i18n';

/* ─── LA BANDE DE LA JOURNÉE — l'objet dominant (`24a`) ────────────────────── */

/*
  LA JOURNÉE EST UNE BANDE, ET LA BANDE EST CONTIGUË.

  76 px de haut, remplie de gauche à droite, un segment par période pointée.
  Elle n'est pas un graphique de la journée : elle EST la journée, et son
  extrémité droite est maintenant.

  LA RÈGLE DE CONTIGUÏTÉ, tenue littéralement. `MODULES.md` dit qu'un vide
  dans la bande signifierait du temps non pointé, « ce qui doit être visible
  comme tel ». Deux lectures possibles : sauter les trous (la bande ment par
  omission), ou les dessiner en creux. C'est la seconde — un intervalle entre
  deux périodes devient un segment `non-pointe`, hachuré, avec sa durée. La
  bande n'a donc aucun trou : ce qui aurait été un trou porte un nom.

  CE QUI EST FACTURABLE, et ce qui ne l'est jamais. Le modèle du produit ne
  porte pas de catégorie « trajet » ou « déjeuner » sur une période : il porte
  un intitulé libre et un projet optionnel. Mais la facturation, elle, EXIGE
  un projet (voir `billableOf` et `TimeInvoiceDialog`) : une période sans
  projet ne peut structurellement pas partir en facture. La distinction du
  module existe donc déjà dans le produit, sous un autre nom — elle est lue
  là où elle est vraie, et non inventée à partir des mots de l'intitulé.
*/
const BANDE_H = 76;
/*
  En dessous de cette part de la bande, aucun texte ne tient dans le segment :
  il passe en bulle de survol. Le seuil est en POURCENTAGE et non en pixels,
  parce que la bande est fluide — un seuil en pixels serait faux à toutes les
  largeurs sauf une.
*/
const SEGMENT_TEXTE_MIN_PCT = 6;
/** Deux périodes séparées de moins d'une minute sont contiguës, pas trouées. */
const TROU_MIN_MS = 60_000;

type NatureDuSegment = 'facturable' | 'interne' | 'non-pointe';

interface SegmentDeJournee {
  cle: string;
  ms: number;
  part: number;
  nature: NatureDuSegment;
  intitule: string;
  enCours: boolean;
}

const REMPLISSAGE_SEGMENT: Record<NatureDuSegment, string> = {
  facturable: '#4a4a48',
  interne: 'var(--color-border-strong)',
  'non-pointe': 'var(--color-sunken)',
};

/**
 * Découpe la journée en segments contigus.
 *
 * `periodes` doit être trié par début croissant. La bande va du premier début
 * au dernier bout — maintenant si quelque chose tourne, la dernière fin
 * sinon. Les largeurs sont des POURCENTAGES de cette étendue : la somme fait
 * exactement 100, parce que les trous sont des segments comme les autres.
 */
function bandeDuJour(periodes: TimeEntry[], maintenant: number): SegmentDeJournee[] {
  if (periodes.length === 0) return [];
  const debut = Date.parse(periodes[0].startedAt);
  const fin = periodes.reduce(
    (borne, e) => Math.max(borne, isRunning(e) ? maintenant : Date.parse(e.endedAt)),
    debut,
  );
  const etendue = Math.max(1, fin - debut);
  const segments: SegmentDeJournee[] = [];
  let curseur = debut;

  for (const e of periodes) {
    const d = Date.parse(e.startedAt);
    const f = isRunning(e) ? maintenant : Date.parse(e.endedAt);
    if (d - curseur >= TROU_MIN_MS) {
      const ms = d - curseur;
      segments.push({
        cle: `trou-${curseur}`,
        ms,
        part: (ms / etendue) * 100,
        nature: 'non-pointe',
        intitule: 'Non pointé',
        enCours: false,
      });
    }
    const ms = Math.max(0, f - Math.max(d, curseur));
    if (ms > 0) {
      segments.push({
        cle: e.id,
        ms,
        part: (ms / etendue) * 100,
        nature: e.projectId ? 'facturable' : 'interne',
        intitule: e.label || 'Sans intitulé',
        enCours: isRunning(e),
      });
    }
    curseur = Math.max(curseur, f);
  }
  return segments;
}

/**
 * Temps — le chronomètre d'abord, la feuille d'heures jamais.
 *
 * ## Le geste, avant tout le reste
 *
 * L'écran s'ouvre sur UN bouton, occupant toute la largeur et haut de 64 px :
 * démarrer, ou arrêter. C'est la seule chose qu'on fait dix fois par jour, et
 * c'est donc la seule chose qui a droit à cette place. Le « sur quoi » se
 * remplit avant, ou après — un chrono qu'on ne peut pas lancer sans avoir
 * rempli un formulaire est un chrono qu'on ne lance pas.
 *
 * ## Ce qui tourne est visible partout
 *
 * La période en cours est un enregistrement synchronisé (voir `timeEngine`) :
 * démarrée sur le téléphone, elle s'affiche et s'arrête depuis le poste. C'est
 * ce qui évite le classique « j'ai laissé tourner sur l'autre appareil » et
 * les huit heures fantômes du lendemain.
 */
export function TimeScreen() {
  // Abonnement à la langue : sans lui, l'écran gardait les libellés de la
  // langue active AU MONTAGE et ne suivait pas un changement en cours de route.
  useLangue();
  const {
    config,
    saveConfig,
    running,
    byDay,
    summary,
    byProject,
    start,
    stop,
    addManual,
    updateEntry,
    deleteEntry,
    markInvoiced,
    billableOf,
  } = useTimeTracking();
  const { projects } = useProjects();
  const { clients } = useClients();
  const { createDraft } = useInvoices();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [label, setLabel] = useState('');
  const [projectId, setProjectId] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<TimeEntry | null>(null);

  /*
    Le battement de seconde n'existe QUE pendant qu'un chrono tourne.

    Un intervalle permanent ferait rendre l'écran soixante fois par minute pour
    afficher exactement la même chose — sur un portable, c'est de la batterie
    dépensée à ne rien changer.
  */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  /* Déclaré ici, avant `aFacturer` qui s'en sert : facturer n'existe que si le
     module de facturation est actif dans cet espace. */
  const canInvoice = isModuleEnabled('invoices');

  const totals = useMemo(() => summary(now), [summary, now]);
  const monday = totals.weekStartDay;
  const perProject = useMemo(() => byProject(monday, now), [byProject, monday, now]);

  /*
    LES SEPT JOURS DE LA SEMAINE, du lundi au dimanche, avec leur total.

    `byDay` ne rend que les jours qui portent quelque chose : une semaine à deux
    jours travaillés donnerait deux barres, et la comparaison — tout le propos
    du ruban — n'aurait plus d'axe. On construit donc les sept, y compris les
    vides, qui disent « rien » au lieu de ne rien dire.
  */
  const semaine = useMemo(() => {
    const aujourd = dayOf(new Date(now).toISOString());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${monday}T00:00:00`);
      d.setDate(d.getDate() + i);
      const day = dayOf(d.toISOString());
      const groupe = byDay.find((g) => g.day === day);
      return {
        day,
        ms: groupe ? groupe.rows.reduce((n, e) => n + durationMs(e, now), 0) : 0,
        aujourdhui: day === aujourd,
        etiquette: `${d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')} ${String(d.getDate()).padStart(2, '0')}`,
      };
    });
  }, [byDay, monday, now]);
  const maxJour = useMemo(() => semaine.reduce((n, j) => Math.max(n, j.ms), 0), [semaine]);

  /*
    LE PROJET QU'IL RESTE À FACTURER — le plus gros d'abord, et un seul.

    La carte de droite en montre UN, pas la liste : c'est un rappel, pas un
    tableau de bord, et la liste complète par projet vit déjà plus bas. Sans
    module de facturation activé, `canInvoice` est faux et la carte disparaît
    entièrement — proposer de facturer sans facturation n'est pas une offre.
  */
  const aFacturer = useMemo(() => {
    if (!canInvoice) return null;
    const candidats = perProject
      .filter((row) => row.projectId)
      .map((row) => ({
        projectId: row.projectId,
        ms: billableOf(row.projectId).reduce((n, e) => n + durationMs(e, now), 0),
      }))
      .filter((row) => row.ms > 0)
      .sort((a, b) => b.ms - a.ms);
    return candidats[0] ?? null;
  }, [canInvoice, perProject, billableOf, now]);

  /*
    LES PÉRIODES DU JOUR, et la bande qu'elles composent.

    `byDay` porte déjà le groupe du jour ; on le trie par début croissant
    parce que la bande est un déroulé, pas un classement.
  */
  const periodesDuJour = useMemo(() => {
    const aujourd = dayOf(new Date(now).toISOString());
    const groupe = byDay.find((g) => g.day === aujourd);
    return [...(groupe?.rows ?? [])].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }, [byDay, now]);

  const bande = useMemo(() => bandeDuJour(periodesDuJour, now), [periodesDuJour, now]);

  /*
    LA RÉPARTITION DU JOUR PAR TÂCHE — l'entourage gauche.

    Regroupée par INTITULÉ et non par période : trois sessions de « retouches »
    font une tâche, pas trois. Le temps non pointé n'y figure pas — ce n'est
    pas une tâche, c'est l'absence de tâche, et la bande le dit déjà.
  */
  const parTache = useMemo(() => {
    const totaux = new Map<string, { ms: number; facturable: boolean }>();
    for (const seg of bande) {
      if (seg.nature === 'non-pointe') continue;
      const entree = totaux.get(seg.intitule) ?? { ms: 0, facturable: false };
      entree.ms += seg.ms;
      entree.facturable = entree.facturable || seg.nature === 'facturable';
      totaux.set(seg.intitule, entree);
    }
    const lignes = [...totaux.entries()]
      .map(([intitule, v]) => ({ intitule, ...v }))
      .sort((a, b) => b.ms - a.ms);
    const plus = lignes[0]?.ms ?? 0;
    return lignes.map((l) => ({ ...l, part: plus > 0 ? l.ms / plus : 0 }));
  }, [bande]);

  /*
    LA SEMAINE EN TROIS CHIFFRES — pointé, facturable, non facturable.

    Le non facturable est une SOUSTRACTION du pointé, jamais un second
    comptage : deux totaux calculés séparément finissent toujours par ne plus
    s'additionner, et personne ne sait lequel croire.
  */
  const semaineEnTrois = useMemo(() => {
    let pointe = 0;
    let facturable = 0;
    for (const groupe of byDay) {
      if (groupe.day < monday) continue;
      for (const e of groupe.rows) {
        const ms = durationMs(e, now);
        pointe += ms;
        if (e.projectId) facturable += ms;
      }
    }
    return { pointe, facturable, nonFacturable: pointe - facturable };
  }, [byDay, monday, now]);

  const projectTitle = (id: string) =>
    projects.find((p) => p.id === id)?.title || (id ? 'Projet supprimé' : 'Sans projet');

  const toggle = () => {
    if (running) {
      stop();
      return;
    }
    start({ label: label.trim(), projectId: projectId || undefined });
    setLabel('');
  };

  /**
   * Crée le brouillon de facture et marque les périodes comme reportées.
   *
   * Le brouillon est volontairement à UNE ligne : « Temps passé — <projet> »,
   * la quantité en heures, le prix unitaire au tarif horaire. Détailler chaque
   * période produirait une facture de quarante lignes que le client ne lira
   * pas, et l'utilisatrice peut toujours l'éclater elle-même dans Facturation.
   */
  const confirmInvoice = (values: { hours: number; rateCents: number; entryIds: string[] }) => {
    const project = projects.find((p) => p.id === invoiceFor);
    const client = clients.find((c) => c.id === project?.clientId);
    createDraft({
      clientId: client?.id ?? 0,
      billTo: partyFromClient(client),
      projectId: project?.id,
      lines: [
        {
          id: uid('line'),
          label: `Temps passé — ${project?.title || 'prestation'}`,
          quantity: values.hours,
          unitPriceCents: values.rateCents,
          vatRate: 20,
        },
      ],
    });
    markInvoiced(values.entryIds);
    // Le tarif est mémorisé pour la fois suivante : le retaper à chaque
    // facture est exactement le genre de frottement qui fait abandonner.
    if (values.rateCents !== config.hourlyRateCents) {
      saveConfig({ ...config, hourlyRateCents: values.rateCents });
    }
    notify({
      title: tr('hist.time.brouillonDeFactureCree'),
      body: 'Relisez-le dans Facturation avant de l’émettre.',
      onClick: () => navigate('/facturation'),
    });
  };

  const invoiceProject = invoiceFor ? projects.find((p) => p.id === invoiceFor) : undefined;

  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader
        eyebrow={tr('hist.surtitre', { module: tr('hist.time.titre') })}
        title={tr('hist.time.titre')}
        description={tr('hist.time.ceQueVousPassez')}
        stats={[
          { label: 'Aujourd’hui', value: formatDuration(totals.todayMs) },
          { label: 'Cette semaine', value: formatDuration(totals.weekMs) },
          {
            label: tr('hist.time.chronometre'),
            value: running ? 'en cours' : 'à l’arrêt',
            emphasis: Boolean(running),
          },
        ]}
        actions={
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9"
          >
            <Plus size={15} strokeWidth={2} />
            <span className="hidden sm:inline">{tr('hist.time.ajouterALaMain')}</span>
            <span className="sm:hidden">{tr('hist.time.aLaMain')}</span>
          </button>
        }
      />

      {/*
        LA BANDE DE LA JOURNÉE — l'objet dominant de l'écran Temps (`24a`).

        Le chronomètre était déjà en haut, et c'était juste. Mais un compteur
        seul ne dit que « il est 14 h 07 de travail » : il ne dit pas d'où on
        vient. La bande le dit — et le compteur passe SOUS elle, à sa place,
        comme la lecture de son extrémité droite.

        L'AMBRE, quatre nœuds tous attachés au même segment : le segment en
        cours, son bord vif, le compteur, et le surtitre « EN COURS ». Rien ne
        tourne, rien n'est ambre : l'écran redevient un registre.
      */}
      <div className="panel-raised p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="eyebrow">La journée</p>
          <p className="tnum font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            {bande.length > 0
              ? `${formatClock(periodesDuJour[0].startedAt)} → ${running ? 'maintenant' : formatClock(periodesDuJour[periodesDuJour.length - 1].endedAt)}`
              : 'rien de pointé aujourd’hui'}
          </p>
        </div>

        {bande.length === 0 ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
            La bande se remplit dès la première période pointée. Elle montre la journée telle
            qu’elle s’est passée, sans trou : un intervalle non pointé y est un segment comme un
            autre, avec sa durée.
          </p>
        ) : (
          <>
            {/* LA BANDE — contiguë, de gauche à droite. */}
            <div
              className="mt-4 flex w-full overflow-hidden border border-border"
              style={{ height: BANDE_H }}
            >
              {bande.map((seg) => (
                <span
                  key={seg.cle}
                  title={`${seg.intitule} · ${formatDuration(seg.ms)}`}
                  data-signal-groupe={seg.enCours ? 'en-cours' : undefined}
                  className={`relative flex min-w-0 items-center overflow-hidden border-r border-bg px-2 last:border-r-0 ${
                    seg.nature === 'non-pointe' ? 'justify-center' : ''
                  }`}
                  style={{
                    width: `${seg.part}%`,
                    background: seg.enCours ? 'var(--color-signal-bande)' : REMPLISSAGE_SEGMENT[seg.nature],
                    ...(seg.nature === 'non-pointe'
                      ? {
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 4px, transparent 4px 9px)',
                        }
                      : {}),
                  }}
                >
                  {seg.part >= SEGMENT_TEXTE_MIN_PCT && (
                    <span
                      className={`min-w-0 ${
                        seg.enCours
                          ? 'text-text-primary'
                          : seg.nature === 'non-pointe'
                            ? 'text-text-muted'
                            : 'text-text-body'
                      }`}
                    >
                      <span className="block truncate text-[12.5px] leading-tight">
                        {seg.intitule}
                      </span>
                      <span className="tnum mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.1em] opacity-80">
                        {formatDuration(seg.ms)}
                      </span>
                    </span>
                  )}

                  {/* LE BORD VIF — 3 px, et c'est LUI qui dit « maintenant ».
                      Il bat à 1,4 s : le segment s'allonge pendant qu'on le
                      regarde, ce bord est l'endroit où ça se passe. */}
                  {seg.enCours && (
                    <span
                      aria-hidden
                      data-signal-groupe="en-cours"
                      className="bord-vivant absolute inset-y-0 right-0 w-[3px] bg-signal"
                    />
                  )}
                </span>
              ))}
            </div>

            {/* LA LÉGENDE DE LA BANDE — en matière : un témoin ambre ici
                compterait pour un second objet à l'écran. */}
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-text-muted">
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-4" style={{ background: REMPLISSAGE_SEGMENT.facturable }} />
                rattaché à un projet
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-4" style={{ background: REMPLISSAGE_SEGMENT.interne }} />
                sans projet — jamais facturable
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-4 border border-border"
                  style={{
                    background: REMPLISSAGE_SEGMENT['non-pointe'],
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 4px, transparent 4px 9px)',
                  }}
                />
                non pointé
              </span>
            </div>
          </>
        )}

        {/* SOUS LA BANDE — le compteur, la tâche, et le rattachement. */}
        {running ? (
          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-t border-border-row pt-5">
            <div className="min-w-0">
              <p
                className="eyebrow text-signal"
                data-signal-groupe="en-cours"
              >
                En cours · démarré à {formatClock(running.startedAt)}
              </p>
              <p
                className="tnum mt-1 font-mono text-[36px] font-bold leading-none tracking-[-0.04em] text-signal sm:text-[44px]"
                data-signal-groupe="en-cours"
              >
                {formatStopwatch(durationMs(running, now))}
              </p>
              <p className="mt-3 text-[17px] font-semibold leading-tight text-text-primary">
                {running.label || tr('hist.time.sansIntitule')}
              </p>
              {/*
                CE À QUOI LE TEMPS SERA RATTACHÉ — dit maintenant, pas au
                moment de facturer. Une période sans projet ne peut pas partir
                en facture : l'apprendre en fin de mois, c'est l'apprendre
                trop tard.
              */}
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
                {running.projectId
                  ? `Sera rattaché à ${projectTitle(running.projectId)} — facturable.`
                  : 'Aucun projet : ce temps ne pourra pas partir en facture.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggle}
                className="min-h-11 bg-accent px-5 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
              >
                {tr('hist.time.arreter')}
              </button>
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="min-h-11 border border-border-strong px-5 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover"
              >
                {tr('hist.time.saisirALaMain')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 border-t border-border-row pt-5">
            <p className="eyebrow">{tr('hist.time.surQuoiTravaillezVous')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') toggle();
                }}
                placeholder="Retouches photos, appel client… (facultatif)"
                className="input-focus min-h-11 w-full border border-border bg-sunken px-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <ProjectPicker value={projectId} onChange={setProjectId} label="Projet (facultatif)" />
            </div>
            {/*
              LE BOUTON DU POUCE RESTE CE QU'IL ÉTAIT : pleine largeur, 64 px,
              un seul mot. C'est le geste qu'on répète dix fois par jour, et
              sur un téléphone tenu d'une main c'est la cible qu'on atteint
              sans regarder.
            */}
            <button
              type="button"
              onClick={toggle}
              className="mt-3 flex h-16 w-full items-center justify-center gap-2.5 bg-accent text-lg font-bold text-bg transition-colors hover:bg-accent-hover"
            >
              <Play size={20} strokeWidth={2.5} />
              {tr('hist.time.demarrer')}
            </button>
          </div>
        )}
      </div>

      {/* AUTOUR — à gauche le jour par tâche, à droite la semaine. */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="panel p-5 sm:p-6">
          <p className="eyebrow">Le jour, par tâche</p>
          {parTache.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Rien de pointé aujourd’hui.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {parTache.map((ligne) => (
                <div key={ligne.intitule} className="grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_72px]">
                  <span className="min-w-0 truncate text-[13.5px] text-text-primary">
                    {ligne.intitule}
                  </span>
                  <span className="relative block h-5 w-full bg-sunken">
                    <span
                      className="absolute inset-y-0 left-0 block"
                      style={{
                        width: `${Math.max(1, ligne.part * 100)}%`,
                        background: ligne.facturable
                          ? REMPLISSAGE_SEGMENT.facturable
                          : REMPLISSAGE_SEGMENT.interne,
                      }}
                    />
                  </span>
                  <span className="tnum text-right font-mono text-[12px] text-text-secondary">
                    {formatDuration(ligne.ms)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="panel flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <p className="eyebrow mb-3">{tr('hist.time.cetteSemaine')}</p>
            <p className="tnum font-mono text-[34px] font-bold leading-none tracking-[-0.04em] text-text-primary">
              {formatDuration(semaineEnTrois.pointe)}
            </p>
            {/*
              LES TROIS CHIFFRES DE LA SEMAINE. Le non facturable est une
              SOUSTRACTION du pointé, jamais un second comptage : deux totaux
              calculés séparément finissent par ne plus s'additionner, et
              personne ne sait lequel croire.
            */}
            <dl className="mt-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  facturable
                </dt>
                <dd className="tnum font-mono text-[13px] text-text-primary">
                  {formatDuration(semaineEnTrois.facturable)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  non facturable
                </dt>
                <dd className="tnum font-mono text-[13px] text-text-secondary">
                  {formatDuration(semaineEnTrois.nonFacturable)}
                </dd>
              </div>
            </dl>
            {totals.weekInvoicedMs > 0 && (
              <p className="mt-3 text-[13.5px] text-text-secondary">
                {tr('hist.time.dontDejaFacturees', { duree: formatDuration(totals.weekInvoicedMs) })}
              </p>
            )}
          </div>

          {aFacturer && (
            <div className="border-t border-border pt-5">
              <p className="eyebrow mb-3">
                {tr('hist.time.projetAFacturer', { projet: projectTitle(aFacturer.projectId) })}
              </p>
              <p className="tnum font-mono text-[25px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                {tr('hist.time.nHeuresMesurees', { h: (aFacturer.ms / 3_600_000).toFixed(2).replace('.', ',') })}
              </p>
              {/*
                Pourquoi le compteur en cours n'y est pas : sa durée augmente
                encore. Facturer un temps qui grandit pendant qu'on le facture
                produit un écart qu'on ne retrouve jamais.
              */}
              <p className="mt-3 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
                {tr('hist.time.periodesTermineesJamais')}
              </p>
              <button
                type="button"
                onClick={() => setInvoiceFor(aFacturer.projectId)}
                className="mt-4 min-h-11 w-full border border-border-strong px-4 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover"
              >
                {tr('hist.time.facturerCeTemps')}
              </button>
              <p className="eyebrow mt-3.5 leading-[1.9]">{tr('hist.time.heuresEtTarifModifiables')}</p>
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------------------- par projet ----- */}
      {/*
        LE TEMPS PAR PROJET RESTE, et il le fallait.

        La carte de droite ne nomme QU'UN projet à facturer — le plus gros. Avec
        trois projets qui portent du temps non facturé, les deux autres
        deviendraient inatteignables si cette section disparaissait : ce serait
        retirer une fonction sous couvert de mise en page. Elle répond d'ailleurs
        à une autre question que le ruban de la semaine — QUI a mangé le temps,
        et non OÙ dans la semaine.
      */}
      {perProject.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-4">
            <p className="eyebrow flex-shrink-0">{tr('hist.time.cetteSemaineParProjet')}</p>
            <span className="h-px flex-1 bg-border-section" aria-hidden />
          </div>
          <div className="flex flex-col gap-2.5">
            {perProject.map((row, index) => {
              const billable = row.projectId ? billableOf(row.projectId) : [];
              return (
                <ProjectBar
                  key={row.projectId || 'aucun'}
                  title={projectTitle(row.projectId)}
                  ms={row.ms}
                  share={perProject[0].ms > 0 ? row.ms / perProject[0].ms : 0}
                  rank={index}
                  onInvoice={
                    canInvoice && row.projectId && billable.length > 0
                      ? () => setInvoiceFor(row.projectId)
                      : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- la semaine ---- */}
      {/*
        SEPT BARRES, UNE PAR JOUR.

        « Cette semaine par projet » répondait à une autre question — qui a
        mangé le temps — et elle garde son sens, mais elle ne dit pas OÙ dans la
        semaine. Sept barres à la même échelle disent d'un regard le jour chargé
        et le jour creux, ce qu'une liste de projets ne peut pas montrer.
      */}
      <section>
        <div className="mb-4 flex items-center gap-4">
          <p className="eyebrow flex-shrink-0">{tr('hist.time.laSemaine')}</p>
          <span className="h-px flex-1 bg-border-section" aria-hidden />
          <p className="eyebrow flex-shrink-0">{tr('hist.time.lundiDAbord')}</p>
        </div>
        <div className="flex items-end gap-1.5 sm:gap-3">
          {semaine.map((jour) => (
            <div key={jour.day} className="flex min-w-0 flex-1 flex-col gap-2">
              <span
                className={`tnum truncate text-center font-mono text-[11px] ${
                  jour.ms > 0 ? 'text-text-secondary' : 'text-text-muted'
                }`}
              >
                {jour.ms > 0 ? formatDuration(jour.ms) : '—'}
              </span>
              {/* La hauteur est relative au jour le plus chargé de la semaine :
                  c'est une comparaison entre eux, pas contre un idéal de huit
                  heures que personne n'a demandé. */}
              <span
                className={`w-full ${jour.aujourdhui ? 'bg-[#4a4a48]' : 'bg-[#2b2b2b]'}`}
                style={{ height: Math.max(3, (jour.ms / Math.max(1, maxJour)) * 96) }}
                aria-hidden
              />
              <span
                className={`truncate border-t pt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                  jour.aujourdhui ? 'border-border-strong text-text-primary' : 'border-border text-text-muted'
                }`}
              >
                {jour.etiquette}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- l'historique --- */}
      {byDay.length === 0 ? (
        /*
          TEMPS (BLOC A) — même boîte centrée que Dépenses, même correction.
          Le chronomètre est déjà en haut de l'écran : l'état vide n'a donc
          aucune action à proposer, il a seulement à ne pas encombrer.
        */
        <FirstRun title={tr('hist.time.rienDeChronometrePour')}>{tr('hist.time.unBoutonDeuxFois')}</FirstRun>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-3">
          {byDay.map((group) => (
            <motion.div key={group.day} variants={staggerItem} className="border border-border bg-surface">
              <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                  {formatDayHeading(group.day)}
                </span>
                <span className="font-mono text-xs tabular-nums text-text-primary">
                  {formatDuration(group.rows.reduce((sum, e) => sum + durationMs(e, now), 0))}
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {group.rows.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    now={now}
                    projectName={entry.projectId ? projectTitle(entry.projectId) : ''}
                    onEdit={() => setEditing(entry)}
                    onDelete={() => deleteEntry(entry.id)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {manualOpen && (
          <ManualEntryDialog
            defaultDay={dayOf(new Date().toISOString())}
            onSubmit={addManual}
            onClose={() => setManualOpen(false)}
          />
        )}

        {editing && (
          <EditEntryDialog
            entry={editing}
            onSave={(patch) => updateEntry(editing.id, patch)}
            onClose={() => setEditing(null)}
          />
        )}

        {invoiceFor && (
          <TimeInvoiceDialog
            projectTitle={projectTitle(invoiceFor)}
            clientName={clients.find((c) => c.id === invoiceProject?.clientId)?.name ?? ''}
            entries={billableOf(invoiceFor)}
            defaultRateCents={config.hourlyRateCents}
            onConfirm={confirmInvoice}
            onClose={() => setInvoiceFor(null)}
          />
        )}
      </AnimatePresence>

      {/* Une semaine commence le lundi — dit une fois, en bas, pour que le
          total « cette semaine » ne soit pas une devinette. */}
      <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
        Semaine du {formatDayHeading(weekStart(dayOf(new Date(now).toISOString())))}
      </p>
    </section>
  );
}


function ProjectBar({
  title,
  ms,
  share,
  rank,
  onInvoice,
}: {
  title: string;
  ms: number;
  share: number;
  rank: number;
  onInvoice?: () => void;
}) {
  const opacity = Math.max(0.3, 1 - rank * 0.14);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-text-primary">{title}</span>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-text-secondary">
            {formatDuration(ms)}
          </span>
          {onInvoice && (
            <button
              type="button"
              onClick={onInvoice}
              title={tr('hist.time.creerUnBrouillonDe')}
              className="flex h-8 items-center gap-1 border border-border px-2 font-mono text-[9px] uppercase tracking-widest text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <ReceiptEuro size={12} strokeWidth={2} />
              Facturer
            </button>
          )}
        </div>
      </div>
      <div className="h-2 w-full bg-bg">
        <div className="h-full bg-accent" style={{ width: `${Math.round(share * 100)}%`, opacity }} />
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  now,
  projectName,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  now: number;
  projectName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = isRunning(entry);

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">
          {entry.label || (projectName ? projectName : 'Sans intitulé')}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {formatClock(entry.startedAt)}
            {entry.endedAt ? ` – ${formatClock(entry.endedAt)}` : ' · en cours'}
          </span>
          <ProjectTag projectId={entry.projectId} />
          {entry.invoicedAt && (
            <span className="border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-muted">{tr('hist.time.facture')}</span>
          )}
        </div>
      </div>

      <span
        className={`flex-shrink-0 font-mono text-sm tabular-nums ${
          live ? 'text-accent' : 'text-text-primary'
        }`}
      >
        {formatDuration(durationMs(entry, now))}
      </span>

      <button
        type="button"
        onClick={onEdit}
        aria-label="Modifier"
        className="flex h-11 w-9 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
      >
        <Pencil size={14} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
        onBlur={() => setConfirmDelete(false)}
        aria-label={confirmDelete ? 'Confirmer la suppression' : 'Supprimer'}
        className={`flex h-11 flex-shrink-0 items-center justify-center px-2 transition-colors ${
          confirmDelete ? 'text-danger' : 'text-text-muted hover:text-danger'
        }`}
      >
        {confirmDelete ? (
          <span className="font-mono text-[9px] uppercase tracking-widest">{tr('hist.time.sur')}</span>
        ) : (
          <Trash2 size={14} strokeWidth={1.9} />
        )}
      </button>
    </div>
  );
}

/**
 * La correction d'une période déjà enregistrée.
 *
 * On ne corrige que l'intitulé et le projet — pas les horodatages. Retoucher
 * un début et une fin à la main, c'est réintroduire la feuille d'heures : si
 * la durée est fausse, la période se supprime et se ressaisit, ce qui laisse
 * une trace honnête au lieu d'un chiffre réécrit.
 */
function EditEntryDialog({
  entry,
  onSave,
  onClose,
}: {
  entry: TimeEntry;
  onSave: (patch: { label: string; projectId?: string }) => void;
  onClose: () => void;
}) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const [label, setLabel] = useState(entry.label);
  const [projectId, setProjectId] = useState(entry.projectId ?? '');

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex w-full max-w-md flex-col border border-border-strong bg-surface"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Modifier ce temps
          </h2>
        </div>
        <div className="p-4">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.time.surQuoi')}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </label>
          <ProjectPicker value={projectId} onChange={setProjectId} className="mt-4" />
          <p className="mt-3 text-xs leading-relaxed text-text-secondary">{tr('hist.time.laDureeNEst')}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ label: label.trim(), projectId: projectId || undefined });
              onClose();
            }}
            className="flex min-h-11 items-center bg-accent px-4 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >{tr('hist.time.enregistrer')}</button>
        </div>
      </motion.div>
    </div>
  );
}

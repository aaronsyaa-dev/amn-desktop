import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Lock, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useHaloSignal } from '../components/EtatEcran';

/**
 * LES INTERVENTIONS — le compte rendu en trois temps.
 *
 * Pour qui : un dépanneur, un poseur, un jardinier, quiconque se déplace chez
 * quelqu'un et doit pouvoir montrer ce qu'il a trouvé et ce qu'il a laissé.
 * Ce que ça règle : une fiche par intervention, avec AVANT, PENDANT, APRÈS —
 * une photo et un commentaire pour chacun — et la liste de ce qui a été
 * consommé sur place.
 *
 * ## Un module qui n'existait pas, et pourquoi il a été créé
 *
 * `MODULES.md` décrit ce module (`24c`) comme un module de la famille
 * Production. Le produit n'en avait aucun : ni écran, ni route, ni
 * collection. Les deux lectures possibles étaient « la spécification décrit
 * une intention, on la note et on passe » ou « le produit a un trou, on le
 * comble ». C'est la seconde, et c'est dit ici plutôt que caché : le module
 * est nouveau, avec sa collection `interventions`, sa route et son entrée de
 * barre latérale dans les deux éditions.
 *
 * Ce qu'il n'invente PAS : il n'y a pas de compte photo, pas de retouche, pas
 * de galerie. Une photo est une image lue en `data:` et posée sur le volet,
 * exactement comme les pièces jointes des messages le font déjà dans ce
 * produit (voir `MediaLibraryScreen`). Le module reste dans ce que la base
 * sait faire.
 *
 * ## Ce qui domine : la séquence, pas la galerie
 *
 * Trois volets côte à côte, dans l'ordre. Le module ne met pas les photos
 * d'un côté et les notes de l'autre : c'est la SÉQUENCE qui fait la valeur
 * d'un compte rendu. Un « après » sans « avant » ne prouve rien ; un « avant »
 * sans « après » ne se facture pas.
 *
 * ## L'ambre
 *
 * Sur le volet « après » quand il est incomplet : son cadre, son surtitre et
 * son emplacement photo vide. Trois nœuds dans un seul volet. Une fiche
 * complète, ou une fiche close, n'a pas d'ambre.
 *
 * ## La règle qui coûte cher si on l'oublie
 *
 * UNE INTERVENTION CLOSE NE PEUT PLUS RECEVOIR DE PHOTO, et l'écran le dit
 * AVANT la clôture, pas après. Sans le volet « après », la fiche ne sert ni
 * au portfolio ni à une contestation — et c'est précisément le jour de la
 * contestation qu'on s'en aperçoit.
 */

/* ─── LA FICHE EN TROIS TEMPS — l'objet dominant (`24c`) ───────────────────── */

const TEMPS = [
  { cle: 'avant', titre: 'Avant', aide: 'L’état trouvé en arrivant.' },
  { cle: 'pendant', titre: 'Pendant', aide: 'Ce qui a été fait, en cours.' },
  { cle: 'apres', titre: 'Après', aide: 'L’état laissé en partant.' },
] as const;

type CleDeTemps = (typeof TEMPS)[number]['cle'];

/** Le rapport de l'emplacement photo. Quatre tiers, jamais autre chose. */
const PHOTO_RATIO = '4 / 3';

interface VoletData {
  /** L'image en `data:` — le produit stocke déjà ses pièces jointes ainsi. */
  photo: string;
  note: string;
}

interface ConsommationData {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  unitCostCents: number;
}

interface InterventionData {
  title: string;
  clientName: string;
  address: string;
  at: string;
  volets: Record<CleDeTemps, VoletData>;
  consommations: ConsommationData[];
  /** Horodatage de clôture ; chaîne vide tant que la fiche est ouverte. */
  closedAt: string;
  /** Horodatage du report dans Stock et Dépenses ; vide tant que rien n'est parti. */
  reportedAt: string;
  createdAt: string;
}

const VOLET_VIDE: VoletData = { photo: '', note: '' };

function voletDe(f: InterventionData, cle: CleDeTemps): VoletData {
  return f.volets?.[cle] ?? VOLET_VIDE;
}

/** Un volet est complet quand il porte une photo ET un commentaire. */
function voletComplet(v: VoletData): boolean {
  return Boolean(v.photo) && v.note.trim().length > 0;
}

/** Ce qui manque à une fiche, en clair — c'est ce que la colonne de droite lit. */
function manques(f: InterventionData): string[] {
  const liste: string[] = [];
  for (const t of TEMPS) {
    const v = voletDe(f, t.cle);
    if (!v.photo && !v.note.trim()) liste.push(`${t.titre} : rien`);
    else if (!v.photo) liste.push(`${t.titre} : pas de photo`);
    else if (!v.note.trim()) liste.push(`${t.titre} : pas de commentaire`);
  }
  return liste;
}

const euros = (cents: number) =>
  `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const quantiteLisible = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');

interface StockItemData {
  name: string;
  quantity: number;
  unit: string;
  threshold: number;
  movedAt: string;
}

export function InterventionsScreen() {
  const { upsert, remove } = useSync();
  const brutes = useCollection<InterventionData>('interventions');
  const articles = useCollection<StockItemData>('stockItems');

  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [choisieId, setChoisieId] = useState<string | null>(null);

  const fiches = useMemo(() => [...brutes].sort((a, b) => b.at.localeCompare(a.at)), [brutes]);
  const enCours = useMemo(() => fiches.filter((f) => !f.closedAt), [fiches]);

  /*
    LA FICHE OUVERTE — celle qu'on a choisie, sinon la plus récente ENCORE
    OUVERTE. On vient sur cet écran pour compléter un compte rendu, pas pour
    relire une fiche close ; ouvrir sur une fiche qu'on ne peut plus modifier
    serait ouvrir sur un cul-de-sac.
  */
  const fiche = fiches.find((f) => f.id === choisieId) ?? enCours[0] ?? fiches[0] ?? null;

  const apres = fiche ? voletDe(fiche, 'apres') : VOLET_VIDE;
  const apresIncomplet = fiche !== null && !fiche.closedAt && !voletComplet(apres);
  const halo = useHaloSignal(apresIncomplet);

  const totalConsomme = fiche
    ? fiche.consommations.reduce((n, c) => n + Math.round(c.quantity * c.unitCostCents), 0)
    : 0;

  const ajouter = async () => {
    if (!title.trim()) return;
    const maintenant = new Date().toISOString();
    await upsert('interventions', uid('itv'), {
      title: title.trim(),
      clientName: clientName.trim(),
      address: address.trim(),
      at: maintenant,
      volets: { avant: { ...VOLET_VIDE }, pendant: { ...VOLET_VIDE }, apres: { ...VOLET_VIDE } },
      consommations: [],
      closedAt: '',
      reportedAt: '',
      createdAt: maintenant,
    });
    setTitle('');
    setClientName('');
    setAddress('');
    setOuvert(false);
  };

  const ecrireVolet = (f: InterventionData & { id: string }, cle: CleDeTemps, v: Partial<VoletData>) =>
    upsert('interventions', f.id, {
      ...f,
      volets: { ...f.volets, [cle]: { ...voletDe(f, cle), ...v } },
    });

  /*
    LA CLÔTURE — le point de non-retour, et il est annoncé.

    Une fois close, la fiche ne reçoit plus ni photo ni commentaire. C'est la
    règle du module, et elle a une raison : un compte rendu qu'on peut
    compléter après coup ne prouve rien. L'écran refuse donc de la clore en
    silence quand le volet « après » manque — il le dit d'abord.
  */
  const clore = (f: InterventionData & { id: string }) =>
    upsert('interventions', f.id, { ...f, closedAt: new Date().toISOString() });

  /*
    LE REPORT DANS STOCK ET DÉPENSES — l'écran ne se contente pas de dire que
    ça « remonte », il le FAIT.

    Chaque consommation dont le libellé correspond à un article de stock
    décrémente cet article et date son mouvement ; l'ensemble devient une
    dépense unique, au nom de l'intervention. Le report est daté sur la fiche,
    donc il ne peut pas partir deux fois — une consommation reportée deux fois
    est un stock faux et une dépense en double.
  */
  const reporter = async (f: InterventionData & { id: string }) => {
    if (f.reportedAt || f.consommations.length === 0) return;
    const maintenant = new Date().toISOString();
    for (const c of f.consommations) {
      const article = articles.find(
        (a) => a.name.trim().toLowerCase() === c.label.trim().toLowerCase(),
      );
      if (!article) continue;
      await upsert('stockItems', article.id, {
        ...article,
        quantity: Math.max(0, article.quantity - c.quantity),
        movedAt: maintenant,
      });
    }
    const total = f.consommations.reduce((n, c) => n + Math.round(c.quantity * c.unitCostCents), 0);
    if (total > 0) {
      await upsert('expenses', uid('exp'), {
        note: `Intervention — ${f.title}`,
        amountCents: total,
        category: 'Fournitures',
        date: maintenant.slice(0, 10),
        createdAt: maintenant,
      });
    }
    await upsert('interventions', f.id, { ...f, reportedAt: maintenant });
  };

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5"
    >
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow="Production · Interventions"
          title="Interventions"
          description="Une fiche par déplacement : avant, pendant, après, et ce qui a été consommé."
          stats={[
            { label: 'Fiches', value: fiches.length },
            { label: 'En cours', value: enCours.length },
            {
              label: 'Sans volet « après »',
              value: enCours.filter((f) => !voletComplet(voletDe(f, 'apres'))).length,
            },
          ]}
          actions={
            <button
              type="button"
              onClick={() => setOuvert((v) => !v)}
              className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Plus size={16} strokeWidth={2} /> Nouvelle intervention
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form
          variants={staggerItem}
          onSubmit={(e) => {
            e.preventDefault();
            void ajouter();
          }}
          className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Objet — « Fuite sous évier »"
            aria-label="Objet de l’intervention"
            autoFocus
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          />
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client"
            aria-label="Client"
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Adresse"
            aria-label="Adresse"
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          />
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button
              type="submit"
              disabled={!title.trim()}
              className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
            >
              Ouvrir la fiche
            </button>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Fermer
            </button>
          </div>
        </motion.form>
      )}

      {fiches.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun
            title="Aucune intervention"
            action={{ label: 'Ouvrir une fiche', onClick: () => setOuvert(true) }}
          >
            Une fiche par déplacement, avec une photo et un mot pour l’avant, le pendant et
            l’après. C’est ce triptyque qui sert au portfolio comme à une contestation.
          </FirstRun>
        </motion.div>
      ) : fiche ? (
        <>
          {/* ── LA FICHE EN TROIS TEMPS — l'objet dominant ───────────────── */}
          <motion.section variants={staggerItem} className="panel-raised panel-raised-wide p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="eyebrow">
                  {fiche.closedAt ? 'Fiche close' : 'Fiche ouverte'} ·{' '}
                  {new Date(fiche.at).toLocaleDateString('fr-FR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <p className="mt-1 text-[21px] font-semibold leading-tight text-text-primary sm:text-[25px]">
                  {fiche.title}
                </p>
                <p className="mt-1 text-[13px] text-text-secondary">
                  {[fiche.clientName, fiche.address].filter(Boolean).join(' · ') ||
                    'Sans client ni adresse'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove('interventions', fiche.id)}
                aria-label="Supprimer la fiche"
                title="Supprimer la fiche"
                className="min-h-11 px-2 text-text-muted hover:text-danger md:min-h-0"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* LES TROIS VOLETS, DANS L'ORDRE. Côte à côte sur poste, empilés
                sur téléphone — mais jamais réordonnés : la séquence est le
                sujet du module. */}
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {TEMPS.map((t) => {
                const v = voletDe(fiche, t.cle);
                const signal = t.cle === 'apres' && apresIncomplet;
                return (
                  <Volet
                    key={t.cle}
                    titre={t.titre}
                    aide={t.aide}
                    volet={v}
                    signal={signal}
                    halo={halo}
                    verrouille={Boolean(fiche.closedAt)}
                    onPhoto={(photo) => void ecrireVolet(fiche, t.cle, { photo })}
                    onNote={(note) => void ecrireVolet(fiche, t.cle, { note })}
                  />
                );
              })}
            </div>

            {/* LA CLÔTURE, ET SON AVERTISSEMENT AVANT LE GESTE. */}
            <div className="mt-5 border-t border-border-row pt-4">
              {fiche.closedAt ? (
                <p className="flex flex-wrap items-center gap-2 text-[13px] leading-relaxed text-text-secondary">
                  <Lock size={13} className="flex-shrink-0 text-text-muted" />
                  Close {relativeTime(fiche.closedAt)}. Une fiche close ne reçoit plus ni photo ni
                  commentaire — c’est ce qui lui donne sa valeur de preuve.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <button
                    type="button"
                    onClick={() => void clore(fiche)}
                    className="min-h-11 border border-border-strong px-4 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                  >
                    Clore la fiche
                  </button>
                  <p className="max-w-xl flex-1 text-[12.5px] leading-relaxed text-text-muted">
                    {voletComplet(apres)
                      ? 'Une fois close, la fiche ne recevra plus ni photo ni commentaire.'
                      : 'Le volet « après » est incomplet. Une fois close, la fiche ne recevra plus de photo : sans ce volet, elle ne servira ni au portfolio ni à une contestation.'}
                  </p>
                </div>
              )}
            </div>
          </motion.section>

          {/* AUTOUR — à gauche ce qui a été consommé, à droite les fiches en cours. */}
          <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="eyebrow">Consommé sur l’intervention</p>
                <p className="tnum font-mono text-[13px] font-semibold text-text-primary">
                  {euros(totalConsomme)}
                </p>
              </div>

              {fiche.consommations.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Rien de consommé sur cette fiche.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-px bg-border">
                  {fiche.consommations.map((c) => {
                    const connu = articles.some(
                      (a) => a.name.trim().toLowerCase() === c.label.trim().toLowerCase(),
                    );
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-surface px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                          {c.label}
                          {!connu && (
                            <span className="text-text-muted"> · hors stock suivi</span>
                          )}
                        </span>
                        <span className="tnum font-mono text-[11px] uppercase tracking-wider text-text-muted">
                          {quantiteLisible(c.quantity)} {c.unit}
                        </span>
                        <span className="tnum w-20 flex-shrink-0 text-right font-mono text-[12px] text-text-secondary">
                          {euros(Math.round(c.quantity * c.unitCostCents))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 border-t border-border-row pt-3">
                {fiche.reportedAt ? (
                  <p className="text-[12.5px] leading-relaxed text-text-secondary">
                    Reporté {relativeTime(fiche.reportedAt)} : les quantités ont été retirées du
                    stock et le total est parti en dépense. Un report ne se rejoue pas — deux
                    reports feraient un stock faux et une dépense en double.
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void reporter(fiche)}
                      disabled={fiche.consommations.length === 0}
                      className="min-h-11 border border-border-strong px-4 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40"
                    >
                      Reporter dans Stock et Dépenses
                    </button>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                      Les lignes qui portent le nom d’un article suivi le décrémentent ; le total
                      devient une dépense au nom de l’intervention.
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">Les fiches en cours</p>
              {enCours.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Aucune fiche ouverte.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {enCours.slice(0, 3).map((f) => {
                    const liste = manques(f);
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setChoisieId(f.id)}
                          aria-pressed={f.id === fiche.id}
                          className={`w-full border px-3 py-2.5 text-left transition-colors ${
                            f.id === fiche.id
                              ? 'border-border-strong bg-surface-hover'
                              : 'border-border hover:bg-surface-hover'
                          }`}
                        >
                          <span className="block truncate text-[13.5px] text-text-primary">
                            {f.title}
                          </span>
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            {liste.length === 0 ? 'complète' : liste.join(' · ')}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {enCours.length > 3 && (
                <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
                  {enCours.length - 3} autre{enCours.length - 3 > 1 ? 's' : ''} fiche
                  {enCours.length - 3 > 1 ? 's' : ''} ouverte
                  {enCours.length - 3 > 1 ? 's' : ''} — le registre complet est ci-dessous.
                </p>
              )}
            </section>
          </motion.div>

          {/* LE REGISTRE — toutes les fiches, closes comprises. */}
          <motion.section variants={staggerItem} className="panel">
            <p className="eyebrow border-b border-border px-4 py-2.5">Le registre</p>
            <ul className="flex flex-col gap-px bg-border">
              {fiches.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setChoisieId(f.id)}
                    aria-pressed={f.id === fiche.id}
                    className={`flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 text-left transition-colors ${
                      f.id === fiche.id ? 'bg-surface-hover' : 'bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {f.title}
                      {f.clientName && <span className="text-text-muted"> · {f.clientName}</span>}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {f.closedAt ? `close ${relativeTime(f.closedAt)}` : 'ouverte'}
                    </span>
                    <span className="tnum w-28 flex-shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {TEMPS.filter((t) => voletComplet(voletDe(f, t.cle))).length}/3 volets
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      ) : null}
    </motion.section>
  );
}

/**
 * UN VOLET — son emplacement photo en 4/3, et son commentaire.
 *
 * L'emplacement garde sa place et son rapport MÊME VIDE : c'est lui qui
 * signale qu'il manque quelque chose. Un emplacement qui disparaît quand il
 * est vide ne manque à personne, et c'est exactement le défaut que ce module
 * existe pour corriger.
 */
function Volet({
  titre,
  aide,
  volet,
  signal,
  halo,
  verrouille,
  onPhoto,
  onNote,
}: {
  titre: string;
  aide: string;
  volet: VoletData;
  signal: boolean;
  halo: string;
  verrouille: boolean;
  onPhoto: (dataUrl: string) => void;
  onNote: (note: string) => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(volet.note);

  const lire = (fichier: File | undefined) => {
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      if (typeof lecteur.result === 'string') onPhoto(lecteur.result);
    };
    lecteur.readAsDataURL(fichier);
  };

  return (
    <div
      className={`flex flex-col gap-3 border p-3 ${signal ? 'border-signal-line bg-signal-muted' : 'border-border bg-sunken'}`}
      data-signal-groupe={signal ? 'apres-incomplet' : undefined}
    >
      <p
        className={`eyebrow ${signal ? `text-signal ${halo}` : ''}`}
        data-signal-groupe={signal ? 'apres-incomplet' : undefined}
      >
        {titre}
      </p>

      {/* L'EMPLACEMENT PHOTO — 4/3, toujours, plein ou vide. */}
      <div
        className={`relative w-full overflow-hidden border ${
          signal && !volet.photo ? 'border-signal' : 'border-border-strong'
        }`}
        style={{ aspectRatio: PHOTO_RATIO, background: 'var(--color-bg)' }}
        data-signal-groupe={signal && !volet.photo ? 'apres-incomplet' : undefined}
      >
        {volet.photo ? (
          <img src={volet.photo} alt={`${titre} — photo`} className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
            <Camera size={18} className={signal ? 'text-signal' : 'text-text-muted'} />
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${signal ? 'text-signal' : 'text-text-muted'}`}
            >
              aucune photo
            </span>
          </span>
        )}
      </div>

      {verrouille ? (
        <p className="text-[12px] leading-relaxed text-text-muted">
          {volet.note || 'Aucun commentaire.'}
        </p>
      ) : (
        <>
          <input
            ref={champ}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => lire(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => champ.current?.click()}
            className="min-h-11 border border-border-strong px-3 text-[12px] font-semibold text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-2"
          >
            {volet.photo ? 'Remplacer la photo' : 'Ajouter une photo'}
          </button>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== volet.note) onNote(note);
            }}
            rows={3}
            placeholder={aide}
            aria-label={`Commentaire — ${titre}`}
            className="input-focus border border-border bg-bg px-2.5 py-2 text-[12.5px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
          />
        </>
      )}
    </div>
  );
}

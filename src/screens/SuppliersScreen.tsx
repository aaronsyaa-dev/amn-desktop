import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, PackageCheck, Phone, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

interface SupplierData {
  name: string;
  supplies: string;
  contact: string;
  phone: string;
  email: string;
  lastOrderAt: string | null;
  createdAt: string;
  /*
    TROIS CHAMPS AJOUTÉS AU MODÈLE, et pourquoi.

    L'haltère demande de comparer un délai PROMIS à un délai CONSTATÉ. Le
    modèle du produit ne portait ni l'un ni l'autre : une fiche fournisseur
    n'avait qu'une date de dernière commande. Deux choix possibles —
    approximer la fiabilité à partir de cette seule date (ce qui n'aurait
    mesuré que le silence, pas la ponctualité), ou porter la vraie donnée.

    C'est la vraie donnée. `leadTimeDays` est le délai annoncé par le
    fournisseur, saisi une fois. `deliveries` est la suite des délais
    RÉELLEMENT observés en jours, écrite par le geste « livrée » — elle n'est
    jamais saisie à la main, elle se déduit de l'écart entre la commande et sa
    réception. `lastDeliveryAt` dit laquelle des deux dates est la plus
    récente, donc si une commande est encore en cours.

    Conséquence assumée : une fiche sans délai promis ou sans aucune livraison
    mesurée n'a pas d'haltère. Elle ne se dessine pas à zéro — un point à
    l'origine serait une mesure, alors que c'est une absence de mesure.
  */
  leadTimeDays?: number | null;
  deliveries?: number[];
  lastDeliveryAt?: string | null;
}

const QUATRE_VINGT_DIX_JOURS = 90 * 86_400_000;

/** Silencieux : jamais commandé, ou plus rien depuis trois mois. */
const muet = (f: SupplierData, maintenant: number) =>
  !f.lastOrderAt || maintenant - Date.parse(f.lastOrderAt) > QUATRE_VINGT_DIX_JOURS;

/* ─── LES HALTÈRES SUR LA RÈGLE DE DIX JOURS — l'objet dominant (`15d`) ───── */

/*
  Par fournisseur, DEUX POINTS SUR LA MÊME RÈGLE : le délai promis en cercle
  vide, le délai constaté en disque plein, reliés par une barre. L'écart entre
  les deux points EST la fiabilité, et il se lit sans soustraction — c'est
  toute la raison d'être de la forme. Deux barres l'une sous l'autre se
  comparent d'un regard ; deux colonnes de chiffres demandent qu'on les
  soustraie de tête.

  LA GRILLE PARTAGÉE (§0.6) : la rangée de graduations porte exactement la
  même `grid-template-columns` que les haltères, cellules vides comprises. Un
  recalage par `margin-left`/`padding-right` ne déplacerait pas le bloc
  conteneur des enfants absolus, et la graduation mentirait de la largeur de
  la colonne des noms.
*/
const AXE_JOURS = 10;
const CRANS_JOURS = [0, 2, 4, 6, 8, 10];
const HALTERE_COLONNES =
  'grid-cols-[minmax(0,1fr)_minmax(0,3fr)_84px] md:grid-cols-[196px_minmax(0,1fr)_104px]';

/** La virgule française, une décimale : « 8,6 j ». */
const enJours = (n: number) => `${n.toFixed(1).replace('.', ',')} j`;
const surLaRegle = (jours: number) => Math.min(100, Math.max(0, (jours / AXE_JOURS) * 100));
const moyenneDe = (xs: number[]) => xs.reduce((somme, x) => somme + x, 0) / xs.length;

interface Haltere {
  f: SupplierData & { id: string };
  promis: number;
  reel: number;
  ecart: number;
  xPromis: number;
  xReel: number;
  deborde: boolean;
  livraisons: number[];
  dansLesTemps: number;
}

function mesure(f: SupplierData): boolean {
  return typeof f.leadTimeDays === 'number' && f.leadTimeDays > 0 && (f.deliveries?.length ?? 0) > 0;
}

/** Triées du moins fiable au plus fiable : la tête de liste porte l'ambre. */
function halteresDe(fournisseurs: (SupplierData & { id: string })[]): Haltere[] {
  return fournisseurs
    .filter(mesure)
    .map((f) => {
      const promis = f.leadTimeDays as number;
      const livraisons = f.deliveries as number[];
      const reel = moyenneDe(livraisons);
      return {
        f,
        promis,
        reel,
        ecart: reel - promis,
        xPromis: surLaRegle(promis),
        xReel: surLaRegle(reel),
        deborde: reel > AXE_JOURS || promis > AXE_JOURS,
        livraisons,
        dansLesTemps: livraisons.filter((j) => j <= promis).length,
      };
    })
    .sort((a, b) => b.ecart - a.ecart);
}

/** Une commande est EN COURS tant qu'aucune réception ne lui répond. */
function enCoursDe(f: SupplierData): boolean {
  if (!f.lastOrderAt) return false;
  if (!f.lastDeliveryAt) return true;
  return Date.parse(f.lastOrderAt) > Date.parse(f.lastDeliveryAt);
}

/**
 * LES FOURNISSEURS — qui vous livre quoi, et depuis quand.
 *
 * Pour qui : une boutique ou un atelier dont le numéro du grossiste vit dans
 * un SMS de l'an dernier. Ce que ça règle : une fiche par fournisseur avec ce
 * qu'il livre, qui appeler, et la date de la dernière commande — posée d'un
 * geste. Les fournisseurs silencieux depuis trois mois remontent : c'est
 * souvent là qu'une commande a été oubliée.
 *
 * ## Un commentaire qui mentait, corrigé le 12 septembre
 *
 * La phrase ci-dessus — « les fournisseurs silencieux remontent » — décrivait
 * une intention, pas le code. Les fiches étaient triées par NOM, et le silence
 * ne se voyait que dans un relevé d'en-tête et une date en orange au milieu
 * d'une grille de cartes égales. Sur le bac à sable : « Bois de l'Hérault »,
 * commandé il y a un mois, ouvrait l'écran ; « Métal & Structure », muet
 * depuis quatre mois, arrivait troisième.
 *
 * Ils remontent pour de bon maintenant, et le commentaire est redevenu vrai.
 *
 * ## Ce qui domine, et ce que la famille a en commun
 *
 * Un registre ne se surveille pas, il se CONSULTE : la question n'est pas
 * « qu'est-ce qui a changé » mais « où est celui que je cherche ». D'où un
 * champ de recherche et des LIGNES, pas des cartes — six cartes de 17 rem
 * remplissaient déjà la fenêtre, et un registre de quarante fournisseurs
 * demanderait six écrans de défilement.
 *
 * Mais chaque registre garde son propre dominant, tiré de sa matière : ici le
 * SILENCE, parce que c'est le seul défaut qu'une liste de fournisseurs puisse
 * porter.
 *
 * ## L'ambre
 *
 * Sur les silencieux, et nulle part ailleurs. Une fiche qu'on consulte n'est
 * pas une décision ; un fournisseur oublié depuis trois mois en est une —
 * commander, ou retirer la fiche.
 */
export function SuppliersScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<SupplierData>('suppliers');
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState('');
  const [supplies, setSupplies] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [recherche, setRecherche] = useState('');
  const maintenant = Date.now();

  /*
    L'ORDRE DU REGISTRE : les silencieux d'abord, puis l'alphabet.

    C'est ce que l'en-tête du fichier promettait depuis le début. À l'intérieur
    d'un groupe, l'alphabet — un registre se parcourt du regard, et un ordre
    par date y serait imprévisible.

    `maintenant` est relu DANS le mémo, pas capturé dehors : une horloge lue à
    chaque rendu ne peut pas servir de dépendance honnête.
  */
  const fournisseurs = useMemo(() => {
    const a_present = Date.now();
    return [...brutes].sort((a, b) => {
      const ma = muet(a, a_present);
      const mb = muet(b, a_present);
      if (ma !== mb) return ma ? -1 : 1;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [brutes]);
  const muets = fournisseurs.filter((f) => muet(f, maintenant));
  const q = recherche.trim().toLowerCase();
  const trouves = q
    ? fournisseurs.filter((f) => `${f.name} ${f.supplies} ${f.contact}`.toLowerCase().includes(q))
    : fournisseurs;
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const commandesMois = fournisseurs.filter((f) => f.lastOrderAt && Date.parse(f.lastOrderAt) >= debutMois).length;
  const silencieux = fournisseurs.filter((f) => !f.lastOrderAt || maintenant - Date.parse(f.lastOrderAt) > QUATRE_VINGT_DIX_JOURS).length;

  /*
    LES HALTÈRES, et l'ambre qui va avec.

    L'ambre va au fournisseur le moins fiable — celui dont le disque réel est
    le plus loin à droite de son cercle promis. Si personne ne dépasse son
    délai promis, il n'y a pas de moins fiable : l'ambre retombe alors sur les
    silencieux, qui redeviennent la seule décision de l'écran. Et si rien
    n'est mesuré du tout, l'écran n'a pas d'ambre — un écran sans matière n'a
    rien à désigner (§0.4).
  */
  const halteres = useMemo(() => halteresDe(fournisseurs), [fournisseurs]);
  const ambreHaltere = halteres.length > 0 && halteres[0].ecart > 0.05 ? halteres[0] : null;
  const ambreSilence = !ambreHaltere && muets.length > 0;
  const halo = useHaloSignal(ambreHaltere !== null);

  const attendues = fournisseurs.filter(enCoursDe);

  const ajouter = async () => {
    if (!name.trim()) return;
    await upsert('suppliers', uid('sup'), { name: name.trim(), supplies: supplies.trim(), contact: contact.trim(), phone: phone.trim(), email: email.trim(), lastOrderAt: null, createdAt: new Date().toISOString() });
    setName(''); setSupplies(''); setContact(''); setPhone(''); setEmail(''); setOuvert(false);
  };
  const commander = (f: SupplierData & { id: string }) =>
    upsert('suppliers', f.id, { ...f, lastOrderAt: new Date().toISOString() });

  /*
    LE GESTE « LIVRÉE » — c'est lui qui fabrique la mesure.

    Le délai constaté n'est jamais saisi : il se DÉDUIT de l'écart entre la
    commande et sa réception, arrondi au jour, plancher à 1 (une livraison le
    jour même reste une journée de délai, pas zéro). On ne garde que les huit
    dernières mesures — au-delà, la moyenne cesse de refléter le fournisseur
    d'aujourd'hui.
  */
  const livrer = (f: SupplierData & { id: string }) => {
    if (!f.lastOrderAt) return;
    const maintenantIso = new Date().toISOString();
    const jours = Math.max(1, Math.round((Date.parse(maintenantIso) - Date.parse(f.lastOrderAt)) / 86_400_000));
    const deliveries = [...(f.deliveries ?? []), jours].slice(-8);
    return upsert('suppliers', f.id, { ...f, deliveries, lastDeliveryAt: maintenantIso });
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('fournisseurs.titre') })}
          title={t('fournisseurs.titre')}
          description={t('fournisseurs.description')}
          stats={[
            { label: t('fournisseurs.stat.fournisseurs'), value: fournisseurs.length },
            { label: t('fournisseurs.stat.commandesMois'), value: commandesMois },
            { label: t('fournisseurs.stat.silencieux'), value: silencieux, emphasis: silencieux > 0 && fournisseurs.length > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('fournisseurs.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('fournisseurs.champNom')} aria-label={t('fournisseurs.champNom')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={supplies} onChange={(e) => setSupplies(e.target.value)} placeholder={t('fournisseurs.champFourniture')} aria-label={t('fournisseurs.champFourniture')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('fournisseurs.champContact')} aria-label={t('fournisseurs.champContact')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder={t('fournisseurs.champTelephone')} aria-label={t('fournisseurs.champTelephone')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('fournisseurs.champEmail')} aria-label={t('fournisseurs.champEmail')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!name.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('fournisseurs.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {fournisseurs.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('fournisseurs.vide.titre')} action={{ label: t('fournisseurs.vide.action'), onClick: () => setOuvert(true) }}>{t('fournisseurs.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* LA RÈGLE DE DIX JOURS — l'objet dominant (`15d`).

              Deux points par fournisseur sur la MÊME règle : le promis en
              cercle vide, le constaté en disque plein. L'écart se lit dans la
              longueur de la barre, sans soustraction. */}
          <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6">
            <p className="eyebrow">Fiabilité des fournisseurs</p>

            {halteres.length === 0 ? (
              <>
                <p className="mt-2 text-[19px] font-semibold leading-tight text-text-primary sm:text-[23px]">
                  Aucun délai mesuré pour l'instant
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                  Une haltère demande deux choses : le délai annoncé par le fournisseur, et au moins
                  une livraison reçue. Posez « livrée » à la réception d'une commande — le délai
                  constaté se déduit de l'écart entre les deux dates, il n'est jamais saisi.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 max-w-2xl text-[19px] font-semibold leading-tight text-text-primary sm:text-[23px]">
                  {ambreHaltere
                    ? `${ambreHaltere.f.name} livre en ${enJours(ambreHaltere.reel)} pour ${enJours(ambreHaltere.promis)} promis.`
                    : 'Tous les fournisseurs mesurés tiennent le délai qu\'ils annoncent.'}
                </p>

                {/* LA GRADUATION — même grille que les haltères, cellules
                    vides comprises (§0.6). */}
                <div className={`mt-5 grid gap-x-4 ${HALTERE_COLONNES}`}>
                  <span aria-hidden />
                  <div className="relative h-4">
                    {CRANS_JOURS.map((jour) => (
                      <span
                        key={jour}
                        className="tnum absolute top-0 -translate-x-1/2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted"
                        style={{ left: `${surLaRegle(jour)}%` }}
                      >
                        {jour}
                      </span>
                    ))}
                  </div>
                  <span className="text-right font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                    jours
                  </span>
                </div>

                <div className="mt-1 flex flex-col gap-2.5">
                  {halteres.map((h) => {
                    const signal = h === ambreHaltere;
                    const gauche = Math.min(h.xPromis, h.xReel);
                    const largeur = Math.abs(h.xReel - h.xPromis);
                    return (
                      <div key={h.f.id} className={`grid items-center gap-x-4 ${HALTERE_COLONNES}`}>
                        <span className="min-w-0">
                          <span className="block truncate text-[14.5px] font-semibold text-text-primary">
                            {h.f.name}
                          </span>
                          <span className="tnum block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                            promis {enJours(h.promis)} · {h.livraisons.length} livraison
                            {h.livraisons.length > 1 ? 's' : ''}
                          </span>
                        </span>

                        <span className="relative block h-7 w-full">
                          <span
                            aria-hidden
                            className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border"
                          />
                          {CRANS_JOURS.map((jour) => (
                            <span
                              key={jour}
                              aria-hidden
                              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-border-strong"
                              style={{ left: `${surLaRegle(jour)}%` }}
                            />
                          ))}
                          {/* LA BARRE — c'est elle, l'haltère. */}
                          <span
                            className={`absolute top-1/2 h-[3px] -translate-y-1/2 ${signal ? `bg-signal ${halo}` : 'bg-[#4a4a48]'}`}
                            style={{ left: `${gauche}%`, width: `${largeur}%` }}
                            data-signal-groupe={signal ? 'moins-fiable' : undefined}
                          />
                          {/* LE PROMIS — cercle vide, jamais ambre : une
                              promesse n'est pas une mesure. */}
                          <span
                            aria-hidden
                            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-text-secondary bg-elevated"
                            style={{ left: `${h.xPromis}%` }}
                          />
                          {/* LE CONSTATÉ — disque plein, un cran PLUS PETIT
                              que le cercle promis : quand un fournisseur
                              tient exactement son délai, les deux points se
                              superposent, et le disque doit rester lisible
                              DANS son cercle au lieu de l'effacer. */}
                          <span
                            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${signal ? `bg-signal ${halo}` : 'bg-text-secondary'}`}
                            style={{ left: `${h.xReel}%` }}
                            data-signal-groupe={signal ? 'moins-fiable' : undefined}
                          />
                        </span>

                        <span
                          className={`tnum text-right font-mono text-[13px] font-semibold ${signal ? 'text-signal' : 'text-text-muted'}`}
                          data-signal-groupe={signal ? 'moins-fiable' : undefined}
                        >
                          {Math.abs(h.ecart) < 0.05
                            ? 'au délai'
                            : `${h.ecart > 0 ? '+' : '−'} ${enJours(Math.abs(h.ecart))}`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* LA LÉGENDE — en matière, jamais en ambre : un témoin de
                    légende qui porterait le signal compterait pour un second
                    objet ambre à l'écran. */}
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-row pt-3 text-[11.5px] text-text-muted">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full border-2 border-text-secondary bg-elevated"
                    />
                    délai promis
                  </span>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-text-secondary" />
                    délai constaté, moyenne des dernières livraisons
                  </span>
                </div>
                {halteres.some((h) => h.deborde) && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                    {halteres.filter((h) => h.deborde).length} fournisseur
                    {halteres.filter((h) => h.deborde).length > 1 ? 's sortent' : ' sort'} de la règle
                    de dix jours : le disque s'arrête au bord, l'écart chiffré à droite reste, lui, la
                    vraie valeur.
                  </p>
                )}
              </>
            )}
          </motion.section>

          {/* AUTOUR — les commandes en cours, et l'historique de ponctualité. */}
          <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">Commandes en cours</p>
              {attendues.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Aucune commande en attente de réception.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-px bg-border">
                  {attendues.map((f) => {
                    const jours = Math.max(
                      0,
                      Math.round((maintenant - Date.parse(f.lastOrderAt as string)) / 86_400_000),
                    );
                    const promis = typeof f.leadTimeDays === 'number' ? f.leadTimeDays : null;
                    const enRetard = promis !== null && jours > promis;
                    return (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-surface px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-sm text-text-primary">{f.name}</span>
                        <span className="tnum font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          commandée il y a {jours} j
                          {promis !== null && ` · promis ${enJours(promis)}`}
                        </span>
                        {enRetard && (
                          <span className="w-full font-mono text-[10px] uppercase tracking-wider text-text-primary">
                            au-delà du délai annoncé
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">Historique de ponctualité</p>
              {halteres.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  L'historique se remplit tout seul à mesure que les réceptions sont posées.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {halteres.map((h) => (
                    <li key={h.f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                        {h.f.name}
                      </span>
                      {/* Une marque par livraison mesurée : pleine si elle a
                          tenu le délai promis, creuse sinon. */}
                      <span aria-hidden className="flex items-center gap-1">
                        {h.livraisons.map((jour, i) => (
                          <span
                            key={i}
                            className={`h-3 w-1.5 ${jour <= h.promis ? 'bg-[#4a4a48]' : 'border border-border-strong'}`}
                          />
                        ))}
                      </span>
                      <span className="tnum w-28 flex-shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {h.dansLesTemps}/{h.livraisons.length} dans les temps
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </motion.div>

          {/* LES SILENCIEUX — descendus au rang de matière depuis que les
              haltères tiennent le dominant. Ils ne reprennent l'ambre que si
              aucune haltère ne le porte : un écran n'a qu'une région ambre, et
              il vaut mieux qu'elle désigne une décision que rien du tout. */}
          <motion.section
            variants={staggerItem}
            className="panel p-4 sm:p-5"
            data-signal-groupe={ambreSilence ? 'silencieux' : undefined}
          >
            {muets.length > 0 ? (
              <>
                {ambreSilence ? (
                  <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('fournisseurs.stat.silencieux')}</p>
                ) : (
                  <p className="eyebrow mb-3">{t('fournisseurs.stat.silencieux')}</p>
                )}
                <p className="text-[17px] font-semibold leading-tight text-text-primary sm:text-[21px]">
                  {muets.length === 1 ? t('fournisseurs.silencieuxUn') : t('fournisseurs.silencieuxN', { n: muets.length })}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('fournisseurs.silencieuxAide')}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {muets.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 border border-border-strong px-3 py-2">
                      <span className="text-sm text-text-primary">{f.name}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                        {f.lastOrderAt ? relativeTime(f.lastOrderAt) : t('fournisseurs.jamaisCommande')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">{t('fournisseurs.stat.silencieux')}</p>
                <p className="text-[17px] font-semibold leading-tight text-text-primary sm:text-[21px]">{t('fournisseurs.tousServis')}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('fournisseurs.tousServisAide')}</p>
              </>
            )}
          </motion.section>

          {/* LE REGISTRE — on vient y chercher une entrée, pas surveiller un
              état : une recherche, puis des lignes. */}
          <motion.section variants={staggerItem} className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <p className="eyebrow">{t('fournisseurs.leRegistre')}</p>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t('fournisseurs.rechercher')}
                aria-label={t('fournisseurs.rechercher')}
                className="input-focus min-h-11 w-full max-w-xs border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-0 md:py-2"
              />
            </div>
            {trouves.length === 0 ? (
              <p className="px-4 py-7 text-center text-sm text-text-secondary">{t('fournisseurs.aucunTrouve')}</p>
            ) : (
              <ul className="flex flex-col gap-px bg-border">
                {trouves.map((f) => (
                  <li key={f.id} className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-surface px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="text-sm text-text-primary">{f.name}</span>
                      {f.supplies && <span className="text-sm text-text-muted"> · {f.supplies}</span>}
                    </span>
                    <span className={`w-40 flex-shrink-0 font-mono text-[10px] uppercase tracking-wider ${muet(f, maintenant) ? 'text-warning' : 'text-text-muted'}`}>
                      {f.lastOrderAt ? t('fournisseurs.derniereCommande', { quand: relativeTime(f.lastOrderAt) }) : t('fournisseurs.jamaisCommande')}
                    </span>
                    <span className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      {f.phone && <a href={`tel:${f.phone}`} className="-my-2 flex items-center gap-1 py-2 hover:text-text-primary"><Phone size={11} /> {f.phone}</a>}
                      {f.email && <a href={`mailto:${f.email}`} className="-my-2 flex items-center gap-1 py-2 hover:text-text-primary"><Mail size={11} /> {f.email}</a>}
                    </span>
                    <span className="flex flex-shrink-0 gap-2">
                      {enCoursDe(f) ? (
                        /* UNE SEULE ACTION À LA FOIS : tant qu'une commande
                           court, ce qu'on attend d'elle c'est sa réception —
                           c'est le geste qui fabrique la mesure de délai. */
                        <button type="button" onClick={() => void livrer(f)} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-2.5 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                          <PackageCheck size={12} /> Livrée aujourd'hui
                        </button>
                      ) : (
                        <button type="button" onClick={() => void commander(f)} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-2.5 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                          <ShoppingCart size={12} /> {t('fournisseurs.commandeAujourdhui')}
                        </button>
                      )}
                      <button type="button" onClick={() => void remove('suppliers', f.id)} aria-label={t('fournisseurs.supprimer')} title={t('fournisseurs.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        </>
      )}
    </motion.section>
  );
}

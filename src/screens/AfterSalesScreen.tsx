import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Package, Plus, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue, type CleTraduction } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

type Etat = 'ouvert' | 'enCours' | 'resolu';
interface TicketData {
  client: string;
  subject: string;
  note: string;
  status: Etat;
  openedAt: string;
  takenBy: string;
  resolvedAt: string | null;
  /*
    LE MOTIF — un champ AJOUTÉ au modèle, et pourquoi.

    `MODULES.md` demande « les motifs des douze derniers mois en barres ». Le
    ticket ne portait qu'un sujet en texte libre : « store qui coince »,
    « store terrasse bloqué » et « le store ne descend plus » sont le même
    motif et trois chaînes différentes. Regrouper des barres là-dessus aurait
    produit autant de barres que de tickets, c'est-à-dire aucune information.

    Le motif est donc un champ à part, court, proposé mais libre. Il reste
    facultatif : un ticket sans motif existe, et il est compté comme tel
    plutôt que rangé d'office dans une catégorie qu'on lui aurait inventée.
  */
  reason?: string;
  /*
    L'ATTENTE D'UNE PIÈCE — fusion « SAV avec suivi de pièces détachées »
    (chantier des cinquante). Tant qu'elle court, le sablier SE FIGE : le délai
    qui ne dépend plus de vous se voit tel quel, avec la pièce, le fournisseur
    et la date promise. À la réception, les heures d'attente s'ajoutent à
    `pausesH` et ne sont jamais décomptées de l'engagement.
  */
  attentePiece?: { piece: string; fournisseur: string; promiseLe: string; depuisLe: string } | null;
  pausesH?: number;
}
type Ticket = TicketData & { id: string };
const jours = (depuis: string, jusqua: string | null) => Math.max(0, Math.round((Date.parse(jusqua ?? new Date().toISOString()) - Date.parse(depuis)) / 86_400_000));

/* ─── LES SABLIERS — l'objet dominant du SAV (`24d`) ──────────────────────── */

/*
  UN DÉLAI EN HEURES EST UN NOMBRE QU'ON LIT ; UN SABLIER PRESQUE VIDE EST UNE
  CHOSE QU'ON VOIT SANS LIRE.

  Un sablier par demande non réglée, le sable passé du haut vers le bas à la
  proportion du temps consommé sur l'engagement. Côte à côte, ils classent les
  demandes sans qu'aucun tri soit nécessaire — c'est la forme qui trie.

  LES DEUX TRIANGLES SONT D'OPACITÉ COMPLÉMENTAIRE : le haut porte `1 − p`, le
  bas porte `p`, et leur somme vaut toujours exactement 1. Ce n'est pas une
  coquetterie : c'est ce qui garantit qu'aucun sable n'apparaît ni ne
  disparaît entre les deux moitiés, quelle que soit la valeur de `p`.

  UN TICKET DÉPASSÉ GARDE SON SABLIER, entièrement écoulé, et NE DEVIENT PAS
  ROUGE. Le rouge de ce système est réservé aux ruptures de stock ; une
  demande en retard est un retard, pas une rupture.
*/

/*
  L'ENGAGEMENT, ET CE QUE LE PRODUIT N'EN SAIT PAS.

  `MODULES.md` pose un engagement de 48 h. Le modèle du produit ne porte
  aucun délai promis — ni par ticket, ni par client, ni en paramètre. La
  valeur est donc ici, une seule fois, nommée, et l'écran l'écrit en toutes
  lettres au lieu de la laisser deviner. Le jour où le produit portera un
  engagement par contrat, c'est cette constante qui disparaîtra.
*/
const ENGAGEMENT_H = 48;

/** En dessous, rien ne presse : l'écran n'a alors pas d'ambre du tout. */
const SABLIER_SEUIL_AMBRE = 0.5;

const SABLIER_L = 34;
const SABLIER_H = 52;
/*
  La géométrie, écrite une fois. Le col est au milieu exact de la hauteur ;
  les deux triangles partagent ce sommet, donc ils se touchent sans se
  recouvrir — un chevauchement d'un pixel ferait une bande plus dense au col
  et casserait la complémentarité des opacités.
*/
const SABLIER_X1 = 4;
const SABLIER_X2 = SABLIER_L - 4;
const SABLIER_Y1 = 2;
const SABLIER_Y2 = SABLIER_H - 2;
const SABLIER_COL_X = SABLIER_L / 2;
const SABLIER_COL_Y = SABLIER_H / 2;
const SABLIER_HAUT = `${SABLIER_X1},${SABLIER_Y1} ${SABLIER_X2},${SABLIER_Y1} ${SABLIER_COL_X},${SABLIER_COL_Y}`;
const SABLIER_BAS = `${SABLIER_X1},${SABLIER_Y2} ${SABLIER_X2},${SABLIER_Y2} ${SABLIER_COL_X},${SABLIER_COL_Y}`;
const SABLIER_CONTOUR =
  `M ${SABLIER_X1} ${SABLIER_Y1} L ${SABLIER_X2} ${SABLIER_Y1} L ${SABLIER_COL_X} ${SABLIER_COL_Y} ` +
  `L ${SABLIER_X2} ${SABLIER_Y2} L ${SABLIER_X1} ${SABLIER_Y2} L ${SABLIER_COL_X} ${SABLIER_COL_Y} Z`;

/**
 * Les heures d'engagement consommées : depuis l'ouverture, moins les attentes
 * de pièce passées ; une attente en cours ARRÊTE l'horloge à son début.
 */
const heuresDepuis = (tk: Pick<TicketData, 'openedAt' | 'attentePiece' | 'pausesH'>, maintenant: number) => {
  const fin = tk.attentePiece ? Date.parse(tk.attentePiece.depuisLe) : maintenant;
  return Math.max(0, (fin - Date.parse(tk.openedAt)) / 3_600_000 - (tk.pausesH ?? 0));
};

/** La part d'engagement consommée, bornée à 1 : le sable ne déborde pas. */
const partConsommee = (tk: Pick<TicketData, 'openedAt' | 'attentePiece' | 'pausesH'>, maintenant: number) =>
  Math.min(1, heuresDepuis(tk, maintenant) / ENGAGEMENT_H);

/** « 12 h restantes », « dépassé de 3 j » — jamais un nombre nu. */
function ditLeReste(tk: Pick<TicketData, 'openedAt' | 'attentePiece' | 'pausesH'>, maintenant: number): string {
  const reste = ENGAGEMENT_H - heuresDepuis(tk, maintenant);
  if (reste >= 1) return `${Math.floor(reste)} h restantes`;
  if (reste > 0) return 'moins d’une heure';
  const depassement = -reste;
  if (depassement < 24) return `dépassé de ${Math.max(1, Math.round(depassement))} h`;
  const j = Math.round(depassement / 24);
  return `dépassé de ${j} jour${j > 1 ? 's' : ''}`;
}

/** Le sablier lui-même. `part` va de 0 (plein) à 1 (écoulé) ; `fige` : en attente de pièce. */
function Sablier({ part, signal, fige = false }: { part: number; signal: boolean; fige?: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${SABLIER_L} ${SABLIER_H}`}
      width={SABLIER_L}
      height={SABLIER_H}
      aria-hidden
      className="flex-shrink-0"
      data-signal-groupe={signal ? 'sablier' : undefined}
    >
      {/* LE SABLE — deux triangles d'opacité complémentaire, somme = 1. */}
      <polygon
        points={SABLIER_HAUT}
        fill={signal ? 'var(--color-signal)' : 'var(--color-text-secondary)'}
        opacity={1 - part}
      />
      <polygon
        points={SABLIER_BAS}
        fill={signal ? 'var(--color-signal)' : 'var(--color-text-secondary)'}
        opacity={part}
      />
      {/* LE CONTOUR — il reste entier même quand le sable est passé : un
          sablier vide est un sablier, pas un vide. */}
      <path
        d={SABLIER_CONTOUR}
        fill="none"
        stroke={signal ? 'var(--color-signal)' : 'var(--color-border-strong)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* FIGÉ : une barre au col — le sable ne passe plus tant que la pièce n'est pas là. */}
      {fige && <line x1={SABLIER_COL_X - 7} y1={SABLIER_COL_Y} x2={SABLIER_COL_X + 7} y2={SABLIER_COL_Y} stroke="var(--color-text-body)" strokeWidth="2.5" strokeLinecap="round" />}
    </svg>
  );
}

/** Les motifs proposés à la saisie — proposés, jamais imposés. */
const MOTIFS_PROPOSES = [
  'Livraison en retard',
  'Article abîmé',
  'Erreur de quantité',
  'Pose à reprendre',
  'Demande d’échange',
  'Question de facture',
];

/*
  LES TRANCHES D'ÂGE ont été retirées ici.

  Elles découpaient les demandes en « plus d'une semaine / cette semaine /
  aujourd'hui ». La colonne de sabliers dit la même chose en CONTINU, et deux
  découpages du même axe sur un écran obligent à vérifier qu'ils sont
  d'accord. Voir l'en-tête du composant.
*/


/**
 * LE SAV — les demandes après vente, de l'ouverture à la résolution.
 *
 * Pour qui : un artisan, un installateur, une boutique dont un client rappelle
 * et personne ne sait qui avait promis quoi. Ce que ça règle : chaque
 * demande a un client, un état, et surtout un âge — ce qui traîne se voit.
 * Trois états seulement : ouverte, en cours, résolue. Un vrai ticketing a des
 * priorités, des files, des SLA ; ici on veut juste ne rien oublier.
 *
 * ## Ce qui domine : la plus vieille qui n'est pas réglée
 *
 * L'écran était un tableau à trois colonnes — ouverte, en cours, résolue —
 * et c'est précisément ce qui cachait l'âge. Sur le bac à sable, un store de
 * terrasse ouvert depuis trente-quatre jours que personne n'a pris et une
 * demande de devis d'il y a deux heures avaient la même carte, dans la même
 * colonne, l'âge écrit en mono 10 px. Le fichier disait pourtant déjà, en
 * tête : « chaque demande a un client, un état, et SURTOUT un âge ».
 *
 * L'état n'a d'ailleurs pas besoin d'une colonne : il tient en un mot sur la
 * ligne. L'âge, lui, ne se lit que si on range par lui.
 *
 * Les non réglées se rangent donc par âge, de la plus vieille à la plus
 * fraîche, et non par état. Les réglées quittent la surface : elles
 * n'attendent rien, et se résument en une phrase avec leur délai moyen.
 *
 * ## Ce qui domine vraiment : le SABLE, pas le rang
 *
 * Ranger par âge était déjà mieux qu'un tableau par état. Mais un rang ne dit
 * pas COMBIEN il reste : « 34 jours » se lit, il ne se voit pas. Le dominant
 * est donc une colonne de sabliers (voir plus haut), un par demande non
 * réglée, dont le sable est passé à la proportion de l'engagement consommé.
 * Les sabliers classent les demandes sans qu'aucun tri soit nécessaire.
 *
 * Les tranches d'âge disparaissent avec eux : elles découpaient en « plus
 * d'une semaine / cette semaine / aujourd'hui » ce que la forme du sablier dit
 * en continu, et deux découpages du même axe sur un écran obligent à vérifier
 * qu'ils sont d'accord.
 *
 * ## L'ambre
 *
 * Sur le sablier le plus avancé : son sable, son contour, et le temps restant
 * à droite de sa ligne. Trois nœuds. En dessous de la moitié de l'engagement
 * consommée, rien ne presse — l'écran n'a alors PAS d'ambre, et le dit
 * calmement. Une demande dépassée garde son sablier entièrement écoulé et ne
 * devient jamais rouge : le rouge est réservé aux ruptures de stock.
 */
export function AfterSalesScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { profileFor } = useProfiles();
  const { upsert, remove } = useSync();
  const brutes = useCollection<TicketData>('tickets');
  const [ouvert, setOuvert] = useState(false);
  const [client, setClient] = useState('');
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  /* L'attente d'une pièce : le ticket dont on saisit la pièce, et la saisie. */
  const [pieceDe, setPieceDe] = useState<string | null>(null);
  const [piece, setPiece] = useState({ piece: '', fournisseur: '', promiseLe: '' });
  const fournisseurs = useCollection<{ name: string }>('suppliers');
  const [reason, setReason] = useState('');

  /* Les non réglées, de la plus vieille à la plus fraîche : c'est l'ordre de
     tout l'écran, tête comprise. */
  const enSouffrance = useMemo(
    () => brutes.filter((tk) => tk.status !== 'resolu').sort((a, b) => a.openedAt.localeCompare(b.openedAt)),
    [brutes],
  );
  const reglees = useMemo(
    () => brutes.filter((tk) => tk.status === 'resolu').sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')),
    [brutes],
  );
  /* `tete` et `suite` ont disparu avec la carte de tête et les tranches : la
     colonne de sabliers porte la totalité des demandes non réglées, dans le
     même ordre, et désigne elle-même celle qui presse. */

  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const dusMois = reglees.filter((tk) => (tk.resolvedAt ?? '') >= debutMois);
  /* Le délai moyen, arrondi au jour : un dixième de jour ne veut rien dire sur
     une demande après vente. */
  const delaiMoyen = dusMois.length === 0 ? 0 : Math.round(dusMois.reduce((n, tk) => n + jours(tk.openedAt, tk.resolvedAt), 0) / dusMois.length);

  const ajouter = async () => {
    if (!subject.trim()) return;
    await upsert('tickets', uid('sav'), { client: client.trim(), subject: subject.trim(), reason: reason.trim(), note: note.trim(), status: 'ouvert', openedAt: new Date().toISOString(), takenBy: '', resolvedAt: null });
    setClient(''); setSubject(''); setReason(''); setNote(''); setOuvert(false);
  };
  const passer = (tk: Ticket, status: Etat) =>
    upsert('tickets', tk.id, {
      ...tk,
      status,
      takenBy: status === 'enCours' ? user?.email ?? tk.takenBy : tk.takenBy,
      resolvedAt: status === 'resolu' ? new Date().toISOString() : null,
    });
  const attendre = async (tk: Ticket) => {
    if (!piece.piece.trim() || !piece.fournisseur.trim() || !piece.promiseLe) return;
    await upsert('tickets', tk.id, { ...tk, attentePiece: { piece: piece.piece.trim(), fournisseur: piece.fournisseur.trim(), promiseLe: piece.promiseLe, depuisLe: new Date().toISOString() } });
    setPieceDe(null);
    setPiece({ piece: '', fournisseur: '', promiseLe: '' });
  };
  /* La pièce arrive : l'attente passe dans `pausesH`, et le sable recommence à couler d'où il s'était arrêté. */
  const recue = async (tk: Ticket) => {
    if (!tk.attentePiece) return;
    const attenteH = Math.max(0, (Date.now() - Date.parse(tk.attentePiece.depuisLe)) / 3_600_000);
    await upsert('tickets', tk.id, { ...tk, attentePiece: null, pausesH: (tk.pausesH ?? 0) + attenteH });
  };
  const etat = (s: Etat) => t(`sav.etat.${s}` as CleTraduction);
  const ditLeDelai = (n: number) => (n === 0 ? t('sav.resolueLeJourMeme') : n === 1 ? t('sav.resolueEnUn') : t('sav.resolueEn', { n }));
  const nomDe = (email: string) => (email ? profileFor(email).name : '');

  /*
    L'HORLOGE, LUE UNE SEULE FOIS PAR RENDU.

    Tous les sabliers, le temps restant et l'ambre sortent de cette même
    valeur. Relire `Date.now()` à chaque sablier donnerait des parts calculées
    à des instants différents — invisible à l'œil, mais c'est exactement le
    genre d'écart qui rend deux chiffres de la même page incohérents.
  */
  const maintenant = Date.now();

  /*
    LE SABLIER QUI PORTE L'AMBRE — le plus avancé, et seulement s'il a
    consommé au moins la moitié de son engagement. En dessous, rien ne presse
    et l'écran n'a pas d'ambre du tout.
  */
  const sablierAmbre = useMemo(() => {
    let pire: { tk: Ticket; part: number } | null = null;
    /* Un sablier figé attend un fournisseur, pas vous : il ne porte jamais l'ambre. */
    for (const tk of enSouffrance.filter((x) => !x.attentePiece)) {
      const part = partConsommee(tk, maintenant);
      if (!pire || part > pire.part) pire = { tk, part };
    }
    return pire && pire.part >= SABLIER_SEUIL_AMBRE ? pire : null;
  }, [enSouffrance, maintenant]);
  const halo = useHaloSignal(sablierAmbre !== null);

  /*
    LES MOTIFS DES DOUZE DERNIERS MOIS — sur TOUTES les demandes de la
    période, réglées comprises : un motif qui ne revient plus parce qu'on l'a
    traité reste un motif de l'année.
  */
  const motifs = useMemo(() => {
    const depuis = new Date(maintenant - 365 * 86_400_000).toISOString();
    const compte = new Map<string, number>();
    let total = 0;
    for (const tk of brutes) {
      if (tk.openedAt < depuis) continue;
      const motif = (tk.reason ?? '').trim();
      if (!motif) continue;
      compte.set(motif, (compte.get(motif) ?? 0) + 1);
      total += 1;
    }
    const lignes = [...compte.entries()]
      .map(([motif, n]) => ({ motif, n }))
      .sort((a, b) => b.n - a.n);
    return {
      lignes,
      plus: lignes[0]?.n ?? 1,
      part: total > 0 && lignes[0] ? Math.round((lignes[0].n / total) * 100) : 0,
    };
  }, [brutes, maintenant]);

  /*
    CE QUE L'ENGAGEMENT VAUT — mesuré sur les demandes RÉGLÉES seulement.
    Une demande encore ouverte n'a pas de délai, elle a un âge ; la compter
    dans une moyenne de délai ferait baisser cette moyenne à mesure que la
    demande traîne, ce qui est exactement l'inverse de la vérité.
  */
  const bilanEngagement = useMemo(() => {
    const tenues = reglees.filter((tk) => tk.resolvedAt);
    const heures = tenues.map(
      (tk) => (Date.parse(tk.resolvedAt as string) - Date.parse(tk.openedAt)) / 3_600_000 - (tk.pausesH ?? 0),
    );
    const depassements =
      heures.filter((h) => h > ENGAGEMENT_H).length +
      enSouffrance.filter((tk) => heuresDepuis(tk, maintenant) > ENGAGEMENT_H).length;
    return {
      compte: tenues.length,
      moyenneH: tenues.length === 0 ? 0 : Math.round(heures.reduce((n, h) => n + h, 0) / tenues.length),
      depassements,
    };
  }, [reglees, enSouffrance, maintenant]);


  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('sav.titre') })}
          title={t('sav.titre')}
          description={t('sav.description')}
          stats={[
            { label: t('sav.stat.ouvertes'), value: brutes.filter((tk) => tk.status === 'ouvert').length, emphasis: brutes.some((tk) => tk.status === 'ouvert') },
            { label: t('sav.stat.enCours'), value: brutes.filter((tk) => tk.status === 'enCours').length },
            { label: t('sav.stat.resoluesMois'), value: dusMois.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('sav.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={t('sav.champClient')} aria-label={t('sav.champClient')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('sav.champSujet')} aria-label={t('sav.champSujet')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          {/* LE MOTIF — proposé, jamais imposé : la liste guide vers un
              vocabulaire commun, le champ reste libre pour ce qu'elle
              n'a pas prévu. */}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            list="sav-motifs"
            placeholder="Motif — « Livraison en retard » (facultatif)"
            aria-label="Motif"
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          />
          <datalist id="sav-motifs">
            {MOTIFS_PROPOSES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('sav.champNote')} aria-label={t('sav.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!subject.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('sav.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {brutes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('sav.vide.titre')} action={{ label: t('sav.vide.action'), onClick: () => setOuvert(true) }}>{t('sav.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* ── LA COLONNE DE SABLIERS — l'objet dominant (`24d`) ────────── */}
          {enSouffrance.length > 0 ? (
            <motion.section variants={staggerItem} className="panel-raised panel-raised-wide p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="eyebrow">Ce qui n’est pas réglé</p>
                <p className="tnum font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                  engagement {ENGAGEMENT_H} h
                </p>
              </div>

              <p className="mt-2 max-w-2xl text-[19px] font-semibold leading-tight text-text-primary sm:text-[23px]">
                {sablierAmbre
                  ? `${sablierAmbre.tk.subject} — ${ditLeReste(sablierAmbre.tk, maintenant)}.`
                  : 'Aucune demande n’a consommé la moitié de son engagement.'}
              </p>

              <ul className="mt-5 flex flex-col gap-px bg-border">
                {enSouffrance.map((tk) => {
                  const part = partConsommee(tk, maintenant);
                  const signal = sablierAmbre?.tk.id === tk.id;
                  const pris = tk.takenBy !== '';
                  const attente = tk.attentePiece ?? null;
                  const promiseJ = attente ? Math.ceil((Date.parse(`${attente.promiseLe}T18:00:00`) - maintenant) / 86_400_000) : 0;
                  return (
                    <React.Fragment key={tk.id}>
                    <li
                      className="group flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-3 py-3 sm:flex-nowrap"
                    >
                      <Sablier part={part} signal={signal} fige={Boolean(attente)} />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] text-text-primary">
                          {tk.subject}
                        </span>
                        <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {[tk.client || '—', tk.reason, etat(tk.status), pris ? nomDe(tk.takenBy) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {attente && (
                          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-text-body">
                            en attente de pièce : {attente.piece} · {attente.fournisseur} · promise le{' '}
                            {new Date(`${attente.promiseLe}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </span>

                      {/* LE TEMPS RESTANT, à droite de sa ligne. */}
                      <span
                        className={`tnum w-36 flex-shrink-0 text-right font-mono text-[12px] font-semibold ${
                          signal ? `text-signal ${halo}` : part >= 1 ? 'text-text-primary' : 'text-text-muted'
                        }`}
                        data-signal-groupe={signal ? 'sablier' : undefined}
                      >
                        {attente
                          ? promiseJ >= 0
                            ? `pièce dans ${promiseJ} j`
                            : `pièce en retard de ${-promiseJ} j`
                          : ditLeReste(tk, maintenant)}
                      </span>

                      <span className="flex flex-shrink-0 gap-2">
                        {attente ? (
                          <button
                            type="button"
                            onClick={() => void recue(tk)}
                            className="flex min-h-11 items-center gap-1.5 border border-border-strong px-2.5 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5"
                          >
                            <Check size={12} /> Pièce reçue
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPieceDe(pieceDe === tk.id ? null : tk.id)}
                            aria-label="Attend une pièce"
                            title="Attend une pièce : figer le sablier"
                            className="flex min-h-11 items-center border border-border px-2.5 text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5"
                          >
                            <Package size={12} />
                          </button>
                        )}
                        {tk.status === 'ouvert' && (
                          <button
                            type="button"
                            onClick={() => void passer(tk, 'enCours')}
                            className="flex min-h-11 items-center gap-1.5 border border-border-strong px-2.5 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5"
                          >
                            <UserCheck size={12} /> {t('sav.prendre')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void passer(tk, 'resolu')}
                          className="flex min-h-11 items-center gap-1.5 border border-border px-2.5 text-[11px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5"
                        >
                          <Check size={12} /> {t('sav.resoudre')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove('tickets', tk.id)}
                          aria-label={t('sav.supprimer')}
                          title={t('sav.supprimer')}
                          className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </li>
                    {pieceDe === tk.id && !attente && (
                      <li className="bg-surface px-3 pb-3">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void attendre(tk);
                          }}
                          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
                        >
                          <input value={piece.piece} onChange={(e) => setPiece({ ...piece, piece: e.target.value })} placeholder="La pièce attendue" aria-label="La pièce attendue" autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-9" />
                          <input value={piece.fournisseur} onChange={(e) => setPiece({ ...piece, fournisseur: e.target.value })} list={`fournisseurs-${tk.id}`} placeholder="Le fournisseur" aria-label="Le fournisseur" className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-9" />
                          <datalist id={`fournisseurs-${tk.id}`}>
                            {fournisseurs.map((f) => <option key={f.id} value={f.name} />)}
                          </datalist>
                          <input type="date" value={piece.promiseLe} onChange={(e) => setPiece({ ...piece, promiseLe: e.target.value })} aria-label="Date promise" className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-9" />
                          <button type="submit" disabled={!piece.piece.trim() || !piece.fournisseur.trim() || !piece.promiseLe} className="min-h-11 bg-accent px-3 text-[12px] font-semibold text-bg disabled:opacity-40 md:min-h-9">
                            Figer le sablier
                          </button>
                        </form>
                      </li>
                    )}
                    </React.Fragment>
                  );
                })}
              </ul>

              <p className="mt-4 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                Le sable est passé à la proportion de l’engagement consommé. Une demande dépassée
                garde son sablier, entièrement écoulé — elle ne devient pas rouge : le rouge de cet
                outil est réservé aux ruptures de stock.
              </p>
            </motion.section>
          ) : (
            <motion.p variants={staggerItem} className="panel px-4 py-7 text-center text-sm text-text-secondary">
              {t('sav.rienDouvert')}
            </motion.p>
          )}

          {/* AUTOUR — à gauche les motifs, à droite ce que l'engagement vaut. */}
          <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">Les motifs des douze derniers mois</p>
              {motifs.lignes.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Aucun motif renseigné sur les douze derniers mois.
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-2.5">
                  {motifs.lignes.map((ligne) => (
                    <div
                      key={ligne.motif}
                      className="grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_54px]"
                    >
                      <span className="min-w-0 truncate text-[13.5px] text-text-primary">
                        {ligne.motif}
                      </span>
                      <span className="relative block h-5 w-full bg-sunken">
                        <span
                          className="absolute inset-y-0 left-0 block bg-[#4a4a48]"
                          style={{ width: `${Math.max(2, (ligne.n / motifs.plus) * 100)}%` }}
                        />
                      </span>
                      <span className="tnum text-right font-mono text-[12px] text-text-secondary">
                        {ligne.n}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/*
                CE QUE LA MAQUETTE AFFIRME, ET CE QUE LA DONNÉE PERMET DE DIRE.

                `MODULES.md` écrit ici « un motif sur trois disparaîtrait avec
                un rappel automatique ». C'est une conclusion sur les données,
                pas une forme : rien dans le produit ne dit quels motifs un
                rappel éviterait, et l'afficher serait inventer un chiffre.
                L'écran dit donc ce qu'il sait — quel motif domine et de
                combien — et laisse la conclusion à qui connaît son métier.
              */}
              {motifs.lignes.length > 0 && (
                <p className="mt-4 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                  {motifs.lignes[0].motif} pèse {motifs.part}&nbsp;% des demandes de l’année. Ce que
                  l’outil ne sait pas, et n’affichera donc pas : lesquelles un rappel automatique
                  aurait évitées.
                </p>
              )}
            </section>

            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">L’engagement</p>
              <p className="tnum mt-2 text-[27px] font-semibold leading-none text-text-primary">
                {ENGAGEMENT_H} h
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                délai promis
              </p>
              <dl className="mt-4 flex flex-col gap-2 border-t border-border-row pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    délai moyen tenu
                  </dt>
                  <dd className="tnum font-mono text-[12px] text-text-primary">
                    {bilanEngagement.compte === 0
                      ? '—'
                      : `${bilanEngagement.moyenneH} h`}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    dépassements
                  </dt>
                  <dd className="tnum font-mono text-[12px] text-text-secondary">
                    {bilanEngagement.depassements}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
                Le délai moyen est calculé sur les demandes RÉGLÉES : une demande encore ouverte
                n’a pas de délai, elle a un âge.
              </p>
            </section>
          </motion.div>

          {/* LES RÉGLÉES — une phrase, puis un registre en sourdine. Elles
              n'attendent rien : elles ne prennent plus le tiers de l'écran. */}
          {reglees.length > 0 && (
            <motion.section variants={staggerItem} className="panel">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
                <p className="eyebrow">{t('sav.reglees')}</p>
                <p className="text-[11px] text-text-secondary">
                  {dusMois.length === 0
                    ? t('sav.bilanMoisAucune')
                    : dusMois.length === 1
                      ? t('sav.bilanMoisUne', { moyenne: delaiMoyen })
                      : t('sav.bilanMois', { n: dusMois.length, moyenne: delaiMoyen })}
                </p>
              </div>
              <ul className="flex flex-col gap-px bg-border">
                {reglees.slice(0, 8).map((tk) => (
                  <li key={tk.id} className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                      {tk.subject}
                      {tk.client && <span className="text-text-muted"> · {tk.client}</span>}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{ditLeDelai(jours(tk.openedAt, tk.resolvedAt))}</span>
                    <button type="button" onClick={() => void passer(tk, 'ouvert')} className="flex min-h-11 items-center gap-1 px-1 text-[11px] text-text-muted opacity-0 hover:text-text-primary focus:opacity-100 group-hover:opacity-100 md:min-h-0"><RotateCcw size={11} /> {t('sav.rouvrir')}</button>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}
        </>
      )}
    </motion.section>
  );
}

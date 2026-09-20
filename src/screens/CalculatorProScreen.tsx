import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete, FileText, Trash2, X } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide } from '../components/EtatEcran';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useClients } from '../state/useClients';
import { VAT_RATES } from '../state/useInvoices';
import { formatCents } from '../lib/money';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/** Une ligne imprimée sur le ruban. Voir `calcTapes` dans src/shared/api.ts. */
interface LigneDeRuban {
  /** Ce qui est imprimé à gauche — « 3 × 42,00 » ou « 42,00 ». */
  libelle: string;
  /** Le montant HORS TAXES, en centimes. Négatif pour une correction. */
  montantCents: number;
  /** Le taux appliqué à cette ligne, en points (20, 10, 5.5…). */
  taux: number;
  at: string;
}
interface RubanData {
  lines: LigneDeRuban[];
  createdAt: string;
  /** Rempli quand le ruban est devenu un devis — il ne se rouvre plus. */
  devisFaitLe: string;
}
interface IdentiteFacturation {
  vatExempt: boolean;
}

/*
  ════════════════════════════════════════════════════════════════════
  LE RUBAN DE CAISSE — et la règle qui décide de tout : il garde TOUT
  ════════════════════════════════════════════════════════════════════

  Une calculatrice à écran unique oublie ce qu'on vient de taper. C'est sans
  conséquence pour additionner deux nombres, et c'est catastrophique pour
  chiffrer un chantier : on arrive à 4 820 € et on ne sait plus si la pose y
  est. Le ruban garde l'enchaînement, donc on peut le relire avant de le
  transformer en devis — et c'est le seul but de ce module.

  LE RUBAN GARDE TOUTES LES LIGNES, Y COMPRIS CELLE QU'ON REGRETTE. Il n'y a
  donc AUCUN bouton pour effacer une ligne : une erreur se corrige comme sur
  une vraie caisse, par une ligne d'annulation négative qui reste imprimée.
  C'est plus lent d'un geste, et c'est ce qui fait qu'on peut faire confiance
  au total — un ruban qu'on peut retoucher ne prouve plus rien.

  `TOUCHES` compte seize touches, et le pavé est à seize touches parce qu'un
  pavé de caisse se tape SANS REGARDER : la position d'une touche doit être
  la même à chaque ouverture, donc leur nombre ne varie pas avec le contexte.
*/
const RUBAN_LIGNE_H = 22;
const DENT_L = 12;
const DENT_H = 7;

type Touche = { cle: string; libelle: string; role: 'chiffre' | 'virgule' | 'effacer' | 'retour' | 'fois' | 'poser' | 'clore' };
const TOUCHES: Touche[] = [
  { cle: '7', libelle: '7', role: 'chiffre' },
  { cle: '8', libelle: '8', role: 'chiffre' },
  { cle: '9', libelle: '9', role: 'chiffre' },
  { cle: 'C', libelle: 'C', role: 'effacer' },
  { cle: '4', libelle: '4', role: 'chiffre' },
  { cle: '5', libelle: '5', role: 'chiffre' },
  { cle: '6', libelle: '6', role: 'chiffre' },
  { cle: 'retour', libelle: '←', role: 'retour' },
  { cle: '1', libelle: '1', role: 'chiffre' },
  { cle: '2', libelle: '2', role: 'chiffre' },
  { cle: '3', libelle: '3', role: 'chiffre' },
  { cle: 'fois', libelle: '×', role: 'fois' },
  { cle: '0', libelle: '0', role: 'chiffre' },
  { cle: '00', libelle: '00', role: 'chiffre' },
  { cle: 'virgule', libelle: ',', role: 'virgule' },
  { cle: 'poser', libelle: '+', role: 'poser' },
];

/** « 42,50 » → 4250 centimes. Une saisie vide vaut zéro, jamais NaN. */
function enCentimes(saisie: string): number {
  const nu = saisie.replace(',', '.').trim();
  if (!nu) return 0;
  const n = Number(nu);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Le pied de ruban : HT, TVA par taux, et TTC. */
function totaux(lignes: LigneDeRuban[]) {
  const htCents = lignes.reduce((n, l) => n + l.montantCents, 0);
  const parTaux = new Map<number, number>();
  for (const l of lignes) {
    const tva = Math.round((l.montantCents * l.taux) / 100);
    parTaux.set(l.taux, (parTaux.get(l.taux) ?? 0) + tva);
  }
  const tvaCents = [...parTaux.values()].reduce((n, x) => n + x, 0);
  return { htCents, tvaCents, ttcCents: htCents + tvaCents, parTaux: [...parTaux.entries()].sort((a, b) => b[0] - a[0]) };
}

/**
 * LA CALCULATRICE PRO — le ruban qu'on relit avant de chiffrer.
 *
 * Pour qui : qui chiffre debout, sur place, en enchaînant des postes — trois
 * jardinières, la pose, le déplacement, la remise. Ce que ça règle : la
 * calculatrice du téléphone donne un nombre et perd le chemin ; ici le chemin
 * reste, ligne à ligne, et se transforme en devis.
 *
 * Ce module n'existait pas : `MODULES.md` le décrit en `21b`, le produit
 * n'avait que les Calculateurs (`25c`), qui répondent à une tout autre
 * question — « quel prix pour telle marge », sur des profils écrits d'avance.
 * On ne tape rien dans les Calculateurs ; on ne fait que ça ici.
 *
 * ## Ce qui domine : le ruban
 *
 * Voir l'en-tête des constantes : pourquoi il garde tout, et pourquoi il n'y
 * a pas de bouton pour effacer une ligne.
 *
 * ## L'ambre : le total en pied de ruban
 *
 * Plaque pleine largeur, libellé et montant en encre noire — trois nœuds, une
 * région. Pas d'ambre sur un ruban vide : il n'y a alors aucun total, et un
 * « 0,00 € » ambre accuserait quelqu'un de n'avoir rien tapé.
 *
 * ## Deux arbitrages, dits à l'écran
 *
 * 1. LES TOUCHES DE TAUX lisent `VAT_RATES` et l'exonération de l'identité de
 *    facturation — jamais des constantes tapées ici. Une organisation exonérée
 *    n'a donc qu'une touche, à 0 %, et c'est juste.
 * 2. UN RUBAN DEVENU DEVIS garde chaque ligne, mais comme LIGNE DE TEXTE : le
 *    modèle `Quote` du produit porte un titre, une description et un prix, et
 *    n'a pas de postes structurés. Rien n'est perdu — chaque ligne se relit
 *    dans le devis — mais rien n'est recalculable non plus, et l'écran le dit
 *    plutôt que de laisser croire à des postes qui n'existent pas.
 */
export function CalculatorProScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const { clients, createQuote } = useClients();
  const rubans = useCollection<RubanData>('calcTapes');
  const facturation = useCollection<IdentiteFacturation>('billing');
  const [saisie, setSaisie] = useState('');
  const [facteur, setFacteur] = useState<number | null>(null);
  const [tauxCourant, setTauxCourant] = useState<number | null>(null);
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [pourQui, setPourQui] = useState('');

  const exonere = facturation.some((f) => f.vatExempt);
  const tauxOfferts = exonere ? [0] : VAT_RATES;
  const taux = tauxCourant ?? tauxOfferts[0] ?? 0;

  const tries = useMemo(() => [...rubans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [rubans]);
  const enCours = tries.find((r) => !r.devisFaitLe) ?? null;
  const ouvert = tries.find((r) => r.id === ouvertId) ?? enCours;
  const lignes = ouvert?.lines ?? [];
  const pied = useMemo(() => totaux(lignes), [lignes]);
  const gardes = tries.filter((r) => r.id !== ouvert?.id);

  const ecrire = async (suite: LigneDeRuban[]) => {
    if (ouvert) {
      await upsert('calcTapes', ouvert.id, { ...ouvert, lines: suite });
      return ouvert.id;
    }
    const id = uid('tape');
    await upsert('calcTapes', id, { lines: suite, createdAt: new Date().toISOString(), devisFaitLe: '' } satisfies RubanData);
    setOuvertId(id);
    return id;
  };

  const poser = async (signe: 1 | -1) => {
    const montant = enCentimes(saisie) * (facteur ?? 1) * signe;
    if (montant === 0) return;
    const libelle = facteur ? `${facteur} × ${saisie || '0'}` : saisie || '0';
    await ecrire([
      ...lignes,
      { libelle: signe < 0 ? t('calculatrice.annulation', { quoi: libelle }) : libelle, montantCents: montant, taux, at: new Date().toISOString() },
    ]);
    setSaisie('');
    setFacteur(null);
  };

  const frapper = (touche: Touche) => {
    switch (touche.role) {
      case 'chiffre':
        setSaisie((s) => (s + touche.cle).replace(/^0+(?=\d)/, ''));
        break;
      case 'virgule':
        setSaisie((s) => (s.includes(',') ? s : `${s || '0'},`));
        break;
      case 'effacer':
        /* « C » n'efface QUE la saisie en cours. Le ruban, jamais. */
        setSaisie('');
        setFacteur(null);
        break;
      case 'retour':
        setSaisie((s) => s.slice(0, -1));
        break;
      case 'fois':
        setFacteur(enCentimes(saisie) / 100 || null);
        setSaisie('');
        break;
      case 'poser':
        void poser(1);
        break;
      default:
        break;
    }
  };

  const enFaireUnDevis = async () => {
    if (!ouvert || lignes.length === 0 || !pourQui) return;
    const client = clients.find((c) => String(c.id) === pourQui);
    if (!client) return;
    await createQuote({
      clientId: client.id,
      title: t('calculatrice.titreDuDevis', { quand: new Date().toLocaleDateString('fr-FR') }),
      /* CHAQUE LIGNE SURVIT — comme ligne de texte, faute de postes
         structurés dans le modèle `Quote`. Voir l'en-tête du fichier. */
      detail: lignes.map((l) => `${l.libelle} — ${formatCents(l.montantCents)} (TVA ${l.taux} %)`).join('\n'),
      trackerTier: '',
      priceEuro: Math.round(pied.ttcCents) / 100,
    });
    await upsert('calcTapes', ouvert.id, { ...ouvert, devisFaitLe: new Date().toISOString() });
    setOuvertId(null);
    setPourQui('');
  };

  const vide = tries.length === 0;

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('outils.surtitre', { module: t('calculatrice.titre') })}
            title={t('calculatrice.titre')}
            description={t('calculatrice.description')}
            phraseVide={t('calculatrice.vide.phrase')}
            stats={[
              { label: t('calculatrice.stat.lignes'), value: lignes.length },
              { label: t('calculatrice.stat.rubans'), value: tries.length },
            ]}
          />
        </motion.div>

        {vide && lignes.length === 0 ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('calculatrice.vide.titre')} action={{ label: t('calculatrice.vide.action'), onClick: () => setSaisie('1') }}>
              {t('calculatrice.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          {/* ═══ L'OBJET DOMINANT : le ruban ═══ */}
          <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="eyebrow">{t('calculatrice.leRuban')}</p>
              {ouvert && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {t('calculatrice.ouvertDepuis', { quand: relativeTime(ouvert.createdAt) })}
                </p>
              )}
            </div>

            {/* LE PAPIER — clair, avec ses lignes de grille et son bord déchiré. */}
            <div className="mt-4">
              <div className="bg-white px-4 py-4 text-[#111111]">
                {lignes.length === 0 ? (
                  <p className="py-6 text-center font-mono text-[12px] uppercase tracking-wider text-[#8a8a86]">
                    {t('calculatrice.rubanVierge')}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {lignes.map((l, i) => (
                      <li
                        key={`${l.at}-${i}`}
                        className="flex items-baseline justify-between gap-4 font-mono text-[13px] tabular-nums"
                        style={{
                          height: RUBAN_LIGNE_H,
                          /* Les lignes de grille du papier : un filet clair sous
                             chaque ligne, comme sur un vrai rouleau. */
                          borderBottom: '1px solid #e6e4de',
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{l.libelle}</span>
                        <span className="w-12 flex-shrink-0 text-right text-[#6a6a66]">{l.taux} %</span>
                        <span className="w-24 flex-shrink-0 text-right">{formatCents(l.montantCents)}</span>
                      </li>
                    ))}
                    <li className="flex items-baseline justify-between gap-4 pt-2 font-mono text-[12px] tabular-nums text-[#6a6a66]">
                      <span>{t('calculatrice.sousTotalHt')}</span>
                      <span className="w-24 text-right">{formatCents(pied.htCents)}</span>
                    </li>
                    {pied.parTaux.map(([tx, montant]) => (
                      <li key={tx} className="flex items-baseline justify-between gap-4 font-mono text-[12px] tabular-nums text-[#6a6a66]">
                        <span>{t('calculatrice.tvaAu', { taux: tx })}</span>
                        <span className="w-24 text-right">{formatCents(montant)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* LE TOTAL — la plaque ambre, pleine largeur, en encre noire. */}
                {lignes.length > 0 && (
                  <div
                    data-signal-groupe="total-ttc"
                    className="-mx-4 mt-3 flex items-baseline justify-between gap-4 bg-signal px-4 py-2.5 text-signal-ink"
                  >
                    <span data-signal-groupe="total-ttc" className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
                      {t('calculatrice.totalTtc')}
                    </span>
                    <span data-signal-groupe="total-ttc" className="text-[23px] font-semibold tabular-nums leading-none">
                      {formatCents(pied.ttcCents)}
                    </span>
                  </div>
                )}
              </div>

              {/* LE BORD DÉCHIRÉ — des dents de scie, en SVG, à la largeur du papier. */}
              <svg
                viewBox={`0 0 ${DENT_L * 40} ${DENT_H}`}
                preserveAspectRatio="none"
                className="block w-full"
                style={{ height: DENT_H }}
                aria-hidden
              >
                <path
                  d={`M0 0 ${Array.from({ length: 40 }, (_, i) => `L${i * DENT_L + DENT_L / 2} ${DENT_H} L${(i + 1) * DENT_L} 0`).join(' ')} Z`}
                  fill="#ffffff"
                />
              </svg>
            </div>

            {/* LA SAISIE EN COURS, sous le ruban : ce qui n'est pas encore imprimé. */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-strong pt-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {facteur ? t('calculatrice.facteurEnAttente', { n: facteur }) : t('calculatrice.aTaper')}
              </p>
              <p className="text-[27px] font-semibold tabular-nums leading-none text-text-primary">{saisie || '0'}</p>
            </div>

            {lignes.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void poser(-1)}
                  disabled={!saisie}
                  className="flex min-h-10 items-center gap-1.5 border border-border-strong px-3 font-mono text-[10px] uppercase tracking-wider text-text-secondary disabled:opacity-40"
                >
                  <X size={12} /> {t('calculatrice.annuler')}
                </button>
                <select
                  value={pourQui}
                  onChange={(e) => setPourQui(e.target.value)}
                  aria-label={t('calculatrice.pourQuel')}
                  className="input-focus min-h-10 border border-border bg-bg px-2.5 text-sm text-text-primary outline-none"
                >
                  <option value="">{t('calculatrice.pourQuel')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void enFaireUnDevis()}
                  disabled={!pourQui}
                  className="flex min-h-10 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40"
                >
                  <FileText size={14} /> {t('calculatrice.enFaireUnDevis')}
                </button>
              </div>
            )}
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-text-muted">{t('calculatrice.gardeTout')}</p>
          </motion.section>

          {/* À DROITE — le pavé, puis les touches de taux. */}
          <motion.aside variants={staggerItem} className="panel p-4">
            <p className="eyebrow mb-3">{t('calculatrice.lePave')}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {TOUCHES.map((k) => (
                <button
                  key={k.cle}
                  type="button"
                  onClick={() => frapper(k)}
                  className={`flex h-12 items-center justify-center font-mono text-[15px] transition-colors ${
                    k.role === 'poser'
                      ? 'bg-accent font-semibold text-bg hover:bg-accent-hover'
                      : k.role === 'effacer' || k.role === 'retour'
                        ? 'border border-border bg-elevated text-text-secondary hover:text-text-primary'
                        : 'border border-border bg-surface text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {k.role === 'retour' ? <Delete size={16} /> : k.libelle}
                </button>
              ))}
            </div>

            <p className="eyebrow mb-2 mt-5">{t('calculatrice.lesTaux')}</p>
            <div role="radiogroup" aria-label={t('calculatrice.lesTaux')} className="flex flex-wrap gap-1.5">
              {tauxOfferts.map((tx) => (
                <button
                  key={tx}
                  type="button"
                  role="radio"
                  aria-checked={taux === tx}
                  onClick={() => setTauxCourant(tx)}
                  className={`min-h-10 border px-3 font-mono text-xs ${
                    taux === tx ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tx} %
                </button>
              ))}
            </div>
            {/* Les taux viennent des paramètres du produit, jamais d'ici. */}
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              {exonere ? t('calculatrice.exonere') : t('calculatrice.tauxDuProduit')}
            </p>
          </motion.aside>
        </div>

        {/* EN PIED — les rubans gardés, et le relevé du calcul en cours. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <motion.section variants={staggerItem} className="panel">
            <p className="eyebrow border-b border-border px-4 py-2.5">{t('calculatrice.rubansGardes')}</p>
            {gardes.length === 0 ? (
              <p className="px-4 py-5 text-sm text-text-muted">{t('calculatrice.aucunRubanGarde')}</p>
            ) : (
              <ul className="flex flex-col">
                {gardes.map((r) => {
                  const p = totaux(r.lines ?? []);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 last:border-b-0">
                      <button type="button" onClick={() => setOuvertId(r.id)} className="input-focus min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm text-text-primary">
                          {t('calculatrice.nLignes', { n: (r.lines ?? []).length })}
                        </span>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {relativeTime(r.createdAt)}
                          {r.devisFaitLe ? ` · ${t('calculatrice.devenuDevis')}` : ''}
                        </span>
                      </button>
                      <span className="flex-shrink-0 font-mono text-[13px] tabular-nums text-text-secondary">{formatCents(p.ttcCents)}</span>
                      <button
                        type="button"
                        onClick={() => void remove('calcTapes', r.id)}
                        aria-label={t('calculatrice.jeter')}
                        title={t('calculatrice.jeter')}
                        className="flex-shrink-0 border border-border px-2 py-1 text-text-muted hover:border-danger/60 hover:text-danger"
                      >
                        <Trash2 size={11} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.section>

          <motion.aside variants={staggerItem} className="panel p-4">
            <p className="eyebrow mb-3">{t('calculatrice.leReleve')}</p>
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('calculatrice.sousTotalHt')}</dt>
                <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{formatCents(pied.htCents)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('calculatrice.tvaTotale')}</dt>
                <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{formatCents(pied.tvaCents)}</dd>
              </div>
            </dl>
            {/*
              ARBITRAGE DIT À L'ÉCRAN : la table du module demande ici des
              « relevés de marge ». Une marge suppose un PRIX D'ACHAT, et un
              ruban de caisse n'en porte aucun — on y tape des prix de vente.
              Inventer un coût pour remplir une carte aurait donné un
              pourcentage faux, affiché avec l'aplomb d'un vrai. On montre donc
              ce que le ruban sait : la part de taxe dans ce qu'on annonce.
            */}
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('calculatrice.pasDeMarge')}</p>
          </motion.aside>
        </div>
      </motion.section>
    </EcranVide>
  );
}

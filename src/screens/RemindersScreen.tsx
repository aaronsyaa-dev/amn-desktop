import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BellRing, Check, Copy } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useInvoices, invoiceTotals, netDueCents } from '../state/useInvoices';
import { useAuth } from '../auth/AuthContext';
import { formatCents } from '../lib/money';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { paliereDe, toneAMonte, rangPalier, cleMessagePalier, CLE_LIBELLE_PALIER, ECHELLE, type PalierRelance } from '../lib/relances';
import type { Invoice } from '../shared/api';

interface ReminderData {
  invoiceId: string;
  sentAt: string;
  byEmail: string;
  note: string;
  /** Absent sur les relances notées avant ce chantier — traité comme `'rappel'` à la lecture. */
  palier?: PalierRelance;
}

const PALIER_TON: Record<PalierRelance, string> = {
  rappel: 'text-text-secondary',
  ferme: 'text-warning',
  'mise-en-demeure': 'text-danger',
  'dernier-avis': 'text-danger',
};
const isoDay = () => new Date().toISOString().slice(0, 10);

/**
 * LES RELANCES DE PAIEMENT — l'argent dû, et le mot qu'on envoie.
 *
 * Pour qui : quiconque facture et n'ose pas relancer, ou oublie. Ce que ça
 * règle : la liste des factures échues, ce qu'elles représentent, quand on a
 * relancé la dernière fois — et un message prêt à coller, poli, précis, avec
 * le numéro et le montant. Rien n'est envoyé d'ici (il n'y a pas d'email) :
 * on copie, on colle où l'on parle au client, et on note « relancé ». Lit
 * la Facturation, n'écrit que la trace des relances.
 *
 * ## Ce qui domine : UNE lettre, posée comme une feuille
 *
 * L'écran empilait une lettre par facture échue, toutes de la même taille.
 * Sur le bac à sable, six factures : deux lettres remplissaient la fenêtre,
 * quatre continuaient dessous. Une mise en demeure à 45 jours et un rappel à
 * 4 jours avaient exactement la même carte, la même encre, et leur palier
 * s'écrivait en mono 9 px au bout du nom. Le module SAIT pourtant les
 * distinguer — `src/lib/relances.ts` gradue le ton sur le retard, et écrit
 * quatre lettres différentes — mais l'écran n'en disait rien.
 *
 * Une seule lettre passe donc en tête, en `panel-sheet` : c'est la classe du
 * document posé, pas de la carte, et une relance EST un document — on la copie
 * telle quelle pour l'envoyer. Les autres échues descendent en registre d'une
 * ligne, sans leur texte : leur lettre s'affiche quand on les choisit.
 *
 * ## Laquelle passe en tête
 *
 * La plus dure à écrire : le palier le plus haut d'abord, puis, à palier égal,
 * le montant le plus gros. Pas la plus ancienne — deux factures du même mois
 * peuvent être à deux paliers, et c'est le palier qui dit ce qu'il faut oser
 * écrire. Pas la plus grosse non plus : un gros rappel de trois jours ne passe
 * pas devant une mise en demeure.
 *
 * ## L'échelle
 *
 * Les quatre paliers se montrent en barreaux, avec le seuil de chacun, le
 * barreau atteint plein et les suivants éteints. C'est l'objet propre de ce
 * module : nulle part ailleurs dans l'application une donnée ne monte par
 * crans nommés. Elle répond à la question qu'on se pose vraiment devant une
 * facture en retard — « je peux écrire ça, ou c'est trop tôt ? »
 *
 * ## L'ambre
 *
 * Sur « à écrire maintenant », c'est-à-dire sur la lettre de tête et son geste
 * de copie. PAS sur la gravité : `PALIER_TON` garde le rouge pour la mise en
 * demeure et le dernier avis, et le rouge dit la gravité depuis toujours dans
 * cette application. L'ambre dit ce qui demande une décision — ici, envoyer
 * celle-là, aujourd'hui. Les deux se lisent ensemble sans se disputer : la
 * lettre de tête est ambre parce qu'elle est à écrire, et son chiffre de
 * retard est rouge parce que 61 jours, c'est grave.
 */
export function RemindersScreen() {
  const { t, langue } = useLangue();
  const { user } = useAuth();
  const { upsert } = useSync();
  const { invoices } = useInvoices();
  const relances = useCollection<ReminderData>('paymentReminders');
  const [copiee, setCopiee] = useState<string | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const jour = isoDay();
  const moi = user?.email ?? '';

  // Un avoir (Bloc 3, facturation avancée) peut avoir tout compensé sur une
  // facture pourtant échue : elle disparaît alors de cette liste, exactement
  // comme si elle avait été payée — c'est ce que `netDueCents` calcule, jamais
  // le montant brut de la facture seule.
  const echues = useMemo(
    () =>
      invoices
        .filter((f) => f.status === 'issued' && f.kind !== 'creditNote' && f.dueAt && f.dueAt < jour && netDueCents(f, invoices) > 0)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [invoices, jour],
  );
  const derniere = (f: Invoice) => relances.filter((r) => r.invoiceId === f.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] ?? null;
  const total = echues.reduce((n, f) => n + netDueCents(f, invoices), 0);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const jours = (f: Invoice) => Math.max(1, Math.round((Date.parse(jour) - Date.parse(f.dueAt)) / 86_400_000));
  /** Le palier qu'un avoir partiel n'annule pas : il se calcule sur le retard, jamais sur le montant restant. */
  const palierDe = (f: Invoice) => paliereDe(jours(f));

  /*
    LA PLUS DURE À ÉCRIRE — palier d'abord, montant ensuite.

    `echues` reste trié par échéance : c'est l'ordre du registre, et il se lit
    bien. La tête, elle, se choisit autrement — voir l'en-tête du fichier.
  */
  const laPlusDure = useMemo(() => {
    /* Le retard se recalcule ici plutôt que d'appeler `jours` : une fermeture
       déclarée dans le corps du composant obligerait à museler la règle des
       dépendances de hook, et une règle muselée finit par cacher un vrai
       oubli. */
    const retard = (f: Invoice) => Math.max(1, Math.round((Date.parse(jour) - Date.parse(f.dueAt)) / 86_400_000));
    return (
      [...echues].sort((a, b) => {
        const ecart = rangPalier(paliereDe(retard(b))) - rangPalier(paliereDe(retard(a)));
        if (ecart !== 0) return ecart;
        return netDueCents(b, invoices) - netDueCents(a, invoices);
      })[0] ?? null
    );
  }, [echues, invoices, jour]);
  const tete = echues.find((f) => f.id === choisie) ?? laPlusDure;
  const reste = echues.filter((f) => f.id !== tete?.id);

  const message = (f: Invoice) =>
    t(cleMessagePalier(palierDe(f)), {
      nom: f.billTo.name,
      numero: f.number,
      montant: formatCents(netDueCents(f, invoices)),
      echeance: new Date(`${f.dueAt}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
      jours: jours(f),
    });
  const copier = async (f: Invoice) => {
    try {
      await navigator.clipboard.writeText(message(f));
      setCopiee(f.id);
      window.setTimeout(() => setCopiee(null), 2000);
    } catch {
      /* presse-papiers refusé : le texte reste sélectionnable dans la ligne */
    }
  };
  const noter = (f: Invoice) =>
    upsert('paymentReminders', uid('rel'), {
      invoiceId: f.id,
      sentAt: new Date().toISOString(),
      byEmail: moi,
      note: '',
      palier: palierDe(f),
    });

  const palierTete = tete ? palierDe(tete) : null;
  const dernierePourTete = tete ? derniere(tete) : null;
  const dernierPalierTete = dernierePourTete?.palier ?? (dernierePourTete ? 'rappel' : null);
  const monteTete = toneAMonte(dernierPalierTete, palierTete ?? 'rappel');

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('relances.titre') })}
          title={t('relances.titre')}
          description={echues.length === 0 ? t('relances.rien') : t('relances.description')}
          stats={[
            { label: t('relances.stat.echues'), value: echues.length, emphasis: echues.length > 0 },
            { label: t('relances.stat.montant'), value: formatCents(total), emphasis: total > 0 },
            { label: t('relances.stat.relancees'), value: relances.length },
          ]}
        />
      </motion.div>

      {!tete || palierTete === null ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('relances.vide.titre')}>{t('relances.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          <motion.section variants={staggerItem} className="panel-sheet p-5 sm:p-6" data-signal-groupe="a-ecrire">
            <p className="eyebrow eyebrow-signal mb-3">{t('relances.aEcrire')}</p>

            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <h2 className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{tete.billTo.name}</h2>
                <p className="mt-1.5 text-sm text-text-secondary">
                  {tete.number} · {formatCents(netDueCents(tete, invoices))}
                  {netDueCents(tete, invoices) !== invoiceTotals(tete).grossCents && (
                    <span className="text-text-muted"> ({t('relances.avoirDeduit', { brut: formatCents(invoiceTotals(tete).grossCents) })})</span>
                  )}
                </p>
              </div>
              {/* Le retard en grand, dans le ton de son palier : c'est le chiffre
                  qui décide de tout le reste de l'écran. */}
              <p className="flex items-baseline gap-2">
                <span className={`text-[27px] font-semibold tabular-nums leading-none ${PALIER_TON[palierTete]}`}>{jours(tete)}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {jours(tete) === 1 ? t('relances.jourDeRetard') : t('relances.joursDeRetard')}
                </span>
              </p>
            </div>

            {/* L'ÉCHELLE DES PALIERS — l'objet propre de ce module. */}
            <p className="eyebrow mt-5 mb-2">{t('relances.echelle')}</p>
            <ol className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {ECHELLE.map((cran) => {
                const atteint = rangPalier(cran.palier) <= rangPalier(palierTete);
                const courant = cran.palier === palierTete;
                return (
                  <li
                    key={cran.palier}
                    aria-current={courant ? 'step' : undefined}
                    className={`flex flex-col gap-1 px-3 py-2.5 ${courant ? 'bg-elevated' : 'bg-surface'}`}
                  >
                    <span className={`text-xs ${courant ? `font-semibold ${PALIER_TON[cran.palier]}` : atteint ? 'text-text-secondary' : 'text-text-muted'}`}>
                      {t(CLE_LIBELLE_PALIER[cran.palier])}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                      {cran.auDela === 0 ? t('relances.seuilPremier') : t('relances.seuilApres', { n: cran.auDela })}
                    </span>
                  </li>
                );
              })}
            </ol>

            {monteTete && dernierPalierTete && (
              <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-danger">
                <AlertTriangle size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
                {t('relances.tonAMonte', { dernier: t(CLE_LIBELLE_PALIER[dernierPalierTete]), actuel: t(CLE_LIBELLE_PALIER[palierTete]) })}
              </p>
            )}
            {dernierePourTete ? (
              !monteTete && (
                <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {t('relances.derniere', { quand: relativeTime(dernierePourTete.sentAt) })}
                </p>
              )
            ) : (
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('relances.premiereRelance')}</p>
            )}

            <p className="mt-4 whitespace-pre-wrap border border-border bg-bg px-4 py-3.5 text-sm leading-relaxed text-text-secondary">{message(tete)}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copier(tete)} className="signal-plate flex min-h-11 items-center gap-2 px-4 text-sm font-semibold md:min-h-0 md:py-2.5">
                {copiee === tete.id ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
                {copiee === tete.id ? t('relances.copie') : t('relances.copier')}
              </button>
              <button type="button" onClick={() => void noter(tete)} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2.5">
                <BellRing size={14} strokeWidth={2} /> {t('relances.noter')}
              </button>
            </div>
          </motion.section>

          {reste.length > 0 && (
            <motion.section variants={staggerItem} className="panel">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
                <p className="eyebrow">{t('relances.autres')}</p>
                <p className="text-[11px] text-text-muted">{t('relances.laPlusDure')}</p>
              </div>
              <ul className="flex flex-col gap-px bg-border">
                {reste.map((f) => {
                  const palier = palierDe(f);
                  const d = derniere(f);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setChoisie(f.id)}
                        aria-label={t('relances.voirLettre')}
                        className="input-focus flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                      >
                        <span className={`w-32 flex-shrink-0 font-mono text-[9px] uppercase tracking-wider ${PALIER_TON[palier]}`}>
                          {t(CLE_LIBELLE_PALIER[palier])}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                          {f.billTo.name} <span className="text-text-muted">· {f.number}</span>
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {jours(f) === 1 ? t('relances.retardUn') : t('relances.enRetard', { n: jours(f) })}
                          {d && <> · {t('relances.derniere', { quand: relativeTime(d.sentAt) })}</>}
                        </span>
                        <span className="w-24 flex-shrink-0 text-right text-sm tabular-nums text-text-secondary">{formatCents(netDueCents(f, invoices))}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          )}
        </>
      )}
    </motion.section>
  );
}

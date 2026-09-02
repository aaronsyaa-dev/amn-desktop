import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Check, Copy } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useInvoices, invoiceTotals } from '../state/useInvoices';
import { useAuth } from '../auth/AuthContext';
import { formatCents } from '../lib/money';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { Invoice } from '../shared/api';

interface ReminderData {
  invoiceId: string;
  sentAt: string;
  byEmail: string;
  note: string;
}
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
 */
export function RemindersScreen() {
  const { t, langue } = useLangue();
  const { user } = useAuth();
  const { upsert } = useSync();
  const { invoices } = useInvoices();
  const relances = useCollection<ReminderData>('paymentReminders');
  const [copiee, setCopiee] = useState<string | null>(null);
  const jour = isoDay();
  const moi = user?.email ?? '';

  const echues = useMemo(
    () => invoices.filter((f) => f.status === 'issued' && !f.paidAt && f.dueAt && f.dueAt < jour).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [invoices, jour],
  );
  const derniere = (f: Invoice) => relances.filter((r) => r.invoiceId === f.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] ?? null;
  const total = echues.reduce((n, f) => n + invoiceTotals(f).grossCents, 0);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const jours = (f: Invoice) => Math.max(1, Math.round((Date.parse(jour) - Date.parse(f.dueAt)) / 86_400_000));

  const message = (f: Invoice) =>
    t('relances.message', {
      nom: f.billTo.name,
      numero: f.number,
      montant: formatCents(invoiceTotals(f).grossCents),
      echeance: new Date(`${f.dueAt}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
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
  const noter = (f: Invoice) => upsert('paymentReminders', uid('rel'), { invoiceId: f.id, sentAt: new Date().toISOString(), byEmail: moi, note: '' });

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

      {echues.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('relances.vide.titre')}>{t('relances.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
          {echues.map((f) => {
            const d = derniere(f);
            const totaux = invoiceTotals(f);
            return (
              <li key={f.id} className="flex flex-col gap-3 bg-surface px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {f.billTo.name} <span className="text-text-muted">· {f.number}</span>
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      <span className="text-warning">{t('relances.enRetard', { n: jours(f) })}</span> · {formatCents(totaux.grossCents)}
                      {d && <span> · {t('relances.derniere', { quand: relativeTime(d.sentAt) })}</span>}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                    <button type="button" onClick={() => void copier(f)} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                      {copiee === f.id ? <Check size={13} /> : <Copy size={13} />} {copiee === f.id ? t('relances.copie') : t('relances.copier')}
                    </button>
                    <button type="button" onClick={() => void noter(f)} className="flex min-h-11 items-center gap-1.5 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5">
                      <BellRing size={13} /> {t('relances.noter')}
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 text-xs leading-relaxed text-text-secondary">{message(f)}</p>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}

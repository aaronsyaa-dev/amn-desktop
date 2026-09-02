import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Mail, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useClients } from '../state/useClients';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface NewsletterData {
  subject: string;
  body: string;
  sentAt: string | null;
  recipients: number;
  byEmail: string;
  createdAt: string;
}

/**
 * LA LETTRE D'INFORMATION — un mot à tous vos clients, depuis votre messagerie.
 *
 * Pour qui : une boutique qui a une nouveauté, une fermeture, une offre, et
 * des clients qui ne le sauront que si on leur dit. Ce que ça règle : un
 * objet, un texte, et la messagerie de la personne fait l'envoi, en copie
 * cachée, aux clients qui ont une adresse dans Clients. Aucun service
 * d'emailing, aucune liste exportée ailleurs : les adresses restent là où
 * elles sont, et l'envoi part du compte de la boutique — c'est aussi ce que
 * la loi attend d'une relation commerciale existante.
 */
export function NewsletterScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const { clients } = useClients();
  const brutes = useCollection<NewsletterData>('newsletters');
  const [ouvert, setOuvert] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copie, setCopie] = useState(false);

  const adresses = useMemo(() => [...new Set(clients.map((c) => c.email.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))], [clients]);
  const lettres = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const envoyees = lettres.filter((l) => l.sentAt);

  const creer = async () => {
    if (!subject.trim()) return;
    await upsert('newsletters', uid('nws'), { subject: subject.trim(), body: body.trim(), sentAt: null, recipients: 0, byEmail: user?.email ?? '', createdAt: new Date().toISOString() });
    setSubject(''); setBody(''); setOuvert(false);
  };
  const lienMessagerie = (l: NewsletterData) => `mailto:?bcc=${encodeURIComponent(adresses.join(','))}&subject=${encodeURIComponent(l.subject)}&body=${encodeURIComponent(l.body)}`;
  const marquer = (l: NewsletterData & { id: string }) => upsert('newsletters', l.id, { ...l, sentAt: new Date().toISOString(), recipients: adresses.length });
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(adresses.join(', '));
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé : les adresses restent dans Clients */
    }
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('lettre.titre') })}
          title={t('lettre.titre')}
          description={t('lettre.description')}
          stats={[
            { label: t('lettre.stat.destinataires'), value: adresses.length },
            { label: t('lettre.stat.envoyees'), value: envoyees.length },
            { label: t('lettre.stat.derniere'), value: envoyees[0]?.sentAt ? relativeTime(envoyees[0].sentAt) : '—' },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('lettre.nouvelle')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('lettre.champObjet')} aria-label={t('lettre.champObjet')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={t('lettre.champTexte')} aria-label={t('lettre.champTexte')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!subject.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('lettre.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {adresses.length === 0 && <motion.p variants={staggerItem} className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-text-secondary">{t('lettre.sansDestinataire')}</motion.p>}

      {lettres.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('lettre.vide.titre')} action={{ label: t('lettre.vide.action'), onClick: () => setOuvert(true) }}>{t('lettre.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-3">
          {lettres.map((l) => (
            <li key={l.id} className={`group rounded-xl border bg-surface p-4 ${l.sentAt ? 'border-success/30' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{l.subject}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{l.sentAt ? t('lettre.envoyee', { quand: relativeTime(l.sentAt), n: l.recipients }) : t('lettre.brouillon')}</p>
                </div>
                <button type="button" onClick={() => void remove('newsletters', l.id)} aria-label={t('lettre.supprimer')} title={t('lettre.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </div>
              {l.body && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{l.body}</p>}
              {!l.sentAt && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={adresses.length ? lienMessagerie(l) : undefined} aria-disabled={adresses.length === 0} className={`flex min-h-11 items-center gap-2 bg-accent px-3 text-xs font-semibold text-bg md:min-h-0 md:py-1.5 ${adresses.length === 0 ? 'pointer-events-none opacity-40' : ''}`}><Mail size={13} /> {t('lettre.ouvrirMessagerie')}</a>
                  <button type="button" onClick={() => void copier()} disabled={adresses.length === 0} className="flex min-h-11 items-center gap-2 border border-border px-3 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-1.5">{copie ? <Check size={13} /> : <Copy size={13} />} {copie ? t('lettre.copiees') : t('lettre.copierAdresses')}</button>
                  <button type="button" onClick={() => void marquer(l)} disabled={adresses.length === 0} className="flex min-h-11 items-center gap-2 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-1.5"><Check size={13} /> {t('lettre.marquerEnvoyee')}</button>
                </div>
              )}
            </li>
          ))}
        </motion.ul>
      )}
    </motion.section>
  );
}

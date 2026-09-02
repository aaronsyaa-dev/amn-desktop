import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface SupplierData {
  name: string;
  supplies: string;
  contact: string;
  phone: string;
  email: string;
  lastOrderAt: string | null;
  createdAt: string;
}

const QUATRE_VINGT_DIX_JOURS = 90 * 86_400_000;

/**
 * LES FOURNISSEURS — qui vous livre quoi, et depuis quand.
 *
 * Pour qui : une boutique ou un atelier dont le numéro du grossiste vit dans
 * un SMS de l'an dernier. Ce que ça règle : une fiche par fournisseur avec ce
 * qu'il livre, qui appeler, et la date de la dernière commande — posée d'un
 * geste. Les fournisseurs silencieux depuis trois mois remontent : c'est
 * souvent là qu'une commande a été oubliée.
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

  const fournisseurs = useMemo(() => [...brutes].sort((a, b) => a.name.localeCompare(b.name)), [brutes]);
  const maintenant = Date.now();
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const commandesMois = fournisseurs.filter((f) => f.lastOrderAt && Date.parse(f.lastOrderAt) >= debutMois).length;
  const silencieux = fournisseurs.filter((f) => !f.lastOrderAt || maintenant - Date.parse(f.lastOrderAt) > QUATRE_VINGT_DIX_JOURS).length;

  const ajouter = async () => {
    if (!name.trim()) return;
    await upsert('suppliers', uid('sup'), { name: name.trim(), supplies: supplies.trim(), contact: contact.trim(), phone: phone.trim(), email: email.trim(), lastOrderAt: null, createdAt: new Date().toISOString() });
    setName(''); setSupplies(''); setContact(''); setPhone(''); setEmail(''); setOuvert(false);
  };
  const commander = (f: SupplierData & { id: string }) => upsert('suppliers', f.id, { ...f, lastOrderAt: new Date().toISOString() });

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
        <motion.ul variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          {fournisseurs.map((f) => {
            const muet = !f.lastOrderAt || maintenant - Date.parse(f.lastOrderAt) > QUATRE_VINGT_DIX_JOURS;
            return (
              <li key={f.id} className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{f.name}</p>
                    {f.supplies && <p className="text-xs text-text-secondary">{f.supplies}</p>}
                  </div>
                  <button type="button" onClick={() => void remove('suppliers', f.id)} aria-label={t('fournisseurs.supprimer')} title={t('fournisseurs.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>
                <p className={`font-mono text-[10px] uppercase tracking-wider ${muet ? 'text-warning' : 'text-text-muted'}`}>
                  {f.lastOrderAt ? t('fournisseurs.derniereCommande', { quand: relativeTime(f.lastOrderAt) }) : t('fournisseurs.jamaisCommande')}
                </p>
                {(f.contact || f.phone || f.email) && (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
                    {f.contact && <span>{f.contact}</span>}
                    {f.phone && <a href={`tel:${f.phone}`} className="-my-2 flex items-center gap-1 py-2 hover:text-text-primary"><Phone size={11} /> {f.phone}</a>}
                    {f.email && <a href={`mailto:${f.email}`} className="-my-2 flex items-center gap-1 py-2 hover:text-text-primary"><Mail size={11} /> {f.email}</a>}
                  </p>
                )}
                <button type="button" onClick={() => void commander(f)} className="mt-1 flex min-h-11 items-center justify-center gap-2 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                  <ShoppingCart size={13} /> {t('fournisseurs.commandeAujourdhui')}
                </button>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}

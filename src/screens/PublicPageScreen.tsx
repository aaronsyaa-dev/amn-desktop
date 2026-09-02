import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, ExternalLink, Loader2, Mail, MapPin, Phone, Star } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useLangue } from '../i18n';

const API_BASE = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');

interface Page {
  status: 'open';
  orgName: string;
  title: string;
  intro: string;
  hours: string;
  address: string;
  phone: string;
  email: string;
  reviews: { author: string; text: string; rating: number; source: string }[];
  portfolio: { title: string; description: string; category: string; link: string }[];
  booking: boolean;
}

/**
 * LA MINI-PAGE PUBLIQUE — sans compte, sans session.
 *
 * Ce qu'elle montre : ce que l'organisation a composé pour être montré, et
 * rien d'autre — le serveur filtre les avis non publiables et les
 * réalisations masquées avant qu'ils n'arrivent ici. Même image que les
 * autres pages publiques : le logo, une carte, une grammaire calme.
 */
export function PublicPageScreen() {
  const { t } = useLangue();
  const [orgId] = useState(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.slice(1);
    return (new URLSearchParams(query).get('org') ?? '').trim();
  });
  const [page, setPage] = useState<Page | null | 'fermee' | 'erreur'>(null);

  useEffect(() => {
    if (!orgId || !API_BASE) {
      setPage('fermee');
      return;
    }
    fetch(`${API_BASE}/v1/page/${encodeURIComponent(orgId)}`)
      .then(async (r) => {
        if (r.status === 404) return 'fermee' as const;
        if (!r.ok) return 'erreur' as const;
        return (await r.json()) as Page;
      })
      .then(setPage)
      .catch(() => setPage('erreur'));
  }, [orgId]);

  return (
    <main className="flex min-h-screen justify-center bg-bg p-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-2xl py-6">
        <div className="mb-6 flex justify-center"><Logo /></div>
        {page === null && <p className="flex items-center justify-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('pagePublique.lecture')}</p>}
        {page === 'fermee' && (
          <section className="border border-border bg-surface p-6">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">{t('pagePublique.fermeeTitre')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t('pagePublique.fermeeTexte')}</p>
          </section>
        )}
        {page === 'erreur' && <section className="border border-border bg-surface p-6"><p className="text-sm text-text-secondary">{t('pagePublique.erreur')}</p></section>}
        {page && typeof page !== 'string' && (
          <div className="flex flex-col gap-4">
            <section className="border border-border bg-surface p-6">
              <p className="eyebrow">{page.orgName}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">{page.title || page.orgName}</h1>
              {page.intro && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{page.intro}</p>}
              {page.booking && (
                <a href={`#/rdv?org=${encodeURIComponent(orgId)}`} className="mt-4 inline-flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg"><CalendarCheck size={14} /> {t('pagePublique.rdv')}</a>
              )}
            </section>
            {(page.hours || page.address || page.phone || page.email) && (
              <section className="grid gap-4 border border-border bg-surface p-6 sm:grid-cols-2">
                {page.hours && (
                  <div>
                    <p className="eyebrow mb-1">{t('pagePublique.horaires')}</p>
                    <p className="whitespace-pre-wrap text-sm text-text-primary">{page.hours}</p>
                  </div>
                )}
                {(page.address || page.phone || page.email) && (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="eyebrow mb-1">{t('pagePublique.contact')}</p>
                    {page.address && <p className="flex items-start gap-2 text-text-primary"><MapPin size={14} className="mt-0.5 shrink-0 text-text-muted" /> {page.address}</p>}
                    {page.phone && <a href={`tel:${page.phone}`} className="flex items-center gap-2 text-text-primary hover:underline"><Phone size={14} className="shrink-0 text-text-muted" /> {page.phone}</a>}
                    {page.email && <a href={`mailto:${page.email}`} className="flex items-center gap-2 text-text-primary hover:underline"><Mail size={14} className="shrink-0 text-text-muted" /> {page.email}</a>}
                  </div>
                )}
              </section>
            )}
            {page.reviews.length > 0 && (
              <section className="border border-border bg-surface p-6">
                <p className="eyebrow mb-3">{t('pagePublique.avis')}</p>
                <ul className="flex flex-col gap-3">
                  {page.reviews.map((a, i) => (
                    <li key={`${a.author}-${i}`} className="border-l-2 border-accent pl-3">
                      <p className="text-sm leading-relaxed text-text-primary">{a.text}</p>
                      <p className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {a.rating > 0 && <span className="flex items-center gap-0.5" aria-label={`${a.rating}/5`}>{Array.from({ length: a.rating }, (_, k) => <Star key={k} size={9} className="fill-current" />)}</span>}
                        {a.author}{a.source ? ` · ${a.source}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {page.portfolio.length > 0 && (
              <section className="border border-border bg-surface p-6">
                <p className="eyebrow mb-3">{t('pagePublique.realisations')}</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {page.portfolio.map((p, i) => (
                    <li key={`${p.title}-${i}`} className="rounded-lg border border-border bg-bg p-3">
                      <p className="text-sm font-semibold text-text-primary">{p.title}</p>
                      {p.category && <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{p.category}</p>}
                      {p.description && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{p.description}</p>}
                      {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-text-primary hover:underline md:min-h-0"><ExternalLink size={11} /> {t('pagePublique.voir')}</a>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </motion.div>
    </main>
  );
}

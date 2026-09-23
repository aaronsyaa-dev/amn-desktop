import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useLangue } from '../i18n';

const API_BASE = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');

type Bloc =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image' | 'video'; url: string; caption: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'table'; columns: string[]; rows: string[][] };

interface Site {
  status: 'open';
  orgName: string;
  pages: Array<{ id: string; title: string }>;
  page?: { id: string; title: string; blocks: Bloc[] };
}

/**
 * LE SITE PUBLIC — les pages de Pages que la cliente a publiées.
 *
 * Fusion du chantier des cinquante (« Mini-builder de site vitrine » →
 * Pages) : il n'y a pas de second éditeur, le site EST la pile de blocs des
 * pages publiées. Sans compte, sans session ; amn-api ne sert que les pages
 * marquées publiées, et seulement leurs blocs de contenu, déjà nettoyés.
 */
export function PublicSiteScreen() {
  const { t } = useLangue();
  const [params] = useState(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.slice(1);
    const q = new URLSearchParams(query);
    return { org: (q.get('org') ?? '').trim(), page: (q.get('page') ?? '').trim() };
  });
  const [pageId, setPageId] = useState(params.page);
  const [site, setSite] = useState<Site | null | 'fermee' | 'erreur'>(null);

  useEffect(() => {
    if (!params.org || !API_BASE) {
      setSite('fermee');
      return;
    }
    const chemin = `${API_BASE}/v1/site/${encodeURIComponent(params.org)}${pageId ? `/${encodeURIComponent(pageId)}` : ''}`;
    fetch(chemin)
      .then(async (r) => {
        if (r.status === 404) return 'fermee' as const;
        if (!r.ok) return 'erreur' as const;
        const s = (await r.json()) as Site;
        /* Sans page demandée : la première du site. */
        if (!s.page && s.pages[0]) setPageId(s.pages[0].id);
        return s;
      })
      .then(setSite)
      .catch(() => setSite('erreur'));
  }, [params.org, pageId]);

  return (
    <main className="flex min-h-screen justify-center bg-bg p-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-2xl py-6">
        <div className="mb-6 flex justify-center"><Logo /></div>
        {site === null && <p className="flex items-center justify-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('pagePublique.lecture')}</p>}
        {site === 'fermee' && (
          <section className="border border-border bg-surface p-6">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">{t('pagePublique.fermeeTitre')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t('pagePublique.fermeeTexte')}</p>
          </section>
        )}
        {site === 'erreur' && <section className="border border-border bg-surface p-6"><p className="text-sm text-text-secondary">{t('pagePublique.erreur')}</p></section>}
        {site && typeof site !== 'string' && (
          <div className="flex flex-col gap-4">
            <nav className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-3" aria-label={site.orgName}>
              <span className="eyebrow mr-2">{site.orgName}</span>
              {site.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPageId(p.id)}
                  aria-current={p.id === site.page?.id ? 'page' : undefined}
                  className={`min-h-11 text-sm md:min-h-0 ${p.id === site.page?.id ? 'font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {p.title}
                </button>
              ))}
            </nav>
            {site.page && (
              <article className="flex flex-col gap-4 border border-border bg-surface p-6">
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">{site.page.title}</h1>
                {site.page.blocks.map((b) =>
                  b.type === 'text' ? (
                    <p key={b.id} className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{b.text}</p>
                  ) : b.type === 'list' ? (
                    <ul key={b.id} className="list-disc pl-5 text-sm leading-relaxed text-text-secondary">
                      {b.items.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  ) : b.type === 'table' ? (
                    <div key={b.id} className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead><tr>{b.columns.map((c, i) => <th key={i} className="border-b border-border py-2 pr-3 font-semibold text-text-primary">{c}</th>)}</tr></thead>
                        <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-border-row py-2 pr-3 text-text-secondary">{c}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  ) : b.type === 'image' ? (
                    <figure key={b.id}>
                      <img src={b.url} alt={b.caption} className="w-full border border-border" loading="lazy" />
                      {b.caption && <figcaption className="mt-1 text-xs text-text-muted">{b.caption}</figcaption>}
                    </figure>
                  ) : (
                    <a key={b.id} href={b.url} target="_blank" rel="noreferrer" className="text-sm text-text-primary underline">{b.caption || b.url}</a>
                  ),
                )}
              </article>
            )}
          </div>
        )}
      </motion.div>
    </main>
  );
}

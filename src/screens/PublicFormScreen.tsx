import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Send } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useLangue } from '../i18n';

const API_BASE = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');

interface Champ {
  id: string;
  label: string;
  type: 'text' | 'long' | 'email' | 'phone' | 'choice';
  required: boolean;
  options: string[];
}
interface Formulaire {
  status: 'open';
  orgName: string;
  title: string;
  intro: string;
  fields: Champ[];
  thanks: string;
}

/**
 * LE FORMULAIRE PUBLIC — sans compte, sans session.
 *
 * Ce qu'il sait : le nom de l'organisation, le titre, l'accueil, les champs.
 * Ce qu'il fait : poser les questions, envoyer les réponses. Le serveur
 * revalide champ par champ ; cette page ne fait que présenter. Même image
 * que la page de rendez-vous : le logo, une carte, une grammaire calme.
 */
export function PublicFormScreen() {
  const { t } = useLangue();
  const [cible] = useState(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.slice(1);
    const q = new URLSearchParams(query);
    return { org: (q.get('org') ?? '').trim(), id: (q.get('id') ?? '').trim() };
  });
  const [form, setForm] = useState<Formulaire | null | 'fermee' | 'erreur'>(null);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [merci, setMerci] = useState<string | null>(null);

  useEffect(() => {
    if (!cible.org || !cible.id || !API_BASE) {
      setForm('fermee');
      return;
    }
    fetch(`${API_BASE}/v1/forms/${encodeURIComponent(cible.org)}/${encodeURIComponent(cible.id)}`)
      .then(async (r) => {
        if (r.status === 404) return 'fermee' as const;
        if (!r.ok) return 'erreur' as const;
        return (await r.json()) as Formulaire;
      })
      .then(setForm)
      .catch(() => setForm('erreur'));
  }, [cible]);

  const complet = form && typeof form !== 'string' && form.fields.every((c) => !c.required || (reponses[c.id] ?? '').trim());

  const envoyer = async () => {
    if (!form || typeof form === 'string' || !complet) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/v1/forms/${encodeURIComponent(cible.org)}/${encodeURIComponent(cible.id)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: reponses }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string; thanks?: string };
      if (!r.ok) {
        setErreur(body.error ?? t('formPublic.echec'));
        return;
      }
      setMerci(body.thanks || form.thanks || '');
    } catch {
      setErreur(t('formPublic.echec'));
    } finally {
      setEnvoi(false);
    }
  };

  const classe = 'input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none';

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-xl">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <section className="border border-border bg-surface p-6">
          {form === null && <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('formPublic.lecture')}</p>}
          {form === 'fermee' && (
            <>
              <h1 className="text-xl font-bold tracking-tight text-text-primary">{t('formPublic.fermeeTitre')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t('formPublic.fermeeTexte')}</p>
            </>
          )}
          {form === 'erreur' && <p className="text-sm text-text-secondary">{t('formPublic.erreur')}</p>}
          {form && typeof form !== 'string' && merci !== null && (
            <>
              <p className="eyebrow flex items-center gap-2 text-success"><Check size={12} /> {t('formPublic.merciSurtitre')}</p>
              <h1 className="mt-2 text-xl font-bold tracking-tight text-text-primary">{t('formPublic.merciTitre')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{merci || t('formPublic.merciDefaut', { org: form.orgName })}</p>
            </>
          )}
          {form && typeof form !== 'string' && merci === null && (
            <form onSubmit={(e) => { e.preventDefault(); void envoyer(); }} className="flex flex-col gap-4">
              <div>
                <p className="eyebrow">{form.orgName}</p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-text-primary">{form.title}</h1>
                {form.intro && <p className="mt-2 text-sm leading-relaxed text-text-secondary">{form.intro}</p>}
              </div>
              {form.fields.map((c) => (
                <label key={c.id} className="flex flex-col gap-1 text-sm text-text-primary">
                  <span>{c.label}{c.required && <span className="text-text-muted"> · {t('formPublic.requis')}</span>}</span>
                  {c.type === 'long' ? (
                    <textarea value={reponses[c.id] ?? ''} onChange={(e) => setReponses((r) => ({ ...r, [c.id]: e.target.value }))} rows={4} required={c.required} className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
                  ) : c.type === 'choice' ? (
                    <select value={reponses[c.id] ?? ''} onChange={(e) => setReponses((r) => ({ ...r, [c.id]: e.target.value }))} required={c.required} className={classe}>
                      <option value="">{t('formPublic.choisir')}</option>
                      {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={c.type === 'email' ? 'email' : c.type === 'phone' ? 'tel' : 'text'} value={reponses[c.id] ?? ''} onChange={(e) => setReponses((r) => ({ ...r, [c.id]: e.target.value }))} required={c.required} className={classe} />
                  )}
                </label>
              ))}
              {erreur && <p role="alert" className="text-sm text-danger">{erreur}</p>}
              <button type="submit" disabled={envoi || !complet} className="flex min-h-11 items-center justify-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40">
                {envoi ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {t('formPublic.envoyer')}
              </button>
            </form>
          )}
        </section>
      </motion.div>
    </main>
  );
}

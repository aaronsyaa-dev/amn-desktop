import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Eye, EyeOff, Link2, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { publicOrigin } from '../lib/publicUrl';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type TypeChamp = 'text' | 'long' | 'email' | 'phone' | 'choice';
interface Champ {
  id: string;
  label: string;
  type: TypeChamp;
  required: boolean;
  options: string[];
}
interface FormData {
  title: string;
  intro: string;
  thanks: string;
  published: boolean;
  fields: Champ[];
  createdAt: string;
}
interface AnswerData {
  formId: string;
  answers: Record<string, string>;
  receivedAt: string;
  source: string;
}
const TYPES: Record<string, TypeChamp> = { texte: 'text', text: 'text', long: 'long', email: 'email', mail: 'email', telephone: 'phone', téléphone: 'phone', tel: 'phone', phone: 'phone', choix: 'choice', choice: 'choice' };

/** « Le meuble | choix : Table, Étagère | requis » → un champ. */
export function lireChamp(ligne: string): Champ | null {
  const [label, brutType = 'texte', brutRequis = ''] = ligne.split('|').map((p) => p.trim());
  if (!label) return null;
  const [motType, brutOptions = ''] = brutType.split(/\s*:\s*/);
  const type = TYPES[motType.toLowerCase()] ?? 'text';
  const options = type === 'choice' ? brutOptions.split(',').map((o) => o.trim()).filter(Boolean) : [];
  return { id: uid('fld'), label, type, required: /requis|required|\*/i.test(brutRequis) || /requis|required/i.test(brutType), options };
}

/**
 * LES FORMULAIRES — une question posée au public, les réponses ici.
 *
 * Pour qui : une boutique qui veut une demande de devis, une inscription,
 * un avis à recueillir, et qui finit sur un service tiers avec un compte de
 * plus. Ce que ça règle : un formulaire composé ici, publié à une adresse,
 * et chaque réponse qui arrive dans cette liste — synchronisée comme le
 * reste, jamais stockée ailleurs. Le serveur revalide chaque réponse contre
 * les champs : un formulaire non publié n'existe pas pour le public.
 */
export function FormsScreen() {
  const { t } = useLangue();
  const { org } = useAuth();
  const { upsert, remove } = useSync();
  const formulaires = useCollection<FormData>('forms');
  const reponses = useCollection<AnswerData>('formAnswers');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [thanks, setThanks] = useState('');
  const [champs, setChamps] = useState('');
  const [copie, setCopie] = useState<string | null>(null);
  const [deplie, setDeplie] = useState<string | null>(null);
  const origine = publicOrigin();

  const tries = useMemo(() => [...formulaires].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [formulaires]);
  const parFormulaire = useMemo(() => {
    const m = new Map<string, (AnswerData & { id: string })[]>();
    for (const r of reponses) m.set(r.formId, [...(m.get(r.formId) ?? []), r]);
    for (const l of m.values()) l.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    return m;
  }, [reponses]);
  const publies = tries.filter((f) => f.published).length;
  const adresse = (id: string) => (origine && org ? `${origine}/#/f?org=${encodeURIComponent(org.id)}&id=${encodeURIComponent(id)}` : null);

  const creer = async () => {
    const fields = champs.split('\n').map(lireChamp).filter((c): c is Champ => Boolean(c));
    if (!title.trim() || fields.length === 0) return;
    await upsert('forms', uid('frm'), { title: title.trim(), intro: intro.trim(), thanks: thanks.trim(), published: false, fields, createdAt: new Date().toISOString() });
    setTitle(''); setIntro(''); setThanks(''); setChamps(''); setOuvert(false);
  };
  const copier = async (id: string) => {
    const a = adresse(id);
    if (!a) return;
    try {
      await navigator.clipboard.writeText(a);
      setCopie(id);
      window.setTimeout(() => setCopie(null), 2000);
    } catch {
      /* presse-papiers refusé : l'adresse reste sélectionnable */
    }
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('formulaires.titre') })}
          title={t('formulaires.titre')}
          description={t('formulaires.description')}
          stats={[
            { label: t('formulaires.stat.formulaires'), value: tries.length },
            { label: t('formulaires.stat.publies'), value: publies },
            { label: t('formulaires.stat.reponses'), value: reponses.length, emphasis: reponses.length > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('formulaires.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('formulaires.champTitre')} aria-label={t('formulaires.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={t('formulaires.champIntro')} aria-label={t('formulaires.champIntro')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={champs} onChange={(e) => setChamps(e.target.value)} rows={5} placeholder={t('formulaires.champChamps')} aria-label={t('formulaires.champChamps')} className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none" />
          <input value={thanks} onChange={(e) => setThanks(e.target.value)} placeholder={t('formulaires.champMerci')} aria-label={t('formulaires.champMerci')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!title.trim() || !champs.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('formulaires.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {tries.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('formulaires.vide.titre')} action={{ label: t('formulaires.vide.action'), onClick: () => setOuvert(true) }}>{t('formulaires.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="flex flex-col gap-3">
          {tries.map((f) => {
            const liste = parFormulaire.get(f.id) ?? [];
            const a = adresse(f.id);
            return (
              <article key={f.id} className={`group rounded-xl border bg-surface p-4 ${f.published ? 'border-success/30' : 'border-border'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{f.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {f.published ? t('formulaires.publie') : t('formulaires.brouillon')} · {t('formulaires.champs', { n: f.fields.length })} · {t('formulaires.reponses', { n: liste.length })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => void upsert('forms', f.id, { ...f, published: !f.published })} aria-pressed={f.published} className="flex min-h-11 items-center gap-1 border border-border-strong px-2 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1">
                      {f.published ? <EyeOff size={11} /> : <Eye size={11} />} {f.published ? t('formulaires.depublier') : t('formulaires.publier')}
                    </button>
                    <button type="button" onClick={() => void remove('forms', f.id)} aria-label={t('formulaires.supprimer')} title={t('formulaires.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                  </div>
                </div>
                {f.published && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="eyebrow flex items-center gap-1"><Link2 size={11} /> {t('formulaires.adresse')}</p>
                    {a ? (
                      <>
                        <code className="min-w-0 flex-1 select-all truncate rounded-lg bg-bg px-3 py-1.5 font-mono text-xs text-text-primary">{a}</code>
                        <button type="button" onClick={() => void copier(f.id)} className="flex min-h-11 items-center gap-1 border border-border px-2 text-[11px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">{copie === f.id ? <Check size={11} /> : <Copy size={11} />} {copie === f.id ? t('formulaires.copie') : t('formulaires.copier')}</button>
                      </>
                    ) : (
                      <p className="text-xs text-text-muted">{t('formulaires.adresseAbsente')}</p>
                    )}
                  </div>
                )}
                <ul className="mt-2 flex flex-wrap gap-1">
                  {f.fields.map((c) => <li key={c.id} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-text-secondary">{c.label}{c.required ? ' *' : ''}</li>)}
                </ul>
                <button type="button" onClick={() => setDeplie((d) => (d === f.id ? null : f.id))} aria-expanded={deplie === f.id} className="mt-3 min-h-11 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">
                  {deplie === f.id ? t('formulaires.masquerReponses') : t('formulaires.voirReponses')}
                </button>
                {deplie === f.id && (
                  liste.length === 0 ? (
                    <p className="mt-2 text-xs text-text-muted">{t('formulaires.aucuneReponse')}</p>
                  ) : (
                    <ul className="mt-2 flex flex-col divide-y divide-border">
                      {liste.slice(0, 50).map((r) => (
                        <li key={r.id} className="group/rep flex gap-3 py-2">
                          <dl className="grid min-w-0 flex-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                            {f.fields.filter((c) => r.answers[c.id]).map((c) => (
                              <div key={c.id} className="min-w-0"><dt className="text-text-muted">{c.label}</dt><dd className="whitespace-pre-wrap text-text-primary">{r.answers[c.id]}</dd></div>
                            ))}
                          </dl>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('formulaires.recue', { quand: relativeTime(r.receivedAt) })}</span>
                            <button type="button" onClick={() => void remove('formAnswers', r.id)} aria-label={t('formulaires.supprimerReponse')} title={t('formulaires.supprimerReponse')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover/rep:opacity-100 md:min-h-0"><Trash2 size={12} /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </article>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}

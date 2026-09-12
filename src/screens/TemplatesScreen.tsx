import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface TemplateData {
  title: string;
  body: string;
  createdAt: string;
}
/** Les trous d'un modèle : « {prénom} », « {date} »… dans l'ordre d'apparition, sans doublon. */
export function trousDe(body: string): string[] {
  const vus = new Set<string>();
  for (const m of body.matchAll(/\{([^{}]{1,40})\}/g)) vus.add(m[1].trim());
  return [...vus];
}
export function remplir(body: string, valeurs: Record<string, string>): string {
  return body.replace(/\{([^{}]{1,40})\}/g, (tout, cle: string) => valeurs[cle.trim()] || tout);
}

/**
 * LES MODÈLES — des textes prêts, à trous.
 *
 * Pour qui : quelqu'un qui réécrit le même message dix fois par semaine — la
 * confirmation de commande, la réponse au devis, le rappel de rendez-vous.
 * Ce que ça règle : un texte avec des trous nommés entre accolades, remplis
 * en un geste, copié. Les Relances et la Lettre ont leur texte propre ; les
 * modèles servent à tout le reste.
 *
 * ## Ce qui domine : le modèle en train d'être rempli
 *
 * L'écran était un rail de 18 rem et un panneau — le QUATRIÈME rail vertical
 * de l'application après Notes, Pages et Contrôles, et le deuxième retiré dans
 * ce chantier après celui de Groupes. À l'ouverture : une colonne de titres et
 * un « Choisissez un modèle » perdu au milieu de la place restante.
 *
 * Or un modèle n'est pas un document qu'on choisit dans une liste : c'est un
 * FORMULAIRE. Ses trous — `{prénom}`, `{date}` — sont des champs, et le geste
 * de l'écran est de les remplir puis de copier. Le premier modèle s'ouvre donc
 * de lui-même, ses champs en tête, le rendu dessous, et la liste passe en
 * bande horizontale au-dessus avec le nombre de trous de chacun.
 *
 * ## L'ambre
 *
 * Sur les trous qui restent. C'est la seule chose que cet écran demande de
 * décider — copier un modèle avec un `{prénom}` non remplacé est précisément
 * la faute qu'il existe pour éviter. Quand tout est rempli, l'ambre disparaît
 * et le bouton de copie redevient ordinaire.
 */
export function TemplatesScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<TemplateData>('templates');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [actif, setActif] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [copie, setCopie] = useState(false);

  const modeles = useMemo(() => [...brutes].sort((a, b) => a.title.localeCompare(b.title, 'fr')), [brutes]);
  /* Le premier s'ouvre de lui-même : un écran de modèles qui n'en montre aucun
     fait perdre un clic à chaque visite, et ne montre rien de ce qu'il fait. */
  const courant = modeles.find((m) => m.id === actif) ?? modeles[0] ?? null;
  const trous = courant ? trousDe(courant.body) : [];
  const resultat = courant ? remplir(courant.body, valeurs) : '';
  /* Un trou reste vide tant que sa valeur est vide : `remplir` laisse alors
     l'accolade en place, et c'est ce qu'il ne faut pas copier. */
  const restants = trous.filter((trou) => !(valeurs[trou] ?? '').trim());
  /* Zéro, un, plusieurs : trois phrases écrites plutôt qu'un « trou(s) ». */
  const ditLesTrous = (n: number) => (n === 0 ? t('modeles.trousAucun') : n === 1 ? t('modeles.trouUn') : t('modeles.trous', { n }));
  const trousTotal = modeles.reduce((n, m) => n + trousDe(m.body).length, 0);

  const creer = async () => {
    if (!title.trim() || !body.trim()) return;
    await upsert('templates', uid('tpl'), { title: title.trim(), body: body.trim(), createdAt: new Date().toISOString() });
    setTitle(''); setBody(''); setOuvert(false);
  };
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(resultat);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé : le texte reste sélectionnable */
    }
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('outils.surtitre', { module: t('modeles.titre') })}
          title={t('modeles.titre')}
          description={t('modeles.description')}
          stats={[
            { label: t('modeles.stat.modeles'), value: modeles.length },
            { label: t('modeles.stat.trous'), value: trousTotal },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('modeles.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('modeles.champTitre')} aria-label={t('modeles.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={t('modeles.champTexte')} aria-label={t('modeles.champTexte')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <p className="text-xs text-text-muted">{t('modeles.aide')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!title.trim() || !body.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('modeles.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {modeles.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('modeles.vide.titre')} action={{ label: t('modeles.vide.action'), onClick: () => setOuvert(true) }}>{t('modeles.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* LA BANDE DES MODÈLES — pas un rail. Le nombre de trous dit d'un
              coup lequel demande du travail. */}
          <motion.section variants={staggerItem} className="panel">
            <p className="eyebrow border-b border-border px-4 py-2.5">{t('modeles.laBande')}</p>
            <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {modeles.map((m) => {
                const n = trousDe(m.body).length;
                const ouvertCelui = courant?.id === m.id;
                return (
                  <li key={m.id} className="group relative flex bg-surface">
                    <button
                      type="button"
                      onClick={() => { setActif(m.id); setValeurs({}); }}
                      aria-pressed={ouvertCelui}
                      className={`input-focus flex min-h-11 w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${ouvertCelui ? 'bg-elevated' : 'hover:bg-surface-hover'}`}
                    >
                      <span className="truncate text-sm text-text-primary">{m.title}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{ditLesTrous(n)}</span>
                    </button>
                    <button type="button" onClick={() => void remove('templates', m.id)} aria-label={t('modeles.supprimer')} title={t('modeles.supprimer')} className="absolute right-2 top-2 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 size={13} /></button>
                  </li>
                );
              })}
            </ul>
          </motion.section>

          {/* LE MODÈLE EN TRAIN D'ÊTRE REMPLI — l'objet dominant : un
              formulaire, pas un document qu'on choisit. */}
          {courant && (
            <motion.section variants={staggerItem} aria-label={courant.title} className="panel-raised p-5 sm:p-6" data-signal-groupe="trous-restants">
              {trous.length > 0 && (
                <p
                  className={`mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    restants.length > 0 ? 'signal-plate' : 'border border-border-strong text-text-secondary'
                  }`}
                >
                  {restants.length === 0
                    ? t('modeles.pretACopier')
                    : restants.length === 1
                      ? t('modeles.ilResteUn')
                      : t('modeles.ilResteN', { n: restants.length })}
                </p>
              )}
              <h2 className="text-[19px] font-semibold leading-tight text-text-primary sm:text-[23px]">{courant.title}</h2>

              {trous.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {trous.map((trou) => (
                    <label key={trou} className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{trou}</span>
                      <input
                        value={valeurs[trou] ?? ''}
                        onChange={(e) => setValeurs((v) => ({ ...v, [trou]: e.target.value }))}
                        placeholder={trou}
                        aria-label={trou}
                        className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-text-secondary">{t('modeles.sansTrou')}</p>
              )}

              <pre className="mt-5 whitespace-pre-wrap border border-border bg-bg px-4 py-3.5 font-sans text-sm leading-relaxed text-text-primary">{resultat}</pre>

              <button
                type="button"
                onClick={() => void copier()}
                className="mt-4 flex min-h-11 w-fit items-center gap-2 bg-accent px-5 text-sm font-semibold text-bg md:min-h-0 md:py-2.5"
              >
                {copie ? <Check size={14} /> : <Copy size={14} />} {copie ? t('modeles.copie') : t('modeles.copier')}
              </button>
            </motion.section>
          )}
        </>
      )}
    </motion.section>
  );
}

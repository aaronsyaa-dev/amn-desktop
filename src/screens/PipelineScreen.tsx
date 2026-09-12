import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { formatCents } from '../lib/money';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Stage = 'contact' | 'qualifie' | 'proposition' | 'gagne' | 'perdu';
interface ProspectData {
  name: string;
  company: string;
  valueCents: number;
  stage: Stage;
  note: string;
  createdAt: string;
  movedAt: string;
}
const STAGES: Stage[] = ['contact', 'qualifie', 'proposition', 'gagne', 'perdu'];
const SUIVANT: Record<Stage, Stage | null> = { contact: 'qualifie', qualifie: 'proposition', proposition: 'gagne', gagne: null, perdu: null };

/**
 * LE PIPELINE COMMERCIAL — d'où viendra le prochain client.
 *
 * Pour qui : une indépendante ou une petite boutique qui a « des gens en
 * cours » dans sa tête et nulle part ailleurs. Ce que ça règle : cinq
 * colonnes, de « contact » à « gagné » ou « perdu », et le montant qu'on
 * espère par colonne. Un prospect gagné devient une fiche client en un geste
 * dans Clients ; ici on ne fait qu'avancer. Trello fait des colonnes pour
 * tout ; celles-ci ont un sens fixe et un total en euros, c'est ce qui rend
 * la lecture immédiate.
 *
 * ## Ce qui domine : l'argent, en barres — pas les fiches, en colonnes
 *
 * Cet écran et le Tableau des projets étaient LE MÊME COMPOSANT : colonnes en
 * `auto-fit`, cartes de poids égal, bouton fléché par carte. Le fichier disait
 * pourtant déjà où était la différence, en tête : « celles-ci ont un sens fixe
 * et UN TOTAL EN EUROS, c'est ce qui rend la lecture immédiate ». Le total en
 * euros vivait dans un relevé d'en-tête, et les colonnes comptaient des
 * cartes.
 *
 * L'entonnoir devient donc l'objet dominant : une ligne par étape, une barre
 * dont la longueur est l'ARGENT à cette étape, le nombre de fiches en petit à
 * côté. Deux fiches à 12 000 € pèsent plus que six à 400 €, et c'est ce qu'on
 * veut voir sans additionner. Les fiches descendent sous l'entonnoir, en
 * registre.
 *
 * ## L'ambre
 *
 * Sur le prospect qui DORT — le plus longtemps sans changer d'étape, au-delà
 * de quinze jours. C'est la seule décision qu'un pipeline réclame : un
 * prospect qu'on laisse dormir n'est ni gagné ni perdu, il occupe une colonne
 * et gonfle le total espéré d'un argent qui ne viendra pas. Gagné et perdu
 * sont des états, jamais ambre.
 */
export function PipelineScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<ProspectData>('prospects');
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const parEtape = useMemo(() => {
    const m: Record<Stage, (ProspectData & { id: string })[]> = { contact: [], qualifie: [], proposition: [], gagne: [], perdu: [] };
    for (const p of brutes) (m[p.stage] ?? m.contact).push(p);
    for (const k of STAGES) m[k].sort((a, b) => b.movedAt.localeCompare(a.movedAt));
    return m;
  }, [brutes]);
  const enCours = STAGES.filter((s) => s !== 'gagne' && s !== 'perdu').flatMap((s) => parEtape[s]);
  const espere = enCours.reduce((n, p) => n + (p.valueCents || 0), 0);
  const gagne = parEtape.gagne.reduce((n, p) => n + (p.valueCents || 0), 0);

  /*
    L'ENTONNOIR — l'argent par étape, et l'échelle qui le dessine.

    La barre se mesure sur l'étape la plus riche, pas sur le total : sinon,
    avec un « gagné » à 9 000 € et un « contact » à 400 €, la seconde barre
    ferait deux pixels et ne dirait plus rien.
  */
  const argentDe = (s: Stage) => parEtape[s].reduce((n, p) => n + (p.valueCents || 0), 0);
  const plusRiche = Math.max(1, ...STAGES.map(argentDe));

  /*
    CELUI QUI DORT — au-delà de quinze jours sans changer d'étape.

    Gagné et perdu sont exclus : une affaire signée n'a plus à bouger. Le seuil
    est celui qu'un cycle commercial court rend raisonnable ; il est écrit ici
    et nulle part ailleurs.
  */
  const SEUIL_SOMMEIL = 15;
  const joursDepuis = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
  const dort = useMemo(() => {
    const candidats = enCours
      .filter((p) => joursDepuis(p.movedAt) > SEUIL_SOMMEIL)
      .sort((a, b) => a.movedAt.localeCompare(b.movedAt));
    return candidats[0] ?? null;
  }, [enCours]);

  const ajouter = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    await upsert('prospects', uid('pro'), { name: name.trim(), company: company.trim(), valueCents: Math.round((Number(value.replace(',', '.')) || 0) * 100), stage: 'contact', note: note.trim(), createdAt: now, movedAt: now });
    setName(''); setCompany(''); setValue(''); setNote(''); setOuvert(false);
  };
  const deplacer = (p: ProspectData & { id: string }, stage: Stage) => upsert('prospects', p.id, { ...p, stage, movedAt: new Date().toISOString() });
  const etape = (s: Stage) => t(`pipeline.etape.${s}` as Parameters<typeof t>[0]);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('pipeline.titre') })}
          title={t('pipeline.titre')}
          description={t('pipeline.description')}
          stats={[
            { label: t('pipeline.stat.enCours'), value: enCours.length },
            { label: t('pipeline.stat.espere'), value: formatCents(espere) },
            { label: t('pipeline.stat.gagne'), value: formatCents(gagne), emphasis: gagne > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('pipeline.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pipeline.champNom')} aria-label={t('pipeline.champNom')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('pipeline.champSociete')} aria-label={t('pipeline.champSociete')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={t('pipeline.champMontant')} aria-label={t('pipeline.champMontant')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pipeline.champNote')} aria-label={t('pipeline.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!name.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('pipeline.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {brutes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('pipeline.vide.titre')} action={{ label: t('pipeline.vide.action'), onClick: () => setOuvert(true) }}>{t('pipeline.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* CELUI QUI DORT — la seule décision de l'écran. */}
          <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6" data-signal-groupe="dort">
            {dort ? (
              <>
                <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">
                  {t('pipeline.dort', { n: joursDepuis(dort.movedAt) })}
                </p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">
                  {t('pipeline.dortTitre', { nom: dort.name, n: joursDepuis(dort.movedAt) })}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('pipeline.dortAide')}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {etape(dort.stage)} · {dort.valueCents ? formatCents(dort.valueCents) : t('pipeline.aucunMontant')}
                  </span>
                  {SUIVANT[dort.stage] && (
                    <button type="button" onClick={() => void deplacer(dort, SUIVANT[dort.stage] as Stage)} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-sm text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2">
                      {etape(SUIVANT[dort.stage] as Stage)} <ArrowRight size={13} />
                    </button>
                  )}
                  <button type="button" onClick={() => void deplacer(dort, 'perdu')} className="flex min-h-11 items-center border border-border px-3 text-sm text-text-secondary hover:text-text-primary md:min-h-0 md:py-2">
                    {etape('perdu')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">{t('pipeline.entonnoir')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{t('pipeline.rienNeDort')}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('pipeline.rienNeDortAide')}</p>
              </>
            )}
          </motion.section>

          {/*
            L'ENTONNOIR — des barres en euros, pas des colonnes de cartes.
            Voir l'en-tête du fichier pour l'écart avec le Tableau des projets.
          */}
          <motion.section variants={staggerItem} className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="eyebrow">{t('pipeline.entonnoir')}</p>
              <p className="text-[11px] text-text-muted">{t('pipeline.entonnoirAide')}</p>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {STAGES.map((s) => {
                const argent = argentDe(s);
                const part = Math.round((argent / plusRiche) * 100);
                return (
                  <li key={s} className="flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 text-sm text-text-primary">{etape(s)}</span>
                    {/*
                      LA BARRE — mesurée au navigateur avant d'être gardée.

                      Premier essai : piste `bg-bg` (#060606), remplissage
                      `bg-elevated` (#121212), dans un panneau `bg-surface`
                      (#0d0d0d). Douze valeurs d'écart entre le remplissage et
                      la piste, et une piste PLUS SOMBRE que le panneau : l'œil
                      lisait la piste comme la barre et le reste comme du fond,
                      donc les barres semblaient inversées. Mesuré, pas deviné.

                      `border-strong` (#3a3a3a) contre le panneau (#0d0d0d)
                      tranche pour de bon, et la piste redevient le fond du
                      panneau — un seul plan au lieu de trois.
                    */}
                    <span className="relative flex h-8 min-w-0 flex-1 items-center border border-border">
                      <span
                        className={`absolute inset-y-0 left-0 ${s === 'gagne' ? 'bg-success/40' : s === 'perdu' ? 'bg-border' : 'bg-border-strong'}`}
                        style={{ width: `${part}%` }}
                        aria-hidden
                      />
                      <span className="relative px-2.5 text-sm tabular-nums text-text-primary">{argent ? formatCents(argent) : '—'}</span>
                    </span>
                    <span className="w-10 flex-shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted tabular-nums">{parEtape[s].length}</span>
                  </li>
                );
              })}
            </ul>
          </motion.section>

          {/* LES FICHES — le détail, sous l'entonnoir, une ligne chacune. */}
          <motion.section variants={staggerItem} className="panel">
            <p className="eyebrow border-b border-border px-4 py-2.5">{t('pipeline.lesFiches')}</p>
            <ul className="flex flex-col gap-px bg-border">
              {STAGES.flatMap((s) => parEtape[s].map((p) => ({ p, s }))).map(({ p, s }) => (
                <li key={p.id} className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-4 py-2.5">
                  <span className="w-24 flex-shrink-0 font-mono text-[9px] uppercase tracking-wider text-text-muted">{etape(s)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm text-text-primary">{p.name}</span>
                    {p.company && <span className="text-sm text-text-muted"> · {p.company}</span>}
                    {p.note && <span className="block truncate text-xs text-text-muted">{p.note}</span>}
                  </span>
                  <span className="w-24 flex-shrink-0 text-right text-sm tabular-nums text-text-secondary">{p.valueCents ? formatCents(p.valueCents) : '—'}</span>
                  <span className="w-24 flex-shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">{relativeTime(p.movedAt)}</span>
                  <span className="flex flex-shrink-0 gap-2">
                    {SUIVANT[s] && (
                      <button type="button" onClick={() => void deplacer(p, SUIVANT[s] as Stage)} className="flex min-h-11 items-center gap-1 border border-border-strong px-2 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1">
                        {etape(SUIVANT[s] as Stage)} <ArrowRight size={11} />
                      </button>
                    )}
                    {s !== 'perdu' && s !== 'gagne' && (
                      <button type="button" onClick={() => void deplacer(p, 'perdu')} className="min-h-11 border border-border px-2 text-[11px] text-text-muted hover:text-text-primary md:min-h-0 md:py-1">{etape('perdu')}</button>
                    )}
                    <button type="button" onClick={() => void remove('prospects', p.id)} aria-label={t('pipeline.supprimer')} title={t('pipeline.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={12} /></button>
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      )}
    </motion.section>
  );
}

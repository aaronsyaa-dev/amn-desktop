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
import { useHaloSignal } from '../components/EtatEcran';

type Stage = 'contact' | 'qualifie' | 'proposition' | 'gagne' | 'perdu';
interface ProspectData {
  name: string;
  company: string;
  valueCents: number;
  stage: Stage;
  note: string;
  /**
   * D'OÙ VIENT CE PROSPECT — un champ à lui, pas une phrase dans `note`.
   *
   * `MODULES.md` demande la provenance en trois barres, avec le fait que les
   * gagnés viennent tous du bouche à oreille. Le déduire d'un texte libre
   * serait deviner ; le produit n'avait pas le champ, il l'a maintenant.
   * Absent sur les fiches écrites avant, et l'écran les compte à part plutôt
   * que de leur attribuer une origine au hasard.
   */
  source?: string;
  createdAt: string;
  movedAt: string;
}

/**
 * LES TROIS PROVENANCES CONNUES. Tout le reste se compte dans « autre » —
 * c'est plus honnête qu'une quatrième barre par orthographe.
 */
const PROVENANCES = [
  { cle: 'bouche', label: 'Bouche à oreille', teinte: '#4a4a48' },
  { cle: 'site', label: 'Site public', teinte: 'var(--color-border-strong)' },
  { cle: 'salon', label: 'Salon, marché', teinte: '#2b2b2b' },
] as const;

/**
 * L'ENTONNOIR — quatre bandes centrées, de largeur proportionnelle (`14e`).
 *
 * Un pipeline n'est pas une somme de colonnes, c'est un RÉTRÉCISSEMENT, et le
 * seul renseignement utile est l'endroit où il se resserre le plus. D'où la
 * chute ÉCRITE ENTRE les bandes — un trait horizontal et un pourcentage de
 * perte — plutôt que quatre nombres qu'il faudrait diviser de tête.
 *
 * LES BANDES SONT CUMULATIVES : qui est au stade « devis envoyé » est passé
 * par « qualifié ». Une bande compte donc les fiches à ce stade OU AU-DELÀ,
 * sinon l'entonnoir s'élargirait dès qu'on avance une fiche.
 *
 * LES PERDUS N'Y SONT PAS, et c'est dit à l'écran : le modèle ne garde pas
 * l'historique d'étapes, donc on ne sait pas jusqu'où un perdu était monté.
 * Le ranger dans la première bande lui inventerait un parcours.
 */
const BANDES: { stage: Stage; label: string }[] = [
  { stage: 'contact', label: 'Contact' },
  { stage: 'qualifie', label: 'Qualifié' },
  { stage: 'proposition', label: 'Devis envoyé' },
  { stage: 'gagne', label: 'Gagné' },
];
const BANDE_H = 52;
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
    L'ANCIEN ENTONNOIR EN EUROS A ÉTÉ RETIRÉ.

    Il mesurait chaque étape en ARGENT, sur l'étape la plus riche. C'était une
    bonne idée tant que l'objet était une liste de barres ; ce n'en est plus
    une depuis que l'objet est un rétrécissement. Un entonnoir en euros ne
    rétrécit pas forcément — deux fiches à 12 000 € au stade « devis » pèsent
    plus que six à 400 € au stade « contact », et la bande du bas serait la
    plus large. Ce qui rétrécit, ce sont les EFFECTIFS, et c'est d'eux que les
    largeurs se déduisent maintenant. L'argent reste lisible là où il sert :
    en relevé d'en-tête (« espéré », « gagné ») et sur chaque fiche.
  */

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

  /* ------------------------------------------- l'entonnoir (`14e`) ----- */

  /*
    LES LARGEURS SE DÉDUISENT DES EFFECTIFS, et les chutes des différences
    entre bandes consécutives. Rien n'est posé à la main : une bande dessinée
    au jugé se déplace au premier prospect ajouté, et l'écran changerait
    d'avis sans que rien n'ait changé.
  */
  const entonnoir = useMemo(() => {
    const rang = (st: Stage) => BANDES.findIndex((b) => b.stage === st);
    const vivants = brutes.filter((pr) => pr.stage !== 'perdu');
    const bandes = BANDES.map((b) => ({
      ...b,
      effectif: vivants.filter((pr) => rang(pr.stage) >= rang(b.stage)).length,
    }));
    const haut = Math.max(1, bandes[0].effectif);
    return bandes.map((b, i) => {
      const suivante = bandes[i + 1];
      return {
        ...b,
        largeur: (b.effectif / haut) * 100,
        chute:
          suivante && b.effectif > 0
            ? {
                perdus: b.effectif - suivante.effectif,
                part: ((b.effectif - suivante.effectif) / b.effectif) * 100,
              }
            : null,
      };
    });
  }, [brutes]);

  /* LA FUITE : la chute la plus forte. C'est le seul renseignement utile
     qu'un entonnoir donne, et c'est lui qui porte l'ambre. */
  const fuite = useMemo(() => {
    const avecChute = entonnoir.filter((b) => b.chute && b.chute.perdus > 0);
    return avecChute.sort((a, b) => (b.chute?.part ?? 0) - (a.chute?.part ?? 0))[0] ?? null;
  }, [entonnoir]);
  const halo = useHaloSignal(!!fuite);

  /* LA PROVENANCE — comptée sur le champ `source`, jamais devinée d'une note. */
  const provenance = useMemo(() => {
    const total = brutes.length;
    const compte = (cle: string) => brutes.filter((pr) => (pr.source ?? '') === cle).length;
    const connus = PROVENANCES.map((pv) => ({ ...pv, n: compte(pv.cle) }));
    const sans = total - connus.reduce((n, c) => n + c.n, 0);
    const gagnes = parEtape.gagne;
    const gagnesBouche = gagnes.filter((pr) => pr.source === 'bouche').length;
    return { connus, sans, total, gagnes: gagnes.length, gagnesBouche };
  }, [brutes, parEtape]);

  /* LES QUALIFIÉS SANS DEVIS — ceux que la fuite désigne, nommés. */
  const qualifiesSansDevis = useMemo(
    () => [...parEtape.qualifie].sort((a, b) => a.movedAt.localeCompare(b.movedAt)),
    [parEtape],
  );

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
          {/* ── L'ENTONNOIR — l'objet dominant (`14e`) ──────────────────── */}
          <motion.section variants={staggerItem} className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              {/*
                L'INTITULÉ NE DIT PLUS « L'ARGENT PAR ÉTAPE ».

                C'était vrai de l'ancien objet, qui mesurait des euros ; les
                bandes comptent des FICHES. Garder la clé i18n `pipeline.
                entonnoir` aurait laissé un titre qui décrit autre chose que ce
                qu'on regarde — le genre d'écart qu'on ne voit plus au bout de
                deux jours, et qui fait lire le chiffre de travers.
              */}
              <p className="eyebrow">Le rétrécissement · {entonnoir[0]?.effectif ?? 0} fiches</p>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                un pipeline n’est pas une somme, c’est un rétrécissement
              </p>
            </div>

            <div className="mx-auto flex max-w-[640px] flex-col">
              {entonnoir.map((bande) => {
                const signal = fuite?.stage === bande.stage;
                return (
                  <React.Fragment key={bande.stage}>
                    {/* LA BANDE, centrée sur le même axe vertical que les autres. */}
                    <div
                      className="mx-auto flex items-center justify-between gap-4 bg-[#2b2b2b] px-4"
                      style={{ width: `${Math.max(6, bande.largeur)}%`, height: BANDE_H }}
                    >
                      <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                        {bande.label}
                      </span>
                      <span className="tnum flex-shrink-0 font-mono text-[20px] font-semibold tracking-[-0.03em] text-text-primary">
                        {bande.effectif}
                      </span>
                    </div>

                    {/* LA CHUTE, ÉCRITE ENTRE LES BANDES. C'est elle le sujet :
                        un trait, un pourcentage de perte, et pour la plus forte
                        la mention qui la nomme. */}
                    {bande.chute && (
                      <div className="flex items-center justify-center gap-3 py-3">
                        <span
                          className={`h-px ${signal ? `bg-signal ${halo}` : 'bg-border-strong'}`}
                          style={{ width: signal ? 96 : 52 }}
                          data-signal-groupe={signal ? 'fuite' : undefined}
                          aria-hidden
                        />
                        <span
                          className={`tnum font-mono text-[13px] tracking-[0.06em] ${
                            signal ? 'font-bold text-signal' : 'text-text-muted'
                          }`}
                          data-signal-groupe={signal ? 'fuite' : undefined}
                        >
                          − {Math.round(bande.chute.part)} %
                        </span>
                        {signal && (
                          <span
                            className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-signal"
                            data-signal-groupe="fuite"
                          >
                            la fuite est ici
                          </span>
                        )}
                        <span
                          className={`h-px ${signal ? `bg-signal ${halo}` : 'bg-border-strong'}`}
                          style={{ width: signal ? 96 : 52 }}
                          aria-hidden
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <p className="mt-6 border-t border-border-row pt-3 text-center text-[12.5px] leading-relaxed text-text-muted">
              Les bandes sont CUMULATIVES : qui est au stade « devis envoyé » est passé par
              « qualifié ». Les {parEtape.perdu.length} perdus n’y figurent pas — le produit ne
              garde pas l’historique d’étapes, donc on ne sait pas jusqu’où ils étaient montés, et
              les ranger dans la première bande leur inventerait un parcours.
            </p>
          </motion.section>

          {/* ── Les qualifiés sans devis, et la provenance ───────────────── */}
          <motion.div variants={staggerItem} className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
            <section className="panel px-5 py-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="eyebrow">Qualifiés, sans devis envoyé</p>
                <p className="tnum font-mono text-[13px] font-semibold text-text-primary">
                  {qualifiesSansDevis.length}
                </p>
              </div>
              {qualifiesSansDevis.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  Tout ce qui est qualifié a reçu son devis.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border-row">
                  {qualifiesSansDevis.map((pr) => (
                    <div key={pr.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-text-primary">
                          {pr.name}
                          {pr.company && <span className="text-text-muted"> · {pr.company}</span>}
                        </span>
                        {pr.note && (
                          <span className="block truncate text-[12px] text-text-muted">{pr.note}</span>
                        )}
                      </span>
                      <span className="tnum w-[92px] flex-shrink-0 text-right font-mono text-[12.5px] text-text-secondary">
                        {pr.valueCents ? formatCents(pr.valueCents) : '—'}
                      </span>
                      <span className="tnum w-[84px] flex-shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        {joursDepuis(pr.movedAt)} j
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {dort && (
                <p className="mt-4 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                  {dort.name} n’a pas bougé depuis {joursDepuis(dort.movedAt)} jours — ni gagné ni
                  perdu, il occupe une place et gonfle le total espéré d’un argent qui ne viendra
                  peut-être pas.{' '}
                  {SUIVANT[dort.stage] && (
                    <button
                      type="button"
                      onClick={() => void deplacer(dort, SUIVANT[dort.stage] as Stage)}
                      className="font-semibold text-text-primary underline-offset-4 hover:underline"
                    >
                      Le passer en {etape(SUIVANT[dort.stage] as Stage).toLowerCase()}
                    </button>
                  )}
                </p>
              )}
            </section>

            <section className="panel flex flex-col px-5 py-4">
              <p className="eyebrow mb-3">D’où ils viennent</p>
              <div className="flex flex-col gap-2.5">
                {provenance.connus.map((pv) => (
                  <div key={pv.cle} className="flex items-center gap-3">
                    <span className="w-[112px] flex-shrink-0 truncate text-[12.5px] text-text-secondary">
                      {pv.label}
                    </span>
                    <span className="h-[6px] min-w-0 flex-1 bg-sunken" aria-hidden>
                      <span
                        className="block h-full"
                        style={{
                          width: `${provenance.total > 0 ? (pv.n / provenance.total) * 100 : 0}%`,
                          background: pv.teinte,
                        }}
                      />
                    </span>
                    <span className="tnum w-6 flex-shrink-0 text-right font-mono text-[12.5px] text-text-primary">
                      {pv.n}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-text-muted">
                {provenance.gagnes === 0
                  ? 'Aucun gagné pour l’instant : la provenance qui convertit reste à découvrir.'
                  : provenance.gagnesBouche === provenance.gagnes
                    ? `Les ${provenance.gagnes} gagnés viennent TOUS du bouche à oreille.`
                    : `${provenance.gagnesBouche} des ${provenance.gagnes} gagnés viennent du bouche à oreille.`}
                {provenance.sans > 0 && (
                  <>
                    {' '}
                    {provenance.sans} fiche{provenance.sans > 1 ? 's' : ''} sans provenance notée —
                    écrite{provenance.sans > 1 ? 's' : ''} avant que le champ existe, et comptée
                    {provenance.sans > 1 ? 's' : ''} à part plutôt que rangée au hasard.
                  </>
                )}
              </p>
            </section>
          </motion.div>

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

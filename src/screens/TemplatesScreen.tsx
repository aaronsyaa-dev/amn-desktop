import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';
import { relativeTime } from '../lib/time';

interface TemplateData {
  title: string;
  body: string;
  createdAt: string;
  /*
    DEUX CHAMPS AJOUTÉS AU MODÈLE, pour que l'étagère ne mente pas.

    `MODULES.md` (`18d`) fait de l'ÉPAISSEUR d'une tranche le nombre
    d'emplois. Le produit ne comptait rien : chaque modèle aurait eu la même
    tranche, et l'étagère — dont tout l'intérêt est que « ce qui sert est
    épais et se voit de loin » — n'aurait rien montré.

    Le compteur est incrémenté par le geste de COPIE, et par lui seul. Ouvrir
    un modèle pour le relire n'est pas l'employer ; c'est le texte copié qui
    part chez quelqu'un. `lastUsedAt` dit quand, ce qui permet de comparer
    l'emploi à la dernière retouche.
  */
  uses?: number;
  lastUsedAt?: string;
  /*
    LE NOM DU CHAMP N'EST PAS `updatedAt`, ET C'EST DÉLIBÉRÉ.

    La couche de synchronisation pose son propre `updatedAt` sur chaque
    enregistrement — l'horodatage de la dernière ÉCRITURE, quelle qu'elle
    soit. Un champ métier du même nom est écrasé par elle : sur le bac à
    sable, « jamais retouché » devenait « retouché il y a une minute » au
    premier semis, et le relevé « jamais retouchés » comptait zéro.
  */
  editedAt?: string;
}

/* ─── L'ÉTAGÈRE — l'objet dominant des Modèles (`18d`) ────────────────────── */

/*
  LES MODÈLES SONT RANGÉS DE CHANT, COMME DES LIVRES.

  L'ÉPAISSEUR de la tranche est le nombre d'emplois ; la HAUTEUR est la
  longueur du document. Ce sont DEUX DIMENSIONS INDÉPENDANTES, et les
  confondre est l'erreur qui rendrait l'objet illisible : un modèle long et
  jamais employé doit être une tranche haute et fine, pas une petite tranche.

  Ce qui sert est épais et se voit de loin ; ce qui ne sert pas est une
  tranche fine qu'on peut retirer sans y penser — et c'est exactement la
  décision que cet écran permet de prendre d'un coup d'œil.

  Un socle de 3 px ferme l'étagère : sans lui, les tranches flottent et
  l'objet redevient un graphique en barres.
*/
const TRANCHE_MIN = 11;
const TRANCHE_MAX = 92;
const ETAGERE_H_MIN = 92;
const ETAGERE_H_MAX = 210;
const SOCLE_H = 3;

interface TrancheDeModele {
  id: string;
  titre: string;
  emplois: number;
  signes: number;
  epaisseur: number;
  hauteur: number;
}

/**
 * Les tranches, dans l'ordre alphabétique de l'étagère.
 *
 * L'épaisseur est proportionnelle aux emplois, la hauteur à la longueur —
 * chacune sur sa propre échelle, ramenée au plus grand de sa dimension. Un
 * modèle jamais employé garde la tranche MINIMALE : il existe, il se voit,
 * il est simplement mince.
 */
function etagereDe(modeles: (TemplateData & { id: string })[]): TrancheDeModele[] {
  const emploisMax = Math.max(1, ...modeles.map((m) => m.uses ?? 0));
  const signesMax = Math.max(1, ...modeles.map((m) => m.body.length));
  return modeles.map((m) => {
    const emplois = m.uses ?? 0;
    const signes = m.body.length;
    return {
      id: m.id,
      titre: m.title,
      emplois,
      signes,
      epaisseur: TRANCHE_MIN + (emplois / emploisMax) * (TRANCHE_MAX - TRANCHE_MIN),
      hauteur: ETAGERE_H_MIN + (signes / signesMax) * (ETAGERE_H_MAX - ETAGERE_H_MIN),
    };
  });
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

  /*
    L'ÉTAGÈRE, et la tranche qui porte l'ambre : la PLUS ÉPAISSE, c'est-à-dire
    la plus employée. Ce n'est pas un défaut — c'est l'objet qui compte le
    plus, et donc celui dont une retouche oubliée coûte le plus cher. Quand
    rien n'a jamais été employé, il n'y a pas de plus épaisse : pas d'ambre.
  */
  const etagere = useMemo(() => etagereDe(modeles), [modeles]);
  const trancheAmbre = useMemo(() => {
    const employees = etagere.filter((t) => t.emplois > 0);
    return employees.reduce<TrancheDeModele | null>(
      (max, t) => (!max || t.emplois > max.emplois ? t : max),
      null,
    );
  }, [etagere]);
  const halo = useHaloSignal(trancheAmbre !== null);

  const modeleAmbre = trancheAmbre ? modeles.find((m) => m.id === trancheAmbre.id) ?? null : null;
  const emploisTotal = modeles.reduce((n, m) => n + (m.uses ?? 0), 0);
  const jamaisRetouches = modeles.filter((m) => !m.editedAt).length;

  const creer = async () => {
    if (!title.trim() || !body.trim()) return;
    await upsert('templates', uid('tpl'), { title: title.trim(), body: body.trim(), createdAt: new Date().toISOString() });
    setTitle(''); setBody(''); setOuvert(false);
  };
  const copier = async () => {
    if (!courant) return;
    try {
      await navigator.clipboard.writeText(resultat);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
      /*
        L'EMPLOI SE COMPTE ICI, et nulle part ailleurs.

        C'est le texte COPIÉ qui part chez quelqu'un ; ouvrir un modèle pour
        le relire n'est pas l'employer. Compter l'ouverture aurait fait
        grossir la tranche du modèle qu'on consulte le plus, pas de celui
        qu'on utilise le plus — ce qui est presque l'inverse.

        L'écriture ne se fait qu'APRÈS la copie réussie : si le presse-papiers
        refuse, rien n'est parti, et rien ne doit être compté.
      */
      await upsert('templates', courant.id, {
        ...courant,
        uses: (courant.uses ?? 0) + 1,
        lastUsedAt: new Date().toISOString(),
      });
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
            /* `18d` demande « modèles, emplois de l'année, jamais retouchés ».
               Les trois se calculent, les trois sont ici — un relevé d'en-tête
               vaut mieux qu'une quatrième carte pour trois nombres. */
            { label: 'Emplois', value: emploisTotal },
            { label: 'Jamais retouchés', value: jamaisRetouches },
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
          {/* ── L'ÉTAGÈRE — l'objet dominant (`18d`) ─────────────────────── */}
          <motion.section variants={staggerItem} className="panel-raised panel-raised-wide p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="eyebrow">L’étagère · {emploisTotal} emploi{emploisTotal > 1 ? 's' : ''}</p>
              <p className="max-w-xs font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.18em] text-text-muted">
                l’épaisseur est l’usage, la hauteur est la longueur
              </p>
            </div>

            {/* LES TRANCHES, posées sur leur socle. L'alignement est en BAS :
                une étagère porte ses livres par le bas, pas par le haut. */}
            <div className="mt-5 overflow-x-auto">
              <div className="inline-flex items-end gap-1.5">
                {etagere.map((tranche) => {
                  const signal = trancheAmbre?.id === tranche.id;
                  const ouvertCelui = courant?.id === tranche.id;
                  return (
                    <button
                      key={tranche.id}
                      type="button"
                      onClick={() => {
                        setActif(tranche.id);
                        setValeurs({});
                      }}
                      aria-pressed={ouvertCelui}
                      title={`${tranche.titre} · ${tranche.emplois} emploi${tranche.emplois > 1 ? 's' : ''} · ${tranche.signes} signes`}
                      className={`flex flex-col items-center justify-between overflow-hidden border px-1 py-2 transition-colors ${
                        signal
                          ? `border-signal-line bg-signal-muted ${halo}`
                          : ouvertCelui
                            ? 'border-border-strong bg-elevated'
                            : 'border-border bg-raised hover:bg-surface-hover'
                      }`}
                      style={{ width: tranche.epaisseur, height: tranche.hauteur }}
                      data-signal-groupe={signal ? 'tranche-epaisse' : undefined}
                    >
                      {/* LE TITRE À LA VERTICALE, sur la tranche. */}
                      <span
                        className={`min-h-0 flex-1 overflow-hidden text-[11px] leading-tight ${
                          signal ? 'font-semibold text-signal' : 'text-text-primary'
                        }`}
                        /* Une seule ligne verticale, tronquée : sur une
                           tranche de onze pixels, un titre qui se replie en
                           deux colonnes n'est plus un titre, c'est du bruit. */
                        style={{
                          writingMode: 'vertical-rl',
                          textOrientation: 'mixed',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                        data-signal-groupe={signal ? 'tranche-epaisse' : undefined}
                      >
                        {tranche.titre}
                      </span>
                      <span
                        className={`tnum mt-1.5 flex-shrink-0 font-mono text-[10px] font-semibold ${
                          signal ? 'text-signal' : 'text-text-muted'
                        }`}
                        data-signal-groupe={signal ? 'tranche-epaisse' : undefined}
                      >
                        {tranche.emplois}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* LE SOCLE — 3 px, et il ferme l'étagère. */}
              <div
                aria-hidden
                className="bg-border-strong"
                style={{ height: SOCLE_H, width: '100%', minWidth: 120 }}
              />
            </div>

            {/*
              SOUS L'ÉTAGÈRE — ce que le module demande d'y écrire : le modèle
              le plus employé et sa dernière retouche. Le produit n'enregistre
              pas les « changements de tarif » ; il enregistre en revanche
              quand un modèle a été modifié, et c'est cette comparaison-là qui
              est vraie.
            */}
            <div className="mt-4 border-t border-border-row pt-3">
              {modeleAmbre && trancheAmbre ? (
                <p className="text-[12.5px] leading-relaxed text-text-secondary">
                  <span className="font-semibold text-text-primary">{trancheAmbre.titre}</span> est
                  le plus employé — {trancheAmbre.emplois} fois.{' '}
                  {modeleAmbre.editedAt
                    ? `Dernière retouche ${relativeTime(modeleAmbre.editedAt)} : si les tarifs ou les délais ont changé depuis, c'est ce texte-là qui part chez tout le monde.`
                    : 'Il n’a jamais été retouché depuis sa création : si les tarifs ou les délais ont changé depuis, c’est ce texte-là qui part chez tout le monde.'}
                </p>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-text-secondary">
                  Aucun modèle n’a encore été copié : toutes les tranches sont à leur épaisseur
                  minimale.
                </p>
              )}
              {/*
                LA RÈGLE QU'ON DÉCOUVRE TROP TARD : retirer un modèle ne
                retire rien de ce qui est déjà parti.
              */}
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                Retirer un modèle ne change rien aux documents déjà émis : le texte est parti avec
                eux. Une tranche fine se retire sans risque ; une tranche épaisse se corrige, elle
                ne se supprime pas.
              </p>
            </div>
          </motion.section>

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

          {/*
            LE MODÈLE EN TRAIN D'ÊTRE REMPLI — un formulaire, pas un document
            qu'on choisit.

            IL A PERDU SON AMBRE, et c'est l'arbitrage de cet écran. Les trous
            restants sont une vraie décision — copier un texte avec un
            `{prénom}` non remplacé est la faute que ce module existe pour
            éviter. Mais `MODULES.md` place l'ambre de `18d` sur la tranche la
            plus épaisse de l'étagère, et un écran n'a qu'une région ambre.
            Le compte des trous reste donc en tête du panneau, en matière
            pleine et en toutes lettres, et le bouton de copie DIT ce qu'il
            copierait au lieu de le laisser deviner.
          */}
          {courant && (
            <motion.section variants={staggerItem} aria-label={courant.title} className="panel p-5 sm:p-6">
              {trous.length > 0 && (
                <p
                  className={`mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    restants.length > 0
                      ? 'border border-border-strong bg-elevated text-text-primary'
                      : 'border border-border text-text-secondary'
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

              {/*
                LE BOUTON DIT CE QU'IL COPIERAIT. Il ne se bloque pas — copier
                un texte à trous est parfois voulu, et un bouton désactivé
                n'explique jamais pourquoi. Il nomme le risque, c'est tout, et
                c'est déjà ce qui manquait.
              */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void copier()}
                  className="flex min-h-11 w-fit items-center gap-2 bg-accent px-5 text-sm font-semibold text-bg md:min-h-0 md:py-2.5"
                >
                  {copie ? <Check size={14} /> : <Copy size={14} />} {copie ? t('modeles.copie') : t('modeles.copier')}
                </button>
                {restants.length > 0 && (
                  <p className="text-[12.5px] leading-relaxed text-text-secondary">
                    {restants.length === 1
                      ? `« {${restants[0]}} » partira tel quel.`
                      : `${restants.length} accolades partiront telles quelles : ${restants.map((r) => `{${r}}`).join(', ')}.`}
                  </p>
                )}
              </div>
            </motion.section>
          )}
        </>
      )}
    </motion.section>
  );
}

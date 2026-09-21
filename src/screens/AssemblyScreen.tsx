import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

interface Etape {
  id: string;
  label: string;
  doneAt: string | null;
}
interface AssemblyData {
  title: string;
  client: string;
  steps: Etape[];
  createdAt: string;
  updatedAt: string;
}

/* ─── L'ÉCLATÉ — l'objet dominant du Montage (`25a`) ──────────────────────── */

/*
  UNE NOMENCLATURE EN TABLEAU DIT *COMBIEN* ; L'ÉCLATÉ DIT *OÙ*.

  Les pièces sont écartées le long d'un axe vertical, dans l'ordre où elles
  s'emboîtent, chacune une plaque de 34 px portant son repère (A, B, C…) et
  son nom, reliées par des lignes de rappel à la colonne des repères à droite.
  L'ordre de la pile EST l'ordre du montage : la dernière posée est en haut,
  et c'est la seule qui se retire sans démonter le reste.

  LA RÈGLE DE L'ORDONNÉE, tenue littéralement. Les lignes de rappel vivent
  dans un `viewBox` en `width:100%` posé en `inset:0` sur la bande entière,
  avec `preserveAspectRatio="none"` : une unité de vue en ordonnée vaut donc
  exactement un pixel, et l'ordonnée d'une ligne s'écrit avec LA MÊME
  expression que le `top` de la plaque qu'elle désigne (`centreDeLaPlaque`).
  Deux calculs séparés dériveraient au premier changement d'écart, et une
  ligne qui pointe à côté de sa plaque est pire qu'une absence de ligne.

  CE QUE LE MODÈLE DU PRODUIT PERMET, ET CE QU'IL NE PERMET PAS.
  Un chantier de montage porte des ÉTAPES ordonnées, pas une nomenclature de
  pièces avec des quantités. Les étapes sont donc les pièces — c'est bien ce
  qu'elles sont : « poser le socle », « fixer le mât » sont des pièces dans
  l'ordre où elles s'emboîtent. La DISPONIBILITÉ, elle, est lue dans le Stock
  quand le nom de l'étape correspond à un article suivi ; sinon la pièce est
  dite « non suivie » plutôt que déclarée disponible par défaut. Inventer une
  quantité par étape aurait fabriqué une nomenclature que personne ne tient à
  jour — `25b Nomenclatures` existe pour ça, et c'est là qu'elle vit.
*/
const PLAQUE_H = 34;
const PLAQUE_ECART = 18;
const PLAQUE_PAS = PLAQUE_H + PLAQUE_ECART;
/** Les plaques sont en POURCENTAGES de largeur — jamais en pixels. */
const PLAQUE_X = 2;
const PLAQUE_L = 46;
/** Le décalage d'éclatement : chaque pièce plus profonde rentre d'un cran. */
const PLAQUE_DECALAGE = 2;
/** L'abscisse où les lignes de rappel rejoignent la colonne des repères. */
const RAPPEL_X = 62;

const REPERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const repereDe = (i: number) => REPERES[i % REPERES.length];

/** L'ordonnée du CENTRE d'une plaque. Une seule expression, deux usages. */
const centreDeLaPlaque = (i: number) => i * PLAQUE_PAS + PLAQUE_H / 2;
const hauteurDeLEclate = (n: number) => Math.max(PLAQUE_H, n * PLAQUE_PAS - PLAQUE_ECART);

type Disponibilite = 'posee' | 'manquante' | 'disponible' | 'non-suivie';

interface PieceDeLEclate {
  etape: Etape;
  /** Le rang d'emboîtement : 0 est la première pièce posée. */
  rang: number;
  /*
    LA LIGNE OÙ LA PIÈCE SE DESSINE, comptée depuis le HAUT.

    Une pile se construit vers le haut : la première pièce est en bas, la
    dernière posée est en haut — et c'est la seule qui se retire sans
    démonter ce qu'il y a dessous. Dessiner A en haut aurait mis la base de
    l'assemblage au sommet du dessin, c'est-à-dire l'inverse de l'objet.
    `ligne` est donc l'index RENVERSÉ, et c'est lui qui pose les ordonnées.
  */
  ligne: number;
  repere: string;
  dispo: Disponibilite;
  /** La quantité en stock, quand la pièce est suivie. */
  enStock: number | null;
}

const MOT_DISPO: Record<Disponibilite, string> = {
  posee: 'posée',
  manquante: 'manquante',
  disponible: 'en stock',
  'non-suivie': 'non suivie',
};

interface ArticleDeStock {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * Les pièces d'un chantier, dans l'ordre où elles s'emboîtent.
 *
 * La disponibilité vient du Stock quand le nom correspond à un article
 * suivi. Une pièce déjà posée l'emporte sur tout le reste : elle est là, la
 * question de son approvisionnement ne se pose plus.
 */
function piecesDe(chantier: AssemblyData, articles: (ArticleDeStock & { id: string })[]): PieceDeLEclate[] {
  const total = chantier.steps.length;
  return chantier.steps.map((etape, rang) => {
    const article = articles.find(
      (a) => a.name.trim().toLowerCase() === etape.label.trim().toLowerCase(),
    );
    const dispo: Disponibilite = etape.doneAt
      ? 'posee'
      : !article
        ? 'non-suivie'
        : article.quantity <= 0
          ? 'manquante'
          : 'disponible';
    return {
      etape,
      rang,
      ligne: total - 1 - rang,
      repere: repereDe(rang),
      dispo,
      enStock: article ? article.quantity : null,
    };
  });
}

/**
 * LE SUIVI DE MONTAGE — chaque chantier, étape par étape.
 *
 * Pour qui : un poseur, un installateur, un atelier qui a trois chantiers en
 * parallèle et à qui le client demande « où en est-on ? ». Ce que ça règle :
 * un chantier, ses étapes écrites une fois, cochées au fur et à mesure.
 * L'avancement affiché est ce qui est fait — jamais un pourcentage estimé.
 */
export function AssemblyScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<AssemblyData>('assemblies');
  const articles = useCollection<ArticleDeStock>('stockItems');
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [steps, setSteps] = useState('');

  const chantiers = useMemo(() => [...brutes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [brutes]);
  const fini = (c: AssemblyData) => c.steps.length > 0 && c.steps.every((s) => s.doneAt);
  const enCours = chantiers.filter((c) => !fini(c));
  const termines = chantiers.filter(fini);
  const restantes = enCours.reduce((n, c) => n + c.steps.filter((s) => !s.doneAt).length, 0);

  /*
    LE CHANTIER OUVERT — celui qu'on a choisi, sinon le plus récemment
    touché parmi ceux EN COURS. Un chantier terminé n'a plus d'éclaté à lire :
    ouvrir dessus serait ouvrir sur un cul-de-sac.
  */
  /*
    Parmi les chantiers en cours, celui qui a une pièce MANQUANTE passe
    devant : c'est le seul défaut que l'éclaté sache montrer, et l'écran doit
    s'ouvrir dessus quand il existe. Sinon, le premier en cours.
  */
  const bloque = useMemo(
    () => enCours.find((c) => piecesDe(c, articles).some((p) => p.dispo === 'manquante')) ?? null,
    [enCours, articles],
  );
  const chantier =
    chantiers.find((c) => c.id === ouvertId) ?? bloque ?? enCours[0] ?? chantiers[0] ?? null;
  const pieces = useMemo(() => (chantier ? piecesDe(chantier, articles) : []), [chantier, articles]);

  /*
    LA PIÈCE QUI PORTE L'AMBRE.

    `MODULES.md` la désigne comme « la pièce manquante ». Quand aucune ne
    manque — le cas courant d'un chantier qui avance — il reste quand même une
    décision : la PROCHAINE à poser. L'ambre va donc à la première pièce
    manquante s'il y en a une, sinon à la prochaine à poser, et à rien du tout
    quand le chantier est fini. Ce sont les deux formes du même fait : la
    pièce qui bloque la suite.
  */
  const pieceAmbre =
    pieces.find((p) => p.dispo === 'manquante') ??
    pieces.find((p) => p.dispo !== 'posee') ??
    null;
  const halo = useHaloSignal(pieceAmbre !== null);

  /*
    CE QUI SE REMPLACE SANS DÉMONTER LE RESTE — la DERNIÈRE de la pile, et
    elle seule. C'est une propriété de l'ordre d'emboîtement, pas une
    préférence : tout ce qui est en dessous porte ce qui est au-dessus.
  */
  const remplacableSeule = pieces.length > 0 ? pieces[pieces.length - 1] : null;

  const ajouter = async () => {
    const lignes = steps.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || lignes.length === 0) return;
    const now = new Date().toISOString();
    await upsert('assemblies', uid('asm'), { title: title.trim(), client: client.trim(), steps: lignes.map((label) => ({ id: uid('stp'), label, doneAt: null })), createdAt: now, updatedAt: now });
    setTitle(''); setClient(''); setSteps(''); setOuvert(false);
  };
  const basculer = (c: AssemblyData & { id: string }, etape: Etape) =>
    upsert('assemblies', c.id, {
      ...c,
      steps: c.steps.map((s) => (s.id === etape.id ? { ...s, doneAt: s.doneAt ? null : new Date().toISOString() } : s)),
      updatedAt: new Date().toISOString(),
    });

  const Carte = ({ c, onOuvrir }: { c: AssemblyData & { id: string }; onOuvrir: () => void }) => {
    const faites = c.steps.filter((s) => s.doneAt).length;
    const termine = fini(c);
    return (
      <article className={`group flex flex-col gap-2 rounded-xl border bg-surface p-4 ${termine ? 'border-success/30' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOuvrir} className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold text-text-primary hover:text-text-body">{c.title}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {c.client ? `${c.client} · ` : ''}{termine ? t('montage.termine') : t('montage.avancement', { fait: faites, total: c.steps.length })} · {relativeTime(c.updatedAt)}
            </p>
          </button>
          <button type="button" onClick={() => void remove('assemblies', c.id)} aria-label={t('montage.supprimer')} title={t('montage.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={c.steps.length} aria-valuenow={faites} aria-label={t('montage.avancement', { fait: faites, total: c.steps.length })}>
          <div className={`h-full ${termine ? 'bg-success' : 'bg-accent'}`} style={{ width: `${c.steps.length ? Math.round((faites / c.steps.length) * 100) : 0}%` }} />
        </div>
        <ol className="flex flex-col">
          {c.steps.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => void basculer(c, s)} aria-pressed={Boolean(s.doneAt)} className="flex min-h-11 w-full items-center gap-2 text-left text-sm hover:bg-surface-hover md:min-h-0 md:py-1">
                {s.doneAt ? <Check size={14} className="shrink-0 text-success" /> : <Circle size={14} className="shrink-0 text-text-muted" />}
                <span className={s.doneAt ? 'text-text-muted line-through' : 'text-text-primary'}>{s.label}</span>
                {s.doneAt && <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-text-muted">{relativeTime(s.doneAt)}</span>}
              </button>
            </li>
          ))}
        </ol>
      </article>
    );
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('montage.titre') })}
          title={t('montage.titre')}
          description={t('montage.description')}
          stats={[
            { label: t('montage.stat.enCours'), value: enCours.length },
            { label: t('montage.stat.termines'), value: termines.length },
            { label: t('montage.stat.etapesRestantes'), value: restantes, emphasis: restantes > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('montage.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('montage.champTitre')} aria-label={t('montage.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={t('montage.champClient')} aria-label={t('montage.champClient')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={4} placeholder={t('montage.champEtapes')} aria-label={t('montage.champEtapes')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim() || !steps.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('montage.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {chantiers.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('montage.vide.titre')} action={{ label: t('montage.vide.action'), onClick: () => setOuvert(true) }}>{t('montage.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* ── L'ÉCLATÉ — l'objet dominant (`25a`) ───────────────────────── */}
          {chantier && pieces.length > 0 && (
            <motion.section variants={staggerItem} className="panel-raised panel-raised-wide p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {chantier.client ? `${chantier.client} · ` : ''}
                    {fini(chantier)
                      ? t('montage.termine')
                      : t('montage.avancement', {
                          fait: chantier.steps.filter((x) => x.doneAt).length,
                          total: chantier.steps.length,
                        })}
                  </p>
                  <p className="mt-1 text-[21px] font-semibold leading-tight text-text-primary sm:text-[25px]">
                    {chantier.title}
                  </p>
                </div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                  de bas en haut, dans l’ordre du montage
                </p>
              </div>

              {/*
                LA BANDE — plaques, lignes de rappel et colonne des repères
                partagent la MÊME hauteur et le MÊME pas. Les deux colonnes
                sont dans la même carte : c'est ce qui fait de l'ambre une
                seule région, même quand il apparaît quatre fois.
              */}
              <div
                className="relative mt-5 w-full"
                style={{ height: hauteurDeLEclate(pieces.length) }}
              >
                {/* LES LIGNES DE RAPPEL. `preserveAspectRatio="none"` +
                    `viewBox` en hauteur de pixels : une unité d'ordonnée vaut
                    un pixel, donc `centreDeLaPlaque` s'écrit ici à
                    l'identique. */}
                <svg
                  aria-hidden
                  className="absolute inset-0 h-full w-full"
                  viewBox={`0 0 100 ${hauteurDeLEclate(pieces.length)}`}
                  preserveAspectRatio="none"
                >
                  {pieces.map((piece) => {
                    const signal = pieceAmbre?.etape.id === piece.etape.id;
                    const y = centreDeLaPlaque(piece.ligne);
                    const x = PLAQUE_X + piece.ligne * PLAQUE_DECALAGE + PLAQUE_L;
                    return (
                      <line
                        key={piece.etape.id}
                        x1={x}
                        y1={y}
                        x2={RAPPEL_X}
                        y2={y}
                        stroke={signal ? 'var(--color-signal)' : 'var(--color-border)'}
                        strokeWidth={signal ? 1.5 : 1}
                        vectorEffect="non-scaling-stroke"
                        data-signal-groupe={signal ? 'piece-bloquante' : undefined}
                      />
                    );
                  })}
                </svg>

                {/* LES PLAQUES — 34 px de haut, largeur en pourcentage. */}
                {pieces.map((piece) => {
                  const signal = pieceAmbre?.etape.id === piece.etape.id;
                  return (
                    <button
                      key={piece.etape.id}
                      type="button"
                      onClick={() => void basculer(chantier, piece.etape)}
                      aria-pressed={Boolean(piece.etape.doneAt)}
                      className={`absolute flex items-center gap-2.5 border px-2.5 text-left transition-colors ${
                        signal
                          ? `border-signal-line bg-signal-muted ${halo}`
                          : piece.dispo === 'posee'
                            ? 'border-border bg-raised'
                            : 'border-border-strong bg-elevated hover:bg-surface-hover'
                      }`}
                      style={{
                        top: piece.ligne * PLAQUE_PAS,
                        height: PLAQUE_H,
                        left: `${PLAQUE_X + piece.ligne * PLAQUE_DECALAGE}%`,
                        width: `${PLAQUE_L}%`,
                      }}
                      data-signal-groupe={signal ? 'piece-bloquante' : undefined}
                    >
                      <span
                        className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center font-mono text-[11px] font-bold ${
                          signal
                            ? 'signal-plate'
                            : piece.dispo === 'posee'
                              ? 'bg-border text-text-muted'
                              : 'bg-border-strong text-text-body'
                        }`}
                      >
                        {piece.repere}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${
                          piece.dispo === 'posee' ? 'text-text-muted line-through' : 'text-text-primary'
                        }`}
                      >
                        {piece.etape.label}
                      </span>
                    </button>
                  );
                })}

                {/* LA COLONNE DES REPÈRES — mêmes ordonnées, forcément. */}
                {pieces.map((piece) => {
                  const signal = pieceAmbre?.etape.id === piece.etape.id;
                  return (
                    <div
                      key={piece.etape.id}
                      className="absolute flex items-center gap-2"
                      style={{
                        top: piece.ligne * PLAQUE_PAS,
                        height: PLAQUE_H,
                        left: `${RAPPEL_X}%`,
                        right: 0,
                      }}
                    >
                      <span
                        className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center font-mono text-[11px] font-bold ${
                          signal
                            ? `signal-plate ${halo}`
                            : piece.dispo === 'posee'
                              ? 'bg-border text-text-muted'
                              : 'bg-border-strong text-text-body'
                        }`}
                        data-signal-groupe={signal ? 'piece-bloquante' : undefined}
                      >
                        {piece.repere}
                      </span>
                      <span
                        className={`tnum min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] ${
                          signal ? 'text-signal' : 'text-text-muted'
                        }`}
                        data-signal-groupe={signal ? 'piece-bloquante' : undefined}
                      >
                        {piece.enStock !== null && piece.dispo !== 'posee'
                          ? `${piece.enStock} · ${MOT_DISPO[piece.dispo]}`
                          : MOT_DISPO[piece.dispo]}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-border-row pt-3">
                {/*
                  LA PHRASE QUI DIT CE QU'ON PEUT REPRENDRE SANS TOUT DÉFAIRE.
                  Elle n'est pas une opinion : c'est la dernière de la pile, et
                  ça se déduit de l'ordre d'emboîtement.
                */}
                {remplacableSeule && (
                  <p className="text-[12.5px] leading-relaxed text-text-secondary">
                    <span className="font-semibold text-text-primary">
                      {remplacableSeule.repere} · {remplacableSeule.etape.label}
                    </span>{' '}
                    est la dernière de la pile : c’est la seule qui se remplace sans démonter ce
                    qu’il y a en dessous.
                  </p>
                )}
                {/*
                  CE QUE LE PRODUIT N'A PAS, dit plutôt qu'imité. La maquette
                  place en pied « les notices disponibles et l'historique du
                  chariot ». Il n'existe ni notice ni chariot dans ce produit :
                  dessiner des cases vides à leur place laisserait croire à une
                  fonction absente.
                */}
                <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                  La disponibilité vient du Stock quand le nom de la pièce correspond à un article
                  suivi. Les notices de montage et l’historique du chariot n’existent pas encore
                  dans le produit : ils ne sont pas dessinés à vide.
                </p>
              </div>
            </motion.section>
          )}

          {/* EN PIED — les autres chantiers, en matière. */}
          <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
            {enCours.filter((c) => c.id !== chantier?.id).map((c) => (
              <Carte key={c.id} c={c} onOuvrir={() => setOuvertId(c.id)} />
            ))}
            {termines.filter((c) => c.id !== chantier?.id).map((c) => (
              <Carte key={c.id} c={c} onOuvrir={() => setOuvertId(c.id)} />
            ))}
          </motion.div>
        </>
      )}
    </motion.section>
  );
}

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import { useHaloSignal } from '../components/EtatEcran';
import { useCollection } from '../state/SyncContext';
import { evaluateProfile, outputsOf } from '../state/calcEngine';
import { CONVERTER_PROFILES } from '../state/converterProfiles';
import { formatValue } from '../lib/calcFormat';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface StockItemData {
  name: string;
  unit: string;
  quantity: number;
}
interface ConsommationData {
  label: string;
  quantity: number;
  unit: string;
}
interface InterventionData {
  title: string;
  clientName: string;
  at: string;
  consommations: ConsommationData[];
  closedAt: string;
}

/*
  ══════════════════════════════════════════════════════════════════════
  LA RÈGLE À CURSEUR — la règle qui en fait un instrument
  ══════════════════════════════════════════════════════════════════════

  LE CURSEUR EST À LA MÊME ABSCISSE SUR TOUTES LES RÈGLES. Ce n'est pas une
  coquetterie de dessin : c'est CE QUI FAIT L'INSTRUMENT. Trois champs de
  saisie côte à côte donnent le même résultat chiffré et n'apprennent rien ;
  trois règles traversées par un seul trait montrent le RAPPORT — on voit que
  la marque des pouces avance deux fois et demie plus vite que celle des
  centimètres, sans qu'aucun nombre le dise.

  Tenir cette règle impose deux choses au code :

  1. LES ÉCHELLES SONT LINÉAIRES et bornées de façon cohérente : chaque règle
     va de ce que vaut la borne basse de l'entrée à ce que vaut sa borne
     haute. Les formules des convertisseurs sont toutes AFFINES (× 100, ÷ 0,0254,
     × 9/5 + 32), donc une fraction d'abscisse identique donne bien la valeur
     correspondante sur chaque règle. Si un profil non affine entrait un jour
     ici, le dessin mentirait — d'où le point 2.
  2. LA VALEUR AFFICHÉE EST TOUJOURS CELLE DU MOTEUR, jamais l'interpolation
     du dessin. On évalue le profil à la valeur d'entrée que le curseur
     désigne, et on affiche ce que le moteur répond. Le dessin peut, à la
     rigueur, être approximatif ; le nombre, jamais.

  `VALEUR_L` est fixe en pixels, et c'est ce qui permet au curseur d'être à la
  même abscisse partout : la zone graduée de chaque règle vaut
  `100 % − VALEUR_L`, et le curseur se pose à `(100 % − VALEUR_L) × t`. Une
  colonne de valeur en pourcentage rendrait cette expression fausse dès que
  deux règles n'ont pas le même nombre de chiffres.
*/
const REGLE_H = 30;
const RANG_H = 72;
const VALEUR_L = 132;
const GRADUATIONS = 21;
/** Une graduation sur cinq est longue — c'est ce qui rend le comptage possible. */
const GRADUATION_LONGUE = 5;

/*
  LES UNITÉS DU STOCK ET CELLES DES RÈGLES ne s'écrivent pas pareil : le stock
  dit « L », la règle dit « Litres ». Rapprocher les deux demande donc une
  normalisation — minuscules, sans accents, sans pluriel — et une courte table
  d'abréviations. Elle est COURTE exprès : à la première unité qui n'y est pas,
  la carte se tait, ce qui est infiniment préférable à un rapprochement faux
  entre deux choses qui n'ont que la première lettre en commun.
*/
const ABREGES: Record<string, string> = {
  l: 'litre',
  ml: 'millilitre',
  cl: 'centilitre',
  kg: 'kilogramme',
  g: 'gramme',
  m: 'metre',
  m2: 'metre carre',
};
const normaliserUnite = (mot: string) => {
  const nu = mot
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/s$/, '');
  return ABREGES[nu] ?? nu;
};
const memeUnite = (a: string, b: string) => normaliserUnite(a) === normaliserUnite(b);

/** Un plafond lisible : 1, 2 ou 5 fois une puissance de dix. */
function plafondLisible(valeur: number): number {
  if (!Number.isFinite(valeur) || valeur <= 0) return 1;
  const decade = 10 ** Math.floor(Math.log10(valeur));
  const part = valeur / decade;
  const cran = part <= 1 ? 1 : part <= 2 ? 2 : part <= 5 ? 5 : 10;
  return cran * decade;
}

interface Regle {
  cle: string;
  libelle: string;
  /** La valeur AU CURSEUR, telle que le moteur la calcule. */
  valeur: number;
  kind: 'number' | 'money' | 'percent' | string;
  /** Les bornes de la règle, pour ses graduations. */
  min: number;
  max: number;
  /** Vrai pour le terme cherché — la règle ambre. */
  cherche: boolean;
}

/**
 * LES CONVERTISSEURS — le bon chiffre tout de suite.
 *
 * Pour qui : une boutique qui reçoit une commande en pouces, un traiteur
 * devant une recette en onces, n'importe qui devant un prix TTC à ramener en
 * HT. Sept convertisseurs sur le moteur des Calculateurs — des profils, des
 * formules, rien d'écrit deux fois. Les devises n'embarquent aucun taux : il
 * serait faux demain, on le saisit.
 *
 * ## Ce qui domine : la règle à curseur
 *
 * L'écran était un formulaire : un champ à gauche, une liste de résultats à
 * droite. C'est le piège de cette famille — l'objet dominant d'un utilitaire
 * est CE QU'IL PRODUIT, et ce qu'un convertisseur produit n'est pas un
 * nombre, c'est un RAPPORT entre deux échelles.
 *
 * Voir l'en-tête des constantes pour la règle qui tient tout : un seul
 * curseur, à la même abscisse sur toutes les règles.
 *
 * ## L'ambre : la règle du terme cherché
 *
 * Le terme cherché est la sortie de tête du profil — celle que le moteur
 * marque `headline`, c'est-à-dire la réponse qu'on est venu chercher. Son
 * surtitre, le segment de curseur qui la traverse et sa valeur : trois nœuds,
 * une région.
 */
export function ConvertersScreen() {
  const { t } = useLangue();
  const [actif, setActif] = useState(CONVERTER_PROFILES[0].id);
  /* Chaque règle garde SA position de curseur — c'est ce que « les autres
     règles mémorisées » veut dire : on revient à celle qu'on avait laissée. */
  const [positions, setPositions] = useState<Record<string, number>>({});
  const stock = useCollection<StockItemData>('stockItems');
  const fiches = useCollection<InterventionData>('interventions');

  const profile = CONVERTER_PROFILES.find((p) => p.id === actif) ?? CONVERTER_PROFILES[0];
  const entree = profile.inputs[0];
  const t01 = positions[profile.id] ?? 0.25;

  /* Les bornes de l'entrée : de zéro à un plafond lisible tiré de sa valeur de
     départ. Le plafond suit donc le profil au lieu d'être écrit sept fois. */
  const bornes = useMemo<[number, number]>(() => [0, plafondLisible(entree.defaultValue * 5)], [entree]);
  const valeurEntree = bornes[0] + t01 * (bornes[1] - bornes[0]);

  /* Les autres entrées du profil (le taux de TVA, par exemple) gardent leur
     valeur de départ : la règle ne fait glisser QUE le premier terme. */
  const autresEntrees = useMemo(() => {
    const out: Record<string, number> = {};
    for (const i of profile.inputs.slice(1)) out[i.key] = i.defaultValue;
    return out;
  }, [profile]);

  const evalueA = useMemo(
    () => (x: number) => outputsOf(evaluateProfile(profile, { ...autresEntrees, [entree.key]: x })),
    [profile, autresEntrees, entree],
  );
  const auCurseur = useMemo(() => evalueA(valeurEntree), [evalueA, valeurEntree]);
  const auMin = useMemo(() => evalueA(bornes[0]), [evalueA, bornes]);
  const auMax = useMemo(() => evalueA(bornes[1]), [evalueA, bornes]);

  /*
    DEUX OU TROIS RÈGLES, jamais plus : l'entrée, la sortie de tête, et au plus
    une autre. Au-delà, le curseur traverse une grille et le rapport cesse de
    se lire — c'est exactement le formulaire qu'on vient de remplacer.
  */
  const regles = useMemo<Regle[]>(() => {
    const tete = auCurseur.find((l) => l.headline) ?? auCurseur[0];
    const seconde = auCurseur.find((l) => l.key !== tete?.key);
    const liste: Regle[] = [
      {
        cle: entree.key,
        libelle: entree.label,
        valeur: valeurEntree,
        kind: entree.kind,
        min: bornes[0],
        max: bornes[1],
        cherche: false,
      },
    ];
    for (const ligne of [tete, seconde]) {
      if (!ligne) continue;
      const bas = auMin.find((l) => l.key === ligne.key)?.value ?? 0;
      const haut = auMax.find((l) => l.key === ligne.key)?.value ?? 1;
      /*
        UNE TROISIÈME RÈGLE QUI LIRAIT « 0,00 » PARTOUT N'EST PAS UNE RÈGLE.

        Les kilomètres d'un axe qui va de 0 à 5 mètres tiennent entre 0,00 et
        0,01 : la valeur ne bouge jamais à l'affichage, et une graduation qui
        ne bouge pas n'apprend rien — elle occupe une ligne et fait douter de
        l'instrument. On ne garde donc la seconde sortie que si son amplitude
        vaut au moins une unité affichable. Le système de design dit « deux ou
        trois règles » : deux est une réponse, pas un manque.
      */
      if (ligne.key !== tete?.key && Math.abs(haut - bas) < 1) continue;
      liste.push({
        cle: ligne.key,
        libelle: ligne.label,
        valeur: ligne.value,
        kind: ligne.kind,
        min: bas,
        max: haut,
        cherche: ligne.key === tete?.key,
      });
    }
    return liste;
  }, [auCurseur, auMin, auMax, entree, valeurEntree, bornes]);

  const indexAmbre = regles.findIndex((r) => r.cherche);
  const halo = useHaloSignal(indexAmbre >= 0);

  /*
    LA CONSÉQUENCE PRATIQUE — ce que le chiffre veut dire dans l'atelier.

    On cherche un article du stock dont l'UNITÉ est celle de la règle de tête,
    et qui est consommé par des interventions. La quantité au curseur divisée
    par la consommation moyenne par intervention donne « combien
    d'interventions ce contenant couvre ». Et comme l'article est justement en
    rupture, la phrase dit aussi ce que le convertisseur ne dira jamais tout
    seul : qu'il n'y en a plus.

    Rien de tout cela n'est écrit d'avance : sans article dans cette unité, ou
    sans consommation enregistrée, la carte se tait.
  */
  const consequence = useMemo(() => {
    for (const regle of regles) {
      if (regle.kind !== 'number') continue;
      const article = stock.find((s) => memeUnite(s.unit ?? '', regle.libelle));
      if (!article) continue;
      const usages = fiches.flatMap((f) =>
        (f.consommations ?? []).filter((c) => c.label === article.name).map((c) => c.quantity),
      );
      if (usages.length === 0) continue;
      const parIntervention = usages.reduce((n, q) => n + q, 0) / usages.length;
      if (parIntervention <= 0) continue;
      return {
        article: article.name,
        parIntervention,
        couvre: Math.floor(regle.valeur / parIntervention),
        enStock: article.quantity,
      };
    }
    return null;
  }, [regles, stock, fiches]);

  /* Les relevés de l'intervention en cours — celle du jour encore ouverte. */
  const enCours = useMemo(() => {
    const jour = new Date().toISOString().slice(0, 10);
    return (
      fiches
        .filter((f) => !f.closedAt && (f.at ?? '').slice(0, 10) <= jour)
        .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))[0] ?? null
    );
  }, [fiches]);

  const glisser = (valeur: number) => setPositions((p) => ({ ...p, [profile.id]: valeur }));
  /* L'abscisse du curseur, en CSS : la zone graduée vaut `100 % − VALEUR_L`. */
  const abscisse = `calc((100% - ${VALEUR_L}px) * ${t01})`;

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('outils.surtitre', { module: t('convertisseurs.titre') })}
          title={t('convertisseurs.titre')}
          description={t('convertisseurs.description')}
          stats={[
            { label: t('convertisseurs.stat.convertisseurs'), value: CONVERTER_PROFILES.length },
            { label: t('convertisseurs.stat.actif'), value: profile.label },
          ]}
        />
      </motion.div>

      {/* ═══ L'OBJET DOMINANT : les règles et leur curseur unique ═══ */}
      <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
        <p className="max-w-prose text-sm leading-relaxed text-text-secondary">{profile.description}</p>

        <div className="relative mt-6" style={{ height: RANG_H * regles.length }}>
          {/*
            LE CURSEUR — un seul élément, découpé en autant de segments qu'il y
            a de règles. Le segment qui traverse la règle cherchée est ambre ;
            les autres sont en gris fort. C'est la même abscisse par
            construction, puisque c'est la même boîte.
          */}
          <div className="pointer-events-none absolute inset-y-0 z-10 w-[3px]" style={{ left: abscisse }} aria-hidden>
            {regles.map((r, i) => (
              <span
                key={r.cle}
                data-signal-groupe={r.cherche ? 'terme-cherche' : undefined}
                className="block w-full"
                style={{
                  height: RANG_H,
                  backgroundColor: r.cherche ? 'var(--color-signal)' : 'var(--color-border-strong)',
                  opacity: i === regles.length - 1 ? 1 : 1,
                }}
              />
            ))}
          </div>

          {regles.map((r) => (
            <div key={r.cle} className="flex items-end" style={{ height: RANG_H }}>
              <div className="min-w-0 flex-1">
                <p
                  data-signal-groupe={r.cherche ? 'terme-cherche' : undefined}
                  className={`eyebrow mb-1.5 ${r.cherche ? 'eyebrow-signal' : ''}`}
                >
                  {r.libelle}
                </p>
                {/* LA RÈGLE GRADUÉE — graduations alternées longues et courtes. */}
                <div className="relative w-full border-b border-border-strong" style={{ height: REGLE_H }}>
                  {Array.from({ length: GRADUATIONS }, (_, i) => {
                    const longue = i % GRADUATION_LONGUE === 0;
                    return (
                      <span
                        key={i}
                        className="absolute bottom-0 w-px bg-border-strong"
                        style={{
                          left: `${(i / (GRADUATIONS - 1)) * 100}%`,
                          height: longue ? REGLE_H * 0.62 : REGLE_H * 0.3,
                        }}
                        aria-hidden
                      />
                    );
                  })}
                  {/* Les deux bornes, dites en clair sous la règle. */}
                  <span className="absolute -bottom-4 left-0 font-mono text-[9px] tabular-nums text-text-muted">
                    {formatValue(r.min, r.kind as never)}
                  </span>
                  <span className="absolute -bottom-4 right-0 font-mono text-[9px] tabular-nums text-text-muted">
                    {formatValue(r.max, r.kind as never)}
                  </span>
                </div>
              </div>
              <div
                data-signal-groupe={r.cherche ? 'terme-cherche' : undefined}
                className="flex flex-shrink-0 items-end justify-end pl-3 text-right"
                style={{ width: VALEUR_L }}
              >
                <span
                  className={`text-[27px] font-semibold leading-none tabular-nums ${r.cherche ? 'text-signal' : 'text-text-primary'}`}
                >
                  {formatValue(r.valeur, r.kind as never)}
                </span>
              </div>
            </div>
          ))}

          {/*
            LA POIGNÉE — un `range` posé sur la zone graduée, invisible mais
            bien là : c'est lui qui donne le clavier, le pas fin et l'étiquette
            vocale sans qu'on ait à les réécrire.
          */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={t01}
            onChange={(e) => glisser(Number(e.target.value))}
            aria-label={t('convertisseurs.curseur', { terme: entree.label })}
            aria-valuetext={`${formatValue(valeurEntree, entree.kind as never)} ${entree.label}`}
            className="input-focus absolute inset-y-0 left-0 z-20 w-auto cursor-ew-resize opacity-0"
            style={{ right: VALEUR_L }}
          />
        </div>

        {/* SOUS LES RÈGLES — la conséquence pratique. */}
        {consequence && (
          <p className="mt-8 max-w-prose border-t border-border-strong pt-4 text-sm leading-relaxed text-text-body">
            {t('convertisseurs.consequence', {
              article: consequence.article,
              n: consequence.couvre,
              par: consequence.parIntervention.toFixed(1).replace('.', ','),
            })}{' '}
            {consequence.enStock === 0
              ? t('convertisseurs.stockZero', { article: consequence.article })
              : t('convertisseurs.stockReste', { n: consequence.enStock })}
          </p>
        )}
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* À GAUCHE — les autres règles mémorisées. */}
        <motion.section variants={staggerItem} className="panel">
          <p className="eyebrow border-b border-border px-4 py-2.5">{t('convertisseurs.lesAutresRegles')}</p>
          <ul className="flex flex-col">
            {CONVERTER_PROFILES.filter((p) => p.id !== profile.id).map((p) => {
              const sonEntree = p.inputs[0];
              const sesBornes: [number, number] = [0, plafondLisible(sonEntree.defaultValue * 5)];
              const saPosition = positions[p.id] ?? 0.25;
              const saValeur = sesBornes[0] + saPosition * (sesBornes[1] - sesBornes[0]);
              const autres: Record<string, number> = {};
              for (const i of p.inputs.slice(1)) autres[i.key] = i.defaultValue;
              const tete = outputsOf(evaluateProfile(p, { ...autres, [sonEntree.key]: saValeur })).find((l) => l.headline);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setActif(p.id)}
                    className="input-focus flex min-h-11 w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-primary">{p.label}</span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {sonEntree.label} → {tete?.label ?? '—'}
                      </span>
                    </span>
                    <span className="flex-shrink-0 font-mono text-[13px] tabular-nums text-text-secondary">
                      {formatValue(saValeur, sonEntree.kind as never)}
                      {tete ? ` → ${formatValue(tete.value, tete.kind)}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>

        {/* À DROITE — l'intervention en cours, pour qui convertit en chantier. */}
        <motion.aside variants={staggerItem} className="panel p-4">
          <p className="eyebrow mb-3">{t('convertisseurs.interventionEnCours')}</p>
          {enCours ? (
            <>
              <p className="text-[15px] font-semibold leading-tight text-text-primary">{enCours.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{enCours.clientName}</p>
              {(enCours.consommations ?? []).length === 0 ? (
                <p className="mt-3 border-t border-border pt-3 text-sm text-text-muted">{t('convertisseurs.rienConsomme')}</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                  {(enCours.consommations ?? []).map((c, i) => (
                    <li key={`${c.label}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-text-secondary">{c.label}</span>
                      <span className="flex-shrink-0 font-mono tabular-nums text-text-primary">
                        {c.quantity} {c.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-text-secondary">{t('convertisseurs.aucuneIntervention')}</p>
          )}
        </motion.aside>
      </div>
    </motion.section>
  );
}

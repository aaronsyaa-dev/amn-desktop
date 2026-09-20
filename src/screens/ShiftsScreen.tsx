import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection } from '../state/SyncContext';
import { useMembers } from '../state/useMembers';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Poste = 'matin' | 'apresmidi' | 'journee' | 'repos';
interface ShiftData {
  email: string;
  day: string;
  kind: Poste;
  updatedAt: string;
}
const CYCLE: (Poste | null)[] = ['matin', 'apresmidi', 'journee', 'repos', null];
const JOUR = 86_400_000;

const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Le lundi de la semaine de `d`, à minuit local. */
function lundi(d: Date): Date {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const decalage = (j.getDay() + 6) % 7;
  j.setDate(j.getDate() - decalage);
  return j;
}
const nomCourt = (email: string) => email.split('@')[0].replace(/[._-]+/g, ' ');

/* ─── LE PLAN DES HEURES — l'objet dominant (`15e`) ──────────────────────── */

/*
  CE QUI COMPTE N'EST PAS LA PILE, C'EST CE QUI MANQUE SOUS LA LIGNE.

  Les heures posées s'empilent par personne, jour par jour ; une ligne
  horizontale traverse la semaine à la hauteur du besoin. Le déficit se
  dessine en creux, à la place EXACTE qu'il occupe entre le haut de la pile et
  la ligne — pas dans un relevé à côté, pas en barre négative sous l'axe. Un
  planning se lit d'abord par ses trous, et un trou est une forme, pas un
  chiffre.

  TROIS RÈGLES TENUES DANS LE CODE, pas seulement dans le cas de démonstration :

  1. Les heures affichées somment EXACTEMENT ce que le graphique montre : les
     cartes des personnes, le déficit total et les segments dessinés sortent
     tous de `HEURES_DU_POSTE`, jamais d'un arrondi parallèle.
  2. Le déficit ne s'affiche que SOUS la ligne de besoin. Une colonne qui
     dépasse n'a pas de hachure — elle a un excédent, qui se dit en mots à
     droite.
  3. Le segment d'une personne qui ne travaille pas ce jour-là N'EXISTE PAS :
     il est filtré avant le rendu, il ne se dessine pas à zéro. Un repos non
     plus — quelqu'un en repos n'ouvre pas la boutique, et c'est déjà la règle
     que la couverture applique.
*/
const BESOIN_H = 12;
const PLAN_H = 210;
/** En dessous, l'initiale ne tient pas dans le segment — on la retire. */
const SEGMENT_INITIALE_MIN = 15;
/** En dessous, la plaque « − N h » ne tient pas dans la hachure. */
const HACHURE_PLAQUE_MIN = 24;

/*
  LES HEURES D'UN POSTE — la seule table de conversion de l'écran.

  Le modèle du produit ne stocke pas d'heures : il stocke un POSTE. Deux
  arbitrages possibles — ajouter un champ d'heures libre par case (ce qui
  ferait du planning une feuille de temps, alors que `24a Temps` existe déjà
  pour ça), ou convertir le poste. C'est la conversion : une demi-journée vaut
  quatre heures, une journée huit, un repos zéro. La valeur est ici, une fois,
  pour que rien ne puisse en afficher une autre.
*/
const HEURES_DU_POSTE: Record<Poste, number> = { matin: 4, apresmidi: 4, journee: 8, repos: 0 };

/** Jour ouvré au sens du besoin : du lundi au vendredi. */
const estOuvre = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;

/** « 8 h », « 4,5 h » — virgule française, et pas de décimale inutile. */
const enHeures = (h: number) =>
  `${Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',')} h`;

/** Les trois remplissages de la rampe, dans l'ordre : encre claire par-dessus. */
const REMPLISSAGES = ['#4a4a48', 'var(--color-border-strong)', '#2b2b2b'];

interface SegmentDuPlan {
  email: string;
  initiale: string;
  heures: number;
  remplissage: string;
}
interface ColonneDuPlan {
  date: Date;
  iso: string;
  ouvre: boolean;
  segments: SegmentDuPlan[];
  pile: number;
  deficit: number;
  excedent: number;
}
/*
  La MAJUSCULE INITIALE, et elle seule.

  `capitalize` de CSS met une capitale à CHAQUE mot : « Lundi 7 Septembre », où
  le français n'en veut pas sur le mois. Et `toLocaleDateString` rend le jour
  en minuscule, ce qui ne peut pas ouvrir une phrase.
*/
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * LE PLANNING D'ÉQUIPE — qui est là quel jour.
 *
 * Pour qui : une boutique ou un atelier à plusieurs, où « qui ouvre jeudi ? »
 * se règle par SMS. Ce que ça règle : sept jours, une chaîne de postes par
 * jour, un clic qui tourne entre matin, après-midi, journée et repos. Les
 * membres viennent de l'organisation elle-même : pas de liste à tenir à
 * côté. Les absences validées restent dans Absences ; ici c'est le planning
 * voulu, pas les imprévus.
 *
 * ## Ce qui domine : ce qui MANQUE sous la ligne de besoin
 *
 * L'écran était une grille membres × jours — et `5d Routines` en a déjà une,
 * routines × jours, avec sa colonne du jour en plaque ambre. Deux matrices à
 * deux axes dans la même application, c'est une famille indistincte : on
 * reconnaît le gabarit avant de lire le sujet.
 *
 * Le dominant est donc le PLAN DES HEURES (voir `ColonneDuPlan` plus haut) :
 * sept piles, une par jour, les personnes en segments portant leur initiale,
 * et une ligne horizontale qui traverse la semaine à la hauteur du besoin.
 * Ce qui se lit n'est pas la pile mais le creux entre son sommet et la ligne.
 *
 * La matrice retournée — une ligne par jour, les membres en jetons — reste
 * dessous : c'est la surface de GESTE, et elle n'a pas changé. Un clic fait
 * toujours tourner le poste, les membres sans poste restent visibles en
 * pointillé pour qu'on sache où cliquer.
 *
 * ## L'ambre
 *
 * Sur le jour ouvré dont le déficit est le plus gros, et sur lui seul : la
 * hachure de ce jour (avec sa plaque « − N h ») et son libellé dans la rangée
 * de pied, sous la même colonne. Deux nœuds, une seule région.
 *
 * Les AUTRES jours en déficit sont hachurés eux aussi, mais en matière. Le
 * système n'autorise qu'une région ambre par écran (§0.4) ; entre « hachurer
 * tous les déficits en ambre » et « désigner celui qui coûte le plus », c'est
 * la règle de l'ambre unique qui tranche — sinon la semaine clignote de
 * partout et ne désigne plus rien.
 *
 * Une semaine entièrement couverte n'a aucun ambre, et le dire calmement en
 * une phrase est la bonne réponse.
 *
 * « Repos » ne compte ni dans la couverture ni dans les heures : quelqu'un en
 * repos n'ouvre pas la boutique.
 */
export function ShiftsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const navigate = useNavigate();
  const { upsert, remove } = useSync();
  const { membres } = useMembers();
  const brutes = useCollection<ShiftData>('shifts');
  const [semaine, setSemaine] = useState(0);

  const debut = useMemo(() => {
    const l = lundi(new Date());
    l.setDate(l.getDate() + semaine * 7);
    return l;
  }, [semaine]);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(debut.getTime() + i * JOUR)), [debut]);
  const actifs = useMemo(() => membres.filter((m) => m.status === 'active').sort((a, b) => a.email.localeCompare(b.email)), [membres]);
  const parCase = useMemo(() => {
    const m = new Map<string, ShiftData & { id: string }>();
    for (const s of brutes) m.set(`${s.email}|${s.day}`, s);
    return m;
  }, [brutes]);
  const aujourdhui = isoJour(new Date());
  /*
    LA COUVERTURE DE CHAQUE JOUR — « repos » ne couvre pas.

    Quelqu'un en repos n'ouvre pas la boutique. C'est la règle que le relevé
    « présents aujourd'hui » appliquait déjà ; elle vaut maintenant pour les
    sept jours, et c'est elle qui ouvre chaque ligne.
  */
  const couverture = useMemo(() => {
    const compte = (day: string) =>
      actifs.filter((m) => {
        const k = parCase.get(`${m.email}|${day}`)?.kind;
        return k !== undefined && k !== 'repos';
      }).length;
    const m = new Map<string, number>();
    for (const j of jours) m.set(isoJour(j), compte(isoJour(j)));
    /* Aujourd'hui n'est pas toujours dans la semaine affichée, et le relevé
       d'en-tête en parle quand même. */
    if (!m.has(aujourdhui)) m.set(aujourdhui, compte(aujourdhui));
    return m;
  }, [jours, actifs, parCase, aujourdhui]);
  const couvertureDe = (day: string) => couverture.get(day) ?? 0;
  const presents = couvertureDe(aujourdhui);
  const posees = jours.reduce((n, j) => n + actifs.filter((m) => parCase.has(`${m.email}|${isoJour(j)}`)).length, 0);

  /*
    LE PREMIER TROU a disparu d'ici, et c'est voulu.

    Il servait l'ancien dominant (« personne n'est prévu jeudi »). Le plan des
    heures dit strictement plus : un jour sans personne est un déficit de
    douze heures, donc le plus gros de la semaine, donc celui que la hachure
    ambre désigne déjà. Garder le calcul à côté du plan, c'est garder deux
    définitions du même jour critique — et le jour où l'une des deux bouge,
    l'écran se contredit lui-même. Voir `jourAmbre`.
  */

  /*
    LE PLAN DES HEURES — les sept colonnes, dans l'ordre de la semaine.

    Un segment n'existe que si la personne travaille CE jour-là avec un poste
    qui compte des heures : le filtre est ici, avant le rendu, pour qu'aucune
    pile ne puisse contenir une barre de zéro pixel.
  */
  const colonnes = useMemo<ColonneDuPlan[]>(
    () =>
      jours.map((d) => {
        const iso = isoJour(d);
        const segments: SegmentDuPlan[] = [];
        actifs.forEach((m, rang) => {
          const kind = parCase.get(`${m.email}|${iso}`)?.kind;
          if (!kind) return;
          const heures = HEURES_DU_POSTE[kind];
          if (heures <= 0) return;
          segments.push({
            email: m.email,
            initiale: (nomCourt(m.email)[0] ?? '?').toUpperCase(),
            heures,
            remplissage: REMPLISSAGES[rang % REMPLISSAGES.length],
          });
        });
        const pile = segments.reduce((somme, seg) => somme + seg.heures, 0);
        const ouvre = estOuvre(d);
        return {
          date: d,
          iso,
          ouvre,
          segments,
          pile,
          deficit: ouvre ? Math.max(0, BESOIN_H - pile) : 0,
          excedent: ouvre ? Math.max(0, pile - BESOIN_H) : 0,
        };
      }),
    [jours, actifs, parCase],
  );

  /*
    L'ÉCHELLE — la ligne de besoin doit rester DANS la bande même quand une
    pile la dépasse. L'axe monte donc au plus haut des deux, et le pixel par
    heure s'en déduit : c'est la même division pour les segments, la hachure
    et la ligne, donc aucune des trois ne peut mentir aux deux autres.
  */
  const plafond = Math.max(BESOIN_H, ...colonnes.map((c) => c.pile));
  const pxParHeure = PLAN_H / plafond;

  /*
    LE JOUR QUI COÛTE LE PLUS — le plus gros déficit, et à égalité le plus
    proche. Voir l'en-tête pour l'arbitrage contre « tout hachurer en ambre ».
  */
  const jourAmbre = useMemo(() => {
    let pire: ColonneDuPlan | null = null;
    for (const c of colonnes) {
      if (c.deficit <= 0) continue;
      if (!pire || c.deficit > pire.deficit) pire = c;
    }
    return pire;
  }, [colonnes]);

  const deficitTotal = colonnes.reduce((somme, c) => somme + c.deficit, 0);
  const jourExcedent = useMemo(
    () => colonnes.reduce<ColonneDuPlan | null>((meilleur, c) => (c.excedent > (meilleur?.excedent ?? 0) ? c : meilleur), null),
    [colonnes],
  );

  /*
    LES HEURES PAR PERSONNE — la règle « les heures affichées somment
    exactement ce que le graphique montre » est tenue parce que ces totaux
    sont reconstruits à partir des MÊMES segments que les piles, et non
    recalculés depuis les postes une seconde fois.
  */
  const parPersonne = useMemo(() => {
    const totaux = new Map<string, { heures: number; joursTravailles: number }>();
    for (const c of colonnes) {
      for (const seg of c.segments) {
        const entree = totaux.get(seg.email) ?? { heures: 0, joursTravailles: 0 };
        entree.heures += seg.heures;
        entree.joursTravailles += 1;
        totaux.set(seg.email, entree);
      }
    }
    return actifs.map((m, rang) => ({
      membre: m,
      remplissage: REMPLISSAGES[rang % REMPLISSAGES.length],
      heures: totaux.get(m.email)?.heures ?? 0,
      joursTravailles: totaux.get(m.email)?.joursTravailles ?? 0,
      repos: jours.filter((d) => parCase.get(`${m.email}|${isoJour(d)}`)?.kind === 'repos').length,
    }));
  }, [colonnes, actifs, jours, parCase]);

  const ditLaCouverture = (n: number) => (n === 0 ? t('planning.aucunPoste') : n === 1 ? t('planning.unePersonne') : t('planning.nPersonnes', { n }));
  const jourEntier = (d: Date) => majuscule(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }));

  const tourner = async (email: string, day: string) => {
    const actuel = parCase.get(`${email}|${day}`);
    const suivant = CYCLE[(CYCLE.indexOf(actuel?.kind ?? null) + 1) % CYCLE.length];
    if (!suivant) {
      if (actuel) await remove('shifts', actuel.id);
      return;
    }
    await upsert('shifts', actuel?.id ?? `shift-${email}-${day}`, { email, day, kind: suivant, updatedAt: new Date().toISOString() });
  };
  const poste = (k: Poste) => t(`planning.kind.${k}` as Parameters<typeof t>[0]);
  const dateCourte = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  const teinte: Record<Poste, string> = {
    matin: 'bg-accent/15 text-text-primary border-accent/40',
    apresmidi: 'bg-accent/10 text-text-primary border-accent/30',
    journee: 'bg-accent/25 text-text-primary border-accent/60',
    repos: 'bg-bg text-text-muted border-border',
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('planning.titre') })}
          title={t('planning.titre')}
          description={t('planning.description')}
          stats={[
            { label: t('planning.stat.presents'), value: presents },
            { label: t('planning.stat.cases'), value: posees },
            { label: t('planning.stat.membres'), value: actifs.length },
          ]}
          actions={
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSemaine((s) => s - 1)} aria-label={t('planning.semainePrecedente')} title={t('planning.semainePrecedente')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary hover:text-text-primary"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setSemaine(0)} className="min-h-11 border border-border px-3 text-sm text-text-primary hover:bg-surface-hover">
                {semaine === 0 ? t('planning.cetteSemaine') : t('planning.semaineDu', { date: debut.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}
              </button>
              <button type="button" onClick={() => setSemaine((s) => s + 1)} aria-label={t('planning.semaineSuivante')} title={t('planning.semaineSuivante')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary hover:text-text-primary"><ChevronRight size={16} /></button>
            </div>
          }
        />
      </motion.div>

      {actifs.length <= 1 && brutes.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('planning.vide.titre')} action={{ label: t('planning.vide.action'), onClick: () => navigate('/membres') }}>{t('planning.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* LE PLAN DES HEURES — l'objet dominant (`15e`).

              La ligne de besoin est posée UNE fois, sur la bande entière :
              c'est elle qui « traverse la semaine ». Les hachures, elles,
              sont par colonne, entre le sommet de la pile et cette ligne. */}
          <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="eyebrow">{t('planning.couverture')}</p>
              <p className="tnum font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                besoin {enHeures(BESOIN_H)} par jour ouvré
              </p>
            </div>

            <p className="mt-2 max-w-2xl text-[19px] font-semibold leading-tight text-text-primary sm:text-[23px]">
              {jourAmbre
                ? `Il manque ${enHeures(jourAmbre.deficit)} ${jourEntier(jourAmbre.date).toLowerCase()}.`
                : deficitTotal === 0 && colonnes.some((c) => c.pile > 0)
                  ? 'La semaine tient : aucun jour ouvré sous le besoin.'
                  : 'Aucune heure posée cette semaine.'}
            </p>

            {/* LA BANDE — sept piles, et la ligne qui les traverse. */}
            <div className="relative mt-5" style={{ height: PLAN_H }}>
              <div className="grid h-full grid-cols-7 gap-1.5">
                {colonnes.map((c) => {
                  const signal = c === jourAmbre;
                  const hautPile = c.pile * pxParHeure;
                  const hautHachure = c.deficit * pxParHeure;
                  return (
                    <div key={c.iso} className="relative h-full">
                      {/* LE CREUX du jour : un fond enfoncé sur toute la
                          colonne, pour que la pile se lise comme posée. */}
                      <span aria-hidden className="absolute inset-0 bg-sunken" />

                      {/* LA PILE — du bas vers le haut, un segment par
                          personne qui travaille. Une personne absente n'a
                          pas de segment du tout. */}
                      <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse">
                        {c.segments.map((seg) => {
                          const h = seg.heures * pxParHeure;
                          return (
                            <span
                              key={seg.email}
                              title={`${nomCourt(seg.email)} · ${enHeures(seg.heures)}`}
                              className="flex items-center justify-center border-t border-bg font-mono text-[10px] uppercase tracking-[0.1em] text-text-body"
                              style={{ height: h, background: seg.remplissage }}
                            >
                              {h >= SEGMENT_INITIALE_MIN ? seg.initiale : ''}
                            </span>
                          );
                        })}
                      </div>

                      {/* LA HACHURE — exactement entre le sommet de la pile
                          et la ligne de besoin. Jamais ailleurs, jamais en
                          barre négative. */}
                      {c.deficit > 0 && (
                        <span
                          className="absolute inset-x-0 flex items-center justify-center"
                          style={{
                            bottom: hautPile,
                            height: hautHachure,
                            backgroundImage: `repeating-linear-gradient(45deg, ${signal ? 'var(--color-signal-muted)' : 'rgba(255,255,255,0.05)'} 0 5px, transparent 5px 10px)`,
                            borderTop: `1px solid ${signal ? 'var(--color-signal-line)' : 'var(--color-border)'}`,
                          }}
                          data-signal-groupe={signal ? 'deficit' : undefined}
                        >
                          {/* LA PLAQUE — une hachure seule ne tient pas le
                              contraste sous un texte : le « − N h » est posé
                              sur sa propre plaque pleine, en encre noire. */}
                          {hautHachure >= HACHURE_PLAQUE_MIN &&
                            (signal ? (
                              <span
                                className="signal-plate tnum px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                                data-signal-groupe="deficit"
                              >
                                − {enHeures(c.deficit)}
                              </span>
                            ) : (
                              <span className="tnum bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                                − {enHeures(c.deficit)}
                              </span>
                            ))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* LA LIGNE DE BESOIN — une seule, sur la bande entière. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 h-px bg-text-secondary"
                style={{ bottom: BESOIN_H * pxParHeure }}
              />
            </div>

            {/* LA RANGÉE DE PIED — même grille que la bande, cellule par
                cellule : c'est ce qui garantit qu'un libellé est bien SOUS sa
                colonne (§0.6). */}
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {colonnes.map((c) => {
                const signal = c === jourAmbre;
                return (
                  <div key={c.iso} className="min-w-0 text-center">
                    <p
                      className={`truncate font-mono text-[10px] uppercase tracking-[0.12em] ${
                        signal ? 'text-signal' : c.ouvre ? 'text-text-secondary' : 'text-text-muted'
                      }`}
                      data-signal-groupe={signal ? 'deficit' : undefined}
                    >
                      {c.date.toLocaleDateString(locale, { weekday: 'short' })}
                    </p>
                    <p className="tnum truncate font-mono text-[10px] text-text-muted">
                      {c.pile > 0 ? enHeures(c.pile) : '—'}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
              Le besoin ne s'applique qu'aux jours ouvrés : un samedi sous la ligne n'est pas un
              déficit, et il n'est pas hachuré. Les heures viennent des postes — matin et après-midi
              valent {enHeures(4)}, une journée {enHeures(8)}, un repos rien.
            </p>
          </motion.section>

          {/* AUTOUR — à gauche les personnes, à droite le bilan de la semaine. */}
          <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">Heures par personne</p>
              {parPersonne.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Aucun membre actif dans l'organisation.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {parPersonne.map((p) => (
                    <li
                      key={p.membre.id}
                      className="flex items-center gap-3 border border-border bg-bg px-3 py-2.5"
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center font-mono text-[11px] uppercase text-text-body"
                        style={{ background: p.remplissage }}
                      >
                        {(nomCourt(p.membre.email)[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm capitalize text-text-primary">
                          {nomCourt(p.membre.email)}
                        </span>
                        <span className="tnum block truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {p.joursTravailles} jour{p.joursTravailles > 1 ? 's' : ''} · {p.repos} repos
                        </span>
                      </span>
                      <span className="tnum flex-shrink-0 font-mono text-[13px] font-semibold text-text-primary">
                        {enHeures(p.heures)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {/*
                CE QUE LE MODÈLE NE PORTE PAS, dit plutôt qu'inventé.

                La maquette parle des « contraintes » de chaque personne. Le
                produit n'en stocke aucune : ni heures contractuelles, ni
                disponibilités, ni maximum hebdomadaire. Inventer un « 35 h
                max » au rendu ferait croire à une règle que rien ne fait
                respecter. On affiche donc ce qui existe — heures posées,
                jours travaillés, repos — et on dit l'absence.
              */}
              <p className="mt-3 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                Les heures contractuelles et les disponibilités de chacun ne sont pas encore dans le
                produit : ce tableau compte ce qui est posé, pas ce qui est dû.
              </p>
            </section>

            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">La semaine</p>
              <p className="tnum mt-3 text-[27px] font-semibold leading-none text-text-primary">
                {deficitTotal > 0 ? `− ${enHeures(deficitTotal)}` : enHeures(0)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                déficit total sur les jours ouvrés
              </p>
              <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                {jourExcedent
                  ? `Le ${jourEntier(jourExcedent.date).toLowerCase()} est en excédent de ${enHeures(jourExcedent.excedent)} — c'est là qu'il y a des heures à déplacer.`
                  : 'Aucun jour en excédent : rien à déplacer, il faut ajouter.'}
              </p>
            </section>
          </motion.div>

          {/*
            LA SEMAINE EN LIGNES DE JOURS — la matrice retournée.

            Une ligne par jour, la couverture en chiffre à gauche, les membres
            en jetons à droite. Un membre sans poste reste visible en pointillé :
            c'est ce qui permet d'en poser un sans chercher où cliquer. Voir
            l'en-tête du fichier pour l'arbitrage contre la deuxième matrice.
          */}
          <motion.ul variants={staggerItem} className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
            {jours.map((j) => {
              const day = isoJour(j);
              const n = couvertureDe(day);
              const cejour = day === aujourdhui;
              const vide = n === 0;
              return (
                <li key={day} className={`flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${cejour ? 'bg-elevated' : 'bg-surface'}`}>
                  <div className="flex w-full items-baseline gap-3 sm:w-52 sm:flex-shrink-0">
                    <span className={`text-[21px] font-semibold leading-none tabular-nums ${vide ? 'text-text-muted' : 'text-text-primary'}`}>{n}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary">{jourEntier(j)}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {cejour ? t('planning.aujourdhui') : ditLaCouverture(n)}
                      </span>
                    </span>
                  </div>
                  <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {actifs.map((m) => {
                      const k = parCase.get(`${m.email}|${day}`)?.kind ?? null;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => void tourner(m.email, day)}
                            aria-label={`${nomCourt(m.email)} · ${dateCourte(j)} · ${k ? poste(k) : t('planning.kind.vide')}`}
                            className={`input-focus flex min-h-11 items-center gap-1.5 border px-2.5 text-xs transition-colors hover:bg-surface-hover md:min-h-0 md:py-1.5 ${
                              k ? teinte[k] : 'border-dashed border-border text-text-muted'
                            }`}
                          >
                            <span className="capitalize">{nomCourt(m.email)}</span>
                            {k && <span className="font-mono text-[9px] uppercase tracking-wider opacity-80">{poste(k)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </motion.ul>
          <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('planning.legende')}</motion.p>
        </>
      )}
    </motion.section>
  );
}

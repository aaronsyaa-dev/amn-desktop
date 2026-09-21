import React from 'react';
import { motion } from 'framer-motion';

/**
 * LES CINQ ÉTATS TRANSVERSES — ni des modules, ni des familles (BLOC 3)
 * ════════════════════════════════════════════════════════════════════
 *
 * Ces états peuvent survenir sur N'IMPORTE LEQUEL des soixante-et-onze écrans.
 * Les écrire à la main écran par écran, c'est soixante-et-onze occasions de
 * les écrire un peu différemment — et au bout d'un an, cinq états deviennent
 * cinquante formes. Ils vivent donc ici, une fois, et les écrans les
 * REMPLISSENT au lieu de les redessiner.
 *
 * Ce fichier ne contient que la FORME. Aucune donnée, aucune phrase par
 * défaut : ce qu'il y a à dire dépend du module, et un état transverse qui
 * parlerait à la place de l'écran dirait forcément une généralité.
 */

/* ════════════════════════════════════════════════════════════════════════
   T1 · L'ÉTAT VIDE QUI INVITE (`27a`)
   ════════════════════════════════════════════════════════════════════════

   L'ÉCRAN REND SON PROPRE INSTRUMENT, À VIDE, et pose l'invitation dedans.
   Pas une boîte centrée avec une icône : l'instrument du module — ses axes,
   ses graduations, ses lignes de partage, ses quadrants nommés — dessiné
   sans mesures.

   POURQUOI CETTE FORME ET PAS UNE AUTRE. Un état vide ordinaire dit « il n'y
   a rien ». Un instrument à vide dit « voilà ce qui sera mesuré, et où » :
   le vide cesse d'être une absence pour devenir une PROMESSE. C'est la seule
   forme d'état vide qui apprend quelque chose.

   LA GÉOMÉTRIE EST EXACTE, ET C'EST TOUTE LA DIFFÉRENCE. Le cadre passe en
   pointillé et l'encre à la sourdine, mais les axes gardent leurs positions,
   les graduations leur pas, les quadrants leurs noms. Un instrument
   approximatif ne serait plus une promesse, seulement une décoration — et
   quand les premières données arriveraient, elles ne tomberaient pas où
   l'écran les avait annoncées.

   CE QUE L'INSTRUMENT NE DOIT PAS CONTENIR : aucun chiffre. Une graduation
   se nomme (« 30 jours », « URGENT »), elle ne compte pas. Un zéro dans un
   instrument à vide, c'est la faute de `27b`, une case plus loin.

   L'AMBRE : AUCUN. Un écran vide n'a rien à signaler. C'est l'exception à la
   règle d'ambre, et elle est délibérée — `EcranVide` la fait déjà respecter
   aux composants partagés.
*/
export function InstrumentVide({
  titre,
  children,
  hauteur,
  action,
  amorces,
  phrase,
}: {
  /** Ce que le module fait, à la taille d'un titre d'écran (27 px). */
  titre: string;
  /** Ce que l'instrument encodera, en une phrase. */
  phrase: React.ReactNode;
  /**
   * L'instrument du module, dessiné à vide et à sa géométrie exacte. Il est
   * rendu en `currentColor` sur une encre de sourdine : dessinez-le avec
   * `currentColor` plutôt qu'avec une couleur en dur, sinon il gardera
   * l'encre d'un instrument qui a des mesures.
   */
  children: React.ReactNode;
  /** La hauteur de la bande de l'instrument, la même qu'une fois rempli. */
  hauteur: number;
  /** L'action primaire. Une seule, et une seule fois par écran. */
  action?: { label: string; onClick: () => void };
  /**
   * DEUX OU TROIS AMORCES, ET DES CHEMINS RÉELS. Jamais des suggestions
   * génériques : une amorce qui ne mène nulle part est une promesse de plus
   * sur un écran qui n'en a encore tenu aucune.
   */
  amorces?: { label: string; onClick: () => void }[];
}) {
  return (
    <section className="border border-dashed border-border-strong p-5 sm:p-6">
      {/* L'INSTRUMENT, À SA HAUTEUR RÉELLE ET À SA GÉOMÉTRIE EXACTE. */}
      <div
        aria-hidden
        className="w-full border-b border-border pb-5 text-text-muted"
        style={{ height: hauteur + 21 }}
      >
        {children}
      </div>

      {/* L'INVITATION, POSÉE DEDANS. Le filet de séparation tient toute la
          largeur du cadre, pas celle du texte : un trait qui s'arrête au
          milieu se lit comme un bord manquant. */}
      <div className="mt-5 max-w-xl">
        <p className="text-[27px] font-bold leading-[1.08] tracking-[-0.028em] text-text-primary">{titre}</p>
        <p className="mt-3 text-[14.5px] leading-[1.7] text-text-secondary [text-wrap:pretty]">{phrase}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-5 bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
          >
            {action.label}
          </button>
        )}
      </div>

      {amorces && amorces.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          {amorces.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="min-h-11 border border-border px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-2"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   T2 · LE PREMIER JOUR (`27b`)
   ════════════════════════════════════════════════════════════════════════

   LE CAS LE PLUS DIFFICILE : TOUT EST VIDE À LA FOIS. La règle « une seule
   invitation par écran » interdit d'en poser une par carte — trois
   invitations côte à côte ne font pas trois fois mieux, elles font un écran
   qui supplie.

   La composition tenue : l'instrument principal garde ses graduations, porte
   la phrase qui dit que rien n'est encore passé, et sous lui la SEULE
   invitation de l'écran. Les autres cartes passent en muet : une phrase en
   encre pleine qui dit ce qu'elles contiendront, aucune action.

   AUCUN CHIFFRE À ZÉRO NULLE PART — la règle la plus importante de cet état,
   et elle vaut pour tout état vide du produit. « 0 € encaissé » se lit comme
   un échec ; « rien n'est encore passé en caisse » se lit comme un début.
   C'est la différence entre un outil qui accuse quelqu'un dès son premier
   jour et un outil qui l'accueille. Les cartes calmes n'acceptent donc
   qu'une phrase — pas de `valeur`, pas de compteur : le type l'interdit.
*/
export function PremierJour({
  axe,
  hauteurAxe,
  phraseAxe,
  titre,
  phrase,
  action,
  calmes,
}: {
  /** L'instrument principal, à vide, à sa géométrie exacte (`currentColor`). */
  axe: React.ReactNode;
  hauteurAxe: number;
  /** « La journée n'a rien encore » — un fait, jamais un reproche. */
  phraseAxe: string;
  /** L'unique invitation de l'écran (22 px). */
  titre: string;
  phrase: React.ReactNode;
  action?: { label: string; onClick: () => void };
  /**
   * Les cartes calmes : un titre et une phrase. PAS de valeur — un premier
   * jour n'affiche aucun chiffre, et le type est le garde-fou.
   */
  calmes?: { titre: string; phrase: string }[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="border border-dashed border-border-strong p-5 sm:p-6">
        <div aria-hidden className="w-full text-text-muted" style={{ height: hauteurAxe }}>
          {axe}
        </div>
        <p className="mt-4 text-[14.5px] leading-[1.7] text-text-secondary">{phraseAxe}</p>

        {/* LA SEULE INVITATION DE L'ÉCRAN. Le filet tient toute la largeur. */}
        <div className="mt-5 border-t border-border pt-5">
          <div className="max-w-xl">
          <p className="text-[22px] font-bold leading-[1.1] tracking-[-0.024em] text-text-primary">{titre}</p>
          <p className="mt-2.5 text-[14px] leading-[1.7] text-text-secondary [text-wrap:pretty]">{phrase}</p>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-4 bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
            >
              {action.label}
            </button>
          )}
          </div>
        </div>
      </section>

      {calmes && calmes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {calmes.map((c) => (
            /* ENCRE PLEINE, AUCUNE ACTION. Se taire ne veut pas dire devenir
               illisible : on retire l'invitation, pas le contraste. */
            <section key={c.titre} className="panel p-4">
              <p className="eyebrow mb-2">{c.titre}</p>
              <p className="text-[13.5px] leading-[1.7] text-text-secondary">{c.phrase}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   T3 · LE FORMULAIRE LONG (`27c`)
   ════════════════════════════════════════════════════════════════════════

   UN ASSISTANT NE MONTRE PAS SON PROPRE PROGRÈS, IL MONTRE CE QU'IL FABRIQUE.
   Une barre « étape 2 sur 3 » informe sur le formulaire ; elle n'apprend rien
   sur la chose qu'on est en train de faire. À droite, donc, l'objet RÉEL qui
   se remplit poste par poste — et ce que les étapes suivantes apporteront
   reste dessiné en filet pointillé, avec la mention de l'étape qui le
   remplira. On sait à tout instant ce qui manque et ce que ça vaut.

   RIEN N'EST CRÉÉ AVANT LE DERNIER BOUTON. Quitter en cours de route ne
   laisse rien derrière, et l'écran le dit — un assistant qui écrit à chaque
   étape sème des objets à moitié faits que personne ne vient nettoyer.

   L'ACTION PRIMAIRE INACTIVE A SON PROPRE TRAITEMENT : fond
   `--color-action-inactive`, aucune ombre. C'est la PERTE D'ÉLÉVATION qui la
   rend inactive à l'œil, pas une opacité. La règle vit dans `src/index.css`
   (`button.bg-accent:disabled`), donc il suffit ici d'un vrai `disabled` —
   et l'assistant doit l'afficher tant que son champ requis est vide, sinon
   il démontre le contraire de ce qu'il affirme.

   L'AMBRE : l'étape courante — sa barre, son numéro, son nom. Trois nœuds,
   une seule région.
*/
const ETAPE_H = 5;

export function BarreEtapes({
  etapes,
  courante,
}: {
  /** Les étapes, dans l'ordre. Leur nom dit ce qu'on y fait, pas « Étape 2 ». */
  etapes: string[];
  /** L'index de l'étape en cours, à partir de zéro. */
  courante: number;
}) {
  return (
    <ol className="flex w-full gap-3">
      {etapes.map((nom, i) => {
        const ambre = i === courante;
        return (
          <li key={nom} className="min-w-0 flex-1" data-signal-groupe={ambre ? 'etape-courante' : undefined}>
            <span
              data-signal-groupe={ambre ? 'etape-courante' : undefined}
              className="block w-full"
              style={{
                height: ETAPE_H,
                backgroundColor: ambre
                  ? 'var(--color-signal)'
                  : i < courante
                    ? 'var(--color-text-body)'
                    : 'var(--color-border)',
              }}
              aria-hidden
            />
            <p
              data-signal-groupe={ambre ? 'etape-courante' : undefined}
              className={`mt-2 truncate font-mono text-[10px] uppercase tracking-[0.16em] ${
                ambre ? 'text-signal' : 'text-text-muted'
              }`}
            >
              {i + 1} · {nom}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Une ligne de l'aperçu que l'étape courante ne remplit pas encore : filet
 * pointillé et mention de l'étape qui la remplira. Ce n'est pas un
 * remplissage décoratif — c'est la réponse à « qu'est-ce qui manque ? ».
 */
export function LigneAVenir({ quoi, etape }: { quoi: string; etape: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border py-2 last:border-b-0">
      <span className="min-w-0 truncate text-[13px] text-text-muted">{quoi}</span>
      <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
        à l’étape {etape}
      </span>
    </div>
  );
}

export function AssistantLong({
  etapes,
  courante,
  champs,
  apercu,
  titreApercu,
  pied,
}: {
  etapes: string[];
  courante: number;
  /** Les champs de l'étape courante, et eux seuls. */
  champs: React.ReactNode;
  /** L'objet réel en train de se fabriquer. */
  apercu: React.ReactNode;
  titreApercu: string;
  /** Les actions : précédent, suivant, et le dernier bouton qui crée. */
  pied: React.ReactNode;
}) {
  return (
    <section className="panel-raised p-5 sm:p-6">
      <BarreEtapes etapes={etapes} courante={courante} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">{champs}</div>
        {/* CE QUE L'ASSISTANT FABRIQUE — à droite, en train de se remplir. */}
        <aside className="panel p-4">
          <p className="eyebrow mb-3">{titreApercu}</p>
          {apercu}
        </aside>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">{pied}</div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   T4 · LE REFUS (`27d`)
   ════════════════════════════════════════════════════════════════════════

   UN REFUS N'EST PAS UNE ALERTE : C'EST UNE BIFURCATION. Une alerte dit
   « non » et laisse la personne devant le même écran, avec le même geste à
   refaire à l'aveugle. Une bifurcation montre CE QUI BLOQUE, QUI LE BLOQUE,
   et par où passer.

   Le conflit est donc dessiné, en petit : deux barres qui se chevauchent sur
   un axe horaire, le nom de qui occupe le créneau gravé dans sa barre. Puis
   deux créneaux libres CLIQUABLES, avec leur durée et leur position
   relative — des chemins réels, jamais une suggestion textuelle.

   L'ÉCRAN DERRIÈRE RESTE VISIBLE. Un voile opaque coupe la personne de son
   contexte au moment précis où elle en a besoin : elle vient de saisir des
   heures, et c'est en les revoyant qu'elle comprend le refus.

   L'AMBRE : la barre du créneau DEMANDÉ et son étiquette. Deux nœuds. LE NOM
   DE LA PERSONNE QUI OCCUPE LE CRÉNEAU RESTE EN ENCRE CLAIRE — ce n'est pas
   elle le sujet du refus, et l'ambre sur son nom la désignerait comme la
   fautive.

   RIEN N'A ÉTÉ ENREGISTRÉ, et la fenêtre le dit sous les créneaux.
*/
const FENETRE_L = 560;
const AXE_H = 56;
const BARRE_H = 18;

export interface Creneau {
  /** Minutes depuis minuit. */
  debut: number;
  fin: number;
}

export function FenetreRefus({
  titre,
  demande,
  occupe,
  parQui,
  borneBasse,
  borneHaute,
  libres,
  formaterHeure,
  surCreneau,
  onFermer,
  libelleFermer,
  rienEnregistre,
}: {
  titre: string;
  /** Le créneau demandé — celui qui porte l'ambre. */
  demande: Creneau;
  /** Le créneau qui bloque. */
  occupe: Creneau;
  /** Qui l'occupe. Gravé dans sa barre, en encre claire. */
  parQui: string;
  /** Les bornes de l'axe, en minutes depuis minuit (journée ouvrable). */
  borneBasse: number;
  borneHaute: number;
  /** Les sorties réelles. Deux au plus : au-delà, ce n'est plus une bifurcation. */
  libres: Creneau[];
  formaterHeure: (minutes: number) => string;
  surCreneau: (c: Creneau) => void;
  onFermer: () => void;
  libelleFermer: string;
  /** La phrase qui affirme que rien n'a été enregistré. */
  rienEnregistre: string;
}) {
  const etendue = Math.max(1, borneHaute - borneBasse);
  const part = (m: number) => ((m - borneBasse) / etendue) * 100;
  const largeur = (c: Creneau) => Math.max(1.5, part(c.fin) - part(c.debut));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/*
        L'ÉCRAN DERRIÈRE RESTE VISIBLE : 65 % de noir, pas un voile opaque.
        C'est le contexte du geste, et le refus parle DE ce contexte.
      */}
      <button
        type="button"
        aria-label={libelleFermer}
        onClick={onFermer}
        className="absolute inset-0 bg-bg/65"
      />
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="relative w-full border border-border-strong bg-surface p-5 shadow-[0_28px_60px_-24px_rgba(0,0,0,.95)]"
        style={{ maxWidth: FENETRE_L }}
      >
        <p className="text-[17px] font-semibold leading-tight text-text-primary">{titre}</p>

        {/* LE CONFLIT, DESSINÉ. Deux barres sur le même axe : le chevauchement
            se VOIT, il n'est pas raconté. */}
        <div className="relative mt-4 w-full border-y border-border" style={{ height: AXE_H }}>
          {/* La barre qui occupe — encre claire, nom gravé dedans. */}
          <div
            className="absolute flex items-center overflow-hidden bg-raised px-2"
            style={{
              left: `${part(occupe.debut)}%`,
              width: `${largeur(occupe)}%`,
              top: 8,
              height: BARRE_H,
              border: '1px solid var(--color-border-strong)',
            }}
          >
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-text-secondary">{parQui}</span>
          </div>
          {/* LA BARRE DEMANDÉE — l'ambre, sous celle qui occupe. */}
          <div
            data-signal-groupe="creneau-demande"
            className="absolute bg-signal"
            style={{
              left: `${part(demande.debut)}%`,
              width: `${largeur(demande)}%`,
              top: 8 + BARRE_H + 4,
              height: BARRE_H,
            }}
            aria-hidden
          />
          <p
            data-signal-groupe="creneau-demande"
            className="absolute font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-signal"
            style={{ left: `${part(demande.debut)}%`, top: 8 + BARRE_H * 2 + 8 }}
          >
            {formaterHeure(demande.debut)} → {formaterHeure(demande.fin)} · demandé
          </p>
        </div>

        {/* LES SORTIES — réelles et cliquables. */}
        {libres.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {libres.slice(0, 2).map((c) => {
              const minutes = c.fin - c.debut;
              const duree = minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${minutes % 60}`;
              const avant = c.fin <= demande.debut;
              return (
                <li key={`${c.debut}-${c.fin}`}>
                  <button
                    type="button"
                    onClick={() => surCreneau(c)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 border border-border-strong px-3 text-left transition-colors hover:bg-surface-hover md:min-h-0 md:py-2.5"
                  >
                    <span className="text-[14px] text-text-primary">
                      {formaterHeure(c.debut)} → {formaterHeure(c.fin)}
                    </span>
                    <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {duree} · {avant ? 'avant' : 'après'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-[13px] leading-relaxed text-text-secondary">{rienEnregistre}</p>

        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={onFermer}
            className="min-h-11 border border-border px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-2"
          >
            {libelleFermer}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   T5 · LE HORS-LIGNE (`27e`)
   ════════════════════════════════════════════════════════════════════════

   UNE FILE D'ATTENTE DEVANT UNE BARRIÈRE. À gauche de la barrière, ce qui
   est déjà parti et ne bougera plus ; à droite, ce qui attend, DANS L'ORDRE
   OÙ IL REPARTIRA. La barrière porte l'heure de la coupure.

   LE PRODUIT CONTINUE DE FONCTIONNER, et l'écran le montre en laissant tout
   le reste en pleine encre plutôt qu'en grisant la page. Griser la page dit
   « l'application est morte » ; elle ne l'est pas, elle écrit en local et
   enverra à la reprise. Le mensonge coûte cher : quelqu'un qui croit l'outil
   mort arrête de saisir, et c'est le travail de la coupure qui est perdu,
   pas la synchronisation.

   L'AMBRE : la barrière et ce qui attend derrière elle — une seule région,
   même si elle compte onze nœuds. L'indicateur de la barre de titre rappelle
   la même heure et reste donc en encre claire : deux ambres pour un seul
   fait, ce serait deux signaux pour une seule décision.
*/
const WAGON_H = 34;

export function FileHorsLigne({
  depuis,
  partis,
  attente,
  surtitreAttente,
  titre,
}: {
  /** L'heure de la coupure, déjà formatée. */
  depuis: string;
  /** Ce qui est parti avant la coupure. */
  partis: { id: string; quoi: string; heure: string }[];
  /** Ce qui attend, dans l'ordre où il repartira. */
  attente: { id: string; quoi: string; heure: string }[];
  surtitreAttente: string;
  titre: string;
}) {
  return (
    <section data-signal-groupe="barriere" className="panel-raised p-5 sm:p-6">
      <p className="eyebrow mb-4">{titre}</p>
      <div className="flex items-stretch gap-4">
        {/* CE QUI EST DÉJÀ PARTI — encre ordinaire, il ne bougera plus. */}
        <ul className="flex min-w-0 flex-1 flex-col gap-2">
          {partis.length === 0 ? (
            /* LE PRODUIT NE GARDE PAS DE JOURNAL DE CE QUI EST PARTI. Écrire
               « rien n'était parti » serait faux : tout ce qui n'est plus
               dans la file est arrivé, simplement personne ne l'a noté. La
               colonne dit donc ce qu'elle sait, et pas davantage. */
            <li className="text-[13px] leading-relaxed text-text-secondary">
              Tout ce qui n’est pas dans la file est déjà arrivé. Le produit n’en garde pas la liste : une
              écriture qui est partie n’a plus de raison d’exister quelque part.
            </li>
          ) : (
            partis.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 border border-border bg-surface px-3"
                style={{ height: WAGON_H }}
              >
                <span aria-hidden className="h-2 w-2 flex-shrink-0 rounded-full bg-text-body" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">{p.quoi}</span>
                <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-text-muted">{p.heure}</span>
              </li>
            ))
          )}
        </ul>

        {/* LA BARRIÈRE — le bandeau et sa rayure, l'heure à la verticale. */}
        <div
          data-signal-groupe="barriere"
          className="flex flex-shrink-0 flex-col items-center justify-center px-1"
          style={{ borderLeft: '2px dashed var(--color-signal)' }}
        >
          <span
            data-signal-groupe="barriere"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-signal"
            style={{ writingMode: 'vertical-rl' }}
          >
            {depuis}
          </span>
        </div>

        {/* CE QUI ATTEND — dans l'ordre où il repartira. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <p
            data-signal-groupe="barriere"
            className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-signal"
          >
            {surtitreAttente} · {attente.length}
          </p>
          <ul className="flex flex-col gap-2">
            {attente.map((a) => (
              <li
                key={a.id}
                data-signal-groupe="barriere"
                className="flex items-center gap-2 border border-signal-line bg-signal-muted px-3"
                style={{ height: WAGON_H }}
              >
                <span data-signal-groupe="barriere" aria-hidden className="h-2 w-2 flex-shrink-0 rounded-full bg-signal" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{a.quoi}</span>
                <span
                  data-signal-groupe="barriere"
                  className="flex-shrink-0 font-mono text-[10px] tabular-nums text-signal"
                >
                  {a.heure}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

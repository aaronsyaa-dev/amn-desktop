import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { choixMouvement, ecrireMouvement, lireMouvement, useMouvement, type NiveauMouvement } from '../../../socle/mouvement';
import { FAMILLES } from '../../../socle/familles';
import {
  Anneau,
  AnneauProgression,
  Avatar,
  BarreProgression,
  Barres,
  BlocEtat,
  BoiteRecherche,
  Bouton,
  BoutonIcone,
  Caret,
  Carte,
  CarteAnneau,
  CarteCases,
  CarteJalon,
  CarteModule,
  CarteSerie,
  CaseACocher,
  CelluleAvatar,
  CelluleBouton,
  CelluleCase,
  CelluleDate,
  CelluleEtat,
  CelluleIcone,
  CelluleInterrupteur,
  CelluleMontant,
  CelluleNom,
  CelluleProgression,
  CelluleTag,
  CelluleTexte,
  Chargement,
  ChronologieTemps,
  ColonneDroite,
  ColonneKanban,
  Courbe,
  DetailScinde,
  DispositionPage,
  Donut,
  DrapeauUrgent,
  ElementListe,
  EnTeteDePage,
  EtapeFranchie,
  Etiquette,
  EtatVide,
  FilterChips,
  FlowLine,
  Gauge,
  GrilleCartes,
  HeatCell,
  IconeEtincelle,
  InlineSuggestion,
  Interrupteur,
  Kanban,
  LigneActivite,
  LigneTache,
  LigneTemps,
  ListeScindee,
  LiveDot,
  MiniCourbe,
  Modale,
  Onglets,
  Page,
  PanneauOnglet,
  PastilleEtat,
  PastilleFiltre,
  PileAvatars,
  RangeeKpi,
  Raccourci,
  SANS_ACTION,
  Saisie,
  Scinde,
  Segmente,
  Selecteur,
  Semaine,
  Severity,
  SousCarte,
  Squelette,
  SqueletteLignes,
  SuggestionAjmani,
  Tableau,
  Tag,
  TexteTronque,
  TuileAjouter,
  TuileKpi,
  Ticket,
  debutDeSemaine,
  formaterDate,
  formaterEuro,
  formaterMontant,
  tonDeSante,
  type ColonneTableau,
  type EtatPastille,
  type TonBarre,
  type TonEtat,
  type TonVariation,
  type NiveauSeverite,
  type TonVivant,
} from '../../../socle/ui';
import { arriveeLigne } from '../../../socle/couche-mouvement';
import {
  BARRES,
  COLONNES_KANBAN,
  COURBE,
  COURBE_SECONDE,
  COURBE_UN_POINT,
  LIGNES_TABLEAU,
  MESSAGES,
  MODULES,
  MOMENTS,
  ORGANISATIONS,
  PARTS_DONUT,
  PERSONNES,
  SEUILS_SANTE,
  TENDANCE,
  TENDANCE_BAISSE,
  evenementsDeLaSemaine,
  nomsDesJours,
  type ColonneExemple,
  type LigneExemple,
  type TicketExemple,
} from './exemples';
import { useMotsDemo } from './i18n';
import './demo.css';

/**
 * LA PAGE DE DÉMONSTRATION DU SOCLE — réservée au développement, édition interne.
 *
 * Chaque composant de `src/socle/ui/` dans tous ses états, sur le fond de la page (`--socle-fond-page`), pour le
 * comparer à `01-SOCLE-DESIGN.md` (§1 jetons, §4 composants, §5 archétypes). Elle ne sert qu'aux yeux des
 * développeurs : rien d'autre ne l'importe, et son seul point d'entrée est la route `/dev/socle` (derrière
 * `import.meta.env.DEV`, hors coquille, connectée), posée par la couture de l'édition interne.
 *
 * ## Ce que la page tient
 *
 *   · Les couleurs, tailles et polices ne viennent que de `src/socle/noir.css` : la feuille `demo.css` ne
 *     contient aucune couleur en dur, et aucune encre « discret » ne sert de couleur de texte.
 *   · Aucun nom propre : tout vient de `exemples.ts` (« Projet A », « Personne 1 »). Aucun texte en dur
 *     ici : tout passe par `i18n.ts`.
 *   · Le sommaire n'utilise PAS d'ancres `href="#…"` : l'application est en HashRouter, un `#` y changerait de
 *     route. Ce sont des boutons qui font `scrollIntoView`.
 *   · La page ne laisse rien derrière elle : le réglage Mouvement qu'elle aurait changé est remis à son état
 *     d'avant au démontage.
 *   · Pas d'interrupteur « thème clair » : le thème clair de `src/index.css` ne redéfinit que les noms
 *     `--color-*` des briques d'origine ; les briques noires lisent `--socle-*`, que rien n'y redéfinit. Un
 *     interrupteur n'aurait donc rien changé à l'écran. À reposer le jour où ce thème existe.
 *   · Les états de chargement, vide, erreur, hors connexion, confirmation et toast ne sont PAS refaits ici :
 *     ils ont leur page (`/dev/etats`, H43).
 *
 * Route : `import PageDemoSocle from '…/demo/PageDemoSocle'` (export par défaut, pour `lazy`).
 */

/** Les sections, dans l'ordre du sommaire. L'identifiant sert à l'ancre (`sd-<id>`) et aux clés de `i18n.ts`. */
export const SECTIONS = [
  'jetons',
  'boutons',
  'cartes',
  'avatars',
  'progression',
  'kpi',
  'champs',
  'taches',
  'ludiques',
  'suggestion',
  'graphiques',
  'archetypes',
  'gabarit',
  'etats',
  'mouvement',
  'vivant',
] as const;
export type IdSection = (typeof SECTIONS)[number];

/* ─────────────────────────────  Les petites pièces de la page  ───────────────────────────── */

function Section({ id, children }: { id: IdSection; children: React.ReactNode }) {
  const { tm } = useMotsDemo();
  const idTitre = `sd-${id}-titre`;
  return (
    <section id={`sd-${id}`} data-section={id} aria-labelledby={idTitre} className="sd-section">
      <h2 id={idTitre} className="sd-section__titre">
        {tm(`s.${id}.titre`)}
      </h2>
      <p className="sd-section__desc">{tm(`s.${id}.desc`)}</p>
      <p className="sd-section__etats">
        <span className="sd-section__etats-etiquette">{tm('etats.etiquette')}</span> {tm(`s.${id}.etats`)}
      </p>
      {children}
    </section>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="sd-bloc">
      <h3 className="sd-bloc__titre">{titre}</h3>
      {children}
    </div>
  );
}

/** Un exemple et sa légende : le nom de l'état qu'il montre. */
function Cas({ legende, children }: { legende: string; children: React.ReactNode }) {
  return (
    <figure className="sd-cas">
      <div className="sd-cas__corps">{children}</div>
      <figcaption className="sd-cas__legende">{legende}</figcaption>
    </figure>
  );
}

/** Un cadre de hauteur fixe : les archétypes prennent « la hauteur restante », il leur faut donc un parent qui en a une. */
function Cadre({ hauteur, largeurMin, children }: { hauteur: number; largeurMin?: number; children: React.ReactNode }) {
  return (
    <div className="sd-defile-x">
      <div className="sd-cadre" style={{ '--sd-hauteur': `${hauteur}px`, '--sd-largeur-min': largeurMin ? `${largeurMin}px` : undefined } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** Le tableau d'un état à l'autre : un `Segmente` pour le choisir. */
function ChoixEtat<T extends string>({ libelle, options, valeur, onChange }: { libelle: string; options: { cle: T; libelle: string }[]; valeur: T; onChange: (v: T) => void }) {
  return <Segmente libelle={libelle} options={options} valeur={valeur} onChange={(c) => onChange(c as T)} />;
}

/* ─────────────────────────────  1. Les jetons  ───────────────────────────── */

type GenreEchantillon = 'fond' | 'bord' | 'encre' | 'decor' | 'famille' | 'etat' | 'avatar';
type CleRole = 'role.t1' | 'role.t2' | 'role.t3' | 'role.t4' | 'role.decor1' | 'role.decor2';

interface Jeton {
  jeton: string;
  role?: CleRole;
}

/** Les jetons montrés, par groupe. Chaque nom doit exister dans `noir.css` : `check:systeme-demo` le vérifie. */
const GROUPES_JETONS: { cle: 'fonds' | 'bordures' | 'encres' | 'decor' | 'familles' | 'etats' | 'avatars'; genre: GenreEchantillon; jetons: Jeton[] }[] = [
  {
    cle: 'fonds',
    genre: 'fond',
    jetons: [
      '--socle-fond-page',
      '--socle-fond-lateral',
      '--socle-carte-haut',
      '--socle-carte-bas',
      '--socle-sous-carte',
      '--socle-ticket',
      '--socle-champ',
      '--socle-encart',
      '--socle-survol',
      '--socle-piste',
      '--socle-suggestion-haut',
      '--socle-suggestion-bas',
      '--socle-tag',
      '--socle-pilule',
    ].map((jeton) => ({ jeton })),
  },
  {
    cle: 'bordures',
    genre: 'bord',
    jetons: [
      '--socle-bord-carte',
      '--socle-bord-sous-carte',
      '--socle-bord-bouton',
      '--socle-bord-controle',
      '--socle-bord-entete',
      '--socle-bord-ligne',
      '--socle-bord-lateral',
      '--socle-bord-champ',
      '--socle-bord-ticket',
      '--socle-bord-kanban',
      '--socle-pointille',
    ].map((jeton) => ({ jeton })),
  },
  {
    cle: 'encres',
    genre: 'encre',
    jetons: [
      { jeton: '--socle-texte-1', role: 'role.t1' },
      { jeton: '--socle-texte-courant', role: 'role.t2' },
      { jeton: '--socle-texte-2', role: 'role.t3' },
      { jeton: '--socle-texte-3', role: 'role.t4' },
    ],
  },
  {
    cle: 'decor',
    genre: 'decor',
    jetons: [
      { jeton: '--socle-trait-discret', role: 'role.decor1' },
      { jeton: '--socle-trait-tres-discret', role: 'role.decor2' },
    ],
  },
  { cle: 'familles', genre: 'famille', jetons: FAMILLES.map((f) => ({ jeton: `--socle-fam-${f}` })) },
  { cle: 'etats', genre: 'etat', jetons: ['succes', 'attention', 'critique', 'info'].map((e) => ({ jeton: `--socle-etat-${e}` })) },
  { cle: 'avatars', genre: 'avatar', jetons: ['a', 'm', 'r', 'c', 't', 'l'].map((a) => ({ jeton: `--socle-avatar-${a}` })) },
];

/** La valeur d'un jeton, lue sur `<html>` à l'exécution (et relue à l'image suivante, au cas où l'ambiance arrive après nous). */
function useValeurJeton(jeton: string): string {
  const [valeur, setValeur] = useState('');
  useEffect(() => {
    const lire = () => setValeur(window.getComputedStyle(document.documentElement).getPropertyValue(jeton).trim());
    lire();
    const image = window.requestAnimationFrame(lire);
    return () => window.cancelAnimationFrame(image);
  }, [jeton]);
  return valeur;
}

function Echantillon({ jeton, genre, role }: Jeton & { genre: GenreEchantillon }) {
  const { tm } = useMotsDemo();
  const valeur = useValeurJeton(jeton);
  const etat = genre === 'etat' ? jeton.replace('--socle-etat-', '') : null;
  return (
    <figure className="sd-jeton" data-genre={genre}>
      <div className="sd-jeton__echantillon" style={{ '--sd-ech': `var(${jeton})` } as React.CSSProperties}>
        {genre === 'encre' && <span>{tm('jeton.exemple')}</span>}
        {genre === 'avatar' && <span aria-hidden>A</span>}
        {genre === 'etat' && etat && <PastilleEtat etat={etat as EtatPastille}>{tm(`etat.${etat as 'succes' | 'attention' | 'critique' | 'info'}`)}</PastilleEtat>}
      </div>
      <figcaption className="sd-jeton__legende">
        <code className="sd-jeton__nom">{jeton}</code>
        <span className="sd-jeton__valeur">{valeur || '—'}</span>
        {role && <span className="sd-jeton__role">{tm(role)}</span>}
      </figcaption>
    </figure>
  );
}

function SectionJetons() {
  const { tm } = useMotsDemo();
  return (
    <Section id="jetons">
      {GROUPES_JETONS.map((g) => (
        <Bloc key={g.cle} titre={tm(`jeton.groupe.${g.cle}`)}>
          <div className="sd-grille sd-grille--jetons">
            {g.jetons.map((j) => (
              <Echantillon key={j.jeton} genre={g.genre} {...j} />
            ))}
          </div>
        </Bloc>
      ))}
    </Section>
  );
}

/* ─────────────────────────────  2. Les boutons  ───────────────────────────── */

const VARIANTES = ['primaire', 'secondaire', 'discret', 'danger'] as const;
const TAILLES = ['petit', 'moyen', 'grand'] as const;

function MatriceBoutons({ etat }: { etat: 'repos' | 'desactive' | 'chargement' }) {
  const { tm } = useMotsDemo();
  return (
    <div className="sd-matrice" role="group" aria-label={tm(`bouton.etat.${etat}`)}>
      <span aria-hidden />
      {TAILLES.map((t) => (
        <span key={t} className="sd-matrice__entete">
          {tm(`bouton.taille.${t}`)}
        </span>
      ))}
      {VARIANTES.map((v) => (
        <React.Fragment key={v}>
          <span className="sd-matrice__entete">{tm(`bouton.variante.${v}`)}</span>
          {TAILLES.map((t) => (
            <span key={t}>
              <Bouton variante={v} taille={t} disabled={etat === 'desactive'} chargement={etat === 'chargement'}>
                {tm('bouton.libelle')}
              </Bouton>
            </span>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function SectionBoutons() {
  const { tm } = useMotsDemo();
  return (
    <Section id="boutons">
      {(['repos', 'desactive', 'chargement'] as const).map((etat) => (
        <Bloc key={etat} titre={tm(`bouton.etat.${etat}`)}>
          <MatriceBoutons etat={etat} />
        </Bloc>
      ))}
      <Bloc titre={tm('bouton.icone')}>
        <div className="sd-rangee">
          {VARIANTES.map((v) => (
            <Bouton key={v} variante={v} icone={<Plus />} raccourci="⌘N">
              {tm('bouton.nouveau')}
            </Bouton>
          ))}
          <Bouton variante="secondaire" icone={<Download />}>
            {tm('bouton.exporter')}
          </Bouton>
        </div>
      </Bloc>
      <Bloc titre={tm('bouton.pleineLargeur')}>
        <div className="sd-etroit">
          <Bouton variante="secondaire" pleineLargeur>
            {tm('bouton.libelle')}
          </Bouton>
        </div>
      </Bloc>
      <Bloc titre={tm('bouton.iconeSeule')}>
        <div className="sd-rangee">
          <Cas legende={tm('bouton.etat.repos')}>
            <BoutonIcone libelle={tm('bouton.reglages')} icone={<Settings />} />
          </Cas>
          <Cas legende={tm('bouton.etat.desactive')}>
            <BoutonIcone libelle={tm('bouton.reglages')} icone={<Settings />} disabled />
          </Cas>
          <Cas legende={tm('bouton.raccourci')}>
            <Raccourci>⌘K</Raccourci>
          </Cas>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  3. Cartes, tags, pastilles  ───────────────────────────── */

const ETATS_PASTILLE: EtatPastille[] = ['succes', 'attention', 'critique', 'info', 'neutre'];

function SectionCartes() {
  const { tm } = useMotsDemo();
  const [filtre, setFiltre] = useState('tous');
  return (
    <Section id="cartes">
      <Bloc titre={tm('cartes.carte')}>
        <div className="sd-grille" style={{ '--sd-min': '250px' } as React.CSSProperties}>
          <Cas legende={tm('cartes.repos')}>
            <Carte surtitre={tm('cartes.surtitre')} titre={tm('cartes.titre')} actions={<BoutonIcone libelle={tm('bouton.reglages')} icone={<Settings />} />}>
              {tm('cartes.texte')}
            </Carte>
          </Cas>
          <Cas legende={tm('cartes.famille')}>
            <Carte famille="contacts" surtitre={tm('cartes.surtitre')} titre={tm('cartes.titre')}>
              {tm('cartes.texte')}
            </Carte>
          </Cas>
          <Cas legende={tm('cartes.compacte')}>
            <Carte compacte titre={tm('cartes.titre')}>
              {tm('cartes.texte')}
            </Carte>
          </Cas>
          <Cas legende={tm('cartes.active')}>
            <Carte active titre={tm('cartes.titre')}>
              {tm('cartes.texte')}
            </Carte>
          </Cas>
          <Cas legende={tm('cartes.cliquable')}>
            <Carte titre={tm('cartes.titre')} onClick={SANS_ACTION}>
              {tm('cartes.texte')}
            </Carte>
          </Cas>
          <Cas legende={tm('cartes.sansMarge')}>
            <Carte sansMarge>
              <div className="sd-vide-interne">{tm('cartes.texte')}</div>
            </Carte>
          </Cas>
        </div>
      </Bloc>

      <Bloc titre={tm('cartes.sousCarte')}>
        <Carte titre={tm('cartes.titre')}>
          <div className="sd-grille" style={{ '--sd-min': '220px' } as React.CSSProperties}>
            <SousCarte>{tm('cartes.sousTexte')}</SousCarte>
            <SousCarte>{tm('cartes.sousTexte')}</SousCarte>
          </div>
        </Carte>
      </Bloc>

      <Bloc titre={tm('cartes.tags')}>
        <div className="sd-rangee">
          <Cas legende={tm('cartes.neutre')}>
            <Tag>{tm('cartes.tag')}</Tag>
          </Cas>
          {FAMILLES.map((f) => (
            <Cas key={f} legende={f}>
              <Tag famille={f}>{tm('cartes.tag')}</Tag>
            </Cas>
          ))}
          {(['succes', 'attention', 'critique', 'info'] as const).map((e) => (
            <Cas key={e} legende={e}>
              <Tag etat={e}>{tm('cartes.tag')}</Tag>
            </Cas>
          ))}
        </div>
      </Bloc>

      <Bloc titre={tm('cartes.pastilles')}>
        <div className="sd-rangee">
          {ETATS_PASTILLE.map((e) => (
            <Cas key={e} legende={e}>
              <PastilleEtat etat={e}>{tm(`etat.${e}`)}</PastilleEtat>
            </Cas>
          ))}
        </div>
        <div className="sd-rangee">
          {ETATS_PASTILLE.map((e) => (
            <Cas key={e} legende={`${tm('cartes.allegee')} · ${e}`}>
              <PastilleEtat etat={e} allegee>
                {tm(`etat.${e}`)}
              </PastilleEtat>
            </Cas>
          ))}
        </div>
      </Bloc>

      <Bloc titre={tm('cartes.etiquettes')}>
        <div className="sd-rangee">
          <Cas legende={tm('cartes.neutre')}>
            <Etiquette>{tm('cartes.etiquette')}</Etiquette>
          </Cas>
          <Cas legende={tm('cartes.famille')}>
            <Etiquette famille="argent">{tm('cartes.etiquette')}</Etiquette>
          </Cas>
          <Cas legende={tm('cartes.compacte')}>
            <Etiquette compacte>{tm('cartes.etiquette')}</Etiquette>
          </Cas>
          <Cas legende={`${tm('cartes.compacte')} · ${tm('cartes.famille')}`}>
            <Etiquette compacte famille="echanger">
              {tm('cartes.etiquette')}
            </Etiquette>
          </Cas>
        </div>
      </Bloc>

      <Bloc titre={tm('cartes.urgent')}>
        <div className="sd-rangee">
          <Cas legende={tm('cartes.repos')}>
            <DrapeauUrgent />
          </Cas>
          <Cas legende={tm('cartes.libelleLibre')}>
            <DrapeauUrgent>{tm('cartes.enRetard')}</DrapeauUrgent>
          </Cas>
        </div>
      </Bloc>

      <Bloc titre={tm('cartes.filtres')}>
        <div className="sd-rangee" role="group" aria-label={tm('cartes.filtres')}>
          {(
            [
              ['tous', 'cartes.filtre.tous', 24],
              ['actifs', 'cartes.filtre.actifs', 9],
              ['termines', 'cartes.filtre.termines', 15],
            ] as const
          ).map(([cle, mot, n]) => (
            <PastilleFiltre key={cle} actif={filtre === cle} onClick={() => setFiltre(cle)} compteur={n}>
              {tm(mot)}
            </PastilleFiltre>
          ))}
          <PastilleFiltre actif={false} onClick={SANS_ACTION}>
            {tm('cartes.filtre.sansCompteur')}
          </PastilleFiltre>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  4. Les avatars  ───────────────────────────── */

function SectionAvatars() {
  const { tm } = useMotsDemo();
  return (
    <Section id="avatars">
      <Bloc titre={tm('avatars.ronds')}>
        <div className="sd-rangee">
          {PERSONNES.slice(0, 6).map((nom) => (
            <Avatar key={nom} nom={nom} taille={34} />
          ))}
        </div>
        <div className="sd-rangee">
          {[22, 24, 28, 34].map((t) => (
            <Cas key={t} legende={`${t} px`}>
              <Avatar nom={PERSONNES[0]} taille={t} />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('avatars.carres')}>
        <div className="sd-rangee">
          {ORGANISATIONS.map((nom) => (
            <Avatar key={nom} nom={nom} taille={34} forme="carre" />
          ))}
          {[22, 28, 34].map((t) => (
            <Cas key={t} legende={`${t} px`}>
              <Avatar nom={ORGANISATIONS[0]} taille={t} forme="carre" />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('avatars.enLigne')}>
        <div className="sd-rangee">
          <Cas legende={tm('avatars.enLigne')}>
            <Avatar nom={PERSONNES[1]} taille={34} enLigne />
          </Cas>
          <Cas legende={tm('avatars.horsLigne')}>
            <Avatar nom={PERSONNES[1]} taille={34} />
          </Cas>
          <Cas legende={`${tm('avatars.enLigne')} · 26 px`}>
            <Avatar nom={PERSONNES[2]} taille={26} enLigne />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('avatars.piles')}>
        <div className="sd-rangee">
          <Cas legende={tm('avatars.pile.trois')}>
            <PileAvatars noms={PERSONNES.slice(0, 3)} libelle={tm('avatars.pile.libelle', { n: 3 })} />
          </Cas>
          <Cas legende={tm('avatars.pile.reste')}>
            <PileAvatars noms={PERSONNES} libelle={tm('avatars.pile.libelle', { n: PERSONNES.length })} />
          </Cas>
          <Cas legende={tm('avatars.pile.une')}>
            <PileAvatars noms={PERSONNES.slice(0, 1)} libelle={tm('avatars.pile.libelle', { n: 1 })} />
          </Cas>
          <Cas legende={`${tm('avatars.pile.reste')} · 34 px`}>
            <PileAvatars noms={PERSONNES} max={4} taille={34} libelle={tm('avatars.pile.libelle', { n: PERSONNES.length })} />
          </Cas>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  5. La progression  ───────────────────────────── */

const TONS_BARRE: TonBarre[] = ['neutre', 'succes', 'attention', 'critique', 'info'];

function SectionProgression() {
  const { tm } = useMotsDemo();
  return (
    <Section id="progression">
      <Bloc titre={tm('progression.hauteurs')}>
        <div className="sd-pile">
          {([4, 5, 8] as const).map((h) => (
            <Cas key={h} legende={`${h} px`}>
              <BarreProgression valeur={0.62} hauteur={h} libelle={tm('progression.libelle')} texte={tm('progression.texte', { n: 62 })} />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('progression.tons')}>
        <div className="sd-pile">
          {TONS_BARRE.map((t) => (
            <Cas key={t} legende={t}>
              <BarreProgression valeur={0.7} ton={t} libelle={tm('progression.libelle')} texte={tm('progression.texte', { n: 70 })} />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('progression.sante')}>
        <div className="sd-pile">
          {SEUILS_SANTE.map((v) => (
            <Cas key={v} legende={`${Math.round(v * 100)} % → ${tonDeSante(v)}`}>
              <BarreProgression valeur={v} ton={tonDeSante(v)} libelle={tm('progression.sante')} texte={tm('progression.texte', { n: Math.round(v * 100) })} />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('progression.reperes')}>
        <div className="sd-pile">
          <Cas legende={tm('progression.reperes.avec')}>
            <BarreProgression valeur={0.8} hauteur={8} reperes libelle={tm('progression.libelle')} texte={tm('progression.texte', { n: 80 })} />
          </Cas>
          <Cas legende={tm('progression.vide')}>
            <BarreProgression valeur={0} libelle={tm('progression.libelle')} texte={tm('progression.texte', { n: 0 })} />
          </Cas>
          <Cas legende={tm('progression.pleine')}>
            <BarreProgression valeur={1} ton="succes" libelle={tm('progression.libelle')} texte={tm('progression.texte', { n: 100 })} />
          </Cas>
          <Cas legende={tm('progression.horsBornes')}>
            <BarreProgression valeur={1.4} libelle={tm('progression.libelle')} texte={tm('progression.texte', { n: 100 })} />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('progression.anneaux')}>
        <div className="sd-rangee">
          <Cas legende={tm('progression.anneau.defaut')}>
            <AnneauProgression valeur={3 / 7} libelle={tm('progression.libelle')} texte={tm('progression.sur', { x: 3, y: 7 })}>
              3/7
            </AnneauProgression>
          </Cas>
          {[72, 76, 80].map((t) => (
            <Cas key={t} legende={`${t} px`}>
              <Anneau valeur={0.8} taille={t} libelle={tm('progression.libelle')} />
            </Cas>
          ))}
          {(['succes', 'attention', 'critique', 'info'] as const).map((t: TonVariation) => (
            <Cas key={t} legende={t}>
              <Anneau valeur={0.64} ton={t} libelle={tm('progression.libelle')} />
            </Cas>
          ))}
          <Cas legende={tm('progression.anneau.centre')}>
            <Anneau valeur={0.4} libelle={tm('progression.libelle')} texte={tm('progression.sur', { x: 2, y: 5 })}>
              2/5
            </Anneau>
          </Cas>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  6. Les tuiles KPI  ───────────────────────────── */

function SectionKpi() {
  const { tm } = useMotsDemo();
  const tons: TonVariation[] = ['neutre', 'succes', 'attention', 'critique', 'info'];
  return (
    <Section id="kpi">
      <Bloc titre={tm('kpi.simple')}>
        <div className="sd-grille" style={{ '--sd-min': '230px' } as React.CSSProperties}>
          <Cas legende="84 px">
            <TuileKpi libelle={tm('kpi.libelle')} valeur={formaterEuro(12480)} variation={tm('kpi.variation')} ton="succes" detail={tm('kpi.detail')} />
          </Cas>
          <Cas legende="92 px">
            <TuileKpi libelle={tm('kpi.libelle')} valeur={formaterEuro(12480)} variation={tm('kpi.variation')} ton="succes" detail={tm('kpi.detail')} hauteur={92} />
          </Cas>
          <Cas legende={tm('kpi.sansVariation')}>
            <TuileKpi libelle={tm('kpi.libelle')} valeur="37" />
          </Cas>
          <Cas legende={tm('kpi.cliquable')}>
            <TuileKpi libelle={tm('kpi.libelle')} valeur="37" variation={tm('kpi.variation')} ton="info" onClick={SANS_ACTION} aria-label={tm('kpi.libelle')} />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('kpi.tons')}>
        <div className="sd-grille" style={{ '--sd-min': '230px' } as React.CSSProperties}>
          {tons.map((t) => (
            <Cas key={t} legende={t}>
              <TuileKpi libelle={tm('kpi.libelle')} valeur="58" variation={tm('kpi.variation')} ton={t} />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('kpi.courbe')}>
        <div className="sd-grille" style={{ '--sd-min': '260px' } as React.CSSProperties}>
          <Cas legende={`84 px · ${tm('kpi.avecCourbe')}`}>
            <TuileKpi libelle={tm('kpi.libelle')} valeur={formaterEuro(8450)} variation={tm('kpi.variation')} ton="succes" droite={<MiniCourbe valeurs={TENDANCE} libelle={tm('kpi.libelle')} ton="succes" />} />
          </Cas>
          <Cas legende={`92 px · ${tm('kpi.avecCourbe')}`}>
            <TuileKpi libelle={tm('kpi.libelle')} valeur={formaterEuro(8450)} variation={tm('kpi.baisse')} ton="critique" hauteur={92} droite={<MiniCourbe valeurs={TENDANCE_BAISSE} libelle={tm('kpi.libelle')} ton="critique" />} />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('kpi.barre')}>
        <div className="sd-grille" style={{ '--sd-min': '260px' } as React.CSSProperties}>
          <Cas legende={`84 px · ${tm('kpi.avecBarre')}`}>
            <TuileKpi libelle={tm('kpi.libelle')} valeur="72 %" variation={tm('kpi.variation')} ton="neutre" barre={0.72} libelleBarre={tm('progression.libelle')} />
          </Cas>
          <Cas legende={`92 px · ${tm('kpi.avecBarre')}`}>
            <TuileKpi libelle={tm('kpi.libelle')} valeur="72 %" variation={tm('kpi.variation')} ton="attention" barre={0.72} libelleBarre={tm('progression.libelle')} hauteur={92} />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('kpi.famille')}>
        <div className="sd-grille" style={{ '--sd-min': '230px' } as React.CSSProperties}>
          {FAMILLES.slice(0, 4).map((f) => (
            <Cas key={f} legende={f}>
              <TuileKpi famille={f} libelle={tm('kpi.libelle')} valeur="21" variation={tm('kpi.variation')} ton="neutre" />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('kpi.ajouter')}>
        <div className="sd-grille" style={{ '--sd-min': '230px' } as React.CSSProperties}>
          <Cas legende="84 px">
            <TuileAjouter libelle={tm('kpi.ajouterLibelle')} onClick={SANS_ACTION} />
          </Cas>
          <Cas legende="92 px">
            <TuileAjouter libelle={tm('kpi.ajouterLibelle')} onClick={SANS_ACTION} hauteur={92} />
          </Cas>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  7. Les champs  ───────────────────────────── */

function SectionChamps() {
  const { tm } = useMotsDemo();
  const [recherche, setRecherche] = useState('');
  const [rechercheLarge, setRechercheLarge] = useState('');
  const [rempli, setRempli] = useState(tm('champs.recherche.exemple'));
  const [actif, setActif] = useState(true);
  const [coche, setCoche] = useState(true);
  const [serie, setSerie] = useState(false);
  const [onglet, setOnglet] = useState('a');
  const [segment, setSegment] = useState('semaine');
  const idOnglets = useId();
  return (
    <Section id="champs">
      <Bloc titre={tm('champs.saisie')}>
        <div className="sd-grille" style={{ '--sd-min': '250px' } as React.CSSProperties}>
          <Saisie etiquette={tm('champs.etiquette')} placeholder={tm('champs.placeholder')} />
          <Saisie etiquette={tm('champs.etiquette')} aide={tm('champs.aide')} defaultValue={tm('champs.valeur')} />
          <Saisie etiquette={tm('champs.etiquette')} erreur={tm('champs.erreur')} defaultValue={tm('champs.valeurErreur')} />
          <Saisie etiquette={tm('champs.montant')} suffixe="€" inputMode="decimal" defaultValue="1 250" />
          <Saisie etiquette={tm('champs.etiquette')} disabled defaultValue={tm('champs.valeur')} />
        </div>
        <p className="sd-note">{tm('champs.saisie.note')}</p>
      </Bloc>

      <Bloc titre={tm('champs.selecteur')}>
        <div className="sd-grille" style={{ '--sd-min': '250px' } as React.CSSProperties}>
          <Selecteur etiquette={tm('champs.etiquette')} defaultValue="a">
            <option value="a">{tm('champs.option', { n: 'A' })}</option>
            <option value="b">{tm('champs.option', { n: 'B' })}</option>
          </Selecteur>
          <Selecteur etiquette={tm('champs.etiquette')} aide={tm('champs.aide')} defaultValue="b">
            <option value="a">{tm('champs.option', { n: 'A' })}</option>
            <option value="b">{tm('champs.option', { n: 'B' })}</option>
          </Selecteur>
          <Selecteur etiquette={tm('champs.etiquette')} erreur={tm('champs.erreur')} defaultValue="">
            <option value="" disabled>
              {tm('champs.choisir')}
            </option>
            <option value="a">{tm('champs.option', { n: 'A' })}</option>
          </Selecteur>
          <Selecteur etiquette={tm('champs.etiquette')} disabled defaultValue="a">
            <option value="a">{tm('champs.option', { n: 'A' })}</option>
          </Selecteur>
        </div>
      </Bloc>

      <Bloc titre={tm('champs.recherche')}>
        <div className="sd-grille" style={{ '--sd-min': '280px' } as React.CSSProperties}>
          <Cas legende={`34 px · ${tm('champs.recherche.vide')}`}>
            <BoiteRecherche valeur={recherche} onChange={setRecherche} libelle={tm('champs.recherche.libelle')} placeholder={tm('champs.recherche.placeholder')} raccourci="⌘K" />
          </Cas>
          <Cas legende={`34 px · ${tm('champs.recherche.rempli')}`}>
            <BoiteRecherche valeur={rempli} onChange={setRempli} libelle={tm('champs.recherche.libelle')} />
          </Cas>
          <Cas legende={`42 px · ${tm('champs.recherche.vide')}`}>
            <BoiteRecherche grande valeur={rechercheLarge} onChange={setRechercheLarge} libelle={tm('champs.recherche.libelle')} placeholder={tm('champs.recherche.placeholder')} raccourci="⌘K" />
          </Cas>
        </div>
      </Bloc>

      <Bloc titre={tm('champs.interrupteur')}>
        <div className="sd-rangee">
          <Cas legende={tm('champs.actif')}>
            <Interrupteur actif={actif} onChange={setActif} libelle={tm('champs.interrupteur')} />
          </Cas>
          <Cas legende={tm('champs.inactif')}>
            <Interrupteur actif={false} onChange={SANS_ACTION} libelle={tm('champs.interrupteur')} />
          </Cas>
          <Cas legende={`${tm('champs.actif')} · ${tm('champs.desactive')}`}>
            <Interrupteur actif disabled libelle={tm('champs.interrupteur')} />
          </Cas>
          <Cas legende={`${tm('champs.inactif')} · ${tm('champs.desactive')}`}>
            <Interrupteur actif={false} disabled libelle={tm('champs.interrupteur')} />
          </Cas>
        </div>
      </Bloc>

      <Bloc titre={tm('champs.case')}>
        <div className="sd-rangee">
          <Cas legende={`18 px · ${tm('champs.vide')}`}>
            <CaseACocher coche={false} onChange={SANS_ACTION} libelle={tm('champs.case')} />
          </Cas>
          <Cas legende={`18 px · ${tm('champs.cochee')}`}>
            <CaseACocher coche={coche} onChange={setCoche} libelle={tm('champs.case')} />
          </Cas>
          <Cas legende={`18 px · ${tm('champs.lecture')}`}>
            <CaseACocher coche lecture libelle={tm('champs.case')} />
          </Cas>
          <Cas legende={`24 px · ${tm('champs.vide')}`}>
            <CaseACocher taille="serie" coche={serie} onChange={setSerie} libelle={tm('champs.case')} />
          </Cas>
          <Cas legende={`24 px · ${tm('champs.cochee')}`}>
            <CaseACocher taille="serie" coche libelle={tm('champs.case')} onChange={SANS_ACTION} />
          </Cas>
        </div>
      </Bloc>

      <Bloc titre={tm('champs.onglets')}>
        <Onglets
          libelle={tm('champs.onglets')}
          idBase={idOnglets}
          actif={onglet}
          onChange={setOnglet}
          onglets={[
            { cle: 'a', libelle: tm('champs.onglet', { n: 'A' }), compteur: 12 },
            { cle: 'b', libelle: tm('champs.onglet', { n: 'B' }), compteur: 3 },
            { cle: 'c', libelle: tm('champs.onglet', { n: 'C' }) },
          ]}
        />
        {(['a', 'b', 'c'] as const).map((c) => (
          <PanneauOnglet key={c} idBase={idOnglets} cle={c} actif={onglet === c}>
            <p className="sd-note">{tm('champs.panneau', { n: c.toUpperCase() })}</p>
          </PanneauOnglet>
        ))}
      </Bloc>

      <Bloc titre={tm('champs.segmente')}>
        <ChoixEtat
          libelle={tm('champs.segmente')}
          valeur={segment}
          onChange={setSegment}
          options={[
            { cle: 'jour', libelle: tm('champs.segment.jour') },
            { cle: 'semaine', libelle: tm('champs.segment.semaine') },
            { cle: 'mois', libelle: tm('champs.segment.mois') },
          ]}
        />
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  8. Tâches et activité  ───────────────────────────── */

function SectionTaches() {
  const { tm } = useMotsDemo();
  const [faits, setFaits] = useState<Record<string, boolean>>({ a: false, b: true, c: false });
  return (
    <Section id="taches">
      <Bloc titre={tm('taches.lignes')}>
        <Carte sansMarge>
          <ul className="sd-liste">
            <LigneTache
              titre={tm('taches.titre', { n: 'A' })}
              meta={tm('taches.meta')}
              famille="contacts"
              heure="09:30"
              fait={faits.a}
              onCoche={(v) => setFaits((f) => ({ ...f, a: v }))}
              libelleCase={tm('taches.cocher', { titre: tm('taches.titre', { n: 'A' }) })}
              onOuvrir={SANS_ACTION}
              droite={<Avatar nom={PERSONNES[0]} taille={22} />}
            />
            <LigneTache
              titre={tm('taches.titre', { n: 'B' })}
              meta={tm('taches.meta')}
              famille="argent"
              heure="11:00"
              fait={faits.b}
              onCoche={(v) => setFaits((f) => ({ ...f, b: v }))}
              libelleCase={tm('taches.cocher', { titre: tm('taches.titre', { n: 'B' }) })}
            />
            <LigneTache
              titre={tm('taches.titre', { n: 'C' })}
              meta={tm('taches.lecture')}
              avecColonneHeure
              fait={faits.c}
              lecture
              libelleCase={tm('taches.cocher', { titre: tm('taches.titre', { n: 'C' }) })}
            />
          </ul>
        </Carte>
      </Bloc>
      <Bloc titre={tm('taches.activite')}>
        <Carte sansMarge>
          <ul className="sd-liste">
            <LigneActivite nom={PERSONNES[1]} texte={tm('taches.activite.texte')} quand={tm('taches.quand')} famille="echanger" />
            <LigneActivite texte={tm('taches.activite.sansNom')} quand={tm('taches.quand')} famille="outils" />
            <EtapeFranchie libelle={tm('taches.etape')} texte={tm('taches.etape.texte', { n: 100 })} quand={tm('taches.quand')} famille="argent" />
          </ul>
        </Carte>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  9. Les cartes ludiques  ───────────────────────────── */

function SectionLudiques() {
  const { tm, langue } = useMotsDemo();
  const [faits, setFaits] = useState<Record<string, boolean>>({ a: true, b: false, c: false });
  const lignes = (['a', 'b', 'c'] as const).map((id) => ({ id, libelle: tm('ludiques.ligne', { n: id.toUpperCase() }), fait: faits[id] }));
  const jours = useMemo(() => nomsDesJours(langue === 'fr' ? 'fr-FR' : 'en-GB'), [langue]);
  return (
    <Section id="ludiques">
      <Bloc titre={tm('ludiques.cases')}>
        <div className="sd-grille" style={{ '--sd-min': '300px' } as React.CSSProperties}>
          <Cas legende={tm('ludiques.encours')}>
            <CarteCases titre={tm('ludiques.cases.titre')} titreComplet={tm('ludiques.cases.complet')} lignes={lignes} onChange={(id, fait) => setFaits((f) => ({ ...f, [id]: fait }))} />
          </Cas>
          <Cas legende={tm('ludiques.toutFait')}>
            <CarteCases
              titre={tm('ludiques.cases.titre')}
              titreComplet={tm('ludiques.cases.complet')}
              lignes={lignes.map((l) => ({ ...l, fait: true }))}
              onChange={SANS_ACTION}
            />
          </Cas>
          <Cas legende={tm('ludiques.lecture')}>
            <CarteCases titre={tm('ludiques.cases.titre')} lignes={lignes} lecture />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('ludiques.anneau')}>
        <div className="sd-grille" style={{ '--sd-min': '300px' } as React.CSSProperties}>
          <Cas legende={tm('ludiques.encours')}>
            <CarteAnneau titre={tm('ludiques.anneau.titre')} texte={tm('ludiques.anneau.texte')} valeur={0.72} centre="72 %" />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('ludiques.serie')}>
        <div className="sd-grille" style={{ '--sd-min': '300px' } as React.CSSProperties}>
          <Cas legende={tm('ludiques.encours')}>
            <CarteSerie titre={tm('ludiques.serie.titre')} jours={jours.map((j, i) => ({ ...j, fait: i < 5 }))} texte={tm('ludiques.serie.texte', { n: 5 })} />
          </Cas>
          <Cas legende={tm('ludiques.aucune')}>
            <CarteSerie titre={tm('ludiques.serie.titre')} jours={jours.map((j) => ({ ...j, fait: false }))} />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('ludiques.jalon')}>
        <div className="sd-grille" style={{ '--sd-min': '300px' } as React.CSSProperties}>
          <Cas legende={tm('ludiques.encours')}>
            <CarteJalon titre={tm('ludiques.jalon.titre')} fait={12} total={15} texte={tm('ludiques.jalon.texte', { n: 3 })} />
          </Cas>
          <Cas legende={tm('ludiques.debut')}>
            <CarteJalon titre={tm('ludiques.jalon.titre')} fait={0} total={15} />
          </Cas>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  10. La suggestion d'Ajmani  ───────────────────────────── */

function SectionSuggestion() {
  const { tm } = useMotsDemo();
  const [reponse, setReponse] = useState<'aucune' | 'oui' | 'plusTard'>('aucune');
  return (
    <Section id="suggestion">
      <Bloc titre={tm('suggestion.deuxBoutons')}>
        <div className="sd-etroit">
          <SuggestionAjmani
            titre={tm('suggestion.titre')}
            texte={tm('suggestion.texte')}
            primaire={{ libelle: tm('suggestion.relier'), onClick: () => setReponse('oui') }}
            secondaire={{ libelle: tm('suggestion.plusTard'), onClick: () => setReponse('plusTard') }}
          />
          <p role="status" className="sd-note">
            {reponse === 'aucune' ? '' : tm(reponse === 'oui' ? 'suggestion.reponse.oui' : 'suggestion.reponse.plusTard')}
          </p>
        </div>
      </Bloc>
      <Bloc titre={tm('suggestion.unBouton')}>
        <div className="sd-etroit">
          <SuggestionAjmani titre={tm('suggestion.titre')} texte={tm('suggestion.texte')} primaire={{ libelle: tm('suggestion.relier'), onClick: SANS_ACTION, icone: <Plus /> }} />
        </div>
      </Bloc>
      <Bloc titre={tm('suggestion.etincelle')}>
        <div className="sd-rangee">
          {[12, 16, 24].map((t) => (
            <Cas key={t} legende={`${t} px`}>
              <span className="sd-etincelle">
                <IconeEtincelle taille={t} />
              </span>
            </Cas>
          ))}
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  11. Les graphiques  ───────────────────────────── */

function SectionGraphiques() {
  const { tm } = useMotsDemo();
  const euro = (v: number) => formaterEuro(v);
  return (
    <Section id="graphiques">
      <Bloc titre={tm('graphiques.courbe')}>
        <div className="sd-grille" style={{ '--sd-min': '420px' } as React.CSSProperties}>
          <Cas legende={tm('graphiques.uneSerie')}>
            <Carte compacte>
              <Courbe donnees={COURBE} libelle={tm('graphiques.libelle')} nom={tm('graphiques.serie1')} formater={euro} />
            </Carte>
          </Cas>
          <Cas legende={tm('graphiques.deuxSeries')}>
            <Carte compacte>
              <Courbe donnees={COURBE} libelle={tm('graphiques.libelle')} nom={tm('graphiques.serie1')} secondeSerie={COURBE_SECONDE} nomSeconde={tm('graphiques.serie2')} ton="info" formater={euro} />
            </Carte>
          </Cas>
          <Cas legende={tm('graphiques.unPoint')}>
            <Carte compacte>
              <Courbe donnees={COURBE_UN_POINT} libelle={tm('graphiques.libelle')} formater={euro} />
            </Carte>
          </Cas>
          <Cas legende={tm('graphiques.vide')}>
            <Carte compacte>
              <Courbe donnees={[]} libelle={tm('graphiques.libelle')} />
            </Carte>
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('graphiques.barres')}>
        <div className="sd-grille" style={{ '--sd-min': '420px' } as React.CSSProperties}>
          <Cas legende={tm('graphiques.misEnValeur')}>
            <Carte compacte>
              <Barres donnees={BARRES} libelle={tm('graphiques.libelleBarres')} />
            </Carte>
          </Cas>
          <Cas legende={tm('graphiques.sansMiseEnValeur')}>
            <Carte compacte>
              <Barres donnees={BARRES} libelle={tm('graphiques.libelleBarres')} miseEnValeur={null} />
            </Carte>
          </Cas>
          <Cas legende={tm('graphiques.vide')}>
            <Carte compacte>
              <Barres donnees={[]} libelle={tm('graphiques.libelleBarres')} />
            </Carte>
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('graphiques.donut')}>
        <div className="sd-grille" style={{ '--sd-min': '420px' } as React.CSSProperties}>
          <Cas legende={tm('graphiques.avecLegende')}>
            <Carte compacte>
              <Donut
                libelle={tm('graphiques.libelleDonut')}
                segments={PARTS_DONUT.map((p) => ({ libelle: tm(`graphiques.part.${p.cle}`), valeur: p.valeur, ton: p.ton }))}
                formater={euro}
                afficherPart
                centre={formaterEuro(PARTS_DONUT.reduce((s, p) => s + p.valeur, 0))}
              />
            </Carte>
          </Cas>
          <Cas legende={tm('graphiques.unSegment')}>
            <Carte compacte>
              <Donut libelle={tm('graphiques.libelleDonut')} segments={[{ libelle: tm('graphiques.part.a'), valeur: 100, ton: 'succes' }]} />
            </Carte>
          </Cas>
          <Cas legende={tm('graphiques.vide')}>
            <Carte compacte>
              <Donut libelle={tm('graphiques.libelleDonut')} segments={[]} />
            </Carte>
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('graphiques.mini')}>
        <div className="sd-rangee">
          {(['neutre', 'succes', 'attention', 'critique', 'info'] as const).map((t) => (
            <Cas key={t} legende={t}>
              <MiniCourbe valeurs={t === 'critique' ? TENDANCE_BAISSE : TENDANCE} libelle={tm('graphiques.libelleMini')} ton={t} />
            </Cas>
          ))}
          <Cas legende={tm('graphiques.unPoint')}>
            <MiniCourbe valeurs={[18]} libelle={tm('graphiques.libelleMini')} />
          </Cas>
          <Cas legende={tm('graphiques.vide')}>
            <MiniCourbe valeurs={[]} libelle={tm('graphiques.libelleMini')} />
          </Cas>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  12. Les archétypes  ───────────────────────────── */

type ModeTableau = 'donnees' | 'chargement' | 'vide';

function ArchetypeTableau() {
  const { tm } = useMotsDemo();
  const [mode, setMode] = useState<ModeTableau>('donnees');
  const [onglet, setOnglet] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [faits, setFaits] = useState<Record<string, boolean>>(() => Object.fromEntries(LIGNES_TABLEAU.map((l) => [l.id, l.fait])));
  const [actifs, setActifs] = useState<Record<string, boolean>>(() => Object.fromEntries(LIGNES_TABLEAU.map((l) => [l.id, l.actif])));

  const toutes = LIGNES_TABLEAU;
  const enCours = (l: LigneExemple) => l.etat === 'info' || l.etat === 'attention' || l.etat === 'critique';
  const visibles = mode === 'vide' ? [] : toutes.filter((l) => (onglet === 'tous' ? true : onglet === 'encours' ? enCours(l) : l.etat === 'succes'));
  const total = visibles.reduce((s, l) => s + l.montant, 0);
  const libelleEtat = (e: EtatPastille) => tm(`etat.${e}`);

  const colonnes: ColonneTableau<LigneExemple>[] = [
    { cle: 'nom', titre: tm('tableau.nom'), largeur: 'minmax(190px, 2fr)', valeur: (l: LigneExemple) => l.nom, cellule: (l: LigneExemple) => <CelluleNom nom={l.nom} sousTitre={l.sousTitre} /> },
    { cle: 'type', titre: tm('tableau.type'), largeur: '84px', valeur: (l: LigneExemple) => l.type, cellule: (l: LigneExemple) => <CelluleTexte>{l.type}</CelluleTexte> },
    { cle: 'etat', titre: tm('tableau.etat'), largeur: '104px', valeur: (l: LigneExemple) => libelleEtat(l.etat), cellule: (l: LigneExemple) => <CelluleEtat etat={l.etat}>{libelleEtat(l.etat)}</CelluleEtat> },
    { cle: 'avancement', titre: tm('tableau.avancement'), largeur: '128px', valeur: (l: LigneExemple) => l.avancement, cellule: (l: LigneExemple) => <CelluleProgression valeur={l.avancement} libelle={tm('tableau.avancement')} ton={l.etat === 'critique' ? 'critique' : l.etat === 'succes' ? 'succes' : undefined} /> },
    { cle: 'equipe', titre: tm('tableau.equipe'), largeur: '88px', valeur: (l: LigneExemple) => l.responsables[0], cellule: (l: LigneExemple) => <CelluleAvatar noms={l.responsables} libelle={l.responsables.join(', ')} /> },
    { cle: 'montant', titre: tm('tableau.montant'), largeur: '96px', alignement: 'fin' as const, valeur: (l: LigneExemple) => l.montant, cellule: (l: LigneExemple) => <CelluleMontant valeur={l.montant} etat={l.etatMontant} libelleEtat={l.etatMontant ? libelleEtat(l.etatMontant) : undefined} /> },
    { cle: 'categorie', titre: tm('tableau.categorie'), largeur: '96px', valeur: (l: LigneExemple) => l.categorie.libelle, cellule: (l: LigneExemple) => <CelluleTag famille={l.categorie.famille}>{l.categorie.libelle}</CelluleTag> },
    { cle: 'echeance', titre: tm('tableau.echeance'), largeur: '72px', valeur: (l: LigneExemple) => l.echeance, cellule: (l: LigneExemple) => <CelluleDate date={l.echeance} /> },
    { cle: 'fait', titre: tm('tableau.fait'), largeur: '48px', alignement: 'centre' as const, valeur: (l: LigneExemple) => faits[l.id], cellule: (l: LigneExemple) => <CelluleCase coche={faits[l.id]} onChange={(v) => setFaits((f) => ({ ...f, [l.id]: v }))} libelle={tm('tableau.cocher', { nom: l.nom })} /> },
    { cle: 'canal', titre: tm('tableau.canal'), largeur: '104px', valeur: (l: LigneExemple) => l.canal, cellule: (l: LigneExemple) => <CelluleIcone icone={l.canal === 'Appel' ? <Phone /> : l.canal === 'Message' ? <MessageSquare /> : <Mail />}>{l.canal}</CelluleIcone> },
    { cle: 'actif', titre: tm('tableau.actif'), largeur: '56px', alignement: 'centre' as const, valeur: (l: LigneExemple) => actifs[l.id], cellule: (l: LigneExemple) => <CelluleInterrupteur actif={actifs[l.id]} onChange={(v) => setActifs((a) => ({ ...a, [l.id]: v }))} libelle={tm('tableau.activer', { nom: l.nom })} /> },
    { cle: 'action', titre: tm('tableau.action'), titreCache: true, largeur: '84px', alignement: 'fin' as const, cellule: (l: LigneExemple) => <CelluleBouton libelle={tm('tableau.ouvrir')} onClick={() => setActive(l.id)} /> },
  ];

  return (
    <Bloc titre={tm('archetypes.tableau')}>
      <div className="sd-rangee">
        <ChoixEtat
          libelle={tm('archetypes.etatTableau')}
          valeur={mode}
          onChange={setMode}
          options={[
            { cle: 'donnees', libelle: tm('archetypes.mode.donnees') },
            { cle: 'chargement', libelle: tm('archetypes.mode.chargement') },
            { cle: 'vide', libelle: tm('archetypes.mode.vide') },
          ]}
        />
      </div>
      <Cadre hauteur={450} largeurMin={1340}>
        <Tableau<LigneExemple>
          libelle={tm('archetypes.tableau')}
          colonnes={colonnes}
          lignes={visibles}
          cleLigne={(l) => l.id}
          ligneActive={active}
          onOuvrir={(l) => setActive(l.id)}
          chargement={mode === 'chargement'}
          lignesSquelette={5}
          onglets={{
            libelle: tm('tableau.onglets'),
            actif: onglet,
            onChange: setOnglet,
            onglets: [
              { cle: 'tous', libelle: tm('tableau.onglet.tous'), compteur: toutes.length },
              { cle: 'encours', libelle: tm('tableau.onglet.encours'), compteur: toutes.filter(enCours).length },
              { cle: 'termines', libelle: tm('tableau.onglet.termines'), compteur: toutes.filter((l) => l.etat === 'succes').length },
            ],
          }}
          recherche={{ valeur: recherche, onChange: setRecherche, libelle: tm('tableau.rechercher'), placeholder: tm('tableau.rechercher') }}
          filtrer={{ onClick: SANS_ACTION, libelle: tm('tableau.filtrer') }}
          resume={tm('tableau.resume', { n: visibles.length, total: formaterMontant(total) })}
          vide={{ titre: tm('tableau.vide.titre'), texte: tm('tableau.vide.texte'), action: <Bouton variante="secondaire" icone={<Plus />} onClick={() => setMode('donnees')}>{tm('tableau.vide.action')}</Bouton> }}
          aucunResultat={{ titre: tm('tableau.aucun.titre'), texte: tm('tableau.aucun.texte'), action: <Bouton variante="secondaire" icone={<RotateCcw />} onClick={() => setRecherche('')}>{tm('tableau.aucun.action')}</Bouton> }}
        />
      </Cadre>
    </Bloc>
  );
}

function ArchetypeKanban() {
  const { tm } = useMotsDemo();
  const reference = useMemo(() => new Date(), []);
  const [colonnes, setColonnes] = useState<ColonneExemple[]>(COLONNES_KANBAN);
  const echeance = (t: TicketExemple) =>
    t.echeanceEnJours === undefined
      ? undefined
      : { texte: formaterDate(new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + t.echeanceEnJours)), retard: t.echeanceEnJours < 0 };
  return (
    <Bloc titre={tm('archetypes.kanban')}>
      <Cadre hauteur={430} largeurMin={760}>
        <Kanban<TicketExemple>
          libelle={tm('archetypes.kanban')}
          colonnes={colonnes.map((c) => ({ cle: c.cle, titre: tm(`kanban.${c.cle}`), accent: c.accent, limite: c.limite, tickets: c.tickets }))}
          cleTicket={(t) => t.id}
          titreTicket={(t) => t.titre}
          onDeplacer={(d) => setColonnes((cs) => cs.map((c) => ({ ...c, tickets: d.colonnes.find((x) => x.cle === c.cle)?.elements ?? c.tickets })))}
          onAjouter={SANS_ACTION}
          rendreTicket={(t) => (
            <Ticket
              cle={t.id}
              titre={t.titre}
              urgent={t.urgent}
              tags={t.tags.map((g) => (
                <Tag key={g.libelle} famille={g.famille}>
                  {g.libelle}
                </Tag>
              ))}
              progression={t.progression}
              responsables={t.responsables}
              echeance={echeance(t)}
              commentaires={t.commentaires}
              onOuvrir={SANS_ACTION}
            />
          )}
        />
      </Cadre>
      <Bloc titre={tm('archetypes.kanbanSeul')}>
        <div className="sd-etroit">
          <ColonneKanban titre={tm('kanban.seule')} accent="argent" nombre={1}>
            <Ticket titre={tm('kanban.ticketSeul')} tags={<Tag famille="argent">{tm('cartes.tag')}</Tag>} responsables={[PERSONNES[0]]} />
          </ColonneKanban>
        </div>
      </Bloc>
    </Bloc>
  );
}

const ICONES_MODULES = [<Calendar key="c" />, <Users key="u" />, <FileText key="f" />, <FolderOpen key="d" />, <MessageSquare key="m" />, <Video key="v" />];

function ArchetypeCartes() {
  const { tm } = useMotsDemo();
  return (
    <Bloc titre={tm('archetypes.cartes')}>
      <Cadre hauteur={420} largeurMin={760}>
        <GrilleCartes libelle={tm('archetypes.cartes')}>
          {MODULES.map((m, i) => (
            <CarteModule
              key={m.id}
              titre={m.titre}
              description={tm('archetypes.module.description')}
              icone={ICONES_MODULES[i % ICONES_MODULES.length]}
              famille={m.famille}
              progression={{ libelle: tm('archetypes.module.avancement'), valeur: m.progression, ton: m.etat === 'critique' ? 'critique' : undefined }}
              personnes={m.personnes}
              libellePersonnes={tm('archetypes.module.responsables', { noms: m.personnes.join(', ') })}
              etat={{ etat: m.etat, libelle: tm(`etat.${m.etat}`) }}
              onClick={SANS_ACTION}
            />
          ))}
        </GrilleCartes>
      </Cadre>
    </Bloc>
  );
}

function ArchetypeScinde() {
  const { tm } = useMotsDemo();
  const [actif, setActif] = useState<string>(MESSAGES[0].id);
  const [onglet, setOnglet] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [lus, setLus] = useState<Record<string, boolean>>({});
  const nonLu = (m: (typeof MESSAGES)[number]) => m.nonLu && !lus[m.id];
  const visibles = MESSAGES.filter((m) => (onglet === 'tous' || nonLu(m)) && m.titre.toLowerCase().includes(recherche.trim().toLowerCase()));
  const courant = MESSAGES.find((m) => m.id === actif);
  return (
    <Bloc titre={tm('archetypes.scinde')}>
      <Cadre hauteur={430} largeurMin={900}>
        <Scinde
          liste={
            <ListeScindee
              libelle={tm('scinde.liste')}
              recherche={{ valeur: recherche, onChange: setRecherche, libelle: tm('scinde.rechercher'), placeholder: tm('scinde.rechercher') }}
              ajouter={{ libelle: tm('scinde.nouveau'), onClick: SANS_ACTION }}
              onglets={{
                libelle: tm('scinde.onglets'),
                actif: onglet,
                onChange: setOnglet,
                onglets: [
                  { cle: 'tous', libelle: tm('tableau.onglet.tous'), compteur: MESSAGES.length },
                  { cle: 'nonlus', libelle: tm('scinde.nonLus'), compteur: MESSAGES.filter(nonLu).length },
                ],
              }}
              vide={<EtatVide texte={tm('scinde.vide')} action={<Bouton variante="secondaire" onClick={() => setRecherche('')}>{tm('tableau.aucun.action')}</Bouton>} />}
            >
              {visibles.map((m) => (
                <ElementListe
                  key={m.id}
                  titre={m.titre}
                  apercu={tm('scinde.apercu')}
                  heure={m.heure}
                  nonLu={nonLu(m)}
                  actif={m.id === actif}
                  onSelect={() => {
                    setActif(m.id);
                    setLus((l) => ({ ...l, [m.id]: true }));
                  }}
                />
              ))}
            </ListeScindee>
          }
          detail={
            courant ? (
              <DetailScinde
                titre={courant.titre}
                meta={[
                  { icone: <Users />, texte: PERSONNES[0] },
                  { icone: <Calendar />, texte: courant.heure },
                  { icone: <FolderOpen />, texte: ORGANISATIONS[0] },
                ]}
                actions={
                  <>
                    <Bouton variante="secondaire" icone={<Trash2 />} onClick={SANS_ACTION}>
                      {tm('scinde.supprimer')}
                    </Bouton>
                    <Bouton variante="secondaire" onClick={SANS_ACTION}>
                      {tm('scinde.repondre')}
                    </Bouton>
                  </>
                }
                suggestion={{ titre: tm('suggestion.titre'), texte: tm('suggestion.texte'), onOui: SANS_ACTION, onNon: SANS_ACTION }}
              >
                <p>{tm('scinde.texte')}</p>
                <p>{tm('scinde.texte')}</p>
              </DetailScinde>
            ) : (
              <DetailScinde vide={{ texte: tm('scinde.aucunChoisi'), action: <Bouton variante="secondaire" onClick={() => setActif(MESSAGES[0].id)}>{tm('scinde.choisir')}</Bouton> }} />
            )
          }
        />
      </Cadre>
      <Bloc titre={tm('archetypes.scindeVide')}>
        <Cadre hauteur={260} largeurMin={900}>
          <Scinde
            liste={<ListeScindee libelle={tm('scinde.liste')} vide={<EtatVide texte={tm('scinde.vide')} action={<Bouton variante="secondaire" icone={<Plus />} onClick={SANS_ACTION}>{tm('scinde.nouveau')}</Bouton>} />} />}
            detail={<DetailScinde vide={{ texte: tm('scinde.aucunChoisi'), action: <Bouton variante="secondaire" onClick={SANS_ACTION}>{tm('scinde.choisir')}</Bouton> }} />}
          />
        </Cadre>
      </Bloc>
    </Bloc>
  );
}

function ArchetypeSemaine() {
  const { tm, langue } = useMotsDemo();
  // Les événements sont générés par rapport à l'instant où la page s'ouvre : la semaine courante, toujours.
  const { debut, evenements } = useMemo(() => {
    const maintenant = new Date();
    const semaine = evenementsDeLaSemaine(maintenant);
    return { debut: debutDeSemaine(maintenant), evenements: semaine.evenements };
  }, []);
  return (
    <Bloc titre={tm('archetypes.semaine')}>
      <Cadre hauteur={470} largeurMin={760}>
        <Semaine
          libelle={tm('archetypes.semaine')}
          debut={debut}
          heureDebut={8}
          heureFin={19}
          locale={langue === 'fr' ? 'fr-FR' : 'en-GB'}
          evenements={evenements.map((e) => ({ id: e.id, titre: e.titre, detail: e.detail, debut: e.debut, fin: e.fin, famille: e.famille, onOuvrir: SANS_ACTION }))}
        />
      </Cadre>
    </Bloc>
  );
}

function ArchetypeChronologie() {
  const { tm } = useMotsDemo();
  const icones = [<Calendar key="1" />, <Phone key="2" />, <CircleAlert key="3" />, <Bell key="4" />];
  return (
    <Bloc titre={tm('archetypes.chronologie')}>
      <div className="sd-etroit">
        <Carte titre={tm('archetypes.chronologie.titre')}>
          <ChronologieTemps libelle={tm('archetypes.chronologie')}>
            {MOMENTS.map((m, i) => (
              <LigneTemps
                key={m.id}
                heure={m.heure}
                icone={icones[i % icones.length]}
                famille={m.famille}
                etat={m.etat}
                libelleEtat={m.etat ? tm(`etat.${m.etat}`) : undefined}
                titre={m.titre}
                detail={m.detail}
                onOuvrir={i === 0 ? SANS_ACTION : undefined}
              />
            ))}
          </ChronologieTemps>
        </Carte>
        <Cas legende={tm('archetypes.tronque')}>
          <div className="sd-tronque">
            <TexteTronque>{tm('archetypes.tronque.texte')}</TexteTronque>
          </div>
        </Cas>
      </div>
    </Bloc>
  );
}

function SectionArchetypes() {
  return (
    <Section id="archetypes">
      <ArchetypeTableau />
      <ArchetypeKanban />
      <ArchetypeCartes />
      <ArchetypeScinde />
      <ArchetypeSemaine />
      <ArchetypeChronologie />
    </Section>
  );
}

/* ─────────────────────────────  13. Le gabarit de page  ───────────────────────────── */

function SectionGabarit() {
  const { tm } = useMotsDemo();
  return (
    <Section id="gabarit">
      <div className="sd-miniature" role="group" aria-label={tm('gabarit.cadre')}>
        <Page autonome>
          <EnTeteDePage
            titre={tm('gabarit.titre')}
            sousTitre={tm('gabarit.sous')}
            secondaires={[{ libelle: tm('bouton.exporter'), icone: <Download /> }]}
            primaire={{ libelle: tm('bouton.nouveau'), icone: <Plus />, raccourci: '⌘N' }}
          />
          <RangeeKpi libelle={tm('gabarit.kpi')}>
            <TuileKpi libelle={tm('kpi.libelle')} valeur={formaterEuro(12480)} variation={tm('kpi.variation')} ton="succes" droite={<MiniCourbe valeurs={TENDANCE} libelle={tm('kpi.libelle')} ton="succes" />} />
            <TuileKpi libelle={tm('kpi.libelle')} valeur="37" variation={tm('kpi.variation')} ton="info" />
            <TuileKpi libelle={tm('kpi.libelle')} valeur="72 %" barre={0.72} libelleBarre={tm('progression.libelle')} />
            <TuileKpi libelle={tm('kpi.libelle')} valeur="4" variation={tm('kpi.baisse')} ton="critique" />
          </RangeeKpi>
          <DispositionPage
            libelleDroite={tm('gabarit.droite')}
            droite={
              <>
                <CarteAnneau titre={tm('ludiques.anneau.titre')} texte={tm('ludiques.anneau.texte')} valeur={0.72} centre="72 %" />
                <SuggestionAjmani
                  titre={tm('suggestion.titre')}
                  texte={tm('suggestion.texte')}
                  primaire={{ libelle: tm('suggestion.relier'), onClick: SANS_ACTION }}
                  secondaire={{ libelle: tm('suggestion.plusTard'), onClick: SANS_ACTION }}
                />
              </>
            }
          >
            <Carte titre={tm('gabarit.zone')}>
              <EtatVide titre={tm('gabarit.zone.titre')} texte={tm('gabarit.zone.texte')} action={<Bouton variante="secondaire" icone={<Plus />} onClick={SANS_ACTION}>{tm('tableau.vide.action')}</Bouton>} />
            </Carte>
          </DispositionPage>
        </Page>
      </div>
      <p className="sd-note">{tm('gabarit.note')}</p>
      <Bloc titre={tm('gabarit.colonneSeule')}>
        <div className="sd-etroit">
          <ColonneDroite libelle={tm('gabarit.droite')} largeur={300}>
            <Carte compacte titre={tm('cartes.titre')}>
              {tm('cartes.texte')}
            </Carte>
          </ColonneDroite>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  14. Les états  ───────────────────────────── */

function SectionEtats() {
  const { tm } = useMotsDemo();
  const [ouverte, setOuverte] = useState(false);
  const tons: { ton: TonEtat; icone: React.ReactNode }[] = [
    { ton: 'famille', icone: <Users size={20} strokeWidth={1.7} /> },
    { ton: 'attention', icone: <CircleAlert size={20} strokeWidth={1.7} /> },
    { ton: 'neutre', icone: <FolderOpen size={20} strokeWidth={1.7} /> },
    { ton: 'critique', icone: <CircleAlert size={20} strokeWidth={1.7} /> },
  ];
  return (
    <Section id="etats">
      <p className="sd-renvoi">{tm('etats.renvoi')}</p>
      <Bloc titre={tm('etats.bloc')}>
        <div className="sd-grille" style={{ '--sd-min': '280px' } as React.CSSProperties}>
          {tons.map(({ ton, icone }) => (
            <Cas key={ton} legende={ton}>
              <div className="sd-tuile">
                <BlocEtat
                  ton={ton}
                  famille={ton === 'famille' ? 'contacts' : undefined}
                  icone={icone}
                  titre={tm('etats.bloc.titre')}
                  texte={tm('etats.bloc.texte')}
                  actions={
                    <Bouton variante="secondaire" taille="petit" onClick={SANS_ACTION}>
                      {tm('etats.bloc.action')}
                    </Bouton>
                  }
                />
              </div>
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('etats.squelette')}>
        <div className="sd-grille" style={{ '--sd-min': '280px' } as React.CSSProperties}>
          <Cas legende={tm('etats.squelette.formes')}>
            <div className="sd-tuile sd-tuile--ligne">
              <Squelette largeur={34} hauteur={34} rayon={9} />
              <Squelette largeur={34} hauteur={34} rayon="99px" />
              <Squelette largeur={122} hauteur={10} rayon="99px" ligne />
              <Squelette largeur={78} hauteur={8} rayon="99px" ligne />
            </div>
          </Cas>
          <Cas legende={tm('etats.squelette.lignes')}>
            <div className="sd-tuile">
              <SqueletteLignes lignes={3} />
            </div>
          </Cas>
          <Cas legende={tm('etats.chargement')}>
            <div className="sd-tuile">
              <Chargement libelle={tm('etats.chargement.libelle')}>
                <SqueletteLignes lignes={2} />
              </Chargement>
            </div>
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('etats.vide')}>
        <div className="sd-grille" style={{ '--sd-min': '280px' } as React.CSSProperties}>
          <Cas legende={tm('etats.vide.avecTitre')}>
            <EtatVide titre={tm('tableau.vide.titre')} texte={tm('tableau.vide.texte')} action={<Bouton variante="secondaire" icone={<Plus />} onClick={SANS_ACTION}>{tm('tableau.vide.action')}</Bouton>} />
          </Cas>
          <Cas legende={tm('etats.vide.sansTitre')}>
            <EtatVide texte={tm('tableau.vide.texte')} action={<Bouton variante="secondaire" onClick={SANS_ACTION}>{tm('tableau.vide.action')}</Bouton>} />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('etats.modale')}>
        <div className="sd-rangee">
          <Bouton variante="secondaire" onClick={() => setOuverte(true)}>
            {tm('etats.modale.ouvrir')}
          </Bouton>
        </div>
        <Modale
          ouverte={ouverte}
          onFermer={() => setOuverte(false)}
          titre={tm('etats.modale.titre')}
          description={tm('etats.modale.description')}
          taille="petite"
          actions={
            <>
              <Bouton variante="secondaire" onClick={() => setOuverte(false)}>
                {tm('etats.modale.fermer')}
              </Bouton>
              <Bouton variante="primaire" onClick={() => setOuverte(false)}>
                {tm('etats.modale.valider')}
              </Bouton>
            </>
          }
        >
          {tm('etats.modale.texte')}
        </Modale>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  15. Le mouvement  ───────────────────────────── */

const CHOIX_MOUVEMENT: (NiveauMouvement | null)[] = ['complet', 'reduit', 'aucun', null];

function SectionMouvement() {
  const { tm } = useMotsDemo();
  const niveau = useMouvement();
  const [choix, setChoix] = useState<NiveauMouvement | null>(choixMouvement);
  return (
    <Section id="mouvement">
      <p className="sd-note" role="status">
        {tm('mouvement.enVigueur', { niveau: tm(`mouvement.niveau.${niveau}`) })} · {choix ? tm('mouvement.choisi') : tm('mouvement.systeme')}
      </p>
      <div className="sd-rangee" role="group" aria-label={tm('s.mouvement.titre')}>
        {CHOIX_MOUVEMENT.map((n) => (
          <Bouton
            key={n ?? 'systeme'}
            variante="secondaire"
            aria-pressed={choix === n}
            onClick={() => {
              ecrireMouvement(n);
              setChoix(n);
            }}
          >
            {tm(`mouvement.bouton.${n ?? 'systeme'}`)}
          </Bouton>
        ))}
      </div>
      <Bloc titre={tm('mouvement.temoins')}>
        <div className="sd-rangee">
          <Cas legende={tm('mouvement.temoin.chargement')}>
            <Bouton variante="secondaire" chargement>
              {tm('bouton.libelle')}
            </Bouton>
          </Cas>
          <Cas legende={tm('mouvement.temoin.pression')}>
            <Bouton variante="secondaire">{tm('bouton.libelle')}</Bouton>
          </Cas>
          <Cas legende={tm('mouvement.temoin.squelette')}>
            <Squelette largeur={160} hauteur={12} rayon="99px" ligne />
          </Cas>
        </div>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  16. Vivant (v3)  ───────────────────────────── */

const TONS_VOYANT: TonVivant[] = ['ok', 'attention', 'critique', 'info'];
const NIVEAUX: NiveauSeverite[] = ['critique', 'moyen', 'faible', 'info', 'ok'];
/** Une semaine de cinq jours sur six créneaux : des intensités de 0 à 1, fictives. */
const CHALEUR: number[][] = [
  [0, 0.1, 0.3, 0.2, 0, 0.1],
  [0.2, 0.5, 0.9, 0.6, 0.3, 0.1],
  [0.1, 0.3, 0.6, 1, 0.7, 0.2],
  [0, 0.2, 0.4, 0.5, 0.2, 0],
  [0.1, 0, 0.2, 0.3, 0.1, 0],
];
const HEURES_CHALEUR = [8, 10, 12, 14, 16, 18];

function SectionVivant() {
  const { tm, langue } = useMotsDemo();
  const [filtre, setFiltre] = useState('tout');
  const [suggestion, setSuggestion] = useState<'aucune' | 'oui' | 'non'>('aucune');
  const [ouverte, setOuverte] = useState('');
  const [tour, setTour] = useState(0);
  const jours = nomsDesJours(langue === 'fr' ? 'fr-FR' : 'en-GB').slice(0, 5);
  const puces = [
    { cle: 'tout', libelle: tm('vivant.puces.tout'), compteur: 12 },
    { cle: 'critique', libelle: tm('vivant.puces.critiques'), compteur: 2 },
    { cle: 'moyen', libelle: tm('vivant.puces.moyens'), compteur: 4 },
    { cle: 'faible', libelle: tm('vivant.puces.faibles'), compteur: 6 },
  ];
  return (
    <Section id="vivant">
      <Bloc titre={tm('vivant.voyant')}>
        <div className="sd-rangee">
          {TONS_VOYANT.map((t) => (
            <Cas key={t} legende={t}>
              <LiveDot ton={t} libelle={tm(`vivant.voyant.${t}`)} afficherLibelle />
            </Cas>
          ))}
          <Cas legende={tm('vivant.voyant.sansOnde')}>
            <LiveDot libelle={tm('vivant.voyant.ok')} afficherLibelle onde={false} />
          </Cas>
          <Cas legende={tm('vivant.voyant.petit')}>
            <LiveDot libelle={tm('vivant.voyant.enLigne')} afficherLibelle taille={6} halo={false} onde={false} />
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('vivant.curseur')}>
        <div className="sd-etroit">
          <p className="sd-saisie">
            <Caret />
            <span>{tm('vivant.curseur.texte')}</span>
          </p>
        </div>
      </Bloc>
      <Bloc titre={tm('vivant.niveaux')}>
        <div className="sd-rangee">
          {NIVEAUX.map((n) => (
            <Cas key={n} legende={n}>
              <Severity niveau={n} />
            </Cas>
          ))}
        </div>
        <div className="sd-rangee">
          <Cas legende={tm('vivant.mono')}>
            <p className="sd-journal sc-mono">
              <span>10:42:07</span> <Severity niveau="info" /> <span>{tm('vivant.mono.journal')}</span>
            </p>
          </Cas>
        </div>
      </Bloc>
      <Bloc titre={tm('vivant.puces')}>
        <FilterChips libelle={tm('vivant.puces.libelle')} puces={puces} valeur={filtre} onChange={setFiltre} />
        <p role="status" className="sd-note">
          {tm('vivant.puces.choisi', { filtre: puces.find((p) => p.cle === filtre)?.libelle ?? '' })}
        </p>
      </Bloc>
      <Bloc titre={tm('vivant.jauge')}>
        <div className="sd-rangee">
          {[
            { v: 0, ton: 'neutre' as const },
            { v: 42, ton: 'critique' as const },
            { v: 64, ton: 'attention' as const },
            { v: 86, ton: 'ok' as const },
            { v: 100, ton: 'info' as const },
          ].map(({ v, ton }) => (
            <Cas key={v} legende={`${v} · ${ton}`}>
              <Gauge valeur={v} ton={ton} libelle={tm('vivant.jauge.libelle')} />
            </Cas>
          ))}
        </div>
      </Bloc>
      <Bloc titre={tm('vivant.chaleur')}>
        <div className="sd-chaleur" role="group" aria-label={tm('vivant.chaleur')}>
          <span aria-hidden />
          {HEURES_CHALEUR.map((h) => (
            <span key={h} aria-hidden className="sd-chaleur__axe">
              {h}
            </span>
          ))}
          {CHALEUR.map((ligne, j) => (
            <React.Fragment key={j}>
              <span aria-hidden className="sd-chaleur__axe">
                {jours[j].nom}
              </span>
              {ligne.map((v, i) => (
                <HeatCell key={i} intensite={v} libelle={tm('vivant.chaleur.case', { jour: jours[j].nom, heure: HEURES_CHALEUR[i], n: Math.round(v * 10) })} />
              ))}
            </React.Fragment>
          ))}
        </div>
        <div className="sd-rangee">
          {[0, 0.5, 1].map((v) => (
            <Cas key={v} legende={tm('vivant.chaleur.cliquable')}>
              <HeatCell
                intensite={v}
                ton="info"
                libelle={tm('vivant.chaleur.case', { jour: jours[4].nom, heure: 10, n: Math.round(v * 10) })}
                onClick={() => setOuverte(tm('vivant.chaleur.case', { jour: jours[4].nom, heure: 10, n: Math.round(v * 10) }))}
              >
                {Math.round(v * 10)}
              </HeatCell>
            </Cas>
          ))}
        </div>
        <p role="status" className="sd-note">
          {ouverte ? tm('vivant.chaleur.ouverte', { libelle: ouverte }) : ''}
        </p>
      </Bloc>
      <Bloc titre={tm('vivant.flux')}>
        <svg className="sd-flux" viewBox="0 0 520 120" width="520" height="120" role="group" aria-label={tm('vivant.flux')}>
          <FlowLine de={[110, 30]} a={[250, 60]} ton="info" libelle={tm('vivant.flux.actif')} />
          <FlowLine de={[110, 90]} a={[250, 60]} duree={2200} />
          <FlowLine de={[330, 60]} a={[430, 60]} actif={false} ton="attention" libelle={tm('vivant.flux.arret')} />
          {[
            { x: 20, y: 16, cle: 'a' },
            { x: 20, y: 76, cle: 'b' },
            { x: 250, y: 46, cle: 'c' },
            { x: 430, y: 46, cle: 'd' },
          ].map((n) => (
            <g key={n.cle} className="sd-flux__noeud" data-mvt-survol="noeud">
              <rect x={n.x} y={n.y} width={n.cle === 'c' ? 80 : 90} height={28} rx={8} />
              <text x={n.x + (n.cle === 'c' ? 40 : 45)} y={n.y + 18} textAnchor="middle">
                {tm(`vivant.flux.noeud.${n.cle as 'a' | 'b' | 'c' | 'd'}`)}
              </text>
            </g>
          ))}
        </svg>
      </Bloc>
      <Bloc titre={tm('vivant.suggestion')}>
        <div className="sd-etroit">
          <InlineSuggestion texte={tm('vivant.suggestion.texte')} onOui={() => setSuggestion('oui')} onNon={() => setSuggestion('non')} />
          <p role="status" className="sd-note">
            {suggestion === 'aucune' ? '' : tm(suggestion === 'oui' ? 'vivant.suggestion.reponse.oui' : 'vivant.suggestion.reponse.non')}
          </p>
        </div>
      </Bloc>
      <Bloc titre={tm('vivant.couche')}>
        <p className="sd-note">{tm('vivant.couche.note')}</p>
        <div className="sd-rangee">
          <Bouton variante="secondaire" icone={<RotateCcw />} onClick={() => setTour((t) => t + 1)}>
            {tm('vivant.couche.rejouer')}
          </Bouton>
        </div>
        <div key={tour}>
          <Bloc titre={tm('vivant.couche.entree')}>
            <div className="sd-grille" style={{ '--sd-min': '150px' } as React.CSSProperties}>
              {[1, 2, 3, 4, 5, 6].map((n, i) => (
                <Carte key={n} compacte rang={i} titre={tm('vivant.couche.carte', { n })} niveauTitre={4}>
                  <BarreProgression valeur={n / 6} libelle={tm('vivant.couche.carte', { n })} />
                </Carte>
              ))}
            </div>
          </Bloc>
          <Bloc titre={tm('vivant.couche.cascade')}>
            <div className="sd-grille" data-mvt="cascade" style={{ '--sd-min': '150px' } as React.CSSProperties}>
              {[7, 8, 9, 10].map((n) => (
                <SousCarte key={n}>{tm('vivant.couche.carte', { n })}</SousCarte>
              ))}
            </div>
          </Bloc>
          <Bloc titre={tm('vivant.couche.mesures')}>
            <div className="sd-rangee">
              <Anneau valeur={0.64} libelle={tm('vivant.jauge.libelle')} ton="succes" />
              <Gauge valeur={72} libelle={tm('vivant.jauge.libelle')} ton="info" />
              <div className="sd-etroit">
                <Barres donnees={BARRES} libelle={tm('graphiques.libelle')} hauteur={120} interactif={false} />
              </div>
              <MiniCourbe valeurs={TENDANCE} libelle={tm('graphiques.libelle')} ton="argent" />
            </div>
          </Bloc>
          <Bloc titre={tm('vivant.couche.arrivee')}>
            <ul className="sd-journal-liste">
              <li {...arriveeLigne()} data-mvt-survol="ligne" className="sc-mono">
                <span>10:42:07</span> <span>{tm('vivant.couche.ligne')}</span>
              </li>
            </ul>
          </Bloc>
        </div>
        <Bloc titre={tm('vivant.couche.boucles')}>
          <div className="sd-rangee">
            <Cas legende={tm('vivant.couche.balayage')}>
              <span className="sd-radar">
                <span className="sd-radar__balai" data-mvt="balayage" />
              </span>
            </Cas>
          </div>
        </Bloc>
        <Bloc titre={tm('vivant.couche.survols')}>
          <div className="sd-rangee">
            <Cas legende={tm('vivant.survol.carte')}>
              <div className="sd-survol-carte" data-mvt-survol="carte">
                {tm('vivant.couche.carte', { n: 1 })}
              </div>
            </Cas>
            <Cas legende={tm('vivant.survol.bouton')}>
              <Bouton variante="secondaire">{tm('bouton.libelle')}</Bouton>
            </Cas>
            <Cas legende={tm('vivant.survol.ligne')}>
              <div className="sd-survol-ligne" data-mvt-survol="ligne">
                {tm('vivant.couche.ligne')}
              </div>
            </Cas>
          </div>
        </Bloc>
      </Bloc>
    </Section>
  );
}

/* ─────────────────────────────  La page  ───────────────────────────── */

/** Remet le réglage Mouvement dans l'état où la page l'a trouvé quand elle se démonte. */
function useRestaurerMouvement(): void {
  useEffect(() => {
    const avant = choixMouvement();
    return () => ecrireMouvement(avant);
  }, []);
}

export function PageDemoSocle() {
  const { tm } = useMotsDemo();
  const niveau = useMouvement();
  const [courante, setCourante] = useState<IdSection>(SECTIONS[0]);
  const conteneur = useRef<HTMLDivElement | null>(null);
  useRestaurerMouvement();

  // La section en cours de lecture, pour le sommaire.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sections = Array.from(conteneur.current?.querySelectorAll<HTMLElement>('[data-section]') ?? []);
    const observateur = new IntersectionObserver(
      (entrees) => {
        const vue = entrees.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = vue?.target.getAttribute('data-section');
        if (id) setCourante(id as IdSection);
      },
      { rootMargin: '-10% 0px -75% 0px' },
    );
    sections.forEach((s) => observateur.observe(s));
    return () => observateur.disconnect();
  }, []);

  const aller = (id: IdSection) => {
    setCourante(id);
    document.getElementById(`sd-${id}`)?.scrollIntoView({ behavior: lireMouvement() === 'complet' ? 'smooth' : 'auto', block: 'start' });
  };

  return (
    <div ref={conteneur} className="sd" data-refonte-police="inter">
      <aside className="sd-sommaire">
        <nav aria-label={tm('nav.libelle')}>
          <p className="sd-sommaire__titre">{tm('nav.titre')}</p>
          <ul className="sd-sommaire__liste">
            {SECTIONS.map((id) => (
              <li key={id}>
                <button type="button" aria-current={courante === id ? 'location' : undefined} onClick={() => aller(id)} className="sd-sommaire__lien sc-focus">
                  {tm(`s.${id}.titre`)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sd-sommaire__reglage">
          <Interrupteur actif={niveau !== 'complet'} onChange={(reduit) => ecrireMouvement(reduit ? 'reduit' : 'complet')} libelle={tm('nav.mouvement')} />
          <span>{tm('nav.mouvement')}</span>
        </div>
      </aside>

      <div className="sd-contenu">
        <header className="sd-entete">
          <p className="sd-entete__etiquette">{tm('entete.etiquette')}</p>
          <h1 className="sd-entete__titre">{tm('entete.titre')}</h1>
          <p className="sd-entete__sous">{tm('entete.sous')}</p>
        </header>
        <SectionJetons />
        <SectionBoutons />
        <SectionCartes />
        <SectionAvatars />
        <SectionProgression />
        <SectionKpi />
        <SectionChamps />
        <SectionTaches />
        <SectionLudiques />
        <SectionSuggestion />
        <SectionGraphiques />
        <SectionArchetypes />
        <SectionGabarit />
        <SectionEtats />
        <SectionMouvement />
        <SectionVivant />
      </div>
    </div>
  );
}

export default PageDemoSocle;

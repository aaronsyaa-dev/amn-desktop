import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CornerDownLeft, Lock, Search, Shield, Target } from 'lucide-react';
import { Avatar, Raccourci, Segmente } from '../../../socle/ui';
import { styleRang } from '../../../socle/couche-mouvement';
import {
  composerRepertoire,
  compterParNiveau,
  NIVEAUX_FILTRE,
  ordreDeSelection,
  partOuverte,
  repartirEnColonnes,
  surligner,
  ligneVoisine,
  type Correspondance,
  type FamilleComposee,
  type FamilleRepertoire,
  type FiltreNiveau,
  type LigneRepertoire,
  type Moment,
  type ModuleRepertoire,
} from './logique';
import { useMots } from './i18n';
import './modules.css';

/**
 * TOUS LES MODULES (D02, v3) — LA VUE, sans magasin : tout arrive par les props.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Une page de la coquille (fil « Espace / Tous les modules », bouton carré allumé, aucune famille dépliée), plus un
 * panneau en surimpression. Trois zones : l'en-tête (titre, segmenté des niveaux, champ de recherche), le RÉPERTOIRE
 * (les modules de chaque famille, toutes les lignes, quatre colonnes) et la colonne droite (Épinglés, Récents, À
 * découvrir). Le répertoire défile DANS sa carte quand le registre compte plus de lignes que la hauteur n'en tient :
 * jamais de zone coupée, et les bas des deux colonnes s'alignent sur le bas de la zone principale.
 *
 * La page branchée (`PageTousLesModules`) lit le registre, le catalogue, les épingles, le journal des ouvertures et
 * les compteurs de la coquille ; l'aperçu de capture passe des données fictives. Aucun nom, aucun chiffre ici.
 */

/** Un module tel que la colonne droite le montre : son nom, sa teinte de famille, son icône, où il mène. */
export interface ModulePuce {
  id: string;
  nom: string;
  vers: string;
  teinte: string;
  icone?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Une ligne sous le nom (À découvrir). */
  indice?: string;
  /** Une clé du catalogue (pour épingler). */
  cle?: string;
}

export interface VueTousLesModulesProps {
  familles: readonly FamilleRepertoire[];
  /** Trouve les modules qui répondent à une saisie (identifiant d'entrée → score et verbe). */
  correspondre: (requete: string) => ReadonlyMap<string, Correspondance>;
  epingles: readonly ModulePuce[];
  recents: readonly { module: ModulePuce; moment: Moment }[];
  decouvrir: readonly ModulePuce[];
  /** Les modules déjà ouverts au moins une fois par la personne. */
  ouverts: number;
  /** Le lien vers l'espace Cyber, hors des modules (son nombre d'espaces), ou `null`. */
  cyber: { vers: string; espaces: number } | null;
  /** ⌘ sur macOS, Ctrl ailleurs. */
  touche: '⌘' | 'Ctrl';
  onOuvrir: (vers: string) => void;
  /** Épingler ou retirer (clic droit, touche P). Rend vrai si le module est épinglé après le geste. */
  onBasculerEpingle?: (module: ModuleRepertoire) => boolean;
  onDemanderAjmani: (requete: string) => void;
  /** La famille mise en avant à l'arrivée (« + N autres » de la barre latérale). */
  familleActive?: string;
  /** Pour l'aperçu : une recherche et une ligne choisie au chargement. */
  requeteInitiale?: string;
  selectionInitiale?: string;
  /** Le champ prend le focus à l'ouverture (la fiche le demande). */
  focusInitial?: boolean;
}

const estChampDeSaisie = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function VueTousLesModules({
  familles,
  correspondre,
  epingles,
  recents,
  decouvrir,
  ouverts,
  cyber,
  touche,
  onOuvrir,
  onBasculerEpingle,
  onDemanderAjmani,
  familleActive,
  requeteInitiale = '',
  selectionInitiale,
  focusInitial = true,
}: VueTousLesModulesProps) {
  const { tm } = useMots();
  const [requete, setRequete] = useState(requeteInitiale);
  const [niveau, setNiveau] = useState<FiltreNiveau>('tous');
  const [selection, setSelection] = useState(0);
  const [choisie, setChoisie] = useState<string | undefined>(selectionInitiale);
  const [annonce, setAnnonce] = useState('');
  const champ = useRef<HTMLInputElement>(null);
  const grille = useRef<HTMLDivElement>(null);
  const carteRepertoire = useRef<HTMLDivElement>(null);
  /* Le répertoire défile dans sa carte : tant qu'il reste des lignes plus bas, un fondu au bas de la carte le dit. */
  const [deborde, setDeborde] = useState(false);
  useEffect(() => {
    const el = carteRepertoire.current;
    if (!el) return undefined;
    const mesurer = () => setDeborde(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    mesurer();
    el.addEventListener('scroll', mesurer, { passive: true });
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer);
    obs?.observe(el);
    if (grille.current) obs?.observe(grille.current);
    return () => {
      el.removeEventListener('scroll', mesurer);
      obs?.disconnect();
    };
  }, []);

  const total = useMemo(() => compterParNiveau(familles), [familles]);
  const correspondances = useMemo(() => (requete.trim() ? correspondre(requete.trim()) : null), [requete, correspondre]);
  const composees = useMemo(() => composerRepertoire(familles, { niveau, correspondances }), [familles, niveau, correspondances]);
  const colonnes = useMemo(() => repartirEnColonnes(composees, 4), [composees]);
  const { ordre, depart } = useMemo(() => ordreDeSelection(colonnes, correspondances), [colonnes, correspondances]);
  useEffect(() => setSelection(depart), [depart, requete, niveau]);
  const enRecherche = Boolean(correspondances);
  const aucun = enRecherche && ordre.length === 0;
  const idSelection = enRecherche ? ordre[Math.min(selection, ordre.length - 1)] : choisie;

  /* La ligne sélectionnée à la frappe reste visible dans la carte qui défile. */
  useEffect(() => {
    if (!enRecherche || !idSelection) return;
    grille.current?.querySelector(`[data-ligne="${CSS.escape(idSelection)}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [enRecherche, idSelection]);

  /* La famille de « + N autres » : visible à l'arrivée. */
  useEffect(() => {
    if (!familleActive) return;
    grille.current?.querySelector(`[data-famille-id="${CSS.escape(familleActive)}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [familleActive]);

  /* « / » revient au champ de n'importe où ; ⌘1 à ⌘8 ouvrent les épinglés. */
  const epinglesRef = useRef(epingles);
  epinglesRef.current = epingles;
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !estChampDeSaisie(e.target)) {
        e.preventDefault();
        champ.current?.focus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && /^[1-8]$/.test(e.key)) {
        const p = epinglesRef.current[Number(e.key) - 1];
        if (!p) return;
        e.preventDefault();
        onOuvrir(p.vers);
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onOuvrir]);

  const ligneParId = (id: string | undefined): LigneRepertoire | undefined => (id ? composees.flatMap((f) => f.lignes).find((l) => l.id === id) : undefined);
  const ouvrirLigne = (l: LigneRepertoire | undefined) => {
    if (!l) return;
    if (l.type === 'action') onOuvrir(l.vers);
    else if (l.module.active && !l.module.verrouille) onOuvrir(l.module.vers);
  };

  const surChamp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && ordre.length > 0) {
      e.preventDefault();
      setSelection((s) => (s + 1) % ordre.length);
    } else if (e.key === 'ArrowUp' && ordre.length > 0) {
      e.preventDefault();
      setSelection((s) => (s - 1 + ordre.length) % ordre.length);
    } else if (e.key === 'Enter') {
      const l = ligneParId(idSelection);
      if (l) {
        e.preventDefault();
        ouvrirLigne(l);
      }
    } else if (e.key === 'Escape' && requete) {
      e.preventDefault();
      e.stopPropagation();
      setRequete('');
    }
  };

  const basculer = (m: ModuleRepertoire) => {
    if (!onBasculerEpingle) return;
    const epingle = onBasculerEpingle(m);
    setAnnonce(tm(epingle ? 'epingle.fait' : 'epingle.retire', { nom: m.nom }));
  };

  /* Les flèches dans la grille (sans recherche) : ↑ ↓ dans la colonne, ← → vers la colonne voisine ; P épingle. */
  const surGrille = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ici = document.activeElement as HTMLElement | null;
    if (!ici?.dataset.ligne) return;
    if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const l = ligneParId(ici.dataset.ligne);
      if (l?.type === 'module') {
        e.preventDefault();
        basculer(l.module);
      }
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const lignes = [...(grille.current?.querySelectorAll<HTMLElement>('[data-ligne]') ?? [])];
    const i = lignes.indexOf(ici);
    const j = ligneVoisine(lignes.map((l) => ({ colonne: Number(l.dataset.colonne), haut: l.offsetTop })), i, e.key);
    if (j < 0) return;
    e.preventDefault();
    lignes[j]?.focus();
  };

  const sousTitre =
    niveau === 'tous'
      ? tm('sous', { n: total.tous, f: familles.length })
      : tm('sous.niveau', { n: total[niveau], f: familles.length, niveau: tm(`niveau.${niveau}`) });
  const niveauLibelle = niveau === 'tous' ? '' : tm(`niveau1.${niveau}`);
  /* La ligne qui reçoit la tabulation dans le répertoire (une seule : les autres se parcourent aux flèches). */
  const premiere = composees.flatMap((f) => f.lignes)[0]?.id;
  const tabulable = ligneParId(choisie) ? choisie : premiere;

  return (
    <div className="dm-page" data-refonte-police="inter">
      <header className="dm-entete">
        <div className="dm-entete__titres">
          <h1 className="dm-titre">{tm('titre')}</h1>
          <p className="dm-sous">{sousTitre}</p>
        </div>
        <div className="dm-entete__controles">
          <Segmente
            libelle={tm('filtres')}
            valeur={niveau}
            onChange={(c) => setNiveau(c === niveau && c !== 'tous' ? 'tous' : (c as FiltreNiveau))}
            options={NIVEAUX_FILTRE.map((f) => ({ cle: f, libelle: `${tm(`filtre.${f}`)} ${total[f]}` }))}
          />
          <div role="search" className="dm-recherche">
            <Search aria-hidden size={14} />
            <input
              ref={champ}
              type="search"
              value={requete}
              autoFocus={focusInitial}
              placeholder={tm('recherche.placeholder')}
              aria-label={tm('recherche.libelle')}
              aria-controls="dm-repertoire"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setRequete(e.target.value)}
              onKeyDown={surChamp}
            />
            <Raccourci>/</Raccourci>
          </div>
        </div>
      </header>
      {aucun && (
        <p className="dm-aucun" role="status">
          <span>{tm('vide.titre', { q: requete.trim() })}</span>
          <button type="button" onClick={() => onDemanderAjmani(requete.trim())} className="dm-lien sc-focus">
            {tm('vide.demander')}
          </button>
        </p>
      )}

      <div className="dm-corps">
        <section
          id="dm-repertoire"
          aria-label={tm('repertoire')}
          data-socle="carte"
          data-sans-marge="true"
          data-recherche={enRecherche || undefined}
          className="dm-repertoire"
        >
          <span className="sr-only" aria-live="polite">
            {enRecherche ? (aucun ? tm('aucunResultat') : tm('resultats', { n: ordre.length })) : ''}
          </span>
          <div ref={carteRepertoire} data-deborde={deborde || undefined} className="dm-defile">
          <div ref={grille} onKeyDown={surGrille} className="dm-colonnes">
            {colonnes.map((col, c) => (
              <div key={c} className="dm-colonne" data-mvt="fondu" style={styleRang(c)}>
                {col.map((f) => (
                  <Famille
                    key={f.id}
                    famille={f}
                    colonne={c}
                    active={f.id === familleActive}
                    saisie={enRecherche ? requete : ''}
                    selection={idSelection}
                    tabulable={tabulable}
                    niveauLibelle={niveauLibelle}
                    onChoisir={(id) => {
                      if (enRecherche) {
                        const i = ordre.indexOf(id);
                        if (i >= 0) setSelection(i);
                      } else setChoisie(id);
                    }}
                    onBasculer={basculer}
                  />
                ))}
                {c === colonnes.length - 1 && cyber && (
                  <Link to={cyber.vers} className="dm-cyber sc-focus">
                    <Target aria-hidden size={14} strokeWidth={1.8} />
                    <span className="dm-cyber__textes">
                      <span className="dm-cyber__nom">{tm('cyber')}</span>
                      <span className="dm-cyber__sous">{tm('cyber.sous', { n: cyber.espaces })}</span>
                    </span>
                    <ChevronRight aria-hidden size={14} className="dm-chevron" />
                  </Link>
                )}
              </div>
            ))}
          </div>
          </div>
        </section>

        <div className="dm-droite">
          <CarteEpingles epingles={epingles} touche={touche} />
          {recents.length > 0 && <CarteRecents recents={recents} />}
          <CarteDecouvrir decouvrir={decouvrir} ouverts={ouverts} total={total.tous} onOuvrir={onOuvrir} />
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {annonce}
      </span>
    </div>
  );
}

function Famille({
  famille,
  colonne,
  active,
  saisie,
  selection,
  tabulable,
  niveauLibelle,
  onChoisir,
  onBasculer,
}: {
  famille: FamilleComposee;
  colonne: number;
  active: boolean;
  saisie: string;
  selection: string | undefined;
  tabulable: string | undefined;
  niveauLibelle: string;
  onChoisir: (id: string) => void;
  onBasculer: (m: ModuleRepertoire) => void;
}) {
  const { tm } = useMots();
  return (
    <section className="dm-famille" data-famille-id={famille.id} data-active={active || undefined} aria-labelledby={`dm-f-${famille.id}`}>
      <h2 id={`dm-f-${famille.id}`} className="dm-famille__titre">
        <Link to={famille.vers} aria-label={tm('famille.ouvrir', { nom: famille.nom })} title={famille.nom} className="dm-famille__lien sc-focus">
          {famille.garde ? <Shield aria-hidden size={12} strokeWidth={2} className="dm-famille__bouclier" /> : <span aria-hidden className="dm-pastille" data-teinte={famille.teinte} />}
          <span className="dm-famille__nom">{famille.nom}</span>
          <span className="dm-famille__effectif" aria-label={tm('famille.effectif', { n: famille.effectif })}>
            {famille.effectif}
          </span>
          <ChevronRight aria-hidden size={14} className="dm-chevron" />
        </Link>
      </h2>
      {famille.videAuNiveau ? (
        <p className="dm-famille__vide">{tm('niveauVide', { niveau: niveauLibelle })}</p>
      ) : (
        <ul className="dm-lignes">
          {famille.lignes.map((l) => (
            <Ligne
              key={l.id}
              ligne={l}
              colonne={colonne}
              saisie={saisie}
              choisie={l.id === selection}
              tabulable={l.id === tabulable}
              onChoisir={onChoisir}
              onBasculer={onBasculer}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Ligne({
  ligne,
  colonne,
  saisie,
  choisie,
  tabulable,
  onChoisir,
  onBasculer,
}: {
  ligne: LigneRepertoire;
  colonne: number;
  saisie: string;
  choisie: boolean;
  tabulable: boolean;
  onChoisir: (id: string) => void;
  onBasculer: (m: ModuleRepertoire) => void;
}) {
  const { tm } = useMots();
  const m = ligne.module;
  const libelle = ligne.type === 'action' ? ligne.libelle : m.nom;
  const [avant, gras, apres] = surligner(libelle, saisie);
  const terne = Boolean(saisie) && ligne.type === 'module' && !ligne.correspond;
  const ouvrable = ligne.type === 'action' || (m.active && !m.verrouille);
  const aide = ligne.type === 'module' && m.verrouille ? tm('ligne.verrou') : ligne.type === 'module' && !m.active ? tm('ligne.inactif.aide') : libelle;
  const commun = {
    'data-ligne': ligne.id,
    'data-colonne': colonne,
    'data-choisie': choisie || undefined,
    'data-terne': terne || undefined,
    'data-action': ligne.type === 'action' || undefined,
    'data-inactif': (ligne.type === 'module' && !m.active) || undefined,
    tabIndex: tabulable ? 0 : -1,
    title: aide,
    onFocus: () => onChoisir(ligne.id),
    onMouseMove: saisie ? () => onChoisir(ligne.id) : undefined,
    onContextMenu:
      ligne.type === 'module'
        ? (e: React.MouseEvent) => {
            e.preventDefault();
            onBasculer(m);
          }
        : undefined,
    className: 'dm-ligne sc-focus',
  };
  const contenu = (
    <>
      <span className="dm-ligne__nom">
        {avant}
        {gras ? <b>{gras}</b> : null}
        {apres}
      </span>
      {ligne.type === 'action' && <span className="sr-only"> · {tm('ligne.action')}</span>}
      {ligne.type === 'module' && !choisie && (
        <span className="dm-ligne__acc">
          {m.nouveau && <span className="dm-nouveau">{tm('ligne.nouveau')}</span>}
          {!m.active && !m.verrouille && <span className="dm-inactif">{tm('ligne.inactif')}</span>}
          {m.verrouille && (
            <span className="dm-verrou">
              <Lock aria-hidden size={12} />
              <span className="sr-only">{tm('ligne.verrou')}</span>
            </span>
          )}
          {m.badge > 0 && (
            <span className="dm-compte">
              {m.badge > 99 ? '99+' : m.badge}
              <span className="sr-only"> {tm('ligne.badge', { n: m.badge })}</span>
            </span>
          )}
          {m.personnes.length > 0 && (
            <span className="dm-presents">
              {m.personnes.slice(0, 2).map((n) => (
                <Avatar key={n} nom={n} taille={16} enLigne />
              ))}
              <span className="sr-only">{tm('ligne.presents', { noms: m.personnes.join(', ') })}</span>
            </span>
          )}
        </span>
      )}
      {choisie && ouvrable && (
        <Raccourci>
          <CornerDownLeft aria-hidden size={11} />
          <span className="sr-only">{tm('ligne.ouvrir')}</span>
        </Raccourci>
      )}
    </>
  );
  return (
    <li>
      {ouvrable ? (
        <Link to={ligne.type === 'action' ? ligne.vers : m.vers} {...commun}>
          {contenu}
        </Link>
      ) : (
        <span role="link" aria-disabled="true" {...commun}>
          {contenu}
        </span>
      )}
    </li>
  );
}

function Tuile({ module, taille }: { module: ModulePuce; taille: 22 | 28 }) {
  const Icone = module.icone;
  return (
    <span aria-hidden className="dm-tuile" data-teinte={module.teinte} data-taille={taille}>
      {Icone ? <Icone size={taille === 28 ? 13 : 11} strokeWidth={1.8} /> : null}
    </span>
  );
}

function CarteEpingles({ epingles, touche }: { epingles: readonly ModulePuce[]; touche: '⌘' | 'Ctrl' }) {
  const { tm } = useMots();
  const raccourci = (n: number) => (touche === '⌘' ? `⌘${n}` : `Ctrl ${n}`);
  return (
    <section data-socle="carte" data-sans-marge="true" data-mvt="entree" style={styleRang(0)} className="dm-carte dm-epingles" aria-labelledby="dm-epingles">
      <header className="dm-carte__tete">
        <h2 id="dm-epingles" className="dm-carte__titre">
          {tm('epingles')}
        </h2>
        {epingles.length > 0 && (
          <span className="dm-carte__aside dm-raccourcis">
            <Raccourci>{raccourci(1)}</Raccourci>
            <span>{tm('epingles.a')}</span>
            <Raccourci>{raccourci(Math.max(1, epingles.length))}</Raccourci>
          </span>
        )}
      </header>
      {epingles.length === 0 ? (
        <p className="dm-carte__vide">{tm('epingles.vide')}</p>
      ) : (
        <ul className="dm-puces">
          {epingles.map((p, i) => (
            <li key={p.id}>
              <Link to={p.vers} aria-label={tm('epingles.ouvrir', { nom: p.nom, touche: raccourci(i + 1) })} title={p.nom} className="dm-puce sc-focus">
                <Tuile module={p} taille={22} />
                <span className="dm-puce__nom">{p.nom}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CarteRecents({ recents: liste }: { recents: readonly { module: ModulePuce; moment: Moment }[] }) {
  const { tm, langue } = useMots();
  const dire = (m: Moment, premier: boolean): string => {
    if (m.cle === 'instant') return tm('moment.instant');
    if (m.cle === 'minutes') return tm(premier ? 'moment.minutes.premier' : 'moment.minutes', { n: m.n });
    if (m.cle === 'heures') return tm(premier ? 'moment.heures.premier' : 'moment.heures', { n: m.n });
    if (m.cle === 'matin') return tm('moment.matin');
    if (m.cle === 'hier') return tm('moment.hier');
    return m.date.toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
  };
  return (
    <section data-socle="carte" data-sans-marge="true" data-mvt="entree" style={styleRang(1)} className="dm-carte dm-recents" aria-labelledby="dm-recents">
      <header className="dm-carte__tete">
        <h2 id="dm-recents" className="dm-carte__titre">
          {tm('recents')}
        </h2>
        <span className="dm-carte__aside">{tm('recents.vous')}</span>
      </header>
      <ul className="dm-recents__liste">
        {liste.map(({ module, moment }, i) => (
          <li key={module.id}>
            <Link to={module.vers} className="dm-recent sc-focus" title={module.nom}>
              <Tuile module={module} taille={22} />
              <span className="dm-recent__nom">{module.nom}</span>
              <span className="dm-recent__quand">{dire(moment, i === 0)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CarteDecouvrir({ decouvrir, ouverts, total, onOuvrir }: { decouvrir: readonly ModulePuce[]; ouverts: number; total: number; onOuvrir: (vers: string) => void }) {
  const { tm } = useMots();
  const part = partOuverte(ouverts, total);
  return (
    <section data-socle="carte" data-sans-marge="true" data-mvt="entree" style={styleRang(2)} className="dm-carte dm-decouvrir" aria-labelledby="dm-decouvrir">
      <header className="dm-carte__tete">
        <h2 id="dm-decouvrir" className="dm-carte__titre">
          {tm('decouvrir')}
        </h2>
        <span className="dm-carte__aside">{tm('decouvrir.sous')}</span>
      </header>
      {decouvrir.length === 0 ? (
        <p className="dm-carte__vide">{tm('decouvrir.tout')}</p>
      ) : (
        <ul className="dm-decouvrir__liste">
          {decouvrir.map((m) => (
            <li key={m.id} className="dm-decouverte">
              <Tuile module={m} taille={28} />
              <span className="dm-decouverte__textes">
                <span className="dm-decouverte__nom" title={m.nom}>
                  {m.nom}
                </span>
                {m.indice && (
                  <span className="dm-decouverte__indice" title={m.indice}>
                    {m.indice}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => onOuvrir(m.vers)} aria-label={tm('decouvrir.essayer.nom', { nom: m.nom })} className="dm-essayer sc-focus">
                {tm('decouvrir.essayer')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="dm-decouvrir__pied">
        <p className="dm-decouvrir__compte">
          {tm('decouvrir.ouverts')} <b className="dm-chiffres">{tm('decouvrir.chiffres', { x: ouverts, n: total })}</b>
        </p>
        <span className="dm-barre" role="img" aria-label={`${tm('decouvrir.ouverts')} ${tm('decouvrir.chiffres', { x: ouverts, n: total })}`}>
          <span className="dm-barre__plein" data-mvt="remplit" style={{ width: `${Math.round(part * 1000) / 10}%` }} />
        </span>
      </div>
    </section>
  );
}

export default VueTousLesModules;

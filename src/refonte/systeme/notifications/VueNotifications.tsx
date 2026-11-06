import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bell, Check, CircleAlert, Settings, WifiOff } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { PageHead } from '../../../socle/ui/archetypes';
import { Chargement, Squelette } from '../../../socle/ui/Etats';
import { cleSuivante } from '../../../socle/ui/controles';
import { BlocEtat } from '../../../socle/ui/situations';
import { FilterChips, LiveDot } from '../../../socle/ui/vivant';
import { styleRang } from '../../../socle/couche-mouvement';
import './notifications.css';
import { AnneauJournee } from './AnneauJournee';
import { ColonneReglages, heureSansZero } from './ColonneReglages';
import { CarteAction, LigneNotification, LignePaquet } from './LigneNotification';
import { PointAjmani } from './PointAjmani';
import { useMots, type CleMots } from './i18n';
import {
  LIGNES_PAR_PAGE,
  ONGLETS,
  decouper,
  enPaquets,
  filtrerOnglet,
  grouper,
  heureAffichee,
  heureHorloge,
  journee,
  optionsReport,
  pointDuJour,
  sousTitre,
  type CategorieMatrice,
  type Compteurs,
  type ElementFil,
  type GroupeFil,
  type Notification,
  type Onglet,
  type OptionReport,
  type SuggestionMoinsDeBruit,
} from './modele';
import { estRetenue, type ChangementReglage, type ReglagesNotifications } from './reglages';
import type { StatutChargement } from './magasin';

/**
 * LA VUE DE LA PAGE NOTIFICATIONS (H40, v3) — la mise en page et les états, sans aucun accès aux données.
 *
 * Tout ce qu'elle affiche lui est donné (`VueNotificationsProps`) et tout ce qu'elle déclenche passe par `actions` :
 * c'est ce qui permet de rendre chaque état (vide, filtre vide, chargement, erreur, hors ligne, boîte à zéro, liste
 * longue) sans application autour, et de brancher la même vue sur le magasin réel (`PageNotifications`).
 *
 * Disposition (fiche rubrique 3, coordonnées de la zone principale) : en-tête de page (h1, sous-titre, deux boutons
 * SECONDAIRES), puis trois volets de 300 / 476 / 300 px, écart 16, de y = 94 à y = 758 :
 *   · à gauche « Votre journée » (l'anneau de 24 h, 337 px) et « Le point d'Ajmani » (le reste de la hauteur) ;
 *   · au centre le fil (664 px, sans marge interne) : puces de filtre, puis « Maintenant » (cartes d'action, gestes
 *     visibles), « Aujourd'hui » et « Plus tôt » (lignes de 46 px et paquets), « Afficher les plus anciennes » ;
 *   · à droite les réglages rapides du bruit (`ColonneReglages`).
 * Le seul bouton primaire du fil est « Ouvrir le ticket » de la première carte urgente ; l'en-tête n'en a aucun.
 *
 * Clavier : ↑ ↓ changent de ligne (un seul arrêt de tabulation dans le fil), Entrée ouvre (ou déplie un paquet),
 * R ouvre le menu de report, M bascule lu / non lu, ← → changent de puce, ⌘ ⇧ L (ou Ctrl ⇧ L) marque tout comme lu.
 */
export interface ActionsNotifications {
  ouvrir: (n: Notification) => void;
  reporter: (n: Notification, option: OptionReport) => void;
  basculerLue: (n: Notification) => void;
  toutMarquerLu: () => void;
  reessayer: () => void;
  versReglages: () => void;
  changerReglage: (changements: ChangementReglage[]) => boolean;
  reessayerReglage: () => void;
  passerEnResume: (suggestion: SuggestionMoinsDeBruit) => void;
  garder: (suggestion: SuggestionMoinsDeBruit) => void;
}

export interface VueNotificationsProps {
  statut: StatutChargement;
  /** Les lignes que la personne voit (modules ouverts, canal « App » actif). */
  notifications: readonly Notification[];
  compteurs: Compteurs;
  maintenant: Date;
  enLigne: boolean;
  enAttente: number;
  reglages: ReglagesNotifications;
  lignesMatrice: readonly CategorieMatrice[];
  echecReglage: boolean;
  suggestion: SuggestionMoinsDeBruit | null;
  actions: ActionsNotifications;
  filtreInitial?: Onglet;
  /** La ligne dont « Ouvrir » et « Reporter » sont déjà montés (comme si elle était survolée) : pour les contrôles. */
  ligneActiveInitiale?: string;
  /** Les paquets déjà dépliés (leur identifiant) : pour les contrôles. */
  depliesInitiaux?: readonly string[];
  /** Combien de notifications montrer avant « Afficher les plus anciennes » (50 par défaut). */
  limiteInitiale?: number;
  /** Pour les contrôles : tout de suite, sans attendre les 180 ms de sortie d'une ligne reportée. */
  sansAnimation?: boolean;
}

const DELAI_SORTIE_MS = 180;

const CLES_FILTRE: Record<Onglet, CleMots> = { tout: 'filtre.tout', 'non-lues': 'filtre.non-lues', mentions: 'filtre.mentions', urgent: 'filtre.urgent' };
const CLES_FILTRE_VIDE: Record<Exclude<Onglet, 'tout'>, CleMots> = { 'non-lues': 'etat.filtre.non-lues', mentions: 'etat.filtre.mentions', urgent: 'etat.filtre.urgent' };

function reduitLeMouvement(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function LignesEnChargement({ libelle }: { libelle: string }): React.ReactElement {
  return (
    <Chargement libelle={libelle}>
      <ul className="sc-notif__squelettes" data-squelettes>
        {Array.from({ length: 9 }, (_, i) => (
          <li key={i} className="sc-notif__squelette-ligne">
            <Squelette largeur={32} hauteur={32} rayon={10} />
            <span className="sc-notif__squelette-texte">
              <Squelette largeur={i % 2 ? '46%' : '58%'} hauteur={11} ligne />
              <Squelette largeur={i % 2 ? '66%' : '40%'} hauteur={9} ligne />
            </span>
            <Squelette largeur={34} hauteur={9} ligne />
          </li>
        ))}
      </ul>
    </Chargement>
  );
}

/** Le titre et le détail d'un paquet : « 3 alertes de sécurité », « 2 nouvelles de L'argent » ; « …, et 1 autre ». */
function textesPaquet(e: Extract<ElementFil, { genre: 'paquet' }>, tm: (cle: CleMots, params?: Record<string, string | number>) => string): { titre: string; detail: string } {
  const n = e.notifications.length;
  const titre = e.par === 'famille' ? tm(`paquet.famille.${e.famille}`, { n }) : tm(`paquet.type.${e.type}`, { n });
  const premier = e.notifications[0].titre;
  const detail = n === 2 ? tm('paquet.detail.deux', { titre: premier }) : tm('paquet.detail.n', { titre: premier, n: n - 1 });
  return { titre, detail };
}

export function VueNotifications(props: VueNotificationsProps): React.ReactElement {
  const { statut, compteurs: c, maintenant, actions, reglages } = props;
  const { langue, tm } = useMots();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const idBase = useId();
  const [filtre, setFiltre] = useState<Onglet>(props.filtreInitial ?? 'tout');
  const [survol, setSurvol] = useState<string | null>(props.ligneActiveInitiale ?? null);
  const [focus, setFocus] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [sortieId, setSortieId] = useState<string | null>(null);
  const [deplies, setDeplies] = useState<ReadonlySet<string>>(() => new Set(props.depliesInitiaux ?? []));
  const limiteDepart = props.limiteInitiale ?? LIGNES_PAR_PAGE;
  const [limite, setLimite] = useState(limiteDepart);
  const racine = useRef<HTMLDivElement>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const nonLuesRef = useRef(c.nonLues);
  nonLuesRef.current = c.nonLues;

  const chargement = statut === 'chargement';
  const hier = tm('jour.hier');
  const options = useMemo(() => optionsReport(maintenant), [maintenant]);
  const filtrees = useMemo(() => filtrerOnglet(props.notifications, filtre), [props.notifications, filtre]);
  const { groupes, restantes } = useMemo(() => decouper(grouper(filtrees, maintenant), limite), [filtrees, maintenant, limite]);
  const fil: GroupeFil[] = useMemo(() => groupes.map(enPaquets), [groupes]);
  const laJournee = useMemo(() => journee(props.notifications, maintenant), [props.notifications, maintenant]);
  const lignesPoint = useMemo(() => pointDuJour(props.notifications, maintenant), [props.notifications, maintenant]);
  const sous = sousTitre(c.nonLues, c.urgent);
  const heureNow = heureHorloge(maintenant, locale);
  const heureResume = heureSansZero(reglages.resume.heure);

  /** Les lignes du fil dans l'ordre d'affichage (les cartes de « Maintenant » n'en sont pas) : pour ↑ ↓ et la tabulation. */
  const idsLignes = useMemo(() => {
    const ids: string[] = [];
    for (const g of fil) {
      if (g.cle === 'maintenant') continue;
      for (const e of g.elements) {
        ids.push(e.id);
        if (e.genre === 'paquet' && deplies.has(e.id)) for (const n of e.notifications) ids.push(n.id);
      }
    }
    return ids;
  }, [fil, deplies]);
  const aplat = useMemo(() => groupes.flatMap((g) => g.notifications), [groupes]);
  const ligneTab = focus && idsLignes.includes(focus) ? focus : idsLignes[0];

  // ⌘ ⇧ L (ou Ctrl ⇧ L) : tout marquer comme lu, où que soit le focus de la page.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (nonLuesRef.current > 0) actionsRef.current.toutMarquerLu();
      }
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  /** Rend le focus à une ligne après qu'un geste l'a déplacée ou retirée (le navigateur le perd quand le nœud bouge). */
  const focaliser = (id: string | undefined) => {
    if (!id) return;
    window.setTimeout(() => (racine.current ?? document).querySelector<HTMLElement>(`[data-ligne="${CSS.escape(id)}"]`)?.focus(), 0);
  };

  const versFiltre = (cle: Onglet) => {
    setFiltre(cle);
    setLimite(limiteDepart);
    setMenuId(null);
  };

  const basculerPaquet = (id: string) =>
    setDeplies((d) => {
      const suite = new Set(d);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });

  /** Clic sur un rayon de l'anneau : le fil défile jusqu'à la notification (son paquet se déplie au besoin). */
  const montrer = (id: string) => {
    const paquet = fil.flatMap((g) => g.elements).find((e) => e.genre === 'paquet' && e.notifications.some((n) => n.id === id));
    if (paquet && !deplies.has(paquet.id)) basculerPaquet(paquet.id);
    window.setTimeout(() => {
      const cible = (racine.current ?? document).querySelector<HTMLElement>(`[data-notification="${CSS.escape(id)}"]`);
      cible?.scrollIntoView({ block: 'nearest', behavior: reduitLeMouvement() ? 'auto' : 'smooth' });
      (cible?.querySelector<HTMLElement>('[data-ligne], button') ?? cible)?.focus();
    }, 0);
  };

  const surTouche = (e: React.KeyboardEvent<HTMLElement>) => {
    const cible = e.target as HTMLElement;
    if (!cible.matches('[data-ligne]') || e.altKey || e.ctrlKey || e.metaKey) return;
    const id = cible.dataset.ligne as string;
    const lignes = Array.from((racine.current ?? document).querySelectorAll<HTMLElement>('[data-ligne]'));
    const rang = lignes.indexOf(cible);
    const notification = aplat.find((n) => n.id === id);
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const voisine = lignes[e.key === 'ArrowDown' ? Math.min(rang + 1, lignes.length - 1) : Math.max(rang - 1, 0)];
        voisine?.focus();
        break;
      }
      case 'r':
      case 'R':
        e.preventDefault();
        if (notification) setMenuId(id);
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        if (notification) {
          actions.basculerLue(notification);
          focaliser(id);
        }
        break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const suivant = cleSuivante(ONGLETS, filtre, e.key) as Onglet | null;
        if (!suivant) break;
        e.preventDefault();
        versFiltre(suivant);
        window.setTimeout(() => (racine.current ?? document).querySelector<HTMLElement>('.sc-notif__filtres [role="radio"][aria-checked="true"]')?.focus(), 0);
        break;
      }
      default:
    }
  };

  const reporter = (n: Notification, option: OptionReport) => {
    setMenuId(null);
    // La ligne part : le focus passe à sa voisine, jamais dans le vide.
    const i = idsLignes.indexOf(n.id);
    const voisine = i < 0 ? undefined : (idsLignes[i + 1] ?? idsLignes[i - 1]);
    if (props.sansAnimation || reduitLeMouvement()) {
      actions.reporter(n, option);
      focaliser(voisine);
      return;
    }
    setSortieId(n.id);
    window.setTimeout(() => {
      setSortieId(null);
      actionsRef.current.reporter(n, option);
      focaliser(voisine);
    }, DELAI_SORTIE_MS);
  };

  const puces = ONGLETS.map((cle) => ({
    cle,
    libelle: tm(CLES_FILTRE[cle]),
    compteur: chargement ? undefined : cle === 'tout' ? c.tout : cle === 'non-lues' ? c.nonLues : cle === 'mentions' ? c.mentions : c.urgent,
  }));

  const ligne = (n: Notification, dansUnPaquet = false) => (
    <LigneNotification
      key={n.id}
      notification={n}
      heure={heureAffichee(n.date, maintenant, locale, hier)}
      tm={tm}
      tabIndex={n.id === ligneTab ? 0 : -1}
      actionsVisibles={survol === n.id || focus === n.id || menuId === n.id}
      menuOuvert={menuId === n.id}
      options={options}
      sortie={sortieId === n.id}
      dansUnPaquet={dansUnPaquet}
      onOuvrir={() => actions.ouvrir(n)}
      onChoisirReport={(o) => reporter(n, o)}
      onBasculerMenu={() => setMenuId((m) => (m === n.id ? null : n.id))}
      onFermerMenu={() => setMenuId((m) => (m === n.id ? null : m))}
      onSurvol={(oui) => setSurvol((s) => (oui ? n.id : s === n.id ? null : s))}
      onFocusLigne={() => setFocus(n.id)}
      onQuitterFocus={() => setFocus((f) => (f === n.id ? null : f))}
    />
  );

  const aideGroupe = (g: GroupeFil): string => {
    if (g.cle === 'maintenant') return tm('groupe.maintenant.aide');
    if (g.cle === 'plus-tot') return tm('groupe.plus-tot.aide');
    return g.nonLues === 0 ? tm('groupe.aujourdhui.zero') : g.nonLues === 1 ? tm('groupe.aujourdhui.un') : tm('groupe.aujourdhui.n', { n: g.nonLues });
  };

  /* ── Le contenu du fil, selon l'état ── */
  let contenu: React.ReactNode;
  if (chargement) {
    contenu = <LignesEnChargement libelle={tm('etat.chargement')} />;
  } else if (statut === 'erreur') {
    contenu = (
      <div className="sc-notif__etat">
        <BlocEtat
          icone={<CircleAlert />}
          ton="critique"
          annonce="alert"
          niveauTitre={2}
          titre={tm('etat.erreur')}
          actions={
            <Bouton variante="secondaire" taille="petit" onClick={actions.reessayer}>
              {tm('etat.erreur.action')}
            </Bouton>
          }
        />
      </div>
    );
  } else if (props.notifications.length === 0) {
    contenu = (
      <div className="sc-notif__etat">
        <BlocEtat
          icone={<Bell />}
          ton="famille"
          famille="jour"
          niveauTitre={2}
          titre={tm('etat.vide.titre')}
          texte={tm('etat.vide.texte')}
          actions={
            <Bouton variante="secondaire" taille="petit" onClick={actions.versReglages}>
              {tm('etat.vide.action')}
            </Bouton>
          }
        />
      </div>
    );
  } else if (filtrees.length === 0) {
    contenu = (
      <div className="sc-notif__etat sc-notif__etat--reduit">
        <p className="sc-notif__etat-texte">{tm(CLES_FILTRE_VIDE[filtre as Exclude<Onglet, 'tout'>])}</p>
        <Bouton variante="secondaire" taille="petit" onClick={() => versFiltre('tout')}>
          {tm('etat.filtre.action')}
        </Bouton>
      </div>
    );
  } else {
    let primairePose = false;
    contenu = (
      <div className="sc-notif__defilement" onKeyDown={surTouche}>
        {fil.map((g) => (
          <section key={g.cle} className="sc-notif__groupe" data-groupe={g.cle} aria-labelledby={`${idBase}-groupe-${g.cle}`}>
            <h2 id={`${idBase}-groupe-${g.cle}`} className="sc-notif__groupe-titre">
              {g.cle === 'maintenant' && <LiveDot ton="critique" libelle={tm('groupe.maintenant.voyant')} halo={false} taille={6} />}
              <span className="sc-notif__groupe-nom">{tm(`groupe.${g.cle}`)}</span>
              <span className="sc-notif__groupe-aide sc-nombre">{aideGroupe(g)}</span>
            </h2>
            {g.cle === 'maintenant' ? (
              <div className="sc-notif__cartes-action">
                {g.elements.map((e) => {
                  if (e.genre !== 'seule') return null;
                  const n = e.notification;
                  const primaire = !primairePose && n.urgente && !n.lue;
                  if (primaire) primairePose = true;
                  return (
                    <CarteAction
                      key={n.id}
                      notification={n}
                      heure={heureAffichee(n.date, maintenant, locale, hier)}
                      tm={tm}
                      primaire={primaire}
                      options={options}
                      menuOuvert={menuId === n.id}
                      onOuvrir={() => actions.ouvrir(n)}
                      onChoisirReport={(o) => reporter(n, o)}
                      onBasculerMenu={() => setMenuId((m) => (m === n.id ? null : n.id))}
                      onFermerMenu={() => setMenuId((m) => (m === n.id ? null : m))}
                    />
                  );
                })}
              </div>
            ) : (
              <ul className="sc-notif__lignes" role="list">
                {g.elements.map((e) => {
                  if (e.genre === 'seule') return ligne(e.notification);
                  const { titre, detail } = textesPaquet(e, tm);
                  const recente = e.notifications.reduce((a, b) => (Date.parse(b.date) > Date.parse(a.date) ? b : a));
                  const deplie = deplies.has(e.id);
                  return (
                    <React.Fragment key={e.id}>
                      <LignePaquet
                        id={e.id}
                        titre={titre}
                        detail={detail}
                        heure={heureAffichee(recente.date, maintenant, locale, hier)}
                        date={recente.date}
                        nombre={e.notifications.length}
                        lue={e.lue}
                        famille={e.famille}
                        type={e.type}
                        icone={e.icone}
                        deplie={deplie}
                        tm={tm}
                        tabIndex={e.id === ligneTab ? 0 : -1}
                        onBasculer={() => basculerPaquet(e.id)}
                        onFocusLigne={() => setFocus(e.id)}
                        onQuitterFocus={() => setFocus((f) => (f === e.id ? null : f))}
                      />
                      {deplie && e.notifications.map((n) => ligne(n, true))}
                    </React.Fragment>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
        {aplat.length === 1 && restantes === 0 && (
          <div className="sc-notif__fin">
            <span>{tm('liste.toutPourLeMoment')}</span>
            <button type="button" className="sc-notif__lien" onClick={actions.versReglages}>
              {tm('page.reglages')}
            </button>
          </div>
        )}
      </div>
    );
  }

  const montrerLeFil = !chargement && statut !== 'erreur' && filtrees.length > 0;

  return (
    <div ref={racine} className="sc-notif">
      <PageHead
        className="sc-notif__entete"
        titre={tm('page.titre')}
        sousTitre={<span aria-live="polite">{chargement ? ' ' : tm(sous.cle, sous.params)}</span>}
        secondaires={[
          { libelle: tm('page.toutLu'), icone: <Check aria-hidden />, onClick: actions.toutMarquerLu, disabled: chargement || c.nonLues === 0 },
          { libelle: tm('page.reglages'), icone: <Settings aria-hidden />, onClick: actions.versReglages },
        ]}
      />

      <div className="sc-notif__corps">
        <div className="sc-notif__volet sc-notif__volet--gauche" data-mvt="cascade">
          <section className="sc-notif__carte sc-notif__journee" aria-labelledby={`${idBase}-journee`}>
            <header className="sc-notif__carte-entete">
              <h2 id={`${idBase}-journee`} className="sc-notif__carte-titre">
                {tm('journee.titre')}
              </h2>
              <time className="sc-notif__journee-heure sc-mono" dateTime={maintenant.toISOString()}>
                {heureNow}
              </time>
            </header>
            <AnneauJournee
              tm={tm}
              locale={locale}
              maintenant={maintenant}
              journee={laJournee}
              heuresCalmes={reglages.heuresCalmes}
              heureResume={heureResume}
              estRetenue={(n) => estRetenue(n, reglages)}
              chargement={chargement}
              onChoisir={montrerLeFil ? montrer : undefined}
            />
          </section>
          {chargement ? (
            <div className="sc-notif__carte sc-notif__point-ajmani sc-notif__squelette-carte" aria-hidden>
              <div className="sc-notif__squelette-texte">
                <Squelette largeur="50%" hauteur={12} ligne />
                <Squelette largeur="92%" hauteur={10} ligne />
                <Squelette largeur="80%" hauteur={10} ligne />
                <Squelette largeur="86%" hauteur={10} ligne />
              </div>
            </div>
          ) : (
            <PointAjmani tm={tm} heure={heureNow} lignes={statut === 'erreur' ? [] : lignesPoint} resume={{ actif: reglages.resume.actif, heure: heureResume }} onRegler={actions.versReglages} />
          )}
        </div>

        <section className="sc-notif__fil" aria-label={tm('liste.libelle', { filtre: tm(CLES_FILTRE[filtre]) })} data-mvt="entree" style={styleRang(2)}>
          <div className="sc-notif__filtres">
            <FilterChips libelle={tm('filtres.libelle')} puces={puces} valeur={filtre} onChange={(cle) => versFiltre(cle as Onglet)} />
            <span className="sc-notif__ordre">{tm('filtres.ordre')}</span>
          </div>
          {!props.enLigne && (
            <div className="sc-notif__bandeau" data-ton="attention" role="status">
              <WifiOff aria-hidden />
              <span className="sc-notif__bandeau-texte">
                {tm('etat.horsLigne')}
                {props.enAttente > 0 && <span className="sc-notif__bandeau-sous"> · {props.enAttente === 1 ? tm('etat.enAttente.un') : tm('etat.enAttente.n', { n: props.enAttente })}</span>}
              </span>
            </div>
          )}
          {contenu}
          {montrerLeFil && restantes > 0 && (
            <div className="sc-notif__suite">
              <button type="button" className="sc-notif__suite-bouton" onClick={() => setLimite((l) => l + LIGNES_PAR_PAGE)}>
                {tm('liste.plusAnciennes', { n: restantes })}
              </button>
            </div>
          )}
        </section>

        <ColonneReglages
          tm={tm}
          reglages={reglages}
          lignes={props.lignesMatrice}
          echec={props.echecReglage}
          suggestion={chargement ? null : props.suggestion}
          maintenant={maintenant}
          onChanger={actions.changerReglage}
          onReessayer={actions.reessayerReglage}
          onPasserEnResume={actions.passerEnResume}
          onGarder={actions.garder}
        />
      </div>
    </div>
  );
}

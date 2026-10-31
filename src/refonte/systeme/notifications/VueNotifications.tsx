import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bell, Check, CircleAlert, Settings, WifiOff } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { Chargement, EtatVide, Squelette } from '../../../socle/ui/Etats';
import { Onglets, PanneauOnglet, cleSuivante } from '../../../socle/ui/controles';
import './notifications.css';
import { ColonneReglages } from './ColonneReglages';
import { LigneNotification } from './LigneNotification';
import { useMots } from './i18n';
import {
  LIGNES_PAR_PAGE,
  ONGLETS,
  decouper,
  filtrerOnglet,
  grouper,
  heureAffichee,
  optionsReport,
  sousTitre,
  type CategorieMatrice,
  type Compteurs,
  type Notification,
  type Onglet,
  type OptionReport,
  type SuggestionMoinsDeBruit,
} from './modele';
import type { ChangementReglage, ReglagesNotifications } from './reglages';
import type { StatutChargement } from './magasin';

/**
 * LA VUE DE LA PAGE NOTIFICATIONS (H40) — la mise en page et les états, sans aucun accès aux données.
 *
 * Tout ce qu'elle affiche lui est donné (`VueNotificationsProps`) et tout ce qu'elle déclenche passe par `actions` :
 * c'est ce qui permet de rendre chaque état (vide, onglet vide, chargement, erreur, hors ligne, un seul élément,
 * liste longue) sans application autour, et de brancher la même vue sur le magasin réel (`PageNotifications`).
 *
 * Mise en page : en-tête de page (h1, sous-titre, deux boutons SECONDAIRES : aucun primaire dans l'en-tête), carte
 * liste à gauche (onglets collants, groupes collants, lignes de 61 px qui défilent dans la carte), colonne de
 * réglages de 400 px à droite. Le seul bouton primaire de la liste est « Ouvrir », monté pour la ligne survolée ou
 * focalisée seulement.
 *
 * Clavier : ↑ ↓ changent de ligne (un seul arrêt de tabulation dans la liste, comme un menu), Entrée ouvre, R ouvre
 * le menu de report, M bascule lu / non lu, ← → changent d'onglet, ⌘ ⇧ L (ou Ctrl ⇧ L) marque tout comme lu.
 * Le focus d'une ligne est un anneau de 2 px décalé de -2 px (vers l'intérieur) : la carte coupe tout ce qui déborde.
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
  ongletInitial?: Onglet;
  /** La ligne dont « Ouvrir » et « Reporter » sont déjà montés (comme si elle était survolée) : pour les contrôles. */
  ligneActiveInitiale?: string;
  /** Pour les contrôles : tout de suite, sans attendre les 180 ms de sortie d'une ligne reportée. */
  sansAnimation?: boolean;
}

const DELAI_SORTIE_MS = 180;

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
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="sc-notif__squelette-ligne">
            <Squelette largeur={38} hauteur={38} rayon={11} />
            <span className="sc-notif__squelette-texte">
              <Squelette largeur={i % 2 ? '46%' : '58%'} hauteur={12} />
              <Squelette largeur={i % 2 ? '66%' : '40%'} hauteur={10} />
            </span>
            <Squelette largeur={36} hauteur={10} />
          </li>
        ))}
      </ul>
    </Chargement>
  );
}

export function VueNotifications(props: VueNotificationsProps): React.ReactElement {
  const { statut, compteurs: c, maintenant, actions } = props;
  const { langue, tm } = useMots();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const idBase = useId();
  const [onglet, setOnglet] = useState<Onglet>(props.ongletInitial ?? 'tout');
  const [survol, setSurvol] = useState<string | null>(props.ligneActiveInitiale ?? null);
  const [focus, setFocus] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [sortieId, setSortieId] = useState<string | null>(null);
  const [limite, setLimite] = useState(LIGNES_PAR_PAGE);
  const racine = useRef<HTMLDivElement>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const nonLuesRef = useRef(c.nonLues);
  nonLuesRef.current = c.nonLues;

  const chargement = statut === 'chargement';
  const options = useMemo(() => optionsReport(maintenant), [maintenant]);
  const filtrees = useMemo(() => filtrerOnglet(props.notifications, onglet), [props.notifications, onglet]);
  const { groupes, restantes } = useMemo(() => decouper(grouper(filtrees, maintenant), limite), [filtrees, maintenant, limite]);
  const aplat = useMemo(() => groupes.flatMap((g) => g.notifications), [groupes]);
  const sous = sousTitre(c.nonLues);

  // Un seul arrêt de tabulation dans la liste : la ligne qui a le focus, sinon la première.
  const ligneTab = focus && aplat.some((n) => n.id === focus) ? focus : aplat[0]?.id;

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

  const versOnglet = (cle: Onglet) => {
    setOnglet(cle);
    setLimite(LIGNES_PAR_PAGE);
    setMenuId(null);
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
        const suivant = cleSuivante(ONGLETS, onglet, e.key) as Onglet | null;
        if (!suivant) break;
        e.preventDefault();
        versOnglet(suivant);
        window.setTimeout(() => document.getElementById(`${idBase}-onglet-${suivant}`)?.focus(), 0);
        break;
      }
      default:
    }
  };

  const reporter = (n: Notification, option: OptionReport) => {
    setMenuId(null);
    // La ligne part : le focus passe à sa voisine, jamais dans le vide.
    const i = aplat.findIndex((x) => x.id === n.id);
    const voisine = aplat[i + 1] ?? aplat[i - 1];
    if (props.sansAnimation || reduitLeMouvement()) {
      actions.reporter(n, option);
      focaliser(voisine?.id);
      return;
    }
    setSortieId(n.id);
    window.setTimeout(() => {
      setSortieId(null);
      actionsRef.current.reporter(n, option);
      focaliser(voisine?.id);
    }, DELAI_SORTIE_MS);
  };

  const enteteOnglets = [
    { cle: 'tout', libelle: tm('onglet.tout'), compteur: chargement ? undefined : c.tout },
    { cle: 'non-lues', libelle: tm('onglet.non-lues'), compteur: chargement ? undefined : c.nonLues },
    { cle: 'mentions', libelle: tm('onglet.mentions'), compteur: chargement ? undefined : c.mentions },
    { cle: 'urgent', libelle: tm('onglet.urgent'), compteur: chargement ? undefined : c.urgent },
  ];

  /* ── Le contenu de la carte, selon l'état ── */
  let contenu: React.ReactNode;
  if (chargement) {
    contenu = <LignesEnChargement libelle={tm('etat.chargement')} />;
  } else if (statut === 'erreur') {
    contenu = (
      <div className="sc-notif__etat" role="alert">
        <span className="sc-notif__etat-icone" data-ton="critique" aria-hidden>
          <CircleAlert />
        </span>
        <EtatVide
          texte={tm('etat.erreur')}
          action={
            <Bouton variante="secondaire" onClick={actions.reessayer}>
              {tm('etat.erreur.action')}
            </Bouton>
          }
        />
      </div>
    );
  } else if (props.notifications.length === 0) {
    contenu = (
      <div className="sc-notif__etat">
        <span className="sc-notif__etat-icone" aria-hidden>
          <Bell />
        </span>
        <EtatVide
          titre={tm('etat.vide.titre')}
          texte={tm('etat.vide.texte')}
          action={
            <Bouton variante="secondaire" onClick={actions.versReglages}>
              {tm('etat.vide.action')}
            </Bouton>
          }
        />
      </div>
    );
  } else if (filtrees.length === 0) {
    contenu = (
      <div className="sc-notif__etat">
        <EtatVide
          texte={tm(onglet === 'non-lues' ? 'etat.onglet.non-lues' : onglet === 'mentions' ? 'etat.onglet.mentions' : 'etat.onglet.urgent')}
          action={
            <Bouton variante="secondaire" onClick={() => versOnglet('tout')}>
              {tm('etat.onglet.action')}
            </Bouton>
          }
        />
      </div>
    );
  } else {
    contenu = (
      <div className="sc-notif__defilement" onKeyDown={surTouche}>
          {groupes.map((g) => (
            <section key={g.cle} aria-labelledby={`${idBase}-groupe-${g.cle}`}>
              <h2 id={`${idBase}-groupe-${g.cle}`} className="sc-notif__groupe-titre">
                {tm(`groupe.${g.cle}`)}
              </h2>
              <ul className="sc-notif__lignes" role="list">
                {g.notifications.map((n) => (
                  <LigneNotification
                    key={n.id}
                    notification={n}
                    heure={heureAffichee(n.date, maintenant, locale)}
                    tm={tm}
                    tabIndex={n.id === ligneTab ? 0 : -1}
                    actionsVisibles={survol === n.id || focus === n.id || menuId === n.id}
                    menuOuvert={menuId === n.id}
                    options={options}
                    sortie={sortieId === n.id}
                    onOuvrir={() => actions.ouvrir(n)}
                    onChoisirReport={(o) => reporter(n, o)}
                    onBasculerMenu={() => setMenuId((m) => (m === n.id ? null : n.id))}
                    onFermerMenu={() => setMenuId((m) => (m === n.id ? null : m))}
                    onSurvol={(oui) => setSurvol((s) => (oui ? n.id : s === n.id ? null : s))}
                    onFocusLigne={() => setFocus(n.id)}
                    onQuitterFocus={() => setFocus((f) => (f === n.id ? null : f))}
                  />
                ))}
              </ul>
            </section>
          ))}
          {restantes > 0 && (
            <div className="sc-notif__suite">
              <Bouton variante="secondaire" onClick={() => setLimite((l) => l + LIGNES_PAR_PAGE)}>
                {tm('liste.plusAnciennes')}
              </Bouton>
            </div>
          )}
          {aplat.length === 1 && restantes === 0 && (
            <div className="sc-notif__fin">
              <span>{tm('liste.toutPourLeMoment')}</span>
              <button type="button" className="sc-notif__lien sc-focus" onClick={actions.versReglages}>
                {tm('page.reglages')}
              </button>
            </div>
          )}
      </div>
    );
  }

  return (
    <div ref={racine} className="sc-notif">
      <header className="sc-notif__entete">
        <div className="sc-notif__titres">
          <h1 className="sc-notif__titre">{tm('page.titre')}</h1>
          <p className="sc-notif__sous-titre" aria-live="polite">
            {chargement ? ' ' : tm(sous.cle, sous.params)}
          </p>
        </div>
        <div className="sc-notif__boutons">
          <Bouton variante="secondaire" icone={<Check aria-hidden />} onClick={actions.toutMarquerLu} disabled={chargement || c.nonLues === 0}>
            {tm('page.toutLu')}
          </Bouton>
          <Bouton variante="secondaire" icone={<Settings aria-hidden />} onClick={actions.versReglages}>
            {tm('page.reglages')}
          </Bouton>
        </div>
      </header>

      <div className="sc-notif__corps">
        <section className="sc-notif__carte-liste" aria-label={tm('page.libelle')}>
          <div className="sc-notif__onglets">
            <Onglets libelle={tm('onglets.libelle')} onglets={enteteOnglets} actif={onglet} onChange={(cle) => versOnglet(cle as Onglet)} idBase={idBase} />
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
          {ONGLETS.map((cle) => (
            <PanneauOnglet key={cle} idBase={idBase} cle={cle} actif={cle === onglet}>
              {contenu}
            </PanneauOnglet>
          ))}
        </section>

        <ColonneReglages
          tm={tm}
          reglages={props.reglages}
          lignes={props.lignesMatrice}
          echec={props.echecReglage}
          suggestion={props.suggestion}
          chargement={chargement}
          onChanger={actions.changerReglage}
          onReessayer={actions.reessayerReglage}
          onPasserEnResume={actions.passerEnResume}
          onGarder={actions.garder}
        />
      </div>
    </div>
  );
}

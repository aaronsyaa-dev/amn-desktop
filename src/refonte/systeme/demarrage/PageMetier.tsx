import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssistant } from '../../../assistant/AssistantContext';
import { useAuth } from '../../../auth/AuthContext';
import { NAV_SECTIONS } from '../../../data/navigation';
import { ALWAYS_ON_MODULES, isModuleEnabled } from '../../../data/spaces';
import { libelleNav } from '../../../i18n';
import { bridge } from '../../../lib/bridge';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import { useNavAlleges } from '../../../state/useNavAlleges';
import { REGISTRE_MODULES } from '../../modules/registre';
import { useMots } from './i18n';
import { CLE_PREFS_METIER, calculerAllegements, choixDepuisSelection, choixPasse, ecrireMetier, useMetierStocke, type ChoixMetier } from './metier';
import { MODELES, TAILLE_DEFAUT, composition, modeleParId, type ModeleMetier, type TailleEquipe } from './modeles';
import { ROUTE_DEMARRAGE } from './routes';
import { useHorsLigne } from './useDemarrage';
import { VueMetier, type LigneModule } from './VueMetier';

/**
 * QUEL EST VOTRE MÉTIER ? (H47) — l'écran, branché sur le poste. Route : `ROUTE_METIER` (`routes.ts`), export par défaut pour `lazy`.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   · les huit familles viennent de `modeles.ts` (des données, pas du code) ; le choix est un réglage PERSONNEL
 *     (`metier.ts`), pas un réglage d'espace : le poste n'en a pas, d'où l'absence de l'état « Réservé » ;
 *   · « Continuer » garde le choix puis ALLÈGE les modules non activés dans la barre de la personne (jamais supprimés,
 *     tous restent dans « Tous les modules ») ; « Passer » garde le jeu général et marque l'étape « passée » — sans
 *     rien alléger : qui passe n'a rien demandé qu'on lui cache ;
 *   · « Décrire » envoie la phrase à l'assistant existant et ouvre son panneau : la composition automatique d'un
 *     espace n'existe pas dans le poste, l'assistant ne modifie donc rien tout seul.
 */

/* ── L'écran, branché sur le poste ────────────────────────────────────────── */

export function PageMetier() {
  const { tm, langue } = useMots();
  const navigate = useNavigate();
  const { user } = useAuth();
  const email = user?.email ?? '';
  const stocke = useMetierStocke(email);
  const { remplacer } = useNavAlleges();
  const assistant = useAssistant();
  const horsLigne = useHorsLigne();

  const [choix, setChoix] = useState<string | null>(stocke?.modele ?? null);
  const [taille, setTaille] = useState<TailleEquipe>(stocke?.taille ?? TAILLE_DEFAUT);
  const [actifs, setActifs] = useState<ReadonlySet<string>>(() => new Set(stocke?.modele ? stocke.modules : []));
  const [erreur, setErreur] = useState(false);
  const [decrireOuvert, setDecrireOuvert] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [composeEnvoye, setComposeEnvoye] = useState(false);

  /* Les modules que l'organisation a ouverts, et leur nom : le registre fait foi, le catalogue donne les libellés. */
  const catalogue = NAV_SECTIONS.flatMap((s) => s.items);
  const disponibles = useMemo(() => {
    const ouvertes = new Set<string>();
    for (const e of REGISTRE_MODULES.entrees) if (e.vues.some((v) => isModuleEnabled(v.id))) ouvertes.add(e.id);
    return ouvertes;
    // Les modules ouverts ne changent pas pendant que la page est ouverte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const noms = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of REGISTRE_MODULES.entrees) {
      const item = catalogue.find((i) => i.key === e.id);
      m.set(e.id, e.nom ? e.nom[langue] : item ? libelleNav(item) : e.id);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langue]);
  const teintes = useMemo(() => new Map(REGISTRE_MODULES.entrees.map((e) => [e.id, e.teinte as string])), []);

  const modele: ModeleMetier | null = modeleParId(choix);
  const compo = modele ? composition(modele, disponibles) : null;

  const choisir = (id: string) => {
    if (id === choix) return;
    const m = modeleParId(id);
    if (!m) return;
    setChoix(id);
    setErreur(false);
    // Revenir sur le modèle déjà gardé retrouve ses interrupteurs ; un autre part de tous ses modules allumés.
    const gardes = stocke?.modele === id ? stocke.modules : null;
    setActifs(new Set(gardes ?? composition(m, disponibles).tous));
  };

  const basculer = (id: string) => {
    if (ALWAYS_ON_MODULES.includes(id)) return;
    setActifs((avant) => {
      const suivant = new Set(avant);
      if (suivant.has(id)) {
        // Au moins un module reste activé.
        if ([...suivant].filter((x) => !ALWAYS_ON_MODULES.includes(x)).length <= 1) return avant;
        suivant.delete(id);
      } else suivant.add(id);
      return suivant;
    });
  };

  const activables = compo ? compo.tous.filter((id) => actifs.has(id) && !ALWAYS_ON_MODULES.includes(id)) : [];
  const lignes: LigneModule[] = compo
    ? compo.affiches.map((id) => ({
        id,
        nom: modele?.vocabulaire?.[id]?.[langue] ?? noms.get(id) ?? id,
        teinte: teintes.get(id),
        actif: actifs.has(id),
        toujours: ALWAYS_ON_MODULES.includes(id),
      }))
    : [];

  const garder = (c: ChoixMetier, allegements: string[] | null): boolean => {
    if (!ecrireMetier(email, c)) return false;
    try {
      if (allegements) remplacer(allegements);
    } catch {
      return false;
    }
    // Le serveur : au mieux. Le poste a déjà le choix, et le recevra à la prochaine occasion.
    void bridge()
      .remote.prefs.set(CLE_PREFS_METIER, c)
      .catch(() => undefined);
    return true;
  };

  const continuer = () => {
    if (!modele || !compo) return;
    const modules = compo.tous.filter((id) => actifs.has(id));
    if (modules.length === 0) return;
    const fermes = catalogue.map((i) => i.key).filter((k) => !isModuleEnabled(k));
    const allegements = calculerAllegements(modules, REGISTRE_MODULES, catalogue.map((i) => i.key), { toujoursOuverts: ALWAYS_ON_MODULES, fermes });
    if (garder(choixDepuisSelection(modele.id, taille, modules), allegements)) navigate(ROUTE_DEMARRAGE);
    else setErreur(true);
  };

  const passer = () => {
    // Qui avait déjà choisi un métier et « passe » ne perd pas son choix : on retourne à Démarrage, sans rien écrire.
    if (stocke && !stocke.passe) {
      navigate(ROUTE_DEMARRAGE);
      return;
    }
    if (garder(choixPasse(taille), null)) navigate(ROUTE_DEMARRAGE);
    else setErreur(true);
  };

  const composer = () => {
    const texte = phrase.trim();
    if (!texte || horsLigne) return;
    assistant.open('chat');
    assistant.sendMessage(tm('decrire.consigne', { phrase: texte, familles: MODELES.map((m) => m.nom[langue]).join(', ') }));
    setComposeEnvoye(true);
    setDecrireOuvert(false);
    setPhrase('');
  };

  /*
    Échap : referme le champ « Décrire » s'il est ouvert, sinon c'est « Passer ». Le calque du dessus passe avant (pile des
    calques) ; le panneau d'Ajmani et les fenêtres modales ont leur propre écoute d'Échap : tant qu'un d'eux est ouvert,
    l'appui est le sien, jamais un « Passer » par mégarde.
  */
  useFermetureEchap(true, () => {
    if (decrireOuvert) setDecrireOuvert(false);
    else if (!assistant.isOpen && !document.querySelector('[role="dialog"], [aria-modal="true"]')) passer();
  });

  return (
    <VueMetier
      choix={choix}
      taille={taille}
      lignes={lignes}
      autres={compo?.autres ?? 0}
      teintesApercu={modele ? modele.apercu.map((c) => teintes.get(c.module)) : []}
      dernierActif={activables.length <= 1}
      horsLigne={horsLigne}
      erreurEnregistrement={erreur}
      decrireOuvert={decrireOuvert}
      phrase={phrase}
      composeEnvoye={composeEnvoye}
      onChoisir={choisir}
      onTaille={setTaille}
      onBasculer={basculer}
      onContinuer={continuer}
      onPasser={passer}
      onReessayer={() => {
        setErreur(false);
        continuer();
      }}
      onDecrire={() => {
        setComposeEnvoye(false);
        setDecrireOuvert((o) => !o);
      }}
      onPhrase={setPhrase}
      onComposer={composer}
    />
  );
}

export default PageMetier;

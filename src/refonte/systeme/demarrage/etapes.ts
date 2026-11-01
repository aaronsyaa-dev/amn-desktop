import { ETAPES_PAR_DEFAUT, TAILLE_DEFAUT, type EtapeMesuree, type EtapeModele, type EtapesModele, type ModeleMetier, type TailleEquipe } from './modeles';
import { ROUTE_METIER } from './chemins';

/**
 * LES ÉTAPES DE DÉMARRAGE (H42) — la logique, sans React.
 * ═══════════════════════════════════════════════════════
 *
 * Six étapes par défaut, dans cet ordre, à faire dans l'ordre qu'on veut :
 *
 *   1 métier · 2 premier client · 3 premier devis · 4 inviter l'équipe · 5 encaissements · 6 application mobile
 *
 * Ce qui rend une étape « faite » — jamais autre chose que ce qui existe vraiment :
 *   · 1  un métier est enregistré (« Passer » compte : l'étape est alors « passée ») ;
 *   · 2  au moins un client ; 3  au moins un devis (ou la mesure que le métier choisit : tâche, rendez-vous) ;
 *   · 4  au moins deux personnes dans l'équipe, invitées comprises ;
 *   · 5 et 6  le poste n'a AUCUNE donnée de connexion bancaire ni d'appareil mobile : ces deux étapes se marquent à la main.
 *
 * Une étape faite ne redevient jamais « à faire » : la mémoire (`MemoireEtapes`) garde ce qui a été vu fait, même si
 * le client ou le devis est supprimé ensuite. « Pas pour moi » sort une étape de la liste ET du total. Aucune pression :
 * pas de date, pas de retard, pas de point perdu.
 */

export type IdEtape = 'metier' | 'client' | 'devis' | 'equipe' | 'paiement' | 'mobile';
export const ORDRE_ETAPES: readonly IdEtape[] = ['metier', 'client', 'devis', 'equipe', 'paiement', 'mobile'];

/**
 * La durée d'une étape, en minutes (« maintenant · 2 min », « environ 7 min pour le reste »). Des durées FIXES, celles
 * du modèle de métier quand il en donne une (étapes 2, 3, 5), sinon celles-ci. Jamais une mesure de la personne.
 */
export const DUREES_ETAPES: Readonly<Record<IdEtape, number>> = { metier: 1, client: 2, devis: 2, equipe: 1, paiement: 3, mobile: 1 };

export function estIdEtape(valeur: unknown): valeur is IdEtape {
  return typeof valeur === 'string' && (ORDRE_ETAPES as readonly string[]).includes(valeur);
}

/** Ce que la mémoire du compte garde : les étapes vues faites, et celles que la personne a retirées. */
export interface MemoireEtapes {
  faites: readonly IdEtape[];
  retirees: readonly IdEtape[];
}
export const MEMOIRE_VIDE: MemoireEtapes = { faites: [], retirees: [] };

/** Un texte relu du stockage : on ne garde que des identifiants d'étapes connus, une fois chacun. */
export function lireMemoire(brut: unknown): MemoireEtapes {
  const liste = (v: unknown): IdEtape[] => (Array.isArray(v) ? [...new Set(v.filter(estIdEtape))] : []);
  if (typeof brut !== 'object' || brut === null) return MEMOIRE_VIDE;
  const o = brut as Record<string, unknown>;
  return { faites: liste(o.faites), retirees: liste(o.retirees) };
}

/** Ce que les données du poste disent, au moment du calcul. Des nombres, jamais des enregistrements. */
export interface DonneesDetection {
  clients: number;
  quotes: number;
  tasks: number;
  appointments: number;
  /** Les personnes de l'équipe, invités compris. */
  membres: number;
}
export const DONNEES_VIDES: DonneesDetection = { clients: 0, quotes: 0, tasks: 0, appointments: 0, membres: 0 };

export interface MetierConnu {
  modele: ModeleMetier | null;
  taille: TailleEquipe;
  passe: boolean;
}

export interface EtapeCalculee {
  id: IdEtape;
  /** Les textes et la destination d'une étape qui change avec le métier (2, 3, 5) ; `null` pour 1, 4 et 6, dont les mots sont communs. */
  libelle: EtapeModele | null;
  /** Où mène le bouton (et le titre d'une étape faite). `null` : le bouton ouvre une fenêtre (l'application mobile). */
  vers: string | null;
  /** Se marque à la main : le poste n'a rien à mesurer. */
  manuelle: boolean;
  /** Faite, ou passée : comptée dans « n ». */
  faite: boolean;
  /** « Passer » a été utilisé à l'étape 1. */
  passee: boolean;
  /** Prouvée par les données à l'instant du calcul (la mémoire, elle, n'est pas une preuve). */
  detectee: boolean;
  /** La première étape à faire : elle seule a le bouton primaire. */
  conseillee: boolean;
  /** Sa place parmi les étapes montrées, à partir de 1 (« Étape 3 sur 6 »). */
  rang: number;
  /** Sa durée en minutes (fixe : celle du modèle, sinon `DUREES_ETAPES`). */
  duree: number;
}

export type TexteAccueil = 'plusieurs' | 'une' | 'tout';

export interface ResultatEtapes {
  /** Les étapes montrées : ni retirées, ni masquées (« Seul » ne voit pas l'équipe). */
  etapes: readonly EtapeCalculee[];
  /** n : les étapes faites ou passées parmi celles qui sont montrées. */
  n: number;
  /** N : les étapes montrées. */
  total: number;
  restantes: number;
  /** De 0 à 1, pour l'anneau. Sans étape à faire, l'anneau est plein. */
  ratio: number;
  tout: boolean;
  conseillee: IdEtape | null;
  /** L'étape à faire qui suit la conseillée dans l'ordre (« ensuite · 1 min », encart « Ensuite »). */
  suivante: IdEtape | null;
  /** La somme des durées des étapes encore à faire (« environ 7 min pour le reste »). */
  minutesRestantes: number;
  texte: TexteAccueil;
  /** Les étapes que les données prouvent faites et que la mémoire ne connaît pas encore : à garder. */
  aMemoriser: readonly IdEtape[];
  /** Les étapes que la personne a retirées (pour « Les remettre »). */
  retirees: readonly IdEtape[];
}

function mesureDuDevis(devis: EtapeMesuree, d: DonneesDetection): boolean {
  switch (devis.mesure) {
    case 'quotes':
      return d.quotes >= 1;
    case 'tasks':
      return d.tasks >= 1;
    case 'appointments':
      return d.appointments >= 1;
    default:
      return false;
  }
}

/** « Seul » n'a personne à inviter : l'étape 4 est masquée. */
export function etapeMasquee(id: IdEtape, taille: TailleEquipe): boolean {
  return id === 'equipe' && taille === 'seul';
}

export function calculerEtapes(entree: {
  metier: MetierConnu | null;
  donnees: DonneesDetection;
  memoire: MemoireEtapes;
}): ResultatEtapes {
  const { metier, donnees, memoire } = entree;
  const taille = metier?.taille ?? TAILLE_DEFAUT;
  const textes: EtapesModele = metier?.modele?.etapes ?? ETAPES_PAR_DEFAUT;

  const detecte = (id: IdEtape): boolean => {
    switch (id) {
      case 'metier':
        return metier !== null;
      case 'client':
        return donnees.clients >= 1;
      case 'devis':
        return mesureDuDevis(textes.devis, donnees);
      case 'equipe':
        return donnees.membres >= 2;
      default:
        return false;
    }
  };
  const manuelle = (id: IdEtape): boolean => id === 'paiement' || id === 'mobile' || (id === 'devis' && textes.devis.mesure === 'manuel');
  const libelle = (id: IdEtape): EtapeModele | null => (id === 'client' ? textes.client : id === 'devis' ? textes.devis : id === 'paiement' ? textes.paiement : null);
  const destination = (id: IdEtape): string | null => (id === 'metier' ? ROUTE_METIER : id === 'equipe' ? '/membres' : id === 'mobile' ? null : (libelle(id)?.vers ?? null));

  const montrees = ORDRE_ETAPES.filter((id) => !memoire.retirees.includes(id) && !etapeMasquee(id, taille));
  const base = montrees.map((id, i) => {
    const detectee = detecte(id);
    return {
      id,
      rang: i + 1,
      duree: libelle(id)?.duree ?? DUREES_ETAPES[id],
      libelle: libelle(id),
      vers: destination(id),
      manuelle: manuelle(id),
      detectee,
      faite: detectee || memoire.faites.includes(id),
      passee: id === 'metier' && metier?.passe === true,
    };
  });
  const premiere = base.find((e) => !e.faite)?.id ?? null;
  const etapes: EtapeCalculee[] = base.map((e) => ({ ...e, conseillee: e.id === premiere }));
  const iPremiere = etapes.findIndex((e) => e.id === premiere);
  const suivante = iPremiere < 0 ? null : (etapes.slice(iPremiere + 1).find((e) => !e.faite)?.id ?? null);

  const n = etapes.filter((e) => e.faite).length;
  const total = etapes.length;
  const restantes = total - n;
  return {
    etapes,
    n,
    total,
    restantes,
    ratio: total === 0 ? 1 : n / total,
    tout: restantes === 0,
    conseillee: premiere,
    suivante,
    minutesRestantes: etapes.filter((e) => !e.faite).reduce((somme, e) => somme + e.duree, 0),
    texte: restantes === 0 ? 'tout' : restantes === 1 ? 'une' : 'plusieurs',
    aMemoriser: etapes.filter((e) => e.detectee && !memoire.faites.includes(e.id)).map((e) => e.id),
    retirees: ORDRE_ETAPES.filter((id) => memoire.retirees.includes(id)),
  };
}

/* ── Ce que la mémoire apprend (des fonctions pures : la page les applique, le magasin les garde) ── */

/** Garde ce que les données viennent de prouver. Une étape déjà gardée ne bouge pas. */
export function memoriserFaites(memoire: MemoireEtapes, ids: readonly IdEtape[]): MemoireEtapes {
  const nouvelles = ids.filter((id) => !memoire.faites.includes(id));
  return nouvelles.length === 0 ? memoire : { ...memoire, faites: ORDRE_ETAPES.filter((id) => memoire.faites.includes(id) || nouvelles.includes(id)) };
}

/** « Pas pour moi » : l'étape sort de la liste et du total. */
export function retirerEtape(memoire: MemoireEtapes, id: IdEtape): MemoireEtapes {
  return memoire.retirees.includes(id) ? memoire : { ...memoire, retirees: ORDRE_ETAPES.filter((x) => memoire.retirees.includes(x) || x === id) };
}

/** « Annuler » (juste après « Pas pour moi ») : cette étape-là revient, les autres retirées restent retirées. */
export function remettreEtape(memoire: MemoireEtapes, id: IdEtape): MemoireEtapes {
  return memoire.retirees.includes(id) ? { ...memoire, retirees: memoire.retirees.filter((x) => x !== id) } : memoire;
}

/**
 * L'étape qu'on montre après « Plus tard » (dans la carte) : la suivante à faire dans l'ordre, en revenant au début
 * après la dernière. `null` : il n'y en a pas d'autre.
 */
export function etapeApres(etapes: readonly EtapeCalculee[], id: IdEtape): IdEtape | null {
  const i = etapes.findIndex((e) => e.id === id);
  const tour = [...etapes.slice(i + 1), ...etapes.slice(0, Math.max(0, i))];
  return tour.find((e) => !e.faite && e.id !== id)?.id ?? null;
}

/** « Les remettre » : toutes les étapes retirées reviennent. Ce qui a été fait reste fait. */
export function remettreEtapes(memoire: MemoireEtapes): MemoireEtapes {
  return memoire.retirees.length === 0 ? memoire : { ...memoire, retirees: [] };
}

/* ── Le prénom ────────────────────────────────────────────────────────────── */

/*
  Le serveur ne garde pas toujours un nom : le nom du profil peut n'être que le début de l'adresse (« Contact »).
  Une boîte partagée — contact@, info@, compta@ — ou un nom avec des chiffres ne dit pas un prénom : on salue alors
  sans prénom plutôt que « Bienvenue, Info ».
*/
const PAS_UN_PRENOM = /^(contact|bonjour|hello|hi|info|infos|admin|accueil|compta|comptabilite|facturation|direction|gestion|equipe|team|office|secretariat|support|mail|noreply|no|reception|commercial|ventes|rh)$/i;

/** Le premier prénom lisible parmi les noms donnés (le profil d'abord, puis le compte), ou `''`. */
export function prenomAffichable(...noms: ReadonlyArray<string | null | undefined>): string {
  for (const brut of noms) {
    const mot = (brut ?? '').trim().split(/\s+/)[0] ?? '';
    if (!mot || mot.includes('@') || /\d/.test(mot) || PAS_UN_PRENOM.test(mot)) continue;
    return mot;
  }
  return '';
}

/* ── « Bon à savoir » ─────────────────────────────────────────────────────── */

export interface RaccourciSavoir {
  id: 'chercher' | 'ajmani' | 'raccourcis';
  touche: string;
  /** La touche se prend avec ⌘ (macOS) ou Ctrl. */
  avecModificateur: boolean;
}

/**
 * Les trois raccourcis de « Bon à savoir » qui existent dans l'application. « N : créer, partout » n'existe pas (aucune
 * touche N globale) : il n'est pas montré, « ? » (tous les raccourcis) prend sa place.
 */
export const RACCOURCIS_SAVOIR: readonly RaccourciSavoir[] = [
  { id: 'chercher', touche: 'k', avecModificateur: true },
  { id: 'ajmani', touche: 'j', avecModificateur: true },
  { id: 'raccourcis', touche: '?', avecModificateur: false },
];

/** L'événement `keydown` qui fait faire à la fenêtre ce que ferait la touche (les palettes écoutent la fenêtre). */
export function evenementDeTouche(r: RaccourciSavoir, mac: boolean): KeyboardEventInit {
  return { key: r.touche, bubbles: true, metaKey: r.avecModificateur && mac, ctrlKey: r.avecModificateur && !mac };
}

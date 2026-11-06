/**
 * F50 · CRÉER ET PRODUIRE, VUE D'ENSEMBLE — logique pure de la « ligne de production ».
 *
 * Tout ce qui se fabrique (chantiers, commandes, contenus) avance sur cinq postes communs :
 * Préparer, Réaliser, Contrôler, Livrer, Livré. Chaque module GARDE ses propres étapes ;
 * ce fichier ne fait que les ranger dans un poste (fiche F50, rubrique 6, Propositions).
 * Aucune valeur n'est écrite en dur : tout vient des modules.
 */

import { ajouterJours, lundiDe, type Jour } from './commun';
import { etapeEnCours, avancement as avancementChantier, statutDuChantier, budgetConsomme, type ChantierEntree } from './chantiers';
import { estUrgente, etapeDeLaBande, palierDeLivraisons, type CommandeEntree } from './commandes';
import { etapeNormalisee, avancementVideo, type VideoEntree, type Commentaire } from './video';

export const POSTES = ['preparer', 'realiser', 'controler', 'livrer', 'livre'] as const;
export type Poste = (typeof POSTES)[number];
export type CouloirId = 'chantiers' | 'commandes' | 'contenus';
export const COULOIRS: readonly CouloirId[] = ['chantiers', 'commandes', 'contenus'];

export interface Element {
  id: string;
  couloir: CouloirId;
  poste: Poste;
  /** Titre du jeton (nom du chantier, « #1047 Medina », titre de la vidéo). */
  titre: string;
  /** Étape propre au module, jamais renommée. */
  detail: string;
  /** 0–100 : barre d'avancement de 2 px. */
  avancement: number;
  alerte: boolean;
  /** Pour trier : plus c'est haut, plus c'est urgent. */
  urgence: number;
  /** Lien vers l'élément dans son module. */
  lien: { module: 'chantiers' | 'commandes' | 'video' | 'qualite'; id: string };
  personnes: readonly string[];
  /** Nom du contrôle à afficher pour un chantier au poste Contrôler (pas un second chantier). */
  controle?: string;
}

/* -------- Correspondance poste ↔ étapes de chaque module -------- */

export interface ControleOuvert { chantierId: string; nom: string; nonConformes: number }

/**
 * Chantier : Préparer = repérage ou non démarré ; Réaliser = étapes de travaux en cours ;
 * Contrôler = contrôle qualité ouvert sur ce chantier ; Livrer = étape « Réception » ;
 * Livré = réceptionné ce mois. Un chantier n'est qu'à UN poste : le plus avancé non terminé.
 */
export function posteDuChantier(c: ChantierEntree, controlesOuverts: readonly ControleOuvert[], aujourdhui: Jour, etapeReception = /r[ée]ception/i): Poste | null {
  const statut = statutDuChantier(c, aujourdhui);
  if (statut === 'Terminé') return 'livre';
  if (controlesOuverts.some((k) => k.chantierId === c.id)) return 'controler';
  const cours = etapeEnCours(c);
  if (cours && etapeReception.test(cours.etape.nom)) return 'livrer';
  if (statut === 'À venir' || avancementChantier(c) === 0) return 'preparer';
  return 'realiser';
}

/** Commande : Préparer = Reçues ; Réaliser = En préparation ; Contrôler = contrôle avant envoi s'il existe ; Livrer = Expédiées ; Livré = Livrées ce mois. */
export function posteDeLaCommande(c: CommandeEntree, controleAvantEnvoi = false): Poste | null {
  switch (etapeDeLaBande(c)) {
    case 'recues': return 'preparer';
    case 'preparation': return controleAvantEnvoi ? 'controler' : 'realiser';
    case 'expediees': return 'livrer';
    case 'livrees': return 'livre';
    default: return null;
  }
}

/** Contenu : Préparer = idée ou tournage prévu ; Réaliser = montage, sous-titrage ; Contrôler = relecture avec retours ; Livrer = prêt à publier ; Livré = publié. */
export function posteDuContenu(v: VideoEntree, retours: readonly Commentaire[]): Poste {
  const e = etapeNormalisee(v.etape);
  if (e === 'Publiée') return 'livre';
  if (e === 'Idée' || e === 'Enregistrement') return 'preparer';
  if (e === 'Relecture') return retours.some((c) => c.etat === 'À traiter') ? 'controler' : 'livrer';
  return 'realiser'; // Montage, Sous-titrage
}

/* -------- Éléments à partir des modules -------- */

export interface SourcesProduction {
  chantiers: readonly (ChantierEntree & { client?: string; equipe?: readonly string[] })[];
  controlesOuverts: readonly ControleOuvert[];
  commandes: readonly (CommandeEntree & { client?: string; responsable?: string })[];
  videos: readonly (VideoEntree & { responsables?: readonly string[] })[];
  retoursParVideo: Readonly<Record<string, readonly Commentaire[]>>;
  aujourdhui: Jour;
}

export function elementsDeProduction(s: SourcesProduction): Element[] {
  const sortie: Element[] = [];
  for (const c of s.chantiers) {
    const poste = posteDuChantier(c, s.controlesOuverts, s.aujourdhui);
    if (!poste) continue;
    const ctrl = s.controlesOuverts.find((k) => k.chantierId === c.id);
    const conso = budgetConsomme(c);
    sortie.push({
      id: `chantier:${c.id}`, couloir: 'chantiers', poste, titre: c.nom, detail: etapeEnCours(c)?.etape.nom ?? '',
      avancement: avancementChantier(c), alerte: !!ctrl || (conso !== null && conso >= 90), urgence: (ctrl ? 2 : 0) + (conso !== null && conso >= 90 ? 1 : 0),
      lien: ctrl ? { module: 'qualite', id: ctrl.chantierId } : { module: 'chantiers', id: c.id }, personnes: c.equipe ?? [], controle: ctrl?.nom,
    });
  }
  for (const c of s.commandes) {
    const poste = posteDeLaCommande(c);
    if (!poste) continue;
    const urgente = estUrgente(c, s.aujourdhui);
    sortie.push({
      id: `commande:${c.id}`, couloir: 'commandes', poste, titre: c.numero, detail: c.client ?? '', avancement: ({ preparer: 15, realiser: 45, controler: 70, livrer: 90, livre: 100 } as const)[poste],
      alerte: urgente, urgence: urgente ? 2 : 0, lien: { module: 'commandes', id: c.id }, personnes: c.responsable ? [c.responsable] : [],
    });
  }
  for (const v of s.videos) {
    const retours = s.retoursParVideo[v.id] ?? [];
    const aTraiter = retours.filter((r) => r.etat === 'À traiter').length;
    sortie.push({
      id: `video:${v.id}`, couloir: 'contenus', poste: posteDuContenu(v, retours), titre: v.titre, detail: etapeNormalisee(v.etape), avancement: avancementVideo(v),
      alerte: aTraiter > 0, urgence: aTraiter, lien: { module: 'video', id: v.id }, personnes: v.responsables ?? [],
    });
  }
  return sortie;
}

/* -------- La ligne -------- */

export interface Jeton { type: 'element'; element: Element }
export interface JetonGroupe { type: 'groupe'; nombre: number; plusUrgent: Element }
export type Cellule = (Jeton | JetonGroupe)[];

export const JETONS_PAR_CELLULE = 2;

/**
 * Au plus 2 jetons par cellule ; au-delà, UN jeton de regroupement « n reçues » dont le
 * sous-titre est l'élément le plus urgent (cas des commandes). Les plus urgents d'abord.
 */
export function celluleDe(elements: readonly Element[], max = JETONS_PAR_CELLULE): Cellule {
  const tries = [...elements].sort((a, b) => b.urgence - a.urgence || b.avancement - a.avancement || a.titre.localeCompare(b.titre, 'fr'));
  if (tries.length <= max) return tries.map((element) => ({ type: 'element' as const, element }));
  return [{ type: 'groupe', nombre: tries.length, plusUrgent: tries[0] }];
}

export interface Couloir {
  id: CouloirId;
  /** « 5 en cours » : éléments non livrés. */
  enCours: number;
  cellules: Record<Poste, Cellule>;
  /** « 2 chantiers » dans la colonne Livré. */
  livres: number;
  /** Nombre de jetons empilés (hauteur du couloir). */
  hauteur: number;
}

export interface PosteDeLigne {
  id: Poste;
  /** Somme des éléments de ses couloirs. */
  compte: number;
  /** Poste en difficulté (Contrôler avec reprises) : halo orange. */
  enDifficulte: boolean;
  /** « 2 à reprendre » : contrôles non conformes + contenus avec retours non traités. */
  aReprendre: number;
}

export interface LigneDeProduction {
  postes: PosteDeLigne[];
  couloirs: Couloir[];
  /** « Tout 19 » : éléments non livrés. */
  toutEnCours: number;
  /** Ligne à l'arrêt : rien en fabrication. */
  arret: boolean;
}

/**
 * Construit la ligne. `couloirsActifs` : un couloir sans module activé pour le métier
 * disparaît (jamais de couloir vide ni de module inactif affiché comme vide).
 */
export function construireLigne(elements: readonly Element[], couloirsActifs: readonly CouloirId[] = COULOIRS): LigneDeProduction {
  const couloirs: Couloir[] = couloirsActifs.map((id) => {
    const siens = elements.filter((e) => e.couloir === id);
    const cellules = Object.fromEntries(POSTES.map((p) => [p, celluleDe(siens.filter((e) => e.poste === p))])) as Record<Poste, Cellule>;
    return {
      id, cellules, enCours: siens.filter((e) => e.poste !== 'livre').length, livres: siens.filter((e) => e.poste === 'livre').length,
      hauteur: Math.max(1, ...POSTES.filter((p) => p !== 'livre').map((p) => cellules[p].length)),
    };
  });
  const visibles = new Set(couloirsActifs);
  const dans = elements.filter((e) => visibles.has(e.couloir));
  const postes: PosteDeLigne[] = POSTES.map((id) => {
    const ici = dans.filter((e) => e.poste === id);
    const aReprendre = id === 'controler' ? ici.filter((e) => e.alerte).length : 0;
    return { id, compte: ici.length, aReprendre, enDifficulte: aReprendre > 0 };
  });
  const toutEnCours = dans.filter((e) => e.poste !== 'livre').length;
  // Jamais de couloir vide : un couloir sans rien en cours se replie, mais sa colonne « Livré » reste lisible.
  return { postes, couloirs, toutEnCours, arret: toutEnCours === 0 };
}

/** Puce choisie : n'affiche que le couloir demandé ; les autres se replient. */
export const filtrerCouloir = (l: LigneDeProduction, id: CouloirId | 'tout'): Couloir[] => (id === 'tout' ? l.couloirs : l.couloirs.filter((c) => c.id === id));

/* -------- Palier, livraisons à l'heure, suggestion -------- */

export interface Livraison { couloir: CouloirId; promiseLe: Jour; livreeLe: Jour }

/** « Cette semaine : 9 livraisons à l'heure » = commandes et chantiers livrés cette semaine à la date promise (ou avant). */
export function livraisonsALHeure(livraisons: readonly Livraison[], aujourdhui: Jour): number {
  const debut = lundiDe(aujourdhui);
  const fin = ajouterJours(debut, 6);
  return livraisons.filter((l) => l.livreeLe >= debut && l.livreeLe <= fin && l.livreeLe <= l.promiseLe && l.couloir !== 'contenus').length;
}

/** Palier de la colonne Livré des commandes : « 58 commandes · palier 60 dans 2 ». */
export const palierDesCommandes = palierDeLivraisons;

/**
 * Suggestion d'Ajmani (rubrique 10) : au moins 3 articles sous le seuil SANS commande en
 * cours. Renvoie ces articles ; vide sous le déclencheur.
 */
export function articlesPourLaSuggestion<T>(sousSeuilSansCommande: readonly T[], declencheur = 3): T[] {
  return sousSeuilSansCommande.length >= declencheur ? [...sousSeuilSansCommande] : [];
}

/* -------- Les 16 modules -------- */

export type GroupeModules = 'fabriquer' | 'livrer' | 'stocker' | 'montrer';
export interface ModuleDeLaFamille { id: string; groupe: GroupeModules; ecran: string }

/** Rangés du premier geste à la vitrine, tous visibles. Les deux derniers noms de « Fabriquer » sont PROPOSÉS (à confirmer). */
export const SEIZE_MODULES: readonly ModuleDeLaFamille[] = [
  { id: 'chantiers', groupe: 'fabriquer', ecran: 'H16' },
  { id: 'qualite', groupe: 'fabriquer', ecran: 'MR11' },
  { id: 'bons-intervention', groupe: 'fabriquer', ecran: 'à créer' },
  { id: 'fabrication', groupe: 'fabriquer', ecran: 'D02' },
  { id: 'commandes', groupe: 'livrer', ecran: 'MR07' },
  { id: 'tournees', groupe: 'livrer', ecran: 'MR03' },
  { id: 'flotte', groupe: 'livrer', ecran: 'MR09' },
  { id: 'reservations', groupe: 'livrer', ecran: 'MR06' },
  { id: 'stock', groupe: 'stocker', ecran: 'H15' },
  { id: 'materiel', groupe: 'stocker', ecran: 'MR04' },
  { id: 'catalogue', groupe: 'stocker', ecran: 'MR05' },
  { id: 'boutique', groupe: 'stocker', ecran: 'MR08' },
  { id: 'video', groupe: 'montrer', ecran: 'MR01' },
  { id: 'visuels', groupe: 'montrer', ecran: 'H17' },
  { id: 'page-publique', groupe: 'montrer', ecran: 'MR02' },
  { id: 'photos-chantier', groupe: 'montrer', ecran: 'MR10' },
];

/** Une tuile est grisée (« Non activée pour votre métier ») si son module n'est pas activé ; elle ouvre alors D02 pour l'activer. */
export function tuilesDesModules(actifs: ReadonlySet<string>): { module: ModuleDeLaFamille; active: boolean }[] {
  return SEIZE_MODULES.map((m) => ({ module: m, active: actifs.has(m.id) }));
}

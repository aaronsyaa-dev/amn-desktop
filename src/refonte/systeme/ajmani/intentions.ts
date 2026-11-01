/**
 * L'ANALYSEUR D'INTENTIONS D'AJMANI — local, déterministe, sans React, sans modèle.
 *
 * Pour une demande en français, il rend une `Reponse` structurée : la phrase (avec les faits en gras), le niveau
 * d'action, les objets concernés, les boutons. Il ne lit QUE les données réelles qu'on lui passe : numéro, montant
 * et jours de retard (= aujourd'hui − échéance) viennent des factures, jamais d'un modèle ; quand un fait manque,
 * la réponse le dit au lieu de l'inventer. Tout ce qu'il ne reconnaît pas devient une ligne « Demander à Ajmani »,
 * qui délègue à l'assistant existant (le rappel `surDemander` de la palette).
 *
 * Intentions couvertes :
 *   relancer une facture en retard   N1 « Préparer la relance » (Ajmani n'envoie rien : la relance part de l'écran
 *                                    Relances, `RemindersScreen`, par la personne) ; « déjà fait » si une
 *                                    relance est déjà notée au même palier
 *   relancer LES factures en retard  N1, G05 v3 : une ligne cochable par facture (aperçu du texte, mise en garde
 *                                    si une relance est déjà partie), « Préparer les {n} relances » qui ouvre
 *                                    Relances avec celles qui restent cochées ; « Rien ne part sans votre accord »
 *   lister les factures en retard    N0
 *   créer une facture                N1, brouillon : demande le client, puis les lignes, puis récapitule
 *   trouver un module ou un client   N0, 3 résultats par groupe
 *   résumer                          N0, 5 lignes au plus, chacune avec son lien
 *   point à la Garde                 N0, une phrase, une pastille d'état, « Ouvrir La Garde »
 *   rédiger                          N0, délégué à l'assistant (jamais de texte inventé ici)
 *   payer, rembourser, virer         refus : renvoi vers la facturation, où la personne valide elle-même
 *   coffre-fort, accès, clés         refus : hors périmètre
 */
import { formatCentsCompact } from '../../../lib/money';
import { paliereDe, rangPalier, type PalierRelance } from '../../../lib/relances';
import type { Famille } from '../../../socle/familles';
import type { CleMot } from './i18n';
import type { NiveauAction } from './niveaux';
import { aplatir, categorieInterdite } from './sensibles';

/* ═══ Les données qu'on lui passe ═══ */

export type Langue = 'fr' | 'en';
export type FamilleCourante = Famille | 'garde';

export interface FocusAjmani {
  type: string;
  id: string;
  label: string;
}

export interface ContexteAjmani {
  /** La famille de l'écran courant (`garde` : la famille réservée à l'équipe AMN). */
  famille: FamilleCourante | null;
  ecranLibelle: string;
  /** Ce compte administre-t-il son organisation ? (`isAdminRole`) */
  admin: boolean;
  enLigne: boolean;
  /** La fiche ouverte à l'écran (client, facture), s'il y en a une. */
  focus?: FocusAjmani | null;
  langue?: Langue;
  /** Le compte : l'historique, le journal et les usages de la palette lui sont propres. */
  email?: string;
}

export interface FactureAjmani {
  id: string;
  numero: string;
  clientId: number | null;
  clientNom: string;
  /** Le client a une adresse sur la facture : la relance peut partir par e-mail (depuis Relances). */
  courriel?: boolean;
  statut: 'brouillon' | 'emise' | 'payee' | 'annulee';
  /** Échéance, jour ISO (« 2026-10-12 »). */
  echeance: string;
  /** Ce qui reste réellement dû, en centimes (avoirs déduits). */
  resteDuCentimes: number;
}

export interface ClientAjmani {
  id: number;
  recordId?: string;
  nom: string;
  societe: string;
}

export interface RelanceAjmani {
  factureId: string;
  /** Quand elle a été notée (ISO). */
  le: string;
  palier?: PalierRelance;
}

export interface ModuleAjmani {
  cle: string;
  libelle: string;
  indice?: string;
  route: string;
  /** « Mes contacts », « L'argent »… : le libellé de sa famille, pour le sous-titre. */
  familleLibelle?: string;
  famille?: Famille;
  verbes?: readonly string[];
  motsCles?: readonly string[];
}

export interface AttenteAjmani {
  cle: string;
  titre: string;
  route: string;
}

export type EtatGardeAjmani = 'calme' | 'attention' | 'critique' | 'inconnu';

export interface DonneesAjmani {
  /** Aujourd'hui, jour ISO : injecté, jamais lu dans l'horloge ici. */
  aujourdhui: string;
  /** L'instant où ces données ont été lues (ISO) : « d'après Facturation, à jour à 10:42 ». Absent : la source ne dit pas l'heure. */
  luesA?: string;
  factures: readonly FactureAjmani[];
  clients: readonly ClientAjmani[];
  relances: readonly RelanceAjmani[];
  modules: readonly ModuleAjmani[];
  attentes: readonly AttenteAjmani[];
  rendezVousAujourdhui: number;
  /** `null` : la supervision n'a pas pu être lue. */
  garde: { etat: EtatGardeAjmani; points: number } | null;
}

export const DONNEES_VIDES: DonneesAjmani = {
  aujourdhui: '1970-01-01',
  factures: [],
  clients: [],
  relances: [],
  modules: [],
  attentes: [],
  rendezVousAujourdhui: 0,
  garde: null,
};

export type Mots = (cle: CleMot, params?: Record<string, string | number>) => string;

export interface Env {
  donnees: DonneesAjmani;
  contexte: ContexteAjmani;
  /** Traduit une clé : sert aux textes qu'on remet dans le champ (« Créer une facture pour … »). */
  mots: Mots;
}

/* ═══ Ce qu'il rend ═══ */

export interface Phrase {
  cle: CleMot;
  params?: Record<string, string | number>;
  /** Les paramètres rendus en gras (les faits : numéro, nom). */
  gras?: readonly string[];
}

export interface Segment {
  texte: string;
  gras: boolean;
}

/** Découpe un gabarit traduit (« … la facture {numero} … ») en segments, les faits en gras. */
export function segmenter(modele: string, params: Record<string, string | number> = {}, gras: readonly string[] = []): Segment[] {
  const segments: Segment[] = [];
  const re = /\{(\w+)\}/g;
  let dernier = 0;
  for (let m = re.exec(modele); m; m = re.exec(modele)) {
    if (m.index > dernier) segments.push({ texte: modele.slice(dernier, m.index), gras: false });
    segments.push(m[1] in params ? { texte: String(params[m[1]]), gras: gras.includes(m[1]) } : { texte: m[0], gras: false });
    dernier = m.index + m[0].length;
  }
  if (dernier < modele.length) segments.push({ texte: modele.slice(dernier), gras: false });
  return segments;
}

export type IconeAjmani = 'plus' | 'loupe' | 'bouclier' | 'document' | 'envoi' | 'fleche' | 'horloge' | 'liste' | 'ouvrir' | 'utilisateur' | 'appel' | 'message' | 'agenda' | 'note' | 'facture' | 'crayon' | 'courriel';

export interface LigneFactureBrouillon {
  label: string;
  quantite: number;
  prixCentimes: number;
}

/** Ce qu'un bouton ou une ligne déclenche : des données, que la palette traduit en rappels. */
export type Effet =
  | { type: 'aller'; route: string; state?: Record<string, unknown> }
  | { type: 'texte'; texte: string }
  | { type: 'demander'; texte: string }
  | { type: 'rechercher'; texte: string }
  | { type: 'creer-brouillon-facture'; clientId: number; clientNom: string; lignes: LigneFactureBrouillon[] }
  | { type: 'copier'; texte: string }
  | { type: 'effacer' };

export interface BoutonProposition {
  id: string;
  role: 'primaire' | 'secondaire' | 'annuler';
  cle: CleMot;
  params?: Record<string, string | number>;
  icone?: IconeAjmani;
  effet: Effet;
}

export interface LigneReponse {
  id: string;
  /** Un titre venu des données (nom d'un client, d'un module) ou une clé traduite. */
  titre?: string;
  titreCle?: CleMot;
  titreParams?: Record<string, string | number>;
  sous?: string;
  sousCle?: CleMot;
  groupe?: 'modules' | 'clients' | 'documents';
  icone: IconeAjmani;
  famille?: Famille;
  effet: Effet;
}

export type Genre =
  | 'proposition' | 'relances' | 'resultats' | 'resume' | 'garde' | 'brouillon'
  | 'rien-trouve' | 'non-comprise' | 'deja-fait' | 'refus' | 'droits' | 'question'
  | 'vide-propose' | 'vide-recent' | 'vide-suggere';

export type Intention = 'relancer' | 'factures-retard' | 'creer-facture' | 'trouver' | 'resumer' | 'garde' | 'rediger' | 'paiement' | 'coffre' | 'inconnue' | 'vide';

export interface ObjetConcerne {
  type: 'facture' | 'client' | 'module';
  id: string;
  libelle: string;
}

/**
 * Une action proposée (G05 v3, `ProposedAction`) : une relance par facture en retard, cochée par défaut. Les faits
 * (numéro, reste dû, jours de retard, relances déjà notées) viennent des données ; le texte de la relance, de
 * l'appelant (le même que celui de l'écran Relances), jamais d'ici.
 */
export interface ActionProposee {
  id: string;
  factureId: string;
  numero: string;
  clientNom: string;
  resteDuCentimes: number;
  jours: number;
  /** Le palier de ton que le retard appelle. */
  palier: PalierRelance;
  /** La relance que ce serait (1 : la première ; 2 : une deuxième, mise en garde). */
  rang: number;
  /** La dernière relance déjà notée pour cette facture (ISO), s'il y en a une. */
  derniere?: string;
  /** « e-mail » : la facture porte une adresse. */
  canal: 'email' | null;
}

/** Une suite proposée (« ENSUITE, SI VOUS VOULEZ ») : 3 au plus, déduites de la réponse. */
export interface Suite {
  id: string;
  cle: CleMot;
  params?: Record<string, string | number>;
  icone: IconeAjmani;
  effet: Effet;
}

export interface Reponse {
  intention: Intention;
  genre: Genre;
  /**
   * Le niveau de ce que la proposition ENGAGE. N1 ou plus seulement quand un clic va créer ou changer quelque
   * chose (le brouillon à confirmer, la relance à préparer) ; une question, un « rien trouvé », un refus, une
   * lecture n'engagent rien : N0.
   */
  niveau: NiveauAction;
  /** Le texte analysé : la proposition ne vaut que pour lui. */
  pour: string;
  /** Le libellé de la section : « Ajmani propose », « Récent », « Résumé »… */
  section: CleMot;
  phrase: Phrase;
  complement?: Phrase;
  /** Le détail d'un récapitulatif : des lignes de lecture, pas des choix. */
  details: string[];
  objets: ObjetConcerne[];
  boutons: BoutonProposition[];
  lignes: LigneReponse[];
  pastille?: { etat: 'succes' | 'attention' | 'critique' | 'neutre'; cle: CleMot };
  /** D'où viennent les faits (« d'après Facturation, à jour à 10:42 ») : le module et l'heure de lecture. */
  source?: { module: string; a: string };
  /** Les actions proposées une par une (cases à cocher). */
  propositions?: ActionProposee[];
  /** Combien d'autres, au-delà des 5 lignes montrées. */
  autres?: number;
  suites?: Suite[];
}

/* ═══ Les petits outils ═══ */

const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'a', 'au', 'aux', 'en', 'et', 'ou', 'pour', 'chez', 'sur', 'avec', 'sans',
  'mon', 'ma', 'mes', 'moi', 'je', 'j', 'me', 'ce', 'cet', 'cette', 'ces', 'que', 'qui', 'quoi', 'svp', 'stp', 'plait', 'veux', 'voudrais', 'peux', 'peut',
  'the', 'an', 'for', 'to', 'of', 'and', 'with', 'my', 'please', 'me', 'is', 'in', 'on',
]);

/** Les mots qui disent la demande, pas son objet : retirés pour garder le nom du client ou du module. */
const MOTS_DE_DEMANDE = new Set([
  'relancer', 'relance', 'relances', 'relancez', 'rappeler', 'reclamer', 'remind', 'chase',
  'creer', 'cree', 'creez', 'faire', 'fais', 'nouvelle', 'nouveau', 'etablir', 'emettre', 'preparer', 'ajouter', 'redige', 'rediger',
  'create', 'new', 'make', 'draft',
  'facture', 'factures', 'facturer', 'invoice', 'invoices', 'lignes', 'ligne', 'lines', 'line',
  'trouver', 'trouve', 'trouvez', 'cherche', 'chercher', 'cherchez', 'recherche', 'rechercher', 'ouvrir', 'ouvre', 'ouvrez', 'aller', 'va', 'allez',
  'afficher', 'affiche', 'voir', 'montre', 'montrer', 'find', 'search', 'open', 'show', 'go',
  'client', 'clients', 'cliente', 'clientes', 'module', 'modules', 'page', 'ecran', 'societe', 'entreprise', 'customer',
  'retard', 'echue', 'echues', 'echu', 'impaye', 'impayes', 'impayee', 'impayees', 'overdue', 'unpaid', 'late',
  'demander', 'demande', 'point', 'etat',
]);

function jetons(texte: string): string[] {
  return aplatir(texte).split(' ').filter(Boolean);
}

/** Les mots qui restent une fois les mots vides et les mots de demande retirés : l'objet de la demande. */
function objetDe(texte: string): string[] {
  return jetons(texte).filter((m) => m.length >= 2 && !MOTS_VIDES.has(m) && !MOTS_DE_DEMANDE.has(m));
}

const DEBUT_JOUR = (iso: string): number => {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, (m || 1) - 1, j || 1);
};

/** Jours entiers entre deux jours ISO : `b − a`. */
export function joursEntre(a: string, b: string): number {
  return Math.round((DEBUT_JOUR(b) - DEBUT_JOUR(a)) / 86_400_000);
}

export function formaterJour(iso: string, langue: Langue = 'fr'): string {
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(DEBUT_JOUR(iso)));
}

export function formaterMontant(centimes: number): string {
  return formatCentsCompact(centimes);
}

/** Une facture « en retard » : émise, échue, et encore due. Le retard se calcule, il ne se stocke pas. */
export function estEnRetard(f: FactureAjmani, aujourdhui: string): boolean {
  return f.statut === 'emise' && Boolean(f.echeance) && f.echeance.slice(0, 10) < aujourdhui && f.resteDuCentimes > 0;
}

export function joursDeRetard(f: FactureAjmani, aujourdhui: string): number {
  return Math.max(0, joursEntre(f.echeance, aujourdhui));
}

/** Les factures en retard d'abord par ancienneté (la plus ancienne en tête), puis par montant, puis par numéro. */
export function facturesEnRetard(donnees: DonneesAjmani, clientId?: number | null): FactureAjmani[] {
  return donnees.factures
    .filter((f) => estEnRetard(f, donnees.aujourdhui) && (clientId == null || f.clientId === clientId))
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || b.resteDuCentimes - a.resteDuCentimes || a.numero.localeCompare(b.numero));
}

/* ── Retrouver un client dans une phrase ── */

export interface Correspondance {
  /** Les mots de la demande qui désignent un client (vide : aucun client cité). */
  cite: string[];
  clients: ClientAjmani[];
}

export function chercherClients(texte: string, clients: readonly ClientAjmani[]): Correspondance {
  const cite = objetDe(texte);
  if (cite.length === 0) return { cite, clients: [] };
  const complet = cite.join(' ');
  const notes = clients
    .map((c) => {
      const cibles = [...new Set([...jetons(c.nom), ...jetons(c.societe)])].filter((m) => !MOTS_VIDES.has(m));
      let score = 0;
      for (const mot of cite) {
        const exact = cibles.includes(mot);
        if (exact) score += 2;
        else if (mot.length >= 3 && cibles.some((m) => m.startsWith(mot))) score += 1;
        else return { c, score: 0 };
      }
      if (aplatir(c.nom) === complet || aplatir(c.societe) === complet) score += 10;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.nom.localeCompare(b.c.nom, 'fr'));
  return { cite, clients: notes.map((x) => x.c) };
}

const nomAffiche = (c: ClientAjmani): string => c.societe.trim() || c.nom.trim();

/* ── Fabriquer les réponses ── */

const SECTION_PROPOSE: CleMot = 'section.propose';

function reponse(base: Partial<Reponse> & Pick<Reponse, 'intention' | 'genre' | 'phrase'>, pour: string): Reponse {
  return { niveau: 'N0', section: SECTION_PROPOSE, details: [], objets: [], boutons: [], lignes: [], ...base, pour };
}

const annuler = (): BoutonProposition => ({ id: 'annuler', role: 'annuler', cle: 'bouton.annuler', effet: { type: 'effacer' } });

function boutonAller(id: string, cle: CleMot, route: string, role: 'primaire' | 'secondaire' = 'primaire', icone?: IconeAjmani, state?: Record<string, unknown>, params?: Record<string, string | number>): BoutonProposition {
  return { id, role, cle, params, icone, effet: { type: 'aller', route, state } };
}

function ligneAller(id: string, titre: string, sous: string | undefined, icone: IconeAjmani, route: string, state?: Record<string, unknown>, extra?: Partial<LigneReponse>): LigneReponse {
  return { id, titre, sous, icone, effet: { type: 'aller', route, state }, ...extra };
}

function ligneTexte(id: string, titre: string, sous: string | undefined, icone: IconeAjmani, texte: string): LigneReponse {
  return { id, titre, sous, icone, effet: { type: 'texte', texte } };
}

function choixDeClients(clients: readonly ClientAjmani[], seed: (nom: string) => string, max = 5): LigneReponse[] {
  return clients.slice(0, max).map((c) => ligneTexte(`client-${c.id}`, nomAffiche(c), c.nom !== nomAffiche(c) ? c.nom : undefined, 'utilisateur', seed(nomAffiche(c))));
}

/* ═══ Les intentions ═══ */

const RE_RELANCE = /\b(relanc\w*|reclam\w*|remind\w*|chase)\b|\brappeler (?:le |la |les )?(?:paiement|facture|reglement)/;
const RE_RETARDS = /(\bfactures?\b|\binvoices?\b).*\b(retard|echu\w*|impay\w*|overdue|unpaid|late)\b|\b(impay\w*|overdue|unpaid)\b/;
const RE_CREER_FACTURE = /\b(creer|cree|creez|faire|fais|nouvelle|nouveau|etablir|emettre|preparer|ajouter|rediger|create|new|make|draft)\b.*\b(factures?|invoices?)\b|\bfacturer\b|\b(factures?|invoice) (pour|for)\b/;
const RE_GARDE = /\b(garde|supervision|guard)\b/;
const RE_RESUMER = /\b(resum\w*|synthese|summar\w*|bilan|recap\w*)\b/;
const RE_MESSAGES = /\b(messages?|courriels?|mails?|emails?|discussions?|conversations?|inbox)\b/;
const RE_REDIGER = /\b(redig\w*|ecri\w*|compte rendu|compte rendus|annonces?|write|minutes)\b/;
const RE_TROUVER = /^(trouv\w*|cherch\w*|recherch\w*|ouvr\w*|aller|va|allez|find|search|open|go)\b/;
const RE_TROUVER_DOUX = /^(affich\w*|voir|montr\w*|show)\b/;
const MOTS_DE_RECHERCHE = new Set(['trouver', 'trouve', 'trouvez', 'cherche', 'chercher', 'cherchez', 'recherche', 'rechercher', 'ouvrir', 'ouvre', 'ouvrez', 'aller', 'va', 'allez', 'afficher', 'affiche', 'voir', 'montre', 'montrer', 'find', 'search', 'open', 'show', 'go']);
const MOTS_GENERIQUES = new Set(['module', 'modules', 'client', 'clients', 'cliente', 'clientes', 'page', 'ecran', 'societe', 'entreprise', 'customer']);

/** Ce qu'on cherche : la phrase sans ses mots vides, son verbe de recherche, ni les mots génériques (« un module ou un client »). */
function objetDeRecherche(texte: string): string[] {
  return jetons(texte).filter((m) => m.length >= 2 && !MOTS_VIDES.has(m) && !MOTS_DE_RECHERCHE.has(m) && !MOTS_GENERIQUES.has(m));
}

const RE_SANS_LIGNES = /\b(sans lignes?|vide|without lines?|empty)\b/;

/**
 * Les lignes de facturation lues dans la phrase (« 2 jours de conseil à 400 € »), et ce qui reste du texte une fois
 * ces lignes retirées (le nom du client). Les montants sont lus, jamais inventés.
 */
export function lireLignes(texte: string): { lignes: LigneFactureBrouillon[]; reste: string } {
  const lignes: LigneFactureBrouillon[] = [];
  const re = /(?:(\d+(?:[.,]\d+)?)\s*(?:x|×)?\s*)?((?:(?:jours?|journees?|heures?|h|unites?|days?|hours?)\s+(?:de |d'|d’|of )?)?[\p{L}][\p{L}' ’-]{1,40}?)\s+(?:à|a|@|au prix de|at)\s*(\d+(?:[\u00a0\u202f ]?\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)/giu;
  for (let m = re.exec(texte); m; m = re.exec(texte)) {
    const quantite = m[1] ? Number(m[1].replace(',', '.')) : 1;
    const prix = Number(m[3].replace(/[\u00a0\u202f ]/g, '').replace(',', '.'));
    const label = m[2].replace(/^(?:jours?|journees?|heures?|h|unites?|days?|hours?)\s+(?:de |d'|d’|of )?/i, '').trim();
    if (!label || !Number.isFinite(quantite) || !Number.isFinite(prix) || quantite <= 0 || prix < 0) continue;
    lignes.push({ label: label.charAt(0).toUpperCase() + label.slice(1), quantite, prixCentimes: Math.round(prix * 100) });
  }
  return { lignes, reste: texte.replace(re, ' ') };
}

function totalHt(lignes: readonly LigneFactureBrouillon[]): number {
  return lignes.reduce((n, l) => n + Math.round(l.quantite * l.prixCentimes), 0);
}

/** « Relance les factures en retard », « relancer tous les impayés » : la demande porte sur toutes, pas sur une. */
const RE_PLURIEL = /\b(factures|invoices|toutes|tous|all|impayes|impayees|retards)\b/;

/** Au plus 5 lignes d'action ; au-delà, « Voir les {n} autres ». */
export const MAX_PROPOSITIONS = 5;

/** La relance que serait la prochaine pour cette facture (1 : la première), et la date de la dernière notée. */
function dejaRelancee(donnees: DonneesAjmani, factureId: string): { rang: number; derniere?: string } {
  const notees = donnees.relances.filter((r) => r.factureId === factureId).sort((a, b) => b.le.localeCompare(a.le));
  return { rang: notees.length + 1, derniere: notees[0]?.le };
}

function moduleDe(donnees: DonneesAjmani, cle: string): ModuleAjmani | undefined {
  return donnees.modules.find((m) => m.cle === cle);
}

/**
 * RELANCER TOUTES LES FACTURES EN RETARD — G05 v3. Une ligne cochée par facture, la plus ancienne d'abord, avec sa
 * mise en garde quand une relance est déjà partie ; le bouton primaire prépare celles qui restent cochées dans
 * Relances (rien ne part d'ici). Les suites ne mènent qu'à des modules ouverts (une tâche, un appel à l'agenda).
 */
function analyserRelances(texte: string, env: Env): Reponse {
  const { donnees } = env;
  const retards = facturesEnRetard(donnees);
  if (retards.length === 0) return reponse({ intention: 'relancer', genre: 'rien-trouve', phrase: { cle: 'phrase.relance.aucune' } }, texte);
  const propositions: ActionProposee[] = retards.map((f) => {
    const jours = joursDeRetard(f, donnees.aujourdhui);
    const { rang, derniere } = dejaRelancee(donnees, f.id);
    return { id: `relance-${f.id}`, factureId: f.id, numero: f.numero, clientNom: f.clientNom, resteDuCentimes: f.resteDuCentimes, jours, palier: paliereDe(jours), rang, derniere, canal: f.courriel ? 'email' : null };
  });
  const montres = propositions.slice(0, MAX_PROPOSITIONS);
  const total = formaterMontant(retards.reduce((n, f) => n + f.resteDuCentimes, 0));
  const facturation = moduleDe(donnees, 'invoices');
  const suites: Suite[] = [];
  const taches = moduleDe(donnees, 'tasks');
  if (taches) suites.push({ id: 'suite-tache', cle: 'suite.tache', icone: 'liste', effet: { type: 'aller', route: taches.route } });
  const agenda = moduleDe(donnees, 'agenda');
  if (agenda) suites.push({ id: 'suite-appel', cle: 'suite.appel', icone: 'appel', effet: { type: 'aller', route: agenda.route } });
  const relances = moduleDe(donnees, 'reminders');
  if (relances) suites.push({ id: 'suite-relances', cle: 'suite.relances', icone: 'ouvrir', effet: { type: 'aller', route: relances.route } });
  return reponse({
    intention: 'relancer', genre: 'relances', niveau: 'N1',
    phrase: { cle: retards.length === 1 ? 'phrase.relances.un' : 'phrase.relances.n', params: { n: retards.length, total }, gras: ['total'] },
    objets: montres.map((p) => ({ type: 'facture', id: p.factureId, libelle: p.numero })),
    source: facturation && donnees.luesA ? { module: facturation.libelle, a: donnees.luesA } : undefined,
    propositions: montres,
    autres: propositions.length - montres.length,
    suites: suites.slice(0, 3),
    boutons: [
      boutonAller('preparer-tout', retards.length === 1 ? 'bouton.relances.preparer.un' : 'bouton.relances.preparer.n', relances?.route ?? '/relances', 'primaire', 'envoi', { factureIds: montres.map((p) => p.factureId) }, { n: montres.length }),
      boutonAller('modifier', 'bouton.modifier', relances?.route ?? '/relances', 'secondaire', 'crayon'),
      annuler(),
    ],
  }, texte);
}

function analyserRelance(texte: string, env: Env): Reponse {
  const { donnees, contexte, mots } = env;
  const langue = contexte.langue ?? 'fr';
  const trouves = chercherClients(texte, donnees.clients);
  // « Les factures en retard », sans client cité ni fiche ouverte : toutes à la fois (G05 v3).
  if (trouves.cite.filter((m) => !RE_PLURIEL.test(m) && !['ton', 'courtois', 'courtoise', 'poli', 'polie', 'tone', 'polite'].includes(m)).length === 0 && !contexte.focus && RE_PLURIEL.test(aplatir(texte))) {
    return analyserRelances(texte, env);
  }
  let client: ClientAjmani | null = null;
  let facture: FactureAjmani | null = null;

  if (trouves.cite.length > 0) {
    if (trouves.clients.length === 0) {
      return reponse({
        intention: 'relancer', genre: 'rien-trouve',
        phrase: { cle: 'phrase.client.inconnu', params: { texte: trouves.cite.join(' ') }, gras: [] },
        lignes: [ligneTexte('trouver', mots('lancer.trouver.titre'), undefined, 'loupe', mots('seed.trouver'))],
      }, texte);
    }
    if (trouves.clients.length > 1) {
      return reponse({
        intention: 'relancer', genre: 'question',
        phrase: { cle: 'phrase.client.plusieurs', params: { texte: trouves.cite.join(' ') } },
        lignes: choixDeClients(trouves.clients, (nom) => mots('seed.relancer.client', { client: nom })),
      }, texte);
    }
    client = trouves.clients[0];
  } else if (contexte.focus?.type === 'facture') {
    facture = donnees.factures.find((f) => f.id === contexte.focus?.id) ?? null;
  } else if (contexte.focus?.type === 'client') {
    client = donnees.clients.find((c) => c.recordId === contexte.focus?.id) ?? null;
  }

  if (!client && !facture) {
    const retards = facturesEnRetard(donnees);
    if (retards.length === 0) {
      return reponse({ intention: 'relancer', genre: 'rien-trouve', phrase: { cle: 'phrase.relance.aucune' } }, texte);
    }
    const ids = [...new Set(retards.map((f) => f.clientId))];
    const clientsEnRetard = ids.flatMap((id) => donnees.clients.find((c) => c.id === id) ?? []);
    if (clientsEnRetard.length !== 1) {
      return reponse({
        intention: 'relancer', genre: 'question',
        phrase: { cle: 'phrase.relance.quel' },
        lignes: choixDeClients(clientsEnRetard, (nom) => mots('seed.relancer.client', { client: nom })),
      }, texte);
    }
    client = clientsEnRetard[0];
  }

  if (!facture && client) facture = facturesEnRetard(donnees, client.id)[0] ?? null;
  if (!facture || !estEnRetard(facture, donnees.aujourdhui)) {
    return reponse({
      intention: 'relancer', genre: 'rien-trouve',
      phrase: { cle: 'phrase.relance.rien', params: { client: client ? nomAffiche(client) : facture?.clientNom ?? '' }, gras: ['client'] },
      lignes: [ligneTexte('trouver', mots('lancer.trouver.titre'), mots('lancer.trouver.sous'), 'loupe', mots('seed.trouver'))],
    }, texte);
  }

  const jours = joursDeRetard(facture, donnees.aujourdhui);
  const montant = formaterMontant(facture.resteDuCentimes);
  const objets: ObjetConcerne[] = [{ type: 'facture', id: facture.id, libelle: facture.numero }];
  if (client) objets.push({ type: 'client', id: String(client.id), libelle: nomAffiche(client) });

  // Déjà fait : une relance notée au même palier (ou plus haut) ne se refait pas ; si le retard a changé de palier, le ton doit monter.
  const deja = donnees.relances.filter((r) => r.factureId === facture.id).sort((a, b) => b.le.localeCompare(a.le));
  const derniere = deja[0];
  const palierActuel = paliereDe(jours);
  const palierDernier = deja.reduce<PalierRelance>((max, r) => (rangPalier(r.palier ?? 'rappel') > rangPalier(max) ? (r.palier ?? 'rappel') : max), 'rappel');
  const tonMonte = Boolean(derniere) && rangPalier(palierActuel) > rangPalier(palierDernier);
  if (derniere && !tonMonte) {
    return reponse({
      intention: 'relancer', genre: 'deja-fait', objets,
      phrase: { cle: 'phrase.relance.dejaFait', params: { numero: facture.numero, date: formaterJour(derniere.le, langue) }, gras: ['numero'] },
      boutons: [
        boutonAller('voir-facture', 'bouton.facture.voir', '/facturation', 'primaire', 'facture', { openInvoiceId: facture.id }),
        boutonAller('ouvrir-relances', 'bouton.relances.ouvrir', '/relances', 'secondaire'),
        annuler(),
      ],
    }, texte);
  }

  const autres = facturesEnRetard(donnees, facture.clientId).filter((f) => f.id !== facture.id).length;
  const base = { numero: facture.numero, montant, jours };
  return reponse({
    intention: 'relancer', genre: 'proposition', niveau: 'N1', objets,
    phrase: tonMonte && derniere
      ? { cle: 'phrase.relance.monte', params: { ...base, date: formaterJour(derniere.le, langue) }, gras: ['numero'] }
      : { cle: jours === 1 ? 'phrase.relance.unJour' : 'phrase.relance.jours', params: base, gras: ['numero'] },
    complement: autres > 0 ? { cle: autres === 1 ? 'phrase.relance.reste.un' : 'phrase.relance.reste.n', params: { autres } } : undefined,
    boutons: [
      boutonAller('preparer', 'bouton.relance.preparer', '/relances', 'primaire', 'document', { factureId: facture.id }),
      boutonAller('modifier', 'bouton.modifier', '/facturation', 'secondaire', undefined, { openInvoiceId: facture.id }),
      annuler(),
    ],
  }, texte);
}

function analyserFacturesEnRetard(texte: string, env: Env): Reponse {
  const { donnees, mots } = env;
  const trouves = chercherClients(texte, donnees.clients);
  let client: ClientAjmani | null = null;
  if (trouves.cite.length > 0) {
    if (trouves.clients.length === 0) {
      return reponse({
        intention: 'factures-retard', genre: 'rien-trouve',
        phrase: { cle: 'phrase.client.inconnu', params: { texte: trouves.cite.join(' ') } },
        lignes: [ligneTexte('trouver', mots('lancer.trouver.titre'), mots('lancer.trouver.sous'), 'loupe', mots('seed.trouver'))],
      }, texte);
    }
    if (trouves.clients.length > 1) {
      return reponse({
        intention: 'factures-retard', genre: 'question',
        phrase: { cle: 'phrase.client.plusieurs', params: { texte: trouves.cite.join(' ') } },
        lignes: choixDeClients(trouves.clients, (nom) => `${mots('seed.retards')} ${nom}`),
      }, texte);
    }
    client = trouves.clients[0];
  }
  const retards = facturesEnRetard(donnees, client?.id);
  if (retards.length === 0) {
    return reponse({
      intention: 'factures-retard', genre: 'rien-trouve',
      phrase: client ? { cle: 'phrase.relance.rien', params: { client: nomAffiche(client) }, gras: ['client'] } : { cle: 'phrase.retards.aucune' },
      lignes: [ligneTexte('trouver', mots('lancer.trouver.titre'), mots('lancer.trouver.sous'), 'loupe', mots('seed.trouver'))],
    }, texte);
  }
  const total = formaterMontant(retards.reduce((n, f) => n + f.resteDuCentimes, 0));
  const cle: CleMot = client ? (retards.length === 1 ? 'phrase.retards.client.un' : 'phrase.retards.client.n') : retards.length === 1 ? 'phrase.retards.un' : 'phrase.retards.n';
  return reponse({
    intention: 'factures-retard', genre: 'resultats',
    phrase: { cle, params: { n: retards.length, total, client: client ? nomAffiche(client) : '' }, gras: ['total'] },
    objets: retards.slice(0, 3).map((f) => ({ type: 'facture', id: f.id, libelle: f.numero })),
    lignes: retards.slice(0, 3).map((f) => ligneAller(
      `facture-${f.id}`, f.numero, mots('ligne.retard', { montant: formaterMontant(f.resteDuCentimes), jours: joursDeRetard(f, donnees.aujourdhui) }), 'facture', '/facturation', { openInvoiceId: f.id },
      { groupe: 'documents' },
    )),
    boutons: [boutonAller('voir-relances', 'bouton.relances.voir', '/relances', 'primaire', 'ouvrir'), annuler()],
  }, texte);
}

function analyserCreerFacture(texte: string, env: Env): Reponse {
  const { donnees, mots } = env;
  const { lignes, reste } = lireLignes(texte);
  const trouves = chercherClients(reste, donnees.clients);
  const choix = (liste: readonly ClientAjmani[]) => choixDeClients(liste, (nom) => mots('seed.creerFacture.pour', { client: nom }));

  if (trouves.cite.length === 0) {
    return reponse({ intention: 'creer-facture', genre: 'question', phrase: { cle: 'phrase.facture.quelClient' }, lignes: choix(donnees.clients) }, texte);
  }
  if (trouves.clients.length === 0) {
    return reponse({ intention: 'creer-facture', genre: 'rien-trouve', phrase: { cle: 'phrase.client.inconnu', params: { texte: trouves.cite.join(' ') } }, lignes: choix(donnees.clients) }, texte);
  }
  if (trouves.clients.length > 1) {
    return reponse({ intention: 'creer-facture', genre: 'question', phrase: { cle: 'phrase.client.plusieurs', params: { texte: trouves.cite.join(' ') } }, lignes: choix(trouves.clients) }, texte);
  }

  const client = trouves.clients[0];
  const nom = nomAffiche(client);
  const sansLignes = RE_SANS_LIGNES.test(aplatir(texte));
  const objets: ObjetConcerne[] = [{ type: 'client', id: String(client.id), libelle: nom }];

  if (lignes.length === 0 && !sansLignes) {
    return reponse({
      intention: 'creer-facture', genre: 'question', objets,
      phrase: { cle: 'phrase.facture.quellesLignes', params: { client: nom }, gras: ['client'] },
      lignes: [ligneTexte('sans-lignes', mots('ligne.sansLignes.titre'), mots('ligne.sansLignes.sous'), 'document', mots('seed.creerFacture.vide', { client: nom }))],
    }, texte);
  }

  const total = formaterMontant(totalHt(lignes));
  return reponse({
    intention: 'creer-facture', genre: 'brouillon', niveau: 'N1', objets,
    phrase: lignes.length === 0
      ? { cle: 'phrase.facture.recap.vide', params: { client: nom }, gras: ['client'] }
      : { cle: lignes.length === 1 ? 'phrase.facture.recap.une' : 'phrase.facture.recap.n', params: { client: nom, n: lignes.length, total }, gras: ['client', 'total'] },
    details: lignes.map((l) => `${l.quantite} × ${l.label} · ${formaterMontant(l.prixCentimes)}`),
    boutons: [
      { id: 'creer', role: 'primaire', cle: 'bouton.brouillon.creer', icone: 'plus', effet: { type: 'creer-brouillon-facture', clientId: client.id, clientNom: nom, lignes } },
      boutonAller('modifier', 'bouton.modifier', '/facturation', 'secondaire', undefined, { nouvelleFacture: { clientId: client.id } }),
      annuler(),
    ],
  }, texte);
}

/* ── Trouver ── */

function scoreModule(m: ModuleAjmani, mots: string[], sansVerbes = false): number {
  const libelle = jetons(m.libelle);
  const verbes = sansVerbes ? [] : (m.verbes ?? []).flatMap(jetons);
  const cles = (m.motsCles ?? []).flatMap(jetons);
  const indice = jetons(m.indice ?? '');
  let total = 0;
  for (const mot of mots) {
    const colle = (liste: string[]) => liste.some((x) => x.startsWith(mot) || (mot.length > 3 && /[sx]$/.test(mot) && x.startsWith(mot.slice(0, -1))));
    if (colle(libelle)) total += 4;
    else if (colle(cles)) total += 3;
    else if (colle(verbes)) total += 2;
    else if (colle(indice)) total += 1;
    else return 0;
  }
  return total;
}

export const MAX_PAR_GROUPE = 3;
export const MAX_LIGNES_RESUME = 5;

function trouverEnBase(recherche: string[], env: Env, sansVerbes = false): LigneReponse[] {
  const { donnees } = env;
  if (recherche.length === 0) return [];
  const modules = donnees.modules
    .map((m, i) => ({ m, i, s: scoreModule(m, recherche, sansVerbes) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, MAX_PAR_GROUPE)
    .map(({ m }) => ligneAller(`module-${m.cle}`, m.libelle, m.familleLibelle ?? m.indice, 'ouvrir', m.route, undefined, { groupe: 'modules', famille: m.famille }));
  const clients = chercherClients(recherche.join(' '), donnees.clients).clients
    .slice(0, MAX_PAR_GROUPE)
    .map((c) => ligneAller(`client-${c.id}`, nomAffiche(c), c.nom !== nomAffiche(c) ? c.nom : undefined, 'utilisateur', '/clients', { focusClientId: c.id }, { groupe: 'clients' }));
  const documents = recherche.length === 1 && recherche[0].length >= 3
    ? donnees.factures.filter((f) => f.statut !== 'brouillon' && aplatir(f.numero).includes(recherche[0])).slice(0, MAX_PAR_GROUPE)
      .map((f) => ligneAller(`facture-${f.id}`, f.numero, f.clientNom, 'facture', '/facturation', { openInvoiceId: f.id }, { groupe: 'documents' }))
    : [];
  return [...modules, ...clients, ...documents];
}

function analyserTrouver(texte: string, env: Env, avecVerbe: boolean): Reponse | null {
  const { mots } = env;
  const recherche = objetDeRecherche(texte);
  if (recherche.length === 0) {
    return avecVerbe ? reponse({ intention: 'trouver', genre: 'question', phrase: { cle: 'phrase.trouver.quoi' }, boutons: [annuler()] }, texte) : null;
  }
  const lignes = trouverEnBase(recherche, env);
  const dit = recherche.join(' ');
  if (lignes.length === 0) {
    if (!avecVerbe) return null;
    return reponse({
      intention: 'trouver', genre: 'rien-trouve',
      phrase: { cle: 'phrase.trouver.rien', params: { texte: dit } },
      lignes: [ligneTexte('trouver', mots('lancer.trouver.titre'), mots('lancer.trouver.sous'), 'loupe', mots('seed.trouver'))],
    }, texte);
  }
  return reponse({
    intention: 'trouver', genre: 'resultats', section: 'section.resultats',
    phrase: { cle: 'phrase.trouver.resultats', params: { texte: dit } },
    lignes,
    boutons: [{ id: 'tous', role: 'primaire', cle: 'bouton.resultats.voirTous', icone: 'loupe', effet: { type: 'rechercher', texte: dit } }, annuler()],
  }, texte);
}

/* ── Résumer ── */

function analyserResumer(texte: string, env: Env): Reponse {
  const { donnees, mots } = env;
  if (RE_MESSAGES.test(aplatir(texte))) {
    return reponse({
      intention: 'resumer', genre: 'proposition',
      phrase: { cle: 'phrase.resume.messages' },
      boutons: [{ id: 'panneau', role: 'primaire', cle: 'bouton.panneau.demander', icone: 'message', effet: { type: 'demander', texte } }, annuler()],
    }, texte);
  }
  const lignes: LigneReponse[] = [];
  const retards = facturesEnRetard(donnees);
  if (retards.length > 0) {
    const total = formaterMontant(retards.reduce((n, f) => n + f.resteDuCentimes, 0));
    lignes.push(ligneAller('retards', mots(retards.length === 1 ? 'resume.retard.un' : 'resume.retard.n', { n: retards.length, montant: total }), undefined, 'facture', '/relances'));
  }
  for (const a of donnees.attentes.slice(0, 3)) lignes.push(ligneAller(`attente-${a.cle}`, a.titre, undefined, 'ouvrir', a.route));
  if (donnees.rendezVousAujourdhui > 0) {
    lignes.push(ligneAller('rdv', mots(donnees.rendezVousAujourdhui === 1 ? 'resume.rdv.un' : 'resume.rdv.n', { n: donnees.rendezVousAujourdhui }), undefined, 'agenda', '/agenda'));
  }
  const retenues = lignes.slice(0, MAX_LIGNES_RESUME);
  if (retenues.length === 0) {
    return reponse({ intention: 'resumer', genre: 'resume', section: 'section.resume', phrase: { cle: 'phrase.resume.vide' }, boutons: [annuler()] }, texte);
  }
  const copie = retenues.map((l) => `- ${l.titre ?? ''}`).join('\n');
  return reponse({
    intention: 'resumer', genre: 'resume', section: 'section.resume',
    phrase: { cle: 'phrase.resume' },
    lignes: retenues,
    boutons: [{ id: 'copier', role: 'primaire', cle: 'bouton.resume.copier', icone: 'document', effet: { type: 'copier', texte: copie } }, annuler()],
  }, texte);
}

/* ── La Garde ── */

function analyserGarde(texte: string, env: Env): Reponse {
  const { donnees, contexte } = env;
  if (!contexte.admin) {
    return reponse({ intention: 'garde', genre: 'droits', section: 'section.garde', phrase: { cle: 'phrase.droits' }, boutons: [annuler()] }, texte);
  }
  const g = donnees.garde;
  const ouvrir = boutonAller('ouvrir-garde', 'bouton.garde.ouvrir', '/garde', 'primaire', 'bouclier');
  if (!g || g.etat === 'inconnu') {
    return reponse({ intention: 'garde', genre: 'garde', section: 'section.garde', phrase: { cle: 'phrase.garde.inconnu' }, pastille: { etat: 'neutre', cle: 'pastille.inconnu' }, boutons: [ouvrir, annuler()] }, texte);
  }
  const n = g.points;
  const phrase: Phrase =
    g.etat === 'calme' ? { cle: 'phrase.garde.calme' }
    : g.etat === 'attention' ? { cle: n === 1 ? 'phrase.garde.attention.un' : 'phrase.garde.attention.n', params: { n }, gras: ['n'] }
    : { cle: n === 1 ? 'phrase.garde.critique.un' : 'phrase.garde.critique.n', params: { n }, gras: ['n'] };
  const etat = g.etat === 'calme' ? 'succes' : g.etat === 'attention' ? 'attention' : 'critique';
  const cle: CleMot = g.etat === 'calme' ? 'pastille.calme' : g.etat === 'attention' ? 'pastille.attention' : 'pastille.critique';
  return reponse({ intention: 'garde', genre: 'garde', section: 'section.garde', phrase, pastille: { etat, cle }, boutons: [ouvrir, annuler()] }, texte);
}

/* ═══ L'entrée principale ═══ */

/**
 * Analyse une demande. `null` : le champ est vide, la palette montre son état de repos (`etatDeRepos`).
 * Rien ici n'écrit, n'envoie, ni ne lit autre chose que `env.donnees`.
 */
export function analyser(texte: string, env: Env): Reponse | null {
  const net = texte.replace(/\s+/g, ' ').trim();
  const t = aplatir(net);
  if (!t) return null;
  const { mots } = env;
  const demander: LigneReponse = { id: 'demander', titreCle: 'ligne.demander.titre', sous: `« ${net} »`, icone: 'message', effet: { type: 'demander', texte: net } };

  const interdite = categorieInterdite(net);
  if (interdite === 'paiement') {
    return reponse({
      intention: 'paiement', genre: 'refus',
      phrase: { cle: 'phrase.refus.paiement' },
      boutons: [boutonAller('facturation', 'bouton.facturation.ouvrir', '/facturation', 'primaire', 'facture'), annuler()],
    }, net);
  }
  if (interdite === 'coffre') {
    return reponse({ intention: 'coffre', genre: 'refus', phrase: { cle: 'phrase.refus.coffre' }, boutons: [annuler()] }, net);
  }

  // Un mot seul qui est le nom d'un module (« relances », « facturation ») le désigne : on l'ouvre, on ne lance rien.
  if (jetons(net).length === 1) {
    const direct = trouverEnBase(objetDeRecherche(net), env, true);
    if (direct.length > 0) return analyserTrouver(net, env, false);
  }
  // Un verbe de recherche en tête (« Trouver relances ») dit ce qu'on veut, quels que soient les mots qui suivent.
  if (RE_TROUVER.test(t)) return analyserTrouver(net, env, true);

  if (RE_RELANCE.test(t)) return analyserRelance(net, env);
  if (RE_RETARDS.test(t) && !RE_CREER_FACTURE.test(t)) return analyserFacturesEnRetard(net, env);
  if (RE_CREER_FACTURE.test(t)) return analyserCreerFacture(net, env);
  if (RE_GARDE.test(t)) return analyserGarde(net, env);
  if (RE_RESUMER.test(t)) return analyserResumer(net, env);
  if (RE_REDIGER.test(t)) {
    const annonce = /\bannonces?\b/.test(t);
    return reponse({
      intention: 'rediger', genre: 'proposition',
      phrase: { cle: 'phrase.rediger' },
      boutons: [
        { id: 'panneau', role: 'primaire', cle: 'bouton.panneau.rediger', icone: 'document', effet: { type: 'demander', texte: net } },
        ...(annonce ? [boutonAller('annonces', 'bouton.annonces.ouvrir', '/annonces', 'secondaire' as const)] : []),
        annuler(),
      ],
    }, net);
  }

  const verbe = RE_TROUVER_DOUX.test(t);
  const trouvee = analyserTrouver(net, env, verbe);
  if (trouvee && (verbe || jetons(net).length <= 4)) return trouvee;

  // Rien de reconnu : trois lignes, dont « Demander à Ajmani » qui délègue à l'assistant.
  return reponse({
    intention: 'inconnue', genre: 'non-comprise',
    phrase: { cle: 'phrase.nonComprise', params: { texte: net } },
    lignes: [
      demander,
      ligneTexte('trouver', mots('lancer.trouver.titre'), mots('lancer.trouver.sous'), 'loupe', mots('seed.trouver')),
      ligneTexte('resumer', mots('lancer.resumer.titre'), mots('lancer.resumer.sous'), 'liste', mots('seed.resumer')),
    ],
  }, net);
}

/* ═══ Le repos : champ vide ═══ */

export interface EntreeRepos {
  donnees: DonneesAjmani;
  contexte: ContexteAjmani;
  /** Les demandes déjà faites (texte seul), la plus récente d'abord. */
  historique: readonly { texte: string; le: number }[];
  mots: Mots;
}

/**
 * Ce que la palette montre quand le champ est vide :
 *   « Ajmani propose » — l'élément le plus utile du contexte (ce qui demande l'attention, une facture en retard) ;
 *   sinon « Récent » — les demandes passées ;
 *   sinon « Suggéré ici » — les modules de la famille courante.
 */
export function etatDeRepos(e: EntreeRepos): Reponse {
  const { donnees, contexte, historique } = e;
  const premier = donnees.attentes[0];
  if (premier) {
    const n = donnees.attentes.length;
    return reponse({
      intention: 'vide', genre: 'vide-propose',
      phrase: { cle: n === 1 ? 'phrase.vide.attention.un' : 'phrase.vide.attention.n', params: { n, titre: premier.titre }, gras: ['titre'] },
      boutons: [boutonAller('ouvrir', 'bouton.vide.ouvrir', premier.route, 'primaire', 'ouvrir')],
    }, '');
  }
  const retards = facturesEnRetard(donnees);
  if (retards.length > 0) {
    const total = formaterMontant(retards.reduce((n, f) => n + f.resteDuCentimes, 0));
    return reponse({
      intention: 'vide', genre: 'vide-propose',
      phrase: { cle: retards.length === 1 ? 'phrase.vide.retard.un' : 'phrase.vide.retard.n', params: { n: retards.length, montant: total }, gras: ['montant'] },
      boutons: [boutonAller('relances', 'bouton.relances.ouvrir', '/relances', 'primaire', 'ouvrir')],
    }, '');
  }
  if (historique.length > 0) {
    return reponse({
      intention: 'vide', genre: 'vide-recent', section: 'section.recent',
      phrase: { cle: 'phrase.vide.recent' },
      lignes: historique.slice(0, 5).map((d, i) => ({ id: `recent-${i}`, titre: d.texte, icone: 'horloge' as const, effet: { type: 'texte' as const, texte: d.texte } })),
    }, '');
  }
  const ici = donnees.modules.filter((m) => contexte.famille && m.famille === contexte.famille).slice(0, 3);
  return reponse({
    intention: 'vide', genre: 'vide-suggere', section: 'section.suggere',
    phrase: { cle: ici.length > 0 ? 'phrase.vide.suggere' : 'phrase.vide.rien' },
    lignes: ici.map((m) => ligneAller(`module-${m.cle}`, m.libelle, m.familleLibelle ?? m.indice, 'ouvrir', m.route, undefined, { famille: m.famille })),
  }, '');
}

/**
 * LE CHERCHEUR DE MODULES — cahier 12, `46f` et `46h`.
 *
 * La phrase de la cliente, telle quelle. Le chercheur en tire LES IDÉES
 * qu'elle demande, dit ce qu'il ignore, et range les modules dans une grille
 * d'appariement : un module par ligne, une idée par colonne ; une case pleine
 * porte LA RAISON (le cas d'usage), une case vide dit que le module ne le fait
 * pas. On classe par ce que le module couvre, puis par le nombre
 * d'organisations qui l'emploient — jamais par un score opaque.
 *
 * Les trois règles ajoutées après le deuxième essai (`46h`) :
 *   1. un mot à deux sens ouvre DEUX LECTURES, la plus probable d'abord, avec
 *      la raison de ce choix, et une question pour la cliente — le chercheur
 *      ne tranche jamais en silence ;
 *   2. une case peut porter une RÉSERVE (le module fait presque ce qui est
 *      demandé, et la limite est écrite) ;
 *   3. pas de rapprochement forcé : un module qui ne couvre qu'une idée est
 *      écarté, et la raison est dite ; quand aucun module ne répond seul, la
 *      grille l'écrit, et le verdict propose une combinaison en disant ce
 *      qu'elle ne fera pas.
 *
 * Pur, sans React ni catalogue importé : `scripts/check-chercheur.ts` l'éprouve
 * sur un jeu de phrases de clientes, dont celles du paquet.
 */

export interface Sens {
  cle: string;
  libelle: string;
  /** Les mots de la phrase qui rendent ce sens plus probable. */
  indices: RegExp;
  /** Le complément qui TRANCHE (« pointer ses heures » n'a qu'un sens) ; sans lui, les deux lectures restent ouvertes. */
  tranche?: RegExp;
  pourquoi: string;
}

export interface Concept {
  cle: string;
  /** Ce qui, dans la phrase (sans accents, en minuscules), dit cette idée. */
  motif: RegExp;
  /** Un mot à deux sens : chaque sens est une idée à part entière. */
  sens?: Sens[];
}

/* ── Le vocabulaire des clientes ─────────────────────────────────────── */
export const CONCEPTS: Concept[] = [
  { cle: 'personnel', motif: /\b(livreurs?|salarie(e)?s?|employe(e)?s?|equipes?|techniciens?|chauffeurs?|coursiers?|vendeu(r|se)s?)\b/ },
  {
    cle: 'pointer',
    motif: /\bpoint(e|es|ent|er|age)\b/,
    sens: [
      { cle: 'arrivee', libelle: 'signaler l’arrivée chez le destinataire', indices: /(livr|colis|destinataire|client|photo|depot|adresse|arriv)/, pourquoi: '« photo du colis » parle de livraison' },
      { cle: 'heures', libelle: 'pointer ses heures de travail', indices: /(heure|journee|pause|salari|paie|planning|horaire|debut|fin de)/, tranche: /^(heures?|horaires?|temps)$/, pourquoi: 'on parle d’heures et de journées' },
    ],
  },
  { cle: 'surPlace', motif: /\b(sur place|en boutique|au comptoir|sur la tablette)\b/ },
  { cle: 'enLigne', motif: /\b(en ligne|a distance|par internet|sur (le|mon) site)\b/ },
  { cle: 'suivre', motif: /\b(suivre|suivi|savoir ou en (est|sont)|en direct|en temps reel)\b/ },
  { cle: 'livraison', motif: /\b(livraisons?|livrer|livre(e|es|s)?|expedi\w*|tournees?)\b/ },
  { cle: 'photo', motif: /\b(photos?|photographi\w*|images?|cliches?)\b/ },
  { cle: 'colis', motif: /\b(colis|paquets?|cartons?|envois?)\b/ },
  { cle: 'heures', motif: /\b(heures|temps passe|chronometr\w*|feuilles? de temps)\b/ },
  { cle: 'rdv', motif: /\b(rendez-?vous|rdv|reservations?|reserver|creneaux?)\b/ },
  { cle: 'facture', motif: /\b(factur\w*)\b/ },
  { cle: 'devis', motif: /\b(devis)\b/ },
  { cle: 'paiement', motif: /\b(paiements?|payer|paye(r|s)?|encaiss\w*|acomptes?|carte bancaire|cb)\b/ },
  { cle: 'relance', motif: /\b(relanc\w*|impayes?|retards? de paiement)\b/ },
  { cle: 'stock', motif: /\b(stocks?|inventaire|ruptures?)\b/ },
  { cle: 'commande', motif: /\b(commandes?|commander)\b/ },
  { cle: 'client', motif: /\b(fichier client|fiches? clients?|carnet d'?adresses|contacts? clients?)\b/ },
  { cle: 'signature', motif: /\b(signer|signatures?|signe(e|es)?)\b/ },
  { cle: 'contrat', motif: /\b(contrats?)\b/ },
  { cle: 'avis', motif: /\b(avis|temoignages?|commentaires? clients?)\b/ },
  { cle: 'fidelite', motif: /\b(fidelite|fideliser|tampons?|carte de fidelite)\b/ },
  { cle: 'planning', motif: /\b(planning|horaires?|roulements?|qui (est|travaille) (la|quand))\b/ },
  { cle: 'conges', motif: /\b(conges?|absences?|vacances|arrets? maladie)\b/ },
  { cle: 'intervention', motif: /\b(interventions?|depannages?|deplacements?|chantiers?)\b/ },
  { cle: 'compteRendu', motif: /\b(comptes? rendus?|rapports? d'intervention|bons? d'intervention)\b/ },
  { cle: 'courriel', motif: /\b(newsletters?|lettres? d'information|mailings?|courriels? a (tous|mes) clients)\b/ },
  { cle: 'reseaux', motif: /\b(reseaux sociaux|instagram|facebook|linkedin|publications?|posts?)\b/ },
  { cle: 'boutique', motif: /\b(boutique en ligne|vendre en ligne|e-?commerce|panier)\b/ },
  { cle: 'billets', motif: /\b(billets?|billetterie|places de spectacle)\b/ },
  { cle: 'depenses', motif: /\b(depenses?|frais|tickets? de caisse|justificatifs?|notes? de frais)\b/ },
  { cle: 'caisse', motif: /\b(caisse|especes|fond de caisse)\b/ },
  { cle: 'document', motif: /\b(documents?|papiers?|scann\w*|classeur)\b/ },
  { cle: 'vehicule', motif: /\b(vehicules?|camions?|camionnettes?|voitures?|flotte)\b/ },
  { cle: 'itineraire', motif: /\b(itineraires?|trajets?|ordre des arrets|optimis\w*)\b/ },
  { cle: 'materiel', motif: /\b(materiel|outillage|reservation du materiel)\b/ },
  { cle: 'tresorerie', motif: /\b(tresorerie|solde|compte en banque)\b/ },
  { cle: 'qualite', motif: /\b(controles? qualite|check-?lists?|listes? a cocher)\b/ },
  { cle: 'sav', motif: /\b(sav|apres-?vente|reclamations?|retours? produits?)\b/ },
  { cle: 'formulaire', motif: /\b(formulaires?|questionnaires?|sondages?)\b/ },
];

/** Ce qu'une phrase de cliente dit sans rien demander. */
const REMPLISSAGE = [
  /\bil me (manque|faut|faudrait)\b/,
  /\bj'?aimerais( bien)?\b/,
  /\bje (voudrais|veux|cherche)\b/,
  /\bun (truc|machin|outil|moyen|systeme|logiciel)\b/,
  /\bquelque chose\b/,
  /\bun petit\b/,
];

/**
 * Ce que chaque module sait faire, idée par idée — la raison écrite dans la
 * case. Une raison peut porter une RÉSERVE : le module fait presque ce qui
 * est demandé, et la limite est dite. Les clés sont celles du catalogue.
 */
export type Raison = string | { raison: string; reserve: string };
export const CAS_D_USAGE: Record<string, Record<string, Raison>> = {
  rounds: {
    personnel: 'chaque livreur a sa tournée',
    suivre: 'position de l’arrêt, en direct',
    livraison: 'livraison ↔ tournée du jour',
    'pointer:arrivee': 'l’arrêt passe à « arrivé », heure notée',
    itineraire: 'arrêt par arrêt',
  },
  orders: { commande: 'reçues du site', livraison: 'commande livrée', colis: 'colis ↔ commande', suivre: 'statut de la commande', paiement: { raison: 'payée ou non', reserve: 'l’état du paiement, pas l’encaissement' } },
  interventions: {
    suivre: 'avant, pendant, après',
    photo: 'photo par étape',
    intervention: 'le compte rendu d’un déplacement',
    compteRendu: 'compte rendu daté',
    signature: 'signature du client sur place',
    'pointer:arrivee': { raison: 'heure d’arrivée du technicien', reserve: 'notée à la main, pas horodatée par le téléphone' },
    personnel: 'le technicien qui intervient',
  },
  time: { personnel: 'tout salarié qui pointe', 'pointer:heures': 'début et fin de journée, pauses', heures: 'chronomètre et temps passé' },
  shifts: { personnel: 'qui est là, jour par jour', planning: 'la semaine en colonnes', 'pointer:heures': { raison: 'les heures prévues', reserve: 'prévues, pas pointées' } },
  leaves: { conges: 'congés, maladie, télétravail', personnel: 'qui est absent' },
  expenseClaims: { photo: 'un ticket photographié', depenses: 'notes de frais vérifiées' },
  expenses: { depenses: 'frais et justificatifs', photo: { raison: 'justificatif joint', reserve: 'une pièce jointe, pas lue automatiquement' } },
  binder: { document: 'les documents et leurs versions', signature: { raison: 'la version signée', reserve: 'rangée, pas signée ici' } },
  booking: { rdv: 'une page publique de réservation', enLigne: 'la page publique branchée sur l’Agenda', paiement: { raison: 'acompte à la réservation', reserve: 'si l’acompte en ligne est ouvert' } },
  agenda: { rdv: 'rendez-vous et disponibilités', planning: { raison: 'les rendez-vous de l’équipe', reserve: 'des rendez-vous, pas des horaires' } },
  invoices: { facture: 'factures numérotées', paiement: 'encaissements', relance: { raison: 'échéances visibles', reserve: 'la relance est dans « Relances »' } },
  reminders: { relance: 'le mot à envoyer', facture: 'les factures échues' },
  deposits: { paiement: 'acompte payé en ligne', devis: 'devis signé en ligne', signature: 'signature en ligne', enLigne: 'signé et payé en ligne' },
  esign: { signature: 'sur l’écran', devis: 'faire signer un devis', surPlace: 'sur place, sur l’écran de la boutique' },
  remoteSign: { signature: 'à distance, qui tient le document', contrat: 'le contrat en circuit', enLigne: 'à distance' },
  shop: { boutique: 'la boutique en ligne', commande: 'paniers et commandes', paiement: 'payé en ligne', enLigne: 'vendre en ligne' },
  contracts: { contrat: 'ce qui est signé, jusqu’à quand', relance: { raison: 'échéance du contrat', reserve: 'l’échéance, pas la relance' } },
  clients: { client: 'fiches clients', devis: 'devis rattachés à la fiche' },
  reviews: { avis: 'les avis, gardés ensemble' },
  loyalty: { fidelite: 'la carte à tampons' },
  referrals: { fidelite: { raison: 'qui a amené qui', reserve: 'du parrainage, pas des tampons' } },
  stock: { stock: 'ce qu’il reste', commande: { raison: 'à commander', reserve: 'une alerte, pas un bon de commande' } },
  stockForecast: { stock: 'quand chaque article manquera' },
  suppliers: { commande: { raison: 'qui vous fournit quoi', reserve: 'le fournisseur, pas la commande' } },
  ticketing: { billets: 'places vendues, entrées à la porte' },
  fleet: { vehicule: 'compteur et échéances de chaque véhicule' },
  itineraries: { itineraire: 'l’ordre des arrêts, optimisé la veille', livraison: 'les arrêts de livraison' },
  equipment: { materiel: 'qui a quoi, quand' },
  cashForecast: { tresorerie: 'le solde sur douze semaines' },
  cashCount: { caisse: 'le fond et l’écart du jour' },
  checklists: { qualite: 'des listes à cocher, la trace de chaque passage', photo: { raison: 'photo jointe au passage', reserve: 'une pièce jointe, pas une preuve horodatée' } },
  aftersales: { sav: 'de l’ouverture à la résolution', suivre: 'où en est la demande' },
  forms: { formulaire: 'une question posée, les réponses ici' },
  newsletter: { courriel: 'un mot à tous vos clients' },
  postPlanner: { reseaux: 'les posts de la semaine' },
  minisite: { avis: { raison: 'vos avis affichés', reserve: 'affichés, pas recueillis' } },
  assembly: { suivre: 'chaque chantier, étape par étape', intervention: 'le suivi de montage', photo: { raison: 'photo d’étape', reserve: 'si l’étape en demande une' } },
  procedures: { qualite: { raison: 'les procédures affichées', reserve: 'affichées, pas cochées' } },
};

export interface Idee {
  /** `livraison`, ou `pointer:arrivee` pour un sens. */
  cle: string;
  /** Le mot de la phrase qui l'a dite. */
  mot: string;
}

export interface Case {
  raison: string;
  reserve: string | null;
}

export interface LigneGrille {
  cle: string;
  nom: string;
  famille: string;
  cases: (Case | null)[];
  couvre: number;
  reserves: number;
  organisations: number;
}

export interface Lecture {
  /** « A », « B ». */
  lettre: string;
  libelle: string | null;
  pourquoi: string | null;
  idees: Idee[];
  lignes: LigneGrille[];
  ecartes: LigneGrille[];
  /** Le module qui couvre toutes les idées, s'il existe. */
  complet: LigneGrille | null;
  /** Deux modules qui, ensemble, couvrent tout — quand aucun ne répond seul. */
  paire: [LigneGrille, LigneGrille] | null;
}

export interface Recherche {
  phrase: string;
  /** Les idées communes à toutes les lectures, et le mot à deux sens s'il y en a un. */
  idees: Idee[];
  ambigu: { mot: string; sens: Sens[] } | null;
  ignores: string[];
  inconnus: string[];
  lectures: Lecture[];
}

export interface ModuleCatalogue {
  cle: string;
  nom: string;
  famille: string;
}

export const plier = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase();

const VIDES = new Set(['pour', 'avec', 'dans', 'mes', 'mon', 'leur', 'leurs', 'une', 'des', 'les', 'que', 'qui', 'quand', 'comment', 'faire', 'avoir', 'etre', 'plus', 'tout', 'tous', 'bien', 'mais', 'donc', 'aussi', 'chez', 'sans', 'sur', 'nos', 'notre', 'vos', 'votre', 'cela', 'ceci', 'puis', 'faut', 'manque', 'truc', 'aimerais', 'voudrais', 'cherche', 'quelque', 'chose', 'moyen', 'outil', 'petit', 'arrivee', 'arriver', 'gerer', 'savoir']);

/** Lit la phrase : les idées, le mot à deux sens, ce qui est ignoré, ce qui est inconnu. */
export function lire(phrase: string): { idees: Idee[]; ambigu: { concept: Concept; mot: string } | null; ignores: string[]; inconnus: string[] } {
  const p = plier(phrase);
  const idees: Idee[] = [];
  let ambigu: { concept: Concept; mot: string } | null = null;
  const couverts: [number, number][] = [];
  for (const c of CONCEPTS) {
    const m = c.motif.exec(p);
    if (!m) continue;
    couverts.push([m.index, m.index + m[0].length]);
    // Le mot tel qu'elle l'a écrit : on retrouve l'extrait dans la phrase d'origine.
    let mot = phrase.slice(m.index, m.index + m[0].length);
    if (c.sens) {
      // « pointent leur arrivée » : le complément fait partie de l'idée.
      const suite = /^\s+(leur|leurs|son|ses|sa|mon|mes)\s+([\p{L}’'-]+)/u.exec(phrase.slice(m.index + m[0].length));
      if (suite) {
        mot = `${mot}${suite[0]}`;
        couverts.push([m.index, m.index + m[0].length + suite[0].length]);
        // Le complément tranche-t-il ? « pointer ses heures » n'a qu'un sens : pas de question à poser.
        const tranche = c.sens.find((x) => x.tranche?.test(plier(suite[2])));
        if (tranche) {
          idees.push({ cle: `${c.cle}:${tranche.cle}`, mot });
          continue;
        }
      }
      ambigu = { concept: c, mot };
      continue;
    }
    idees.push({ cle: c.cle, mot });
  }
  // Un sens porté par le mot ambigu rend inutile l'idée voisine qu'il contient (« heures » dans « pointer ses heures »).
  const ignores = REMPLISSAGE.map((r) => r.exec(p)).filter((m): m is RegExpExecArray => Boolean(m)).map((m) => phrase.slice(m.index, m.index + m[0].length));
  const inconnus: string[] = [];
  const re = /[\p{L}'-]{5,}/gu;
  let t: RegExpExecArray | null;
  while ((t = re.exec(p))) {
    const [a, b] = [t.index, t.index + t[0].length];
    if (couverts.some(([x, y]) => a >= x && b <= y)) continue;
    if (ignores.some((ig) => plier(ig).includes(t![0]))) continue;
    if (VIDES.has(t[0].replace(/^[dlj]'/, ''))) continue;
    inconnus.push(phrase.slice(a, b));
  }
  // Une idée en double ne compte qu'une fois ; et « heures » est déjà dit par « pointer ses heures ».
  const vues = new Set<string>();
  const tranchees = new Set(idees.filter((i) => i.cle.includes(':')).map((i) => i.cle.split(':')[1]));
  const uniques = idees.filter((i) => !tranchees.has(i.cle)).filter((i) => (vues.has(i.cle) ? false : (vues.add(i.cle), true)));
  // Dans l'ordre où elle les a dits.
  uniques.sort((a, b) => p.indexOf(plier(a.mot)) - p.indexOf(plier(b.mot)));
  return { idees: uniques, ambigu, ignores, inconnus: [...new Set(inconnus)].slice(0, 4) };
}

function grille(idees: Idee[], catalogue: ModuleCatalogue[], usage: Map<string, number>): LigneGrille[] {
  const lignes: LigneGrille[] = [];
  for (const m of catalogue) {
    const cas = CAS_D_USAGE[m.cle];
    if (!cas) continue;
    const cases = idees.map((i) => {
      const r = cas[i.cle];
      if (!r) return null;
      return typeof r === 'string' ? { raison: r, reserve: null } : { raison: r.raison, reserve: r.reserve };
    });
    const couvre = cases.filter(Boolean).length;
    if (!couvre) continue;
    lignes.push({ cle: m.cle, nom: m.nom, famille: m.famille, cases, couvre, reserves: cases.filter((c) => c?.reserve).length, organisations: usage.get(m.cle) ?? 0 });
  }
  return lignes.sort((a, b) => b.couvre - a.couvre || a.reserves - b.reserves || b.organisations - a.organisations || a.nom.localeCompare(b.nom, 'fr'));
}

/** Cherche, pour la phrase d'une cliente, dans le catalogue donné. `usage` : combien d'organisations emploient chaque module. */
export function chercher(phrase: string, catalogue: ModuleCatalogue[], usage: Map<string, number> = new Map()): Recherche {
  const l = lire(phrase);
  const p = plier(phrase);
  const sensOrdonnes = l.ambigu?.concept.sens ? [...l.ambigu.concept.sens].sort((a, b) => Number(b.indices.test(p)) - Number(a.indices.test(p))) : null;
  const variantes: { libelle: string | null; pourquoi: string | null; idees: Idee[] }[] = sensOrdonnes
    ? sensOrdonnes.map((s, i) => {
        const idees = [...l.idees];
        // L'idée du sens prend la place du mot ambigu, à sa position dans la phrase.
        const position = idees.findIndex((x) => plier(phrase).indexOf(plier(x.mot)) > plier(phrase).indexOf(plier(l.ambigu!.mot)));
        const idee = { cle: `pointer:${s.cle}`, mot: s.cle === 'heures' ? 'pointer ses heures' : l.ambigu!.mot };
        if (position < 0) idees.push(idee);
        else idees.splice(position, 0, idee);
        return { libelle: s.libelle, pourquoi: i === 0 ? `la plus probable : ${s.pourquoi}` : null, idees: s.cle === 'heures' ? idees.filter((x) => x.cle !== 'heures') : idees };
      })
    : [{ libelle: null, pourquoi: null, idees: l.idees }];
  const lectures: Lecture[] = variantes.map((v, i) => {
    const toutes = grille(v.idees, catalogue, usage);
    const n = v.idees.length;
    // Pas de rapprochement forcé : avec deux idées ou plus, un module qui n'en couvre qu'une est écarté.
    const lignes = n >= 2 ? toutes.filter((x) => x.couvre >= 2) : toutes;
    const ecartes = n >= 2 ? toutes.filter((x) => x.couvre < 2) : [];
    const complet = lignes.find((x) => x.couvre === n) ?? null;
    let paire: [LigneGrille, LigneGrille] | null = null;
    if (!complet && n >= 2) {
      outer: for (const a of toutes) {
        for (const b of toutes) {
          if (a === b) continue;
          if (v.idees.every((_, k) => a.cases[k] || b.cases[k])) {
            paire = [a, b];
            break outer;
          }
        }
      }
    }
    return { lettre: String.fromCharCode(65 + i), libelle: v.libelle, pourquoi: v.pourquoi, idees: v.idees, lignes, ecartes, complet, paire };
  });
  return {
    phrase,
    idees: l.idees,
    ambigu: l.ambigu && l.ambigu.concept.sens ? { mot: l.ambigu.mot, sens: sensOrdonnes! } : null,
    ignores: l.ignores,
    inconnus: l.inconnus,
    lectures,
  };
}

/** Ce que la combinaison ne fera pas : les idées que chacun couvre seul ne seront pas liées. */
export function limiteDeLaPaire(l: Lecture): string | null {
  if (!l.paire) return null;
  const [a, b] = l.paire;
  const seulA = l.idees.filter((_, k) => a.cases[k] && !b.cases[k]).map((x) => x.mot);
  const seulB = l.idees.filter((_, k) => b.cases[k] && !a.cases[k]).map((x) => x.mot);
  if (!seulA.length || !seulB.length) return null;
  return `« ${seulA.join(', ')} » et « ${seulB.join(', ')} » ne seront pas liés`;
}

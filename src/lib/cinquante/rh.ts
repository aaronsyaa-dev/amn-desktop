/**
 * RH — le lien d'emploi, de l'embauche à la paie (`37a` → `37e`).
 * ═════════════════════════════════════════════════════════════════
 *
 * Cinq moteurs. Trois d'entre eux CROISENT d'autres modules, comme le
 * demandent leurs règles : le trou du Recrutement se lit dans Planning
 * d'équipe (`shifts`), les étapes périmées des Procédures dans Stock
 * (`stockItems`) et Matériel (`resources`), les chantiers des Habilitations
 * dans Interventions (`interventions`). Rien de tout cela n'est saisi à la
 * main dans le module qui l'affiche.
 */

const JOUR_MS = 86_400_000;
const SEMAINE_MS = 7 * JOUR_MS;

/* ══════════════════════════════════════════════════════════════════════════
   37a · RECRUTEMENT — la pièce manquante
   ══════════════════════════════════════════════════════════════════════════ */

/** La semaine de l'équipe : cinq jours sur dix heures (8 h → 18 h). */
export const HEURES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
export const JOURS_OUVRES = [1, 2, 3, 4, 5] as const; // lundi → vendredi
export type Poste = 'matin' | 'apresmidi' | 'journee' | 'repos';
/** Les heures que tient un poste du Planning (mêmes postes que `ShiftsScreen`). */
export const HEURES_DU_POSTE: Record<Poste, number[]> = {
  matin: [8, 9, 10, 11],
  apresmidi: [13, 14, 15, 16],
  journee: [8, 9, 10, 11, 13, 14, 15, 16],
  repos: [],
};
/** Une case de la semaine : « jour-heure », jour 1 (lundi) → 5 (vendredi). */
export const cle = (jour: number, heure: number) => `${jour}-${heure}`;

export interface CreneauPlanning {
  email: string;
  day: string; // AAAA-MM-JJ
  kind: Poste;
}
export interface PosteOuvert {
  kind: 'poste';
  intitule: string;
  publieLe: string;
  /** Interventions refusées faute de bras, depuis la date indiquée. */
  refusees: number;
  refuseesDepuis: string;
  refuseesApresMidi?: boolean;
}
export interface Candidat {
  kind: 'candidat';
  nom: string;
  etape: 'recu' | 'entretien' | 'essai';
  finaliste: boolean;
  /** Disponibilités : cases « jour-heure » de la semaine type. */
  dispo: string[];
  essaiProposeLe?: string;
}
export type EnregistrementRecrutement = PosteOuvert | Candidat;

const jourSemaine = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return ((d.getDay() + 6) % 7) + 1; // 1 = lundi
};
export function lundiDe(d: Date) {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  j.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  return j;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * LE TROU — « se calcule depuis Planning d'équipe, jamais à la main ».
 * Les heures d'ouverture sont celles que l'équipe a tenues au moins une fois
 * sur les quatre semaines précédentes ; le trou, celles d'entre elles que
 * personne ne tient dans la semaine en cours.
 */
export function trouDeLaSemaine(creneaux: CreneauPlanning[], maintenant: Date) {
  const lundi = lundiDe(maintenant);
  const debutHisto = new Date(lundi.getTime() - 4 * SEMAINE_MS);
  const finSemaine = new Date(lundi.getTime() + SEMAINE_MS);
  const ouverture = new Set<string>();
  const tenu = new Set<string>();
  for (const c of creneaux) {
    const d = new Date(`${c.day}T12:00:00`);
    const j = jourSemaine(c.day);
    if (j > 5) continue;
    for (const h of HEURES_DU_POSTE[c.kind] ?? []) {
      if (d >= debutHisto && d < finSemaine) ouverture.add(cle(j, h));
      if (d >= lundi && d < finSemaine) tenu.add(cle(j, h));
    }
  }
  const trou = [...ouverture].filter((k) => !tenu.has(k));
  return { ouverture, tenu, trou: new Set(trou), semaine: isoJour(lundi) };
}

/** « Le pourcentage est heures disponibles ∩ trou / heures du trou. » */
export function comble(dispo: string[], trou: Set<string>) {
  const communes = dispo.filter((k) => trou.has(k));
  return { heures: communes.length, sur: trou.size, pct: trou.size ? Math.round((communes.length / trou.size) * 100) : 0, cases: new Set(communes) };
}

/* ══════════════════════════════════════════════════════════════════════════
   37b · PROCÉDURES — la fiche plastifiée
   ══════════════════════════════════════════════════════════════════════════ */

/** « Corps minimal de 15 px pour les étapes. » */
export const CORPS_ETAPE_PX = 15;
export interface EtapeProcedure {
  texte: string;
  /** Ce que l'étape cite : un article du stock, un matériel, une habilitation. */
  cite?: { type: 'stock' | 'materiel' | 'habilitation'; nom: string };
}
export interface Procedure {
  kind: 'procedure';
  titre: string;
  categorie: string;
  etapes: EtapeProcedure[];
  securite?: string;
  version: number;
  relueLe: string;
  relueePar: string;
}
export type EnregistrementProcedures = Procedure;

const norme = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * « Une étape est périmée quand elle cite un article absent du stock, un
 * matériel sorti du parc ou une habilitation qui n'existe plus : c'est un
 * contrôle mécanique, pas un jugement. »
 */
export function etapePerimee(e: EtapeProcedure, reel: { stock: string[]; materiel: string[]; habilitations: string[] }) {
  if (!e.cite) return null;
  const liste = e.cite.type === 'stock' ? reel.stock : e.cite.type === 'materiel' ? reel.materiel : reel.habilitations;
  const present = liste.some((n) => norme(n) === norme(e.cite?.nom ?? ''));
  if (present) return null;
  return e.cite.type === 'stock' ? 'ce produit n’est plus au stock' : e.cite.type === 'materiel' ? 'ce matériel n’est plus au parc' : 'cette habilitation n’existe plus';
}

/* ══════════════════════════════════════════════════════════════════════════
   37c · FORMATION — la courbe d'oubli
   ══════════════════════════════════════════════════════════════════════════ */

export const SEUIL_RETENTION = 60;
export const HORIZON_SEMAINES = 12;
/** Le rappel est proposé si la courbe prévue passe sous 60 % dans les deux semaines. */
export const RAPPEL_AVANT_J = 14;

export interface Formation {
  kind: 'formation';
  nom: string;
  /** τ par défaut, en semaines, tant qu'aucune personne n'a de rappel mesuré. */
  tauDefautSem: number;
}
export interface Quiz {
  kind: 'quiz';
  formationId: string;
  personne: string;
  le: string;
  score: number; // 0 → 100
  type: 'initial' | 'rappel';
}
export type EnregistrementFormation = Formation | Quiz;

/** « Rétention r(t) = 100 × e^(−t/τ) depuis le dernier quiz. » (t et τ en semaines) */
export const retention = (tSem: number, tauSem: number) => 100 * Math.exp(-Math.max(0, tSem) / tauSem);

/**
 * « τ mesuré à partir des scores successifs de la personne » : à chaque
 * rappel, le score obtenu est ce qui restait du quiz précédent, d'où
 * τ = −Δt / ln(score / 100). On moyenne les rappels mesurés.
 */
export function tauMesure(quiz: Array<Pick<Quiz, 'le' | 'score' | 'type'>>): number | null {
  const q = [...quiz].sort((a, b) => a.le.localeCompare(b.le));
  const taus: number[] = [];
  for (let i = 1; i < q.length; i += 1) {
    if (q[i].type !== 'rappel') continue;
    const dt = (new Date(q[i].le).getTime() - new Date(q[i - 1].le).getTime()) / SEMAINE_MS;
    const s = q[i].score;
    if (dt > 0 && s > 0 && s < 100) taus.push(-dt / Math.log(s / 100));
  }
  return taus.length ? taus.reduce((a, b) => a + b, 0) / taus.length : null;
}

export interface CourbeOubli {
  personne: string;
  tau: number;
  tauMesure: boolean;
  /** Points (semaine depuis le début, rétention). */
  points: Array<{ t: number; r: number }>;
  dernierQuiz: string;
  retentionMaintenant: number;
  /** Semaine (depuis le début) où la courbe passe sous 60 % sans rappel, si c'est déjà arrivé. */
  sousLeSeuilDepuis: number | null;
  rappelPropose: boolean;
}

export function courbes(enr: Array<EnregistrementFormation & { id: string }>, formationId: string, maintenant: Date) {
  const f = enr.find((e): e is Formation & { id: string } => e.kind === 'formation' && e.id === formationId);
  const quiz = enr.filter((e): e is Quiz & { id: string } => e.kind === 'quiz' && e.formationId === formationId);
  if (!f || quiz.length === 0) return { debut: null, courbes: [] as CourbeOubli[], ambre: null as CourbeOubli | null };
  const debut = new Date(quiz.map((q) => q.le).sort()[0]);
  const sem = (iso: string | Date) => ((typeof iso === 'string' ? new Date(iso) : iso).getTime() - debut.getTime()) / SEMAINE_MS;
  const personnes = [...new Set(quiz.map((q) => q.personne))];
  const mesures = new Map(personnes.map((p) => [p, tauMesure(quiz.filter((q) => q.personne === p))]));
  const connus = [...mesures.values()].filter((x): x is number => x !== null).sort((a, b) => a - b);
  const tauDefaut = connus.length ? connus[Math.floor(connus.length / 2)] : f.tauDefautSem;
  const tMaintenant = sem(maintenant);
  const liste: CourbeOubli[] = personnes.map((p) => {
    const siens = quiz.filter((q) => q.personne === p).sort((a, b) => a.le.localeCompare(b.le));
    const tau = mesures.get(p) ?? tauDefaut;
    const points: Array<{ t: number; r: number }> = [];
    const fin = Math.min(HORIZON_SEMAINES, Math.max(tMaintenant, 0));
    siens.forEach((q, i) => {
      const t0 = sem(q.le);
      const t1 = i + 1 < siens.length ? sem(siens[i + 1].le) : fin;
      for (let t = t0; t <= t1 + 1e-9; t += 0.1) points.push({ t, r: retention(t - t0, tau) });
      if (i + 1 < siens.length) points.push({ t: t1, r: 100 }); // la remontée à la verticale
    });
    const dernier = siens[siens.length - 1];
    const tDernier = sem(dernier.le);
    const tCroise = tDernier + tau * Math.log(100 / SEUIL_RETENTION);
    return {
      personne: p,
      tau,
      tauMesure: mesures.get(p) !== null,
      points,
      dernierQuiz: dernier.le,
      retentionMaintenant: retention(tMaintenant - tDernier, tau),
      sousLeSeuilDepuis: tCroise <= tMaintenant ? tCroise : null,
      rappelPropose: tCroise > tMaintenant && (tCroise - tMaintenant) * 7 <= RAPPEL_AVANT_J,
    };
  });
  /** L'ambre : la courbe qui a franchi le seuil sans rappel — la première à l'avoir fait. */
  const ambre = liste.filter((c) => c.sousLeSeuilDepuis !== null).sort((a, b) => (a.sousLeSeuilDepuis ?? 0) - (b.sousLeSeuilDepuis ?? 0))[0] ?? null;
  return { debut, courbes: liste, ambre };
}

/* ══════════════════════════════════════════════════════════════════════════
   37d · HABILITATIONS — le trousseau
   ══════════════════════════════════════════════════════════════════════════ */

export interface Cle {
  habilitation: string;
  echeance: string;
  /** Inscription à un recyclage : la décision est prise, la clé n'est plus ambre. */
  recyclageInscritLe?: string;
}
export interface Detenteur {
  kind: 'personne';
  nom: string;
  cles: Cle[];
}
export interface ChantierPlanifie {
  kind: 'chantier';
  nom: string;
  le: string;
  exige: string[];
  affectes: string[];
}
/** Une règle d'exigence : une intervention dont le titre contient `motif` exige `habilitation`. */
export interface Exigence {
  kind: 'exigence';
  motif: string;
  habilitation: string;
}
export type EnregistrementHabilitations = Detenteur | ChantierPlanifie | Exigence;
export interface InterventionPlanifiee {
  title: string;
  clientName?: string;
  at: string;
  closedAt?: string;
}

export const HORIZON_CHANTIERS_J = 14;

/**
 * Les chantiers des deux prochaines semaines : ceux posés ici, et les
 * interventions planifiées dont le titre appelle une règle d'exigence.
 */
export function chantiersAVenir(enr: EnregistrementHabilitations[], interventions: InterventionPlanifiee[], maintenant: Date) {
  const fin = maintenant.getTime() + HORIZON_CHANTIERS_J * JOUR_MS;
  const dans = (iso: string) => new Date(iso).getTime() >= maintenant.getTime() - JOUR_MS / 2 && new Date(iso).getTime() <= fin;
  const exigences = enr.filter((e): e is Exigence => e.kind === 'exigence');
  const poses = enr.filter((e): e is ChantierPlanifie => e.kind === 'chantier' && dans(e.le));
  const lus = interventions
    .filter((i) => !i.closedAt && dans(i.at))
    .map((i) => ({
      kind: 'chantier' as const,
      nom: i.clientName ? `${i.clientName} · ${i.title}` : i.title,
      le: i.at,
      exige: exigences.filter((x) => norme(`${i.title} ${i.clientName ?? ''}`).includes(norme(x.motif))).map((x) => x.habilitation),
      affectes: [] as string[],
    }));
  return [...poses, ...lus].sort((a, b) => a.le.localeCompare(b.le));
}

/**
 * L'AMBRE — « une clé passe en ambre quand son échéance tombe avant un
 * chantier planifié qui l'exige ». Une clé DÉJÀ échue sans chantier reste
 * grise et cassée ; une clé encore valide qui lâchera la veille d'un chantier
 * est celle qu'il faut recycler.
 */
export function cleQuiLache(personnes: Detenteur[], chantiers: ChantierPlanifie[], maintenant: Date) {
  let pire: { personne: Detenteur; cle: Cle; chantier: ChantierPlanifie } | null = null;
  for (const c of chantiers) {
    for (const hab of c.exige) {
      const concernes = personnes.filter((p) => (c.affectes.length ? c.affectes.includes(p.nom) : true));
      for (const p of concernes) {
        const k = p.cles.find((x) => norme(x.habilitation) === norme(hab));
        if (!k || k.recyclageInscritLe) continue;
        const e = new Date(k.echeance);
        if (e >= maintenant && e < new Date(c.le)) {
          if (!pire || new Date(c.le) < new Date(pire.chantier.le)) pire = { personne: p, cle: k, chantier: c };
        }
      }
    }
  }
  return pire;
}
export const cassee = (k: Cle, maintenant: Date) => new Date(k.echeance) < maintenant;

/* ══════════════════════════════════════════════════════════════════════════
   37e · BULLETINS DE PAIE — le tuyau
   ══════════════════════════════════════════════════════════════════════════ */

/** « Une seule échelle (11 840 € = 150 unités) » : l'entrée fait toujours 150 unités. */
export const TUYAU = { entree: 150, viewBox: { l: 1000, h: 300 }, milieu: 150, xDebut: 60, xFin: 940 } as const;
export interface Bulletin {
  kind: 'bulletin';
  personne: string;
  mois: string; // AAAA-MM
  coutEmployeurCents: number;
  patronalesCents: number;
  salarialesCents: number;
  pasCents: number;
  netCents: number;
  heuresSup?: { coutCents: number; netCents: number };
}
export interface Paie {
  kind: 'paie';
  mois: string;
  virementLe: string;
  valideeLe?: string;
}
export type EnregistrementPaie = Bulletin | Paie;

/**
 * LE TUYAU du mois. Le net est ce qui ARRIVE au bout : coût − patronales −
 * salariales − prélèvement à la source. « La somme des largeurs de sortie
 * égale la largeur d'entrée » — le net est donc calculé, et un bulletin dont
 * le net déclaré ne tombe pas juste est signalé.
 */
export function tuyau(bulletins: Bulletin[]) {
  const s = (f: (b: Bulletin) => number) => bulletins.reduce((x, b) => x + f(b), 0);
  const cout = s((b) => b.coutEmployeurCents);
  const patronales = s((b) => b.patronalesCents);
  const salariales = s((b) => b.salarialesCents);
  const pas = s((b) => b.pasCents);
  const net = cout - patronales - salariales - pas;
  const u = (c: number) => (cout > 0 ? (c / cout) * TUYAU.entree : 0);
  const incoherents = bulletins.filter((b) => b.coutEmployeurCents - b.patronalesCents - b.salarialesCents - b.pasCents !== b.netCents);
  /* Du haut vers le bas du tuyau : patronales (sortent vers le haut), le net, puis les sorties du bas dans l'ordre inverse de leur départ. */
  const haut = TUYAU.milieu - TUYAU.entree / 2;
  const bandes = {
    patronales: { a: haut, b: haut + u(patronales) },
    net: { a: haut + u(patronales), b: haut + u(patronales) + u(net) },
    pas: { a: haut + u(patronales) + u(net), b: haut + u(patronales) + u(net) + u(pas) },
    salariales: { a: haut + u(patronales) + u(net) + u(pas), b: haut + TUYAU.entree },
  };
  return {
    cout,
    patronales,
    salariales,
    pas,
    net,
    largeurs: { patronales: u(patronales), salariales: u(salariales), pas: u(pas), net: u(net) },
    bandes,
    part: (c: number) => (cout ? Math.round((c / cout) * 100) : 0),
    incoherents,
  };
}

/** Une branche qui monte (sortie par le haut) ou qui descend (sortie par le bas). */
export function cheminBranche(a: number, b: number, x0: number, sens: 'haut' | 'bas') {
  const w = b - a;
  const f = (n: number) => n.toFixed(1);
  if (sens === 'haut') {
    return `M${TUYAU.xDebut} ${f(a)} L${x0} ${f(a)} C${x0 + 30} ${f(a)} ${x0 + 30} ${f(Math.max(10, a - 35))} ${x0 + 30} 10 L${f(x0 + 30 + w)} 10 C${f(x0 + 30 + w)} ${f(b - 30)} ${x0 + 40} ${f(b)} ${x0} ${f(b)} L${TUYAU.xDebut} ${f(b)} Z`;
  }
  return `M${TUYAU.xDebut} ${f(a)} L${x0} ${f(a)} C${x0 + 40} ${f(a)} ${f(x0 + 30 + w)} 250 ${f(x0 + 30 + w)} 290 L${x0 + 30} 290 C${x0 + 30} 262 ${x0 + 20} ${f(b)} ${x0} ${f(b)} L${TUYAU.xDebut} ${f(b)} Z`;
}

import type { Famille } from '../../socle/familles';

/**
 * « AUJOURD'HUI » — le fil du jour, automatique, puis modifiable.
 * ════════════════════════════════════════════════════════════════
 *
 * Construit sans React à partir de lignes déjà simplifiées (le hook
 * `useAccueil` lit les collections existantes) :
 *
 *   · les priorités du jour de chacun (`dailyPriorities`) — case RÉELLE :
 *     cocher la sienne la marque faite dans la donnée, comme l'écran
 *     Priorités ; celles des autres se lisent, leur responsable les coche ;
 *   · les rendez-vous du jour — faits quand ils sont passés ou marqués faits ;
 *   · les tâches ouvertes de l'équipe, et celles faites aujourd'hui — case
 *     RÉELLE : cocher passe la tâche à « faite », comme l'écran Tâches ;
 *   · sur un compte vide, les trois étapes pour démarrer.
 *
 * Puis la main de la personne par-dessus, rangée sur ce poste pour la
 * journée : masquer une ligne, ajouter la sienne (cochée sur ce poste).
 *
 * Chaque ligne dit son responsable quand la donnée le connaît, et rien
 * sinon : un rendez-vous n'a pas de responsable enregistré.
 */

export type TypeLigne = 'priorite' | 'rdv' | 'tache' | 'etape' | 'perso';

/** Ce que fait la case : écrire la donnée, retenir sur ce poste, ou rien (lecture seule). */
export type Case = 'donnee' | 'poste' | 'lecture';

export interface LigneFil {
  cle: string;
  type: TypeLigne;
  titre: string;
  /** Une précision courte : l'heure, le statut. */
  detail: string;
  /** Email du responsable, si la donnée le connaît. */
  responsable: string | null;
  fait: boolean;
  case: Case;
  /** Où aller pour agir. */
  vers: string | null;
  famille: Famille;
  /** Pour l'heure des rendez-vous (tri). */
  quand?: string;
}

export interface SourcesFil {
  moi: string;
  priorites: { email: string; id: string; label: string; fait: boolean }[];
  rdv: { id: string; titre: string; quand: string; heure: string; fait: boolean }[];
  taches: { id: string; titre: string; statut: 'todo' | 'doing' | 'done'; responsable: string | null }[];
  /** Les étapes d'un compte vide, `null` sinon. */
  etapes: { client: boolean; rdv: boolean; visite: boolean } | null;
}

export interface RetouchesFil {
  jour: string;
  faits: string[];
  masques: string[];
  ajouts: { cle: string; titre: string }[];
}

export function retouchesVides(jour: string): RetouchesFil {
  return { jour, faits: [], masques: [], ajouts: [] };
}

export interface LibellesFil {
  enCours: string;
  aFaire: string;
  faite: string;
  etapeClient: string;
  etapeRdv: string;
  etapeVisite: string;
}

/** Le fil automatique, sans retouches. */
export function construireFil(s: SourcesFil, l: LibellesFil): LigneFil[] {
  const moi = s.moi.toLowerCase();
  const lignes: LigneFil[] = [];
  if (s.etapes) {
    lignes.push({ cle: 'etape:client', type: 'etape', titre: l.etapeClient, detail: '', responsable: s.moi || null, fait: s.etapes.client, case: 'lecture', vers: '/clients', famille: 'contacts' });
    lignes.push({ cle: 'etape:rdv', type: 'etape', titre: l.etapeRdv, detail: '', responsable: s.moi || null, fait: s.etapes.rdv, case: 'lecture', vers: '/agenda', famille: 'jour' });
    lignes.push({ cle: 'etape:visite', type: 'etape', titre: l.etapeVisite, detail: '', responsable: s.moi || null, fait: s.etapes.visite, case: 'lecture', vers: null, famille: 'outils' });
  }
  // Les miennes d'abord, puis celles des autres.
  const priorites = [...s.priorites].sort((a, b) => Number(b.email.toLowerCase() === moi) - Number(a.email.toLowerCase() === moi));
  for (const p of priorites) {
    const mienne = p.email.toLowerCase() === moi;
    lignes.push({ cle: `priorite:${p.email}:${p.id}`, type: 'priorite', titre: p.label, detail: '', responsable: p.email, fait: p.fait, case: mienne ? 'donnee' : 'lecture', vers: '/priorites', famille: 'jour' });
  }
  for (const r of [...s.rdv].sort((x, y) => x.quand.localeCompare(y.quand))) {
    lignes.push({ cle: `rdv:${r.id}`, type: 'rdv', titre: r.titre, detail: r.heure, responsable: null, fait: r.fait, case: 'lecture', vers: '/agenda', famille: 'jour', quand: r.quand });
  }
  const ordre = { doing: 0, todo: 1, done: 2 } as const;
  for (const t of [...s.taches].sort((x, y) => ordre[x.statut] - ordre[y.statut])) {
    lignes.push({
      cle: `tache:${t.id}`,
      type: 'tache',
      titre: t.titre,
      detail: t.statut === 'doing' ? l.enCours : t.statut === 'done' ? l.faite : l.aFaire,
      responsable: t.responsable,
      fait: t.statut === 'done',
      case: 'donnee',
      vers: '/tasks',
      famille: 'jour',
    });
  }
  return lignes;
}

/** Le fil tel qu'on le montre : retouches du jour appliquées (celles d'un autre jour sont ignorées). */
export function appliquerRetouches(lignes: LigneFil[], r: RetouchesFil, jour: string, moi: string): { visibles: LigneFil[]; masquees: number; faits: number } {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  const perso: LigneFil[] = ret.ajouts.map((a) => ({ cle: a.cle, type: 'perso', titre: a.titre, detail: '', responsable: moi || null, fait: ret.faits.includes(a.cle), case: 'poste', vers: null, famille: 'ecrire' }));
  const toutes = [...lignes, ...perso];
  const visibles = toutes.filter((l) => !ret.masques.includes(l.cle));
  // Ce qui est fait descend en bas, sans changer l'ordre du reste.
  visibles.sort((a, b) => Number(a.fait) - Number(b.fait));
  return { visibles, masquees: toutes.length - visibles.length, faits: visibles.filter((l) => l.fait).length };
}

/** Cocher une ligne « poste » (une ligne à soi). Les autres se cochent dans la donnée. */
export function basculerFait(r: RetouchesFil, jour: string, cle: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  return { ...ret, faits: ret.faits.includes(cle) ? ret.faits.filter((c) => c !== cle) : [...ret.faits, cle] };
}

export function masquer(r: RetouchesFil, jour: string, cle: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  return ret.masques.includes(cle) ? ret : { ...ret, masques: [...ret.masques, cle] };
}

export function toutReafficher(r: RetouchesFil, jour: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  return { ...ret, masques: [] };
}

/** Ajoute une ligne à soi ; un titre vide ou trop long (> 140) est refusé. */
export function ajouter(r: RetouchesFil, jour: string, titre: string, cle: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  const propre = titre.trim().replace(/\s+/g, ' ');
  if (!propre || propre.length > 140) return ret;
  return { ...ret, ajouts: [...ret.ajouts, { cle: `perso:${cle}`, titre: propre }] };
}

/**
 * LE SEUL BOUTON BLANC DE L'ÉCRAN — l'action qui compte maintenant.
 *
 *   1. un point critique → l'ouvrir ;
 *   2. une facture en retard → relancer la plus en retard ;
 *   3. un compte vide → l'étape suivante (« Commencer ») ;
 *   4. sinon la première ligne non faite qui mène quelque part → y aller ;
 *   5. sinon choisir ses priorités du jour.
 */
export type ActionPrincipale =
  | { cle: 'alerte'; titre: string; vers: string }
  | { cle: 'relancer'; nom: string; vers: string }
  | { cle: 'commencer'; titre: string; vers: string }
  | { cle: 'ouvrir'; titre: string; vers: string }
  | { cle: 'priorites'; vers: string };

export function actionPrincipale(alerte: { titre: string; vers: string } | null, enRetard: { nom: string; jours: number }[], visibles: LigneFil[]): ActionPrincipale {
  if (alerte) return { cle: 'alerte', titre: alerte.titre, vers: alerte.vers };
  const pire = [...enRetard].sort((a, b) => b.jours - a.jours)[0];
  if (pire) return { cle: 'relancer', nom: pire.nom, vers: '/relances' };
  const suivante = visibles.find((l) => !l.fait && l.vers);
  if (suivante?.vers) return { cle: suivante.type === 'etape' ? 'commencer' : 'ouvrir', titre: suivante.titre, vers: suivante.vers };
  return { cle: 'priorites', vers: '/priorites' };
}

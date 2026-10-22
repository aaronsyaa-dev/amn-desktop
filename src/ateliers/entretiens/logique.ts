import { ajouterMois, estDateIso, joursEntre } from '../_commun/nombres';

/**
 * VISITES D'ENTRETIEN PÉRIODIQUES — quelle installation visiter, et quand.
 *
 *   prochaine visite = dernière visite + périodicité (en mois ; un 31 qui
 *                      n'existe pas devient le dernier jour du mois)
 *
 * L'état se lit par rapport au jour donné, dans cet ordre :
 *
 *   retard  — la prochaine visite est passée (strictement avant aujourd'hui) ;
 *   ceMois  — elle tombe dans le mois en cours, aujourd'hui compris ;
 *   bientot — elle tombe dans les 30 jours qui viennent (mois suivant) ;
 *   aJour   — plus tard.
 *
 * « À planifier » = retard + ce mois-ci, regroupés par commune pour en faire
 * une tournée. Rien ici ne dit quelle visite est OBLIGATOIRE : la périodicité
 * est celle du contrat, saisie par l'artisan.
 */
export const TYPES = ['chaudiere', 'pompeAChaleur', 'climatisation', 'vmc', 'extincteurs', 'adoucisseur'] as const;
export type TypeInstallation = (typeof TYPES)[number];

export interface Installation {
  id: string;
  client: string;
  type: TypeInstallation;
  commune: string;
  /** AAAA-MM-JJ */
  derniereVisite: string;
  periodiciteMois: number;
}

export type EtatVisite = 'retard' | 'ceMois' | 'bientot' | 'aJour';
export const ETATS: readonly EtatVisite[] = ['retard', 'ceMois', 'bientot', 'aJour'];

export type ErreurInstallation = 'client' | 'commune' | 'date' | 'dateFuture' | 'periodicite';

export function verifierInstallation(i: Omit<Installation, 'id'>, aujourdhui: string): ErreurInstallation[] {
  const fautes: ErreurInstallation[] = [];
  if (!i.client.trim()) fautes.push('client');
  if (!i.commune.trim()) fautes.push('commune');
  if (!estDateIso(i.derniereVisite)) fautes.push('date');
  else if (joursEntre(aujourdhui, i.derniereVisite) > 0) fautes.push('dateFuture');
  if (!(Number.isInteger(i.periodiciteMois) && i.periodiciteMois >= 1 && i.periodiciteMois <= 120)) fautes.push('periodicite');
  return fautes;
}

export function prochaineVisite(i: Pick<Installation, 'derniereVisite' | 'periodiciteMois'>): string {
  return ajouterMois(i.derniereVisite, i.periodiciteMois);
}

export function etatVisite(i: Pick<Installation, 'derniereVisite' | 'periodiciteMois'>, aujourdhui: string): EtatVisite {
  const p = prochaineVisite(i);
  const ecart = joursEntre(aujourdhui, p);
  if (ecart < 0) return 'retard';
  if (p.slice(0, 7) === aujourdhui.slice(0, 7)) return 'ceMois';
  if (ecart <= 30) return 'bientot';
  return 'aJour';
}

export function compter(liste: readonly Installation[], aujourdhui: string): Record<EtatVisite, number> {
  const n: Record<EtatVisite, number> = { retard: 0, ceMois: 0, bientot: 0, aJour: 0 };
  for (const i of liste) n[etatVisite(i, aujourdhui)] += 1;
  return n;
}

/** Les visites à faire (retard et ce mois-ci), par commune, la plus en retard d'abord dans chaque commune. */
export function aPlanifier(liste: readonly Installation[], aujourdhui: string): { commune: string; installations: Installation[] }[] {
  const parCommune = new Map<string, Installation[]>();
  for (const i of liste) {
    const e = etatVisite(i, aujourdhui);
    if (e !== 'retard' && e !== 'ceMois') continue;
    const cle = i.commune.trim();
    parCommune.set(cle, [...(parCommune.get(cle) ?? []), i]);
  }
  return [...parCommune.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([commune, installations]) => ({ commune, installations: installations.sort((a, b) => prochaineVisite(a).localeCompare(prochaineVisite(b))) }));
}

/** Note les visites faites le jour donné ; les autres installations ne bougent pas. */
export function marquerFaites(liste: readonly Installation[], ids: ReadonlySet<string>, jour: string): Installation[] {
  if (!estDateIso(jour)) throw new Error(`date illisible : ${jour}`);
  return liste.map((i) => (ids.has(i.id) ? { ...i, derniereVisite: jour } : i));
}

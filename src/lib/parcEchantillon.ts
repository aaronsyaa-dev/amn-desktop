import { bridge } from './bridge';
import type { AdminOrganization, ParcOrganization } from '../shared/api';

/**
 * L'ÉCHANTILLON DU PARC (Bloc 4) — les organisations les plus actives, jamais toutes.
 *
 * Quatre écrans (Comparatif, Maturité SOC, Alertes personnalisées, Rapport
 * client) et le rail lisaient la liste ENTIÈRE des organisations : mesuré à
 * 100 000, 2,6 s et 48 Mo par lecture, puis un pouls par organisation. Ils
 * lisent désormais les deux cents plus actives — c'est ce qu'ils regardent
 * vraiment — et le disent. Le parc entier se cherche et se filtre dans le
 * registre, page par page.
 */
export const ECHANTILLON_PARC = 200;

/*
  LES LOGOS, DEMANDÉS À PART — et pourquoi ce fichier les avait perdus.

  La page du parc ne transporte pas le logo (jusqu'à 48 Ko par ligne) ; ce
  fichier le mettait à `null`, et le rail, la Vue d'ensemble et le dossier
  ont perdu leurs images à la 1.2.44 alors que la base les avait toujours.
  Désormais la page dit `hasLogo`, et on demande les logos des seules
  organisations qui en ont, cent par appel, en gardant ce qu'on a déjà reçu :
  cinq écrans lisent l'échantillon, un seul aller-retour par logo suffit.
*/
const logosConnus = new Map<string, string | null>();

async function completerLogos(lignes: ParcOrganization[]): Promise<Map<string, string | null>> {
  const manquants = lignes.filter((o) => o.hasLogo && !logosConnus.has(o.id)).map((o) => o.id);
  for (let i = 0; i < manquants.length; i += 100) {
    const lot = manquants.slice(i, i + 100);
    try {
      const logos = await bridge().remote.admin.organizationLogos(lot);
      for (const id of lot) logosConnus.set(id, logos[id] ?? null);
    } catch {
      // Sans logos on garde les initiales ; l'échantillon lui-même n'est pas en cause.
    }
  }
  // Un logo retiré ou changé : la page le dit (`hasLogo`), la mémoire suit.
  for (const o of lignes) if (!o.hasLogo) logosConnus.delete(o.id);
  return logosConnus;
}

/** Oublier un logo mémorisé — après l'avoir changé ou retiré depuis le dossier. */
export function oublierLogo(id: string): void {
  logosConnus.delete(id);
}

function commeAdmin(o: ParcOrganization, logoDataUrl: string | null): AdminOrganization {
  return {
    id: o.id,
    name: o.name,
    plan: o.plan,
    status: o.status,
    logoDataUrl,
    trade: o.trade,
    language: o.language,
    seats: o.seats,
    userCount: o.userCount,
    lastActivityAt: o.lastActivityAt,
    createdAt: o.createdAt,
  };
}

export async function echantillonParc(limite = ECHANTILLON_PARC): Promise<AdminOrganization[]> {
  const admin = bridge().remote.admin;
  const lignes: ParcOrganization[] = [];
  let cursor: string | null = null;
  while (lignes.length < limite) {
    const page = await admin.organizationsPage({ sort: 'activity', limit: Math.min(100, limite - lignes.length), cursor });
    lignes.push(...page.organizations);
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  const clientes = lignes.filter((o) => o.plan !== 'internal');
  const logos = await completerLogos(clientes);
  return clientes.map((o) => commeAdmin(o, logos.get(o.id) ?? null));
}

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

function commeAdmin(o: ParcOrganization): AdminOrganization {
  return {
    id: o.id,
    name: o.name,
    plan: o.plan,
    status: o.status,
    logoDataUrl: null,
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
  return lignes.filter((o) => o.plan !== 'internal').map(commeAdmin);
}

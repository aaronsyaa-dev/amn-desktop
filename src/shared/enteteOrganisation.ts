/** L'en-tête `X-AMN-Org` d'une requête de données — vide quand l'organisation n'est pas connue. */
export function enteteOrganisation(org: string | null | undefined): Record<string, string> {
  return org ? { 'X-AMN-Org': org } : {};
}

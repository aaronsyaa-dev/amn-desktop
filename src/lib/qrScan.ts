const API_BASE = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');

/**
 * SIGNALER UN SCAN DE QR CODE — depuis une page PUBLIQUE, sans session.
 *
 * Le module QR codes (`20c`) affiche un compteur de scans. Ce compteur ne peut
 * pas être tenu par le poste : celui qui scanne est un passant avec un
 * téléphone, il n'a aucun compte, et la seule trace de son passage est
 * l'ouverture de l'adresse encodée dans le code.
 *
 * Le code gardé porte donc son identifiant dans son adresse (`?qr=<id>`), et
 * c'est la page publique — celle-ci — qui prévient le serveur.
 *
 * TROIS PRÉCAUTIONS :
 *
 *   · UNE FOIS PAR OUVERTURE DE PAGE, jamais par rendu. Le marqueur de session
 *     empêche qu'un re-rendu, un retour en arrière ou un rechargement d'onglet
 *     gonfle le compteur. Ce n'est pas une mesure d'audience : c'est « ce code
 *     a-t-il servi ».
 *   · SILENCIEUSE. Un échec réseau ne doit RIEN faire de visible : la personne
 *     est venue prendre un rendez-vous, pas alimenter une statistique. On
 *     avale l'erreur, et le compteur rate un scan — ce qui est infiniment
 *     moins grave qu'une page qui affiche une erreur incompréhensible.
 *   · SANS DONNÉE. Aucun corps, aucun identifiant de visiteur, aucun agent :
 *     la route serveur n'accepte que d'incrémenter.
 */
export function signalerLeScan(orgId: string): void {
  if (!API_BASE || !orgId) return;
  const hash = window.location.hash;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.slice(1);
  const code = (new URLSearchParams(query).get('qr') ?? '').trim();
  if (!code) return;
  const marque = `qr-scan:${orgId}:${code}`;
  try {
    if (window.sessionStorage.getItem(marque)) return;
    window.sessionStorage.setItem(marque, '1');
  } catch {
    /* Navigation privée, stockage refusé : on compte quand même, une fois de
       trop vaut mieux que pas du tout. */
  }
  void fetch(`${API_BASE}/v1/qr/${encodeURIComponent(orgId)}/${encodeURIComponent(code)}/scan`, {
    method: 'POST',
  }).catch(() => undefined);
}

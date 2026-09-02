/**
 * LA GRÂCE DU SERVEUR QUI REDÉMARRE (Bloc 8).
 *
 * amn-api tourne sur une instance qui s'endort quand personne ne lui parle et
 * met quelques secondes à se réveiller. Pendant ce temps, le mandataire
 * devant elle répond 502 ou 503 — et l'application affichait ce chiffre tel
 * quel, en anglais, à une cliente qui n'a rien fait d'autre qu'ouvrir son
 * espace. Un serveur qui se réveille n'est pas une panne : c'est une attente,
 * et une attente se dit en français, puis se résout toute seule.
 *
 * Ce module est PARTAGÉ entre le process main d'Electron et le navigateur,
 * comme le reste de `src/shared/` : la même règle des deux côtés, pas deux
 * copies qui divergent.
 *
 * Trois règles, courtes :
 *
 *   1. On ne réessaie que ce qui est SANS EFFET — les lectures. Une écriture
 *      qui n'a pas reçu de réponse est peut-être passée ; la rejouer
 *      dupliquerait. Les écritures ont leur propre file (lib/fileEnvoi.ts).
 *   2. On ne réessaie que sur un serveur ABSENT : 502, 503, 504, ou pas de
 *      réponse du tout. Un 500 est une erreur du serveur qui a répondu ; on
 *      la montre.
 *   3. Trois reprises espacées, puis on cesse et on le dit — en trois parties,
 *      comme toute erreur de la maison : ce qui s'est passé, ce que ça
 *      signifie, ce qu'on peut faire.
 */

/** Les délais avant chaque reprise. Leur somme borne l'attente : un peu plus de six secondes. */
export const DELAIS_REPRISE_MS = [800, 2000, 3600] as const;

/** Les codes qui disent « le serveur n'est pas là », pas « le serveur refuse ». */
export function serveurAbsent(statut: number): boolean {
  return statut === 502 || statut === 503 || statut === 504;
}

/** L'attente, dite pendant qu'elle dure. Même mot dans le bandeau et dans la pastille. */
export const MESSAGE_REPRISE = 'Le serveur redémarre — reconnexion en cours.';

/**
 * L'erreur de dernier recours, quand les reprises n'ont pas suffi. Trois
 * parties. Le code HTTP y figure en dernier, entre parenthèses : c'est le
 * fait brut, utile à qui appelle son prestataire, jamais le titre.
 */
export function messageServeurAbsent(statut?: number): string {
  const fait = statut ? `Le serveur n’a pas répondu (${statut}).` : 'Le serveur n’a pas répondu.';
  return `${fait} Rien n’est perdu : vos données sont en sécurité et cet écran n’a simplement pas pu se rafraîchir. Réessayez dans un instant.`;
}

/**
 * Exécute une lecture avec reprises. `tenter` rend soit un résultat, soit
 * `{ statut }` quand le serveur a répondu absent, soit lève si rien n'est
 * arrivé. `signaler` reçoit `true` à la première reprise et `false` à la fin,
 * quelle qu'elle soit — c'est ce qui allume et éteint « reconnexion en
 * cours » à l'écran.
 */
export async function avecReprise<T>(
  tenter: () => Promise<{ ok: true; valeur: T } | { ok: false; statut: number }>,
  options: { signaler?: (enCours: boolean) => void; attendre?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const attendre = options.attendre ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let enCours = false;
  const allumer = () => {
    if (enCours) return;
    enCours = true;
    options.signaler?.(true);
  };
  const eteindre = () => {
    if (!enCours) return;
    enCours = false;
    options.signaler?.(false);
  };
  let dernierStatut: number | undefined;
  try {
    for (let i = 0; i <= DELAIS_REPRISE_MS.length; i += 1) {
      let resultat: { ok: true; valeur: T } | { ok: false; statut: number };
      try {
        resultat = await tenter();
      } catch (err) {
        // Pas de réponse du tout : réseau coupé, ou serveur pas encore levé.
        if (i === DELAIS_REPRISE_MS.length) throw err;
        allumer();
        await attendre(DELAIS_REPRISE_MS[i]);
        continue;
      }
      if (resultat.ok) return resultat.valeur;
      dernierStatut = resultat.statut;
      if (!serveurAbsent(resultat.statut) || i === DELAIS_REPRISE_MS.length) break;
      allumer();
      await attendre(DELAIS_REPRISE_MS[i]);
    }
    throw new Error(messageServeurAbsent(dernierStatut));
  } finally {
    eteindre();
  }
}

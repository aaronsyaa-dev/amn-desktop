/**
 * Ce qui protège l'application d'un enregistrement mal formé.
 *
 * ## Le bug qui a motivé ce module
 *
 * Un client — « Elie Sy » — était visible dans la liste mais ne pouvait ni
 * s'ouvrir ni se supprimer. Deux défauts distincts, tous deux de la même
 * famille : une donnée stockée qui ne correspond plus à ce que le code croit
 * lire, et personne pour le constater entre les deux.
 *
 * ## La règle : un enregistrement se DÉCODE, il ne se lit pas
 *
 * `row.status ?? 'prospect'` a l'air d'une garde. Ce n'en est pas une : elle
 * ne protège que de l'ABSENCE. Une valeur présente mais hors du domaine — un
 * statut `"client"` là où le type dit `'active' | 'paused' | 'prospect'` —
 * traverse la garde intacte, arrive dans un `STATUS_META[status].label`, et
 * fait tomber l'écran entier sur un `undefined`. Le cast `as AppointmentStatus`
 * est pire encore : il affirme au compilateur ce que la donnée ne garantit pas.
 *
 * `oneOf` est la garde qui manquait. Elle est délibérément placée au point de
 * DÉCODAGE de chaque collection, et pas aux endroits qui affichent : il y a un
 * décodage par module et des dizaines d'affichages, et l'histoire de ce dépôt
 * montre qu'on en oublie toujours un.
 *
 * ## Pourquoi ne pas simplement écarter la ligne fautive
 *
 * Parce qu'un enregistrement qu'on n'affiche pas est un enregistrement qu'on
 * ne peut plus supprimer — c'est le second demi-bug d'Elie Sy, et le remède
 * serait la maladie. Une donnée abîmée doit rester VISIBLE et MANIPULABLE,
 * quitte à être affichée de façon dégradée.
 */

/**
 * Ramène une valeur inconnue dans un domaine fermé.
 *
 * Tout ce qui n'est pas exactement l'une des valeurs attendues — autre casse,
 * autre orthographe, nombre, objet, valeur d'une version antérieure du
 * produit — devient la valeur de repli. Le reste du code peut alors indexer
 * ses tables sans garde, parce que la garantie a déjà été donnée ici.
 */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Lit une table de correspondance avec un repli explicite.
 *
 * La deuxième ligne de défense, pour les rares endroits qui indexent une table
 * directement avec une valeur venue de la base. `oneOf` au décodage devrait
 * suffire ; celle-ci existe pour que l'oubli d'une garde de décodage, le jour
 * où un champ énuméré s'ajoute, produise une pastille neutre et non un écran
 * blanc.
 */
export function metaOf<T>(map: Record<string, T>, key: string | undefined, fallback: T): T {
  return (key !== undefined && map[key]) || fallback;
}

/**
 * L'identifiant NUMÉRIQUE d'un enregistrement dont la clé est une chaîne.
 *
 * ## Le cœur du bug « Elie Sy »
 *
 * `Client.id` est un nombre dans tout le produit (devis, factures, tâches et
 * rapports s'y réfèrent), mais la clé d'un enregistrement synchronisé est une
 * CHAÎNE. La conversion se faisait par `Number(row.id)`, et l'écriture par le
 * chemin inverse, `String(id)`. L'aller-retour n'est fidèle que si la clé est
 * un nombre écrit en décimal.
 *
 * Or le miroir SQLite des postes Electron (`src/main/clientsSync.ts`) écrit des
 * clés de la forme `client-<uuid>`, pour que deux postes numérotant chacun
 * leurs clients à partir de 1 n'entrent pas en collision. `Number()` en fait
 * donc `NaN`, et à partir de là :
 *
 *   - `clients.find((c) => c.id === selectedId)` ne trouve JAMAIS la fiche,
 *     puisque `NaN === NaN` est faux — le client ne peut pas être consulté ;
 *   - `remove('clients', String(NaN))` efface un enregistrement d'identifiant
 *     `"NaN"`, qui n'existe pas — le client ne peut pas être supprimé.
 *
 * Le vrai correctif est de ne plus jamais reconstruire la clé à partir du
 * nombre : les écritures passent désormais par le `recordId` conservé tel
 * quel. Ce nombre-ci ne sert plus qu'aux références croisées historiques et à
 * la sélection à l'écran — il doit seulement être STABLE et UNIQUE.
 *
 * Il est donc rendu NÉGATIF : aucun identifiant légitime ne l'est (ils
 * viennent d'un `AUTOINCREMENT` ou de l'horloge), la collision avec un vrai
 * client est donc impossible par construction, et non « improbable ».
 */
export function numericId(recordId: string): number {
  // Une clé déjà numérique garde sa valeur : c'est le cas courant, et les
  // références croisées existantes doivent continuer de fonctionner.
  if (/^\d+$/.test(recordId)) {
    const parsed = Number(recordId);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  // FNV-1a 32 bits — court, sans dépendance, et surtout STABLE d'une session à
  // l'autre : un identifiant qui changerait au rechargement rouvrirait le bug
  // sous une autre forme.
  let hash = 0x811c9dc5;
  for (let i = 0; i < recordId.length; i += 1) {
    hash ^= recordId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return -((hash >>> 0) + 1);
}

/**
 * Résout les collisions entre identifiants dérivés, sur une liste complète.
 *
 * `numericId` est un hachage : deux clés distinctes PEUVENT tomber sur le même
 * nombre. C'est très rare, mais « très rare » sur une fusion de deux fiches
 * clients n'est pas un niveau de garantie acceptable — c'est exactement le
 * genre d'approximation qui a produit le bug d'origine. On décale donc le
 * doublon jusqu'à trouver un nombre libre, ce qui rend l'unicité certaine.
 */
export function assignUniqueIds<T>(rows: T[], recordIdOf: (row: T) => string): Map<string, number> {
  const byRecord = new Map<string, number>();
  const taken = new Set<number>();
  // Trié par clé : l'attribution ne doit pas dépendre de l'ordre d'arrivée des
  // enregistrements, qui varie d'une synchronisation à l'autre.
  for (const recordId of rows.map(recordIdOf).sort()) {
    if (byRecord.has(recordId)) continue;
    let candidate = numericId(recordId);
    while (taken.has(candidate)) candidate -= 1;
    taken.add(candidate);
    byRecord.set(recordId, candidate);
  }
  return byRecord;
}

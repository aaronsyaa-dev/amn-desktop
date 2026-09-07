import type { RemoteRecord } from '../shared/api';

/**
 * Le plafond du miroir local, et la reprise de place quand il est atteint.
 *
 * Module SANS dépendance à React ni au navigateur — comme `outbox.ts`, et
 * pour la même raison : il s'exécute tel quel sous Node, donc
 * `scripts/check-mirror-budget.ts` teste le vrai code plutôt qu'une copie.
 *
 * ## Le problème que ça règle
 *
 * `localStorage` plafonne autour de 5 Mo pour toute l'origine, et le miroir
 * de synchronisation y écrit chaque collection. Une photo redimensionnée à
 * 1600 px pèse 250 à 700 Ko une fois convertie en data URL : une dizaine de
 * médias saturent le stockage de l'application entière.
 *
 * Ce qui casse alors n'est pas seulement l'affichage hors ligne des photos.
 * La FILE D'ATTENTE hors ligne vit dans le même stockage : quand il est
 * plein, une écriture faite sans réseau ne peut plus y être déposée, et elle
 * disparaît en silence. C'est exactement ce que la file existe pour empêcher.
 *
 * D'où la règle, en une phrase : **le miroir est un cache que le serveur peut
 * toujours refournir ; la file est une intention que personne ne sait
 * retrouver.** Quand les deux ne tiennent pas ensemble, c'est le cache qui
 * saute.
 */

/**
 * Ce qu'une collection a le droit d'occuper. Les collections de texte ne
 * l'atteignent jamais ; `media` l'atteint tout de suite, et c'est le but.
 */
export const MIRROR_BUDGET_BYTES = 1_200_000;

/** Le sous-ensemble de `Storage` dont la reprise a besoin — remplaçable en test. */
export interface MirrorStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

/**
 * Tronque une collection au budget, les plus récents d'abord.
 *
 * Tronquer est sans perte : `pullAll` remplit le miroir depuis amn-api à
 * chaque démarrage, donc les enregistrements écartés réapparaissent dès que
 * la synchronisation a répondu — ils sont seulement absents de la toute
 * première image affichée.
 *
 * L'ordre n'est pas un détail. Un enregistrement créé hors ligne porte la
 * date du moment : il est le plus récent, donc le dernier à être écarté, et
 * c'est précisément celui qu'on ne peut pas se permettre de perdre de vue.
 */
export function fitToBudget(
  records: RemoteRecord[],
  budget: number = MIRROR_BUDGET_BYTES,
): RemoteRecord[] {
  if (JSON.stringify(records).length <= budget) return records;

  const recentFirst = [...records].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  const kept: RemoteRecord[] = [];
  let size = 2; // les crochets du tableau
  for (const record of recentFirst) {
    const cost = JSON.stringify(record).length + 1; // + la virgule
    if (size + cost > budget) break;
    kept.push(record);
    size += cost;
  }
  return kept;
}

/**
 * Efface le plus gros miroir et dit si elle a jeté quelque chose.
 *
 * Rendue à la file d'attente, qui la rappelle tant qu'elle libère : une
 * écriture en partance vaut plus que n'importe quel cache. Le `false` final
 * est ce qui empêche la boucle infinie quand il n'y a plus rien à jeter.
 */
export function reclaimLargest(storage: MirrorStorage, prefix: string): boolean {
  try {
    let biggest: string | null = null;
    let biggestSize = 0;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const size = (storage.getItem(key) ?? '').length;
      if (size > biggestSize) {
        biggest = key;
        biggestSize = size;
      }
    }
    // Une clé vide ne libère rien : la rendre `true` ferait tourner la file
    // en rond sur des miroirs de taille nulle.
    if (!biggest || biggestSize === 0) return false;
    storage.removeItem(biggest);
    return true;
  } catch {
    return false;
  }
}

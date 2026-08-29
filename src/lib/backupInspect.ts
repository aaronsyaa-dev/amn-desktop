/**
 * LIRE UNE SAUVEGARDE, ET DIRE CE QU'ELLE VAUT
 * ════════════════════════════════════════════
 *
 * Module SANS AUCUN IMPORT, et ce n'est pas un hasard : `scripts/check-sauvegarde.ts`
 * le charge tel quel depuis les sources. `backup.ts`, lui, tire le pont, le
 * téléchargement et l'édition — donc un littéral posé à la compilation — et
 * n'aurait pas pu être éprouvé hors application.
 *
 * ## Le défaut que ça répare
 *
 * Le bouton « Exporter mes données » téléchargeait un fichier, et l'histoire
 * s'arrêtait là. Une sauvegarde qu'on ne peut pas RELIRE est une promesse
 * qu'on ne découvre fausse qu'au moment où l'on en a besoin — c'est-à-dire le
 * jour où l'on a déjà tout perdu par ailleurs. Et le cas n'est pas théorique :
 * l'export local de repli a longtemps couvert neuf collections sur vingt-six,
 * sous un bouton qui promettait tout. Quelqu'un a pu ranger ce fichier-là.
 *
 * ## Pourquoi ça ne RESTAURE pas
 *
 * Parce que réinjecter demande des règles que personne n'a encore tranchées :
 * on écrase, on fusionne, et qui gagne quand les deux côtés ont bougé. Un
 * import approximatif détruit un vrai carnet de clientes pour rendre un
 * fichier ; ce n'est pas un arbitrage à prendre à la légère, et sûrement pas
 * à prendre seul. Ce qui est fait ici est la moitié qui ne peut rien casser,
 * et c'est aussi celle qui manquait vraiment : SAVOIR si le fichier qu'on
 * garde vaut quelque chose.
 *
 * Tout se passe dans l'appareil. Le fichier n'est envoyé nulle part — ce
 * serait le comble pour un outil dont l'objet est de rendre des données.
 *
 * L'ordre des avertissements est celui de la gravité : le premier est celui
 * qu'on lira si on n'en lit qu'un.
 */
export type RapportSauvegarde = {
  /**
   * `serveur` — l'export complet, celui qui fait foi.
   * `local` — l'instantané de repli d'un poste sans serveur : partiel par
   * construction, et c'est précisément ce qu'il faut dire.
   * `null` — ce fichier n'est pas des nôtres.
   */
  origine: 'serveur' | 'local' | null;
  organisation: string | null;
  exporteLe: string | null;
  ageJours: number | null;
  collections: { nom: string; total: number; supprimes: number }[];
  totalFiches: number;
  supervision: { incidents: number; etouffoirs: number; maintenances: number } | null;
  /** Ce que le serveur n'a PAS pu lire au moment de l'export. */
  sectionsManquantes: string[];
  avertissements: string[];
  /**
   * L'INTITULÉ, ET CE QU'IL A LE DROIT D'AFFIRMER.
   *
   * Il vit ici, et pas dans le JSX, parce que c'est une RÈGLE et non une mise
   * en forme : « Sauvegarde complète » affirme une qualité, et ne s'obtient
   * qu'en l'ayant méritée — fichier reconnu du serveur, et pas un seul
   * avertissement. Sinon l'intitulé dit seulement d'où vient le fichier, et
   * laisse les avertissements parler.
   *
   * Le premier jet le calculait dans l'écran, et affichait donc « Sauvegarde
   * complète » juste au-dessus de « ne contient aucune fiche » et « a 400
   * jours ». Le mot le plus gros de l'encadré démentait les trois lignes en
   * dessous — c'est le même défaut que la salutation d'accueil qui disait « la
   * nuit est calme » au-dessus de douze sites hors ligne, et il se répare de
   * la même façon : le défaut penche du côté qui ne rassure pas.
   */
  titre: string;
};

/** Au-delà, une sauvegarde a vieilli assez pour qu'on le dise. */
export const SAUVEGARDE_AGE_ALERTE_JOURS = 90;

/*
  Trois lectures prudentes, et rien d'autre.

  Le document vient d'un FICHIER que quelqu'un a choisi sur son disque : il
  peut être ancien, tronqué, ou n'avoir jamais été des nôtres. Chaque champ est
  donc lu avec sa forme attendue, et vaut « absent » sinon. C'est ce qui permet
  à l'inspecteur de ne jamais lever, y compris sur un fichier abîmé.
*/
type Champ = Record<string, unknown>;
const objet = (v: unknown): Champ | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Champ) : null;
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texte = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function compterCollections(brut: unknown): RapportSauvegarde['collections'] {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return [];
  return Object.entries(brut as Record<string, unknown>)
    .filter(([, v]) => Array.isArray(v))
    .map(([nom, v]) => {
      const lignes = v as { deleted?: unknown }[];
      return {
        nom,
        total: lignes.length,
        supprimes: lignes.filter((l) => l && typeof l === 'object' && l.deleted === true).length,
      };
    })
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom));
}

export function inspecterSauvegarde(brut: unknown, maintenant = new Date()): RapportSauvegarde {
  const doc = objet(brut) ?? {};

  const origine: RapportSauvegarde['origine'] =
    doc.kind === 'amn-export' ? 'serveur' : doc.kind === 'amn-backup' ? 'local' : null;

  // L'export serveur range ses fiches sous `collections`, l'instantané local
  // sous `data`. Deux formats, un seul décompte — c'est justement quand on
  // relit un vieux fichier qu'on ne sait plus lequel on tient.
  const collections = compterCollections(origine === 'local' ? doc.data : doc.collections);
  const totalFiches = collections.reduce((n, c) => n + c.total, 0);

  const exporteLe = texte(doc.exportedAt);
  const instant = exporteLe ? Date.parse(exporteLe) : NaN;
  const ageJours = Number.isFinite(instant)
    ? Math.floor((maintenant.getTime() - instant) / 86_400_000)
    : null;

  const sup = objet(doc.supervision);
  const supervision = sup
    ? {
        incidents: liste(sup.incidents).length,
        etouffoirs: liste(sup.suppressions).length,
        maintenances: liste(sup.maintenance).length,
      }
    : null;

  const sectionsManquantes = liste(doc.unavailable).filter((x): x is string => typeof x === 'string');

  const avertissements: string[] = [];
  if (origine === null) {
    avertissements.push(
      'Ce fichier n’est pas une sauvegarde de cette application — rien n’a pu en être lu.',
    );
  } else {
    // Le pire cas d'abord : un fichier bien formé, rangé en lieu sûr, et vide.
    if (totalFiches === 0) {
      avertissements.push('Cette sauvegarde ne contient aucune fiche. Refaites-en une.');
    }
    if (sectionsManquantes.length > 0) {
      const plusieurs = sectionsManquantes.length > 1;
      avertissements.push(
        plusieurs
          ? `Incomplète : les sections « ${sectionsManquantes.join(' », « ')} » n’ont pas pu être ` +
            'lues au moment de l’export.'
          : `Incomplète : la section « ${sectionsManquantes[0]} » n’a pas pu être lue au moment ` +
            'de l’export.',
      );
    }
    if (origine === 'local') {
      avertissements.push(
        'Copie de repli, faite sans le serveur : elle ne couvre qu’une partie de vos données. ' +
          'Refaites-en une une fois connectée.',
      );
    }
    if (sup?.incidentsTronques === true) {
      avertissements.push('La liste des incidents a été tronquée : elle n’est pas complète.');
    }
    if (ageJours === null) {
      avertissements.push('Ce fichier ne dit pas quand il a été fait.');
    } else if (ageJours > SAUVEGARDE_AGE_ALERTE_JOURS) {
      avertissements.push(`Cette sauvegarde a ${ageJours} jours. Tout ce qui a suivi en est absent.`);
    }
  }

  const titre =
    origine === null
      ? 'Fichier non reconnu'
      : origine === 'local'
        ? 'Copie de repli'
        : avertissements.length === 0
          ? 'Sauvegarde complète'
          : 'Export du serveur';

  return {
    titre,
    origine,
    organisation: texte(objet(doc.organization)?.name),
    exporteLe,
    ageJours,
    collections,
    totalFiches,
    supervision,
    sectionsManquantes,
    avertissements,
  };
}

/**
 * CHERCHER UN MODULE EN DÉCRIVANT SON BESOIN — sans connaître son nom.
 *
 * Une cliente qui découvre le produit ne tape pas « Relances » : elle tape
 * « relancer mes factures impayées », « le planning de mon équipe »,
 * « encaisser par carte ». La recherche d'origine comparait la phrase
 * ENTIÈRE à la fiche du module : trois mots de plus qu'un nom, et plus rien.
 *
 * Ici, la phrase est découpée en mots utiles (les petits mots et les
 * formules de politesse tombent), chaque mot est réduit à sa racine (les six
 * premières lettres : « facture », « factures », « facturation » se
 * rejoignent) et quelques mots du quotidien appellent leurs équivalents
 * (« impayé » cherche aussi « relance »). Un module correspond quand au
 * moins la moitié des mots utiles se retrouvent dans son nom, sa phrase, son
 * « pour qui » ou son exemple ; le score sert à ranger les résultats.
 */

const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const VIDES = new Set(
  'le la les l un une des de du d et ou a au aux en dans sur sous pour par avec sans mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je j tu il elle on nous vous ils elles me moi qui que quoi quel quelle quels quelles ce cet cette ces est sont etre avoir faire veux voudrais aimerais souhaite besoin outil module logiciel application appli truc chose comment pouvoir peux peut plus tout tous toutes bien tres aussi qu n ne pas'.split(' '),
);

/* Quelques mots du quotidien et ce qu'ils appellent dans les fiches. Court, et voulu tel : un mot par besoin fréquent. */
const EQUIVALENTS: Record<string, string[]> = {
  impaye: ['relanc', 'factur', 'retard'],
  relancer: ['relanc'],
  payer: ['paiem', 'factur', 'encais'],
  encaisser: ['caisse', 'paiem', 'encais'],
  carte: ['paiem', 'caisse', 'encais'],
  rdv: ['rendez', 'agenda'],
  rendez: ['agenda', 'rendez'],
  horaire: ['planni', 'agenda'],
  planning: ['planni', 'agenda'],
  conge: ['absenc'],
  vacance: ['absenc'],
  salaire: ['bullet', 'paie'],
  paie: ['bullet', 'salair'],
  salarie: ['person', 'equipe', 'membre'],
  employe: ['person', 'equipe', 'membre'],
  equipe: ['equipe', 'membre', 'planni'],
  mail: ['lettre', 'messag', 'courri'],
  email: ['lettre', 'messag', 'courri'],
  newsletter: ['lettre'],
  signer: ['signat'],
  contrat: ['contra', 'signat'],
  stock: ['stock', 'invent'],
  inventaire: ['stock', 'invent'],
  compta: ['depens', 'factur', 'tresor'],
  comptabilite: ['depens', 'factur', 'tresor'],
  depense: ['depens', 'frais'],
  note: ['note', 'frais'],
  client: ['client', 'fiche'],
  prospect: ['prospe', 'pipeli'],
  vente: ['prospe', 'devis', 'boutiq'],
  vendre: ['boutiq', 'devis', 'caisse'],
  devis: ['devis'],
  avis: ['avis'],
  fidele: ['fideli'],
  site: ['site', 'page'],
  reseau: ['planif', 'visuel', 'public'],
  instagram: ['planif', 'visuel', 'public'],
  facebook: ['planif', 'visuel', 'public'],
  tache: ['tache'],
  projet: ['projet'],
  reunion: ['reunio', 'agenda'],
  appel: ['appel', 'standa'],
  telephone: ['standa', 'appel'],
};

function racine(mot: string): string {
  return mot.length > 6 ? mot.slice(0, 6) : mot.replace(/(es|s|x)$/, '');
}

/** Les mots utiles d'une phrase, réduits à leur racine. */
export function motsUtiles(phrase: string): string[] {
  return normaliser(phrase)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 3 && !VIDES.has(m))
    .map(racine);
}

/**
 * Le score d'une fiche pour une phrase : combien de mots utiles s'y
 * retrouvent (directement ou par un équivalent). `null` quand la fiche ne
 * correspond pas — moins de la moitié des mots, ou aucun.
 */
export function scoreBesoin(phrase: string, fiche: string): number | null {
  const brut = normaliser(phrase.trim());
  if (!brut) return 0;
  const texte = normaliser(fiche);
  // La phrase exacte, comme avant : un nom tapé en entier reste le meilleur résultat.
  if (texte.includes(brut)) return 100;
  const mots = motsUtiles(brut);
  if (mots.length === 0) return null;
  const debuts = new Set(texte.split(/[^a-z0-9]+/).filter(Boolean).map((m) => m.slice(0, 6)));
  const present = (r: string) => [...debuts].some((d) => d.startsWith(r) || (r.startsWith(d) && d.length >= 5));
  let score = 0;
  for (const m of mots) {
    const equivalents = Object.entries(EQUIVALENTS).find(([cle]) => racine(cle) === m || cle.startsWith(m))?.[1] ?? [];
    if (present(m)) score += 2;
    else if (equivalents.some(present)) score += 1;
  }
  return score > 0 && score >= Math.ceil(mots.length / 2) ? score : null;
}

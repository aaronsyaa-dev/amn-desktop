/**
 * Ce qu'on propose dans un devis, éprouvé en Node sur le vrai module.
 *
 * Ce que ces cas protègent : ce qui est proposé à la vente dans l'application
 * doit être ce que le site publie, mot pour mot et centime pour centime — et
 * un devis déjà envoyé doit continuer de s'imprimer comme il est parti.
 *
 * Le défaut d'origine : le devis tirait sa liste de `trackerCatalog`, qui
 * décrit des paliers de tracker dont DEUX ne sont pas codés. On pouvait donc
 * chiffrer « AMN Suite » à une prospecte.
 *
 *   npm run check:offers
 */
import assert from 'node:assert/strict';
import { legacyOffers, offerCatalog, sellableOffers } from '../src/data/offerCatalog.ts';
import { resolveOffer } from '../src/lib/offers.ts';
import { trackerCatalog } from '../src/data/trackerCatalog.ts';
import { formatCents } from '../src/lib/money.ts';

let n = 0;
function cas(titre: string, fn: () => void): void {
  fn();
  n += 1;
  console.log(`  OK  ${titre}`);
}

/** `Intl` sépare les milliers par une espace INSÉCABLE. */
const lisible = (texte: string): string => texte.replace(/\s/g, ' ');

console.log('\nCe qu’on propose dans un devis\n');

/* ------------------------------- le site fait foi ------------------------ */

/**
 * LA RECOPIE DE `prix.html`. Si le site change, cette table change avec lui —
 * et tant qu'elle ne l'a pas fait, ce contrôle échoue. C'est tout l'intérêt :
 * le prix qui part sur un devis est celui que la prospecte a lu.
 */
const PUBLIE: Record<string, { nom: string; parMois: string | null }> = {
  solo: { nom: 'Solo', parMois: '35,00 €' },
  equipe: { nom: 'Petite équipe', parMois: '109,00 €' },
  agence: { nom: 'Agence', parMois: '249,00 €' },
  'sur-mesure': { nom: 'Sur-mesure', parMois: null },
  'option-commerce': { nom: 'Option commerce', parMois: '25,00 €' },
};

cas('le catalogue est exactement celui de la page prix', () => {
  assert.deepEqual(offerCatalog.map((o) => o.id), Object.keys(PUBLIE));
  for (const offre of offerCatalog) {
    const attendu = PUBLIE[offre.id];
    assert.equal(offre.name, attendu.nom, `nom de ${offre.id}`);
    assert.equal(
      offre.monthlyCents === null ? null : lisible(formatCents(offre.monthlyCents)),
      attendu.parMois,
      `prix de ${offre.id}`,
    );
  }
});

cas('un prix est un entier de centimes — jamais un flottant d’euros', () => {
  for (const offre of offerCatalog) {
    if (offre.monthlyCents === null) continue;
    assert.ok(Number.isInteger(offre.monthlyCents), `${offre.id} : ${offre.monthlyCents}`);
    assert.ok(offre.monthlyCents > 0, `${offre.id} ne peut pas être gratuit par accident`);
  }
});

/* ------------------------- ce qu'on peut vendre -------------------------- */

cas('aucun produit non codé ne peut être chiffré à une prospecte', () => {
  // La règle, énoncée à l'envers : rien de ce que `trackerCatalog` marque
  // « à venir » ou « verrouillé » ne doit se retrouver proposable.
  const irréalisés = trackerCatalog
    .filter((offre) => offre.availability !== 'available')
    .map((offre) => offre.id);
  assert.ok(irréalisés.length > 0, 'le cas ne prouverait rien si tout était disponible');
  for (const id of irréalisés) {
    assert.equal(
      sellableOffers.some((offre) => offre.id === id),
      false,
      `${id} est proposable alors qu’il n’est pas codé`,
    );
  }
});

cas('une option ne peut pas être le sujet d’un devis', () => {
  // Elle s'AJOUTE à un forfait : proposée seule, elle produirait un devis
  // « Option commerce, 25 € » qui ne correspond à aucune vente.
  assert.equal(offerCatalog.some((o) => o.addon), true);
  assert.equal(sellableOffers.some((o) => o.addon), false);
  assert.equal(sellableOffers.length, offerCatalog.length - 1);
});

cas('tout ce qui est proposable a un prix, ou dit explicitement « sur devis »', () => {
  for (const offre of sellableOffers) {
    assert.ok(
      offre.monthlyCents === null || offre.monthlyCents > 0,
      `${offre.id} : ni prix ni « sur devis »`,
    );
    assert.ok(offre.tagline.trim() !== '', `${offre.id} sort sans sous-titre sur le devis imprimé`);
  }
});

cas('les identifiants sont distincts et stables', () => {
  const ids = offerCatalog.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z-]+$/, `${id} se retrouvera enregistré tel quel`);
});

/* --------------------- les devis déjà envoyés ---------------------------- */

cas('un devis d’avant garde le nom sous lequel il est parti', () => {
  for (const [id, attendu] of Object.entries(legacyOffers)) {
    const trouve = resolveOffer(sellableOffers, legacyOffers, id);
    assert.notEqual(trouve, null, `${id} ne se résout plus`);
    assert.equal(trouve?.name, attendu.name);
    assert.equal(trouve?.tagline, attendu.tagline, 'le sous-titre imprimé change aussi le document');
  }
});

cas('les trois anciens paliers sont exactement ceux du catalogue tracker', () => {
  // Sinon un devis d'avant se réimprimerait avec un libellé retouché.
  assert.deepEqual(Object.keys(legacyOffers), trackerCatalog.map((o) => o.id));
  for (const offre of trackerCatalog) {
    assert.equal(legacyOffers[offre.id].name, offre.name);
    assert.equal(legacyOffers[offre.id].tagline, offre.tagline);
  }
});

cas('une offre du catalogue courant l’emporte sur un homonyme d’avant', () => {
  const solo = resolveOffer(sellableOffers, legacyOffers, 'solo');
  assert.equal(solo?.name, 'Solo');
});

cas('un intitulé libre ne se fait pas remplacer par une offre', () => {
  // Édition Business : `trackerTier` est ce que la cliente a tapé. Aucun
  // catalogue, donc rien à résoudre — et l'appelant l'affiche tel quel.
  assert.equal(resolveOffer([], {}, 'Prestation à la journée'), null);
  assert.equal(resolveOffer(sellableOffers, legacyOffers, 'Pose de parquet'), null);
  assert.equal(resolveOffer([], {}, ''), null);
});

cas('un identifiant hérité d’un objet JavaScript n’invente pas une offre', () => {
  // `legacyOffers` est un objet : sans garde, `resolveOffer(…, 'toString')`
  // renverrait une fonction et ferait afficher du code sur un devis.
  for (const piege of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    const trouve = resolveOffer(sellableOffers, legacyOffers, piege);
    assert.ok(trouve === null || typeof trouve.name === 'string', `${piege} : ${String(trouve)}`);
    assert.equal(trouve, null, `${piege} ne doit rien résoudre`);
  }
});

console.log(`\nOK — ${n} cas : on ne chiffre que ce qu’on vend, au prix qu’on publie.`);

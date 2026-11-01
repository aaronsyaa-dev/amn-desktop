/**
 * APERÇU « D02 » — Tous les modules (v3), tel que sur l'image : la page dans la coquille (fil « Espace / Tous les
 * modules », aucune famille dépliée, bouton carré allumé), le champ au focus, une ligne choisie au clavier.
 *
 * Le répertoire est le VRAI registre (`src/refonte/modules/`) lu par `lireRepertoire`, sur le vrai catalogue : ses
 * noms et ses effectifs sont ceux de l'application (14 / 7 / 11 / 13 / 15 / 7 / 19 / 15, pas ceux de l'image : écart
 * déjà décidé). Les compteurs, les présences, les épingles, les récents, les modules à découvrir, « 64 » et les
 * deux modules « non activés » sont FICTIFS, comme les données de la maquette, et ne vivent qu'ici.
 *
 *   npm run apercu -- D02
 */
import React from 'react';
import { NAV_SECTIONS, type NavItem } from '../../../src/data/navigation';
import { CATALOGUE } from '../../../src/bureaux/catalogue';
import { choisirEpingles, type Moment } from '../../../src/refonte/systeme/modules/logique';
import { correspondancesDe, enPuce, epingleEnPuce, lireRepertoire, moduleDeLaCle } from '../../../src/refonte/systeme/modules/repertoire';
import { VueTousLesModules } from '../../../src/refonte/systeme/modules/VueTousLesModules';
import { ApercuBureau } from '../coquille';

const catalogue = new Map<string, NavItem>();
for (const s of NAV_SECTIONS) for (const i of s.items) catalogue.set(i.key, i);

/** Compteurs et présences FICTIFS, par adresse (ceux de la maquette, posés sur les modules voisins du registre). */
const COMPTEURS: Record<string, number> = { '/agenda': 3, '/tasks': 3, '/signature': 3, '/facturation': 2, '/messages-prives': 5, '/stock': 6, '/vault': 2, '/supervision': 1, '/garde/pile': 1, '/outils/automatisations': 1 };
const PRESENTS = new Map<string, string[]>([
  ['/clients', ['Riyad']],
  ['/facturation', ['Mohamed']],
]);
const NON_ACTIVES = new Set(['cashCount', 'bom']);

const familles = lireRepertoire({
  langue: 'fr',
  catalogue,
  compteurs: COMPTEURS,
  presents: PRESENTS,
  estActive: (cle) => !NON_ACTIVES.has(cle),
  estVerrouille: () => false,
  nomGarde: 'La Garde',
});
const puce = (cle: string) => {
  const m = moduleDeLaCle(familles, cle);
  if (!m) throw new Error(`aperçu D02 : ${cle} absent du registre`);
  return enPuce(m, familles, catalogue);
};

const EPINGLES = choisirEpingles(['invoices', 'clients', 'supervision', 'agenda', 'calculators', 'notes', 'vault', 'tasks'], (cle) => epingleEnPuce(cle, familles, catalogue));
const RECENTS: { module: ReturnType<typeof puce>; moment: Moment }[] = [
  { module: puce('invoices'), moment: { cle: 'minutes', n: 4 } },
  { module: puce('clients'), moment: { cle: 'minutes', n: 12 } },
  { module: puce('notes'), moment: { cle: 'minutes', n: 40 } },
  { module: puce('gardeSalle'), moment: { cle: 'matin' } },
];
const DECOUVRIR = [puce('logbook'), puce('loyalty'), puce('postPlanner')];

export default function Apercu() {
  return (
    <ApercuBureau fil={['Espace', 'Tous les modules']} tousLesModules ajmani="Dites ce que vous voulez faire, je trouve le bon module">
      <VueTousLesModules
        familles={familles}
        correspondre={(q) => correspondancesDe(q, catalogue, 'fr')}
        epingles={EPINGLES}
        recents={RECENTS}
        decouvrir={DECOUVRIR}
        ouverts={64}
        cyber={{ vers: '/cyber', espaces: CATALOGUE.cyber.onglets.length }}
        touche="⌘"
        onOuvrir={() => undefined}
        onBasculerEpingle={() => true}
        onDemanderAjmani={() => undefined}
        selectionInitiale="cashForecast"
      />
    </ApercuBureau>
  );
}

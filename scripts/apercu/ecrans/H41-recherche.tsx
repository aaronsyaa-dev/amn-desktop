/**
 * APERÇU « H41-recherche » — la palette ⌘K ouverte, « menna » saisi, la 4ᵉ ligne choisie (le client, après ↓), posée
 * sur la coquille (Ma journée / Tâches) figée, floutée et assombrie. Rendue par les VRAIS composants de l'écran
 * (`PaletteRechercheVue`, son moteur et son aperçu) sur un index et des chiffres FICTIFS de bac à sable : Menna
 * Conseil, F-2041, H-118… n'existent qu'ici, jamais dans `src/`.
 *
 *   npm run apercu -- H41-recherche
 *
 * Ce que l'application ne sait pas produire (écarts documentés dans le compte rendu) et qui manque donc ici :
 * « Contacts chez Menna Conseil · 3 personnes » (pas de contacts par client), « 12 personnes », « 1 urgent »,
 * la ligne des contacts, la note épinglée, l'action « Appeler », « ⌘↵ dans un nouvel onglet » (une seule fenêtre).
 */
import React from 'react';
import { ApercuBureau } from '../coquille';
import { PaletteRechercheVue } from '../../../src/refonte/systeme/recherche/PaletteRecherche';
import type { ApercuClient } from '../../../src/refonte/systeme/recherche/apercu';
import type { EntreeIndex, Index, LigneRecherche } from '../../../src/refonte/systeme/recherche/moteur';

const T = Date.parse('2026-10-30T10:42:00');
const entree = (e: Omit<EntreeIndex, 'maj'>, rang: number): EntreeIndex => ({ ...e, maj: T - rang * 1000 });

/** L'index FICTIF : un client, ses documents, deux pages. */
const INDEX: Index = {
  entrees: [
    entree({ cle: 'client:1', type: 'client', libelle: 'Menna Conseil', aussi: ['Menna'], route: '/clients', state: { focusClientId: 1 }, famille: 'contacts', contact: 'Menna', courriel: 'contact@exemple.test' }, 0),
    entree({ cle: 'document:7', type: 'document', libelle: 'Contrat de maintenance Menna', route: '/knowledge', famille: 'ecrire' }, 1),
    entree({ cle: 'facture:f2041', type: 'facture', libelle: 'Facture F-2041 · Menna Conseil', aussi: ['Menna Conseil'], route: '/facturation', state: { openInvoiceId: 'f2041' }, famille: 'argent', enRetard: true }, 2),
    entree({ cle: 'page:cockpit', type: 'page', libelle: 'Cockpit client, filtré sur Menna', route: '/cockpit', famille: 'jour', module: 'cockpit' }, 3),
    entree({ cle: 'page:missions', type: 'page', libelle: 'Missions et tickets · 1 ticket Menna', route: '/missions', famille: 'jour', module: 'missions' }, 4),
  ],
  actions: [],
};

/** Les chiffres FICTIFS de l'aperçu de Menna Conseil (ceux de la maquette). */
const MENNA: ApercuClient = {
  genre: 'client',
  depuis: '2025-03-12T09:00:00',
  annee: 2026,
  factureCentimes: 1_460_000,
  evolution: 18,
  retard: { centimes: 124_000, numero: 'F-2041', jours: 4 },
  rendezVous: '2026-10-30T11:00:00',
  courbe: { valeurs: [9, 6, 13, 11, 18, 5, 12, 17, 8, 16], premier: '2026-01', dernier: '2026-10' },
  activite: [
    { genre: 'evenement', le: '2026-10-30T10:12:00', heure: true, titre: 'Ticket urgent H-118 · Mohamed s’en occupe' },
    { genre: 'encaissement', le: '2026-10-30T09:48:00', heure: true, numero: 'F-2038', montantCentimes: 240_000 },
    { genre: 'evenement', le: '2026-10-29T16:20:00', heure: true, titre: 'Devis D-2026-114 relu par Amina' },
  ],
};

const apercuDe = (ligne: LigneRecherche) => (ligne.lie === 'client:1' ? MENNA : null);

/** Une horloge qui annonce 12 ms, comme la maquette. */
let tic = 0;
const horloge = () => {
  tic += 1;
  return tic % 2 === 1 ? 0 : 12;
};

const rien = () => undefined;

export default function Apercu() {
  return (
    <>
      <ApercuBureau famille="jour" sousPage="taches" fil={['Ma journée', 'Tâches']} />
      <PaletteRechercheVue
        index={INDEX}
        pret
        erreur={false}
        horsLigne={false}
        recents={[]}
        frequences={{}}
        texteInitial="menna"
        choixInitial={3}
        apercuDe={apercuDe}
        maintenant={new Date(T)}
        touche="⌘"
        horloge={horloge}
        onFermer={rien}
        onExecuter={rien}
        onReessayer={rien}
      />
    </>
  );
}

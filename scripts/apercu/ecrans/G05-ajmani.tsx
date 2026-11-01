/**
 * APERÇU « G05-ajmani » — la palette ⌘J ouverte sur l'Accueil, « Relance les factures en retard, ton courtois »
 * saisi : la proposition v3 (trois relances cochées, la deuxième dépliée avec sa mise en garde), la décision et son
 * sceau, « Ensuite, si vous voulez », le pied. Rendue par les VRAIS composants de l'écran (`ContenuPalette`, son
 * analyseur `analyser`) sur des factures FICTIVES de bac à sable ; le texte déplié est celui, fictif, de la maquette
 * (dans l'application : le modèle de Relances rempli des faits, `useTexteRelance`).
 *
 *   npm run apercu -- G05-ajmani
 *
 * Écarts assumés (voir le compte rendu) : « Préparer les 3 relances » au lieu de « Envoyer » (Ajmani n'envoie rien,
 * décision du STATUT), pas d'« Atelier Sarah attend plutôt un appel » ni de modèle « approuvé le 2 oct. » (aucune
 * source), pas de ligne « Objet : » (Relances n'en a pas), suites limitées à des modules ouverts.
 */
import React, { createRef } from 'react';
import { ApercuBureau } from '../coquille';
import { ContenuPalette } from '../../../src/refonte/systeme/ajmani/PaletteAjmaniRefonte';
import { analyser, type ActionProposee, type DonneesAjmani } from '../../../src/refonte/systeme/ajmani/intentions';
import { traduire } from '../../../src/refonte/systeme/ajmani/i18n';

const FACTURES = [
  { id: 'f2041', numero: 'F-2041', clientId: 1, clientNom: 'Menna Conseil', courriel: true, statut: 'emise' as const, echeance: '2026-10-10', resteDuCentimes: 124_000, nom: 'Menna' },
  { id: 'f2039', numero: 'F-2039', clientId: 2, clientNom: 'Studio Nova', courriel: true, statut: 'emise' as const, echeance: '2026-10-15', resteDuCentimes: 40_000, nom: 'Nova' },
  { id: 'f2037', numero: 'F-2037', clientId: 3, clientNom: 'Garage Benali', courriel: true, statut: 'emise' as const, echeance: '2026-10-18', resteDuCentimes: 56_000, nom: 'Benali' },
];

const DONNEES: DonneesAjmani = {
  aujourdhui: '2026-10-30',
  luesA: '2026-10-30T10:42:00',
  factures: FACTURES,
  clients: FACTURES.map((f) => ({ id: f.clientId, nom: f.nom, societe: f.clientNom })),
  relances: [{ factureId: 'f2039', le: '2026-10-22T09:00:00', palier: 'rappel' }],
  modules: [
    { cle: 'invoices', libelle: 'Facturation', route: '/facturation' },
    { cle: 'reminders', libelle: 'Relances', route: '/relances' },
    { cle: 'tasks', libelle: 'Tâches', route: '/tasks' },
    { cle: 'agenda', libelle: 'Agenda', route: '/agenda' },
  ],
  attentes: [],
  rendezVousAujourdhui: 0,
  garde: { etat: 'calme', points: 0 },
};

const CONTEXTE = { famille: 'jour' as const, ecranLibelle: 'Accueil', admin: true, enLigne: true, langue: 'fr' as const, email: '' };
const TEXTE = 'Relance les factures en retard, ton courtois';
const mots = (cle: Parameters<typeof traduire>[1], params?: Record<string, string | number>) => traduire('fr', cle, params);
const REPONSE = analyser(TEXTE, { donnees: DONNEES, contexte: CONTEXTE, mots });

/**
 * Le texte de la relance : dans l'application, le modèle de Relances rempli des faits (`useTexteRelance`) ; ici, le
 * texte FICTIF de la maquette, pour comparer la mise en page à texte égal.
 */
const texteRelance = (p: ActionProposee) =>
  p.factureId === 'f2039'
    ? 'Bonjour, sauf erreur de notre part, la facture F-2039, échue le 15 oct. (400 €), reste à régler. Vous la trouverez en pièce jointe. Si le paiement est déjà parti, ne tenez pas compte de ce message. Belle journée, Aaron'
    : null;

const rien = () => undefined;

export default function Apercu() {
  return (
    <>
      <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Accueil']} />
      <ContenuPalette
        ouverte
        onFermer={rien}
        contexte={CONTEXTE}
        donnees={DONNEES}
        surDemander={rien}
        surAllerA={rien}
        surOuvrirRecherche={rien}
        texteRelance={texteRelance}
        sortie={false}
        champ={createRef<HTMLInputElement>()}
        pilote={{ current: { enCours: false, annuler: rien } }}
        initial={{ texte: TEXTE, reponse: REPONSE }}
      />
    </>
  );
}

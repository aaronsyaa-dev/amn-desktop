/**
 * UNE PHRASE PAR FAMILLE — ce que la bulle du rail dit sous le nom.
 *
 * Par CODE de rail, l'identité stable des familles dans les deux éditions.
 * Les familles de supervision (interne) ont leur phrase dans la barre
 * interne, pas ici : ce fichier entre dans le paquet livré aux clientes.
 */
export const HINT_FAMILLE: Record<string, string> = {
  PI: 'Votre journée, vos tâches, vos projets, vos objectifs.',
  CR: 'Clients, devis, factures, encaissements, relances.',
  GU: 'Ce qui se vend ou se réserve en ligne, et ce qui arrive au standard.',
  MK: 'Faire connaître : contenus, visuels, avis, veille.',
  PR: 'Faire : stock, interventions, planning, temps, tournées.',
  FI: 'Prévoir : trésorerie, scénarios, rapprochement, fiscalité.',
  DO: 'Notes, pages, rapports, médias, classeur.',
  LV: 'Ce qui se livre : rapports, médias, classeur, signatures.',
  JU: 'Contrats, clauses, RGPD, identité.',
  CO: 'L’équipe : messages, groupes, annonces, absences, appels.',
  RH: 'Recruter, former, habiliter, payer.',
  OU: 'Les petits outils du quotidien.',
  PE: 'Ce qui n’appartient qu’à vous : budget, habitudes, journal, santé.',
  SY: 'Paramètres, membres, assistance, coffre-fort.',
};

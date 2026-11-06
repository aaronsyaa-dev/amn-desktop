/**
 * COMPATIBILITÉ AVEC LES TYPES DU DÉPÔT — vérifiée à la compilation, sans coût
 * à l'exécution.
 *
 * Chaque ligne échoue au `typecheck` si un jeu cesse d'être un sur-ensemble du
 * type existant : on le saurait avant qu'un écran reçoive une donnée à laquelle
 * il manque un champ.
 */

import type { Client, Invoice, Quote } from '../../shared/api';
import type { Appointment } from '../../state/useAppointments';
import type { Expense } from '../../state/expenseEngine';
import type { Note } from '../../state/useNotes';
import type { ProjectData } from '../../state/projectEngine';
import type { Depense, Devis, Evenement, Facture, FicheClient, NoteRapide, Projet } from './types';

type SurEnsemble<Jeu extends Ancien, Ancien> = Jeu;

export type VerifCompatibilite = [
  SurEnsemble<FicheClient, Client>,
  SurEnsemble<Devis, Quote>,
  SurEnsemble<Facture, Invoice>,
  SurEnsemble<Evenement, Appointment>,
  SurEnsemble<Depense, Expense>,
  SurEnsemble<NoteRapide, Note>,
  SurEnsemble<Projet, ProjectData>,
];

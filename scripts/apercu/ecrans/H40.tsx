/**
 * APERÇU « H40 » — la page Notifications v3 dans la coquille, telle que sur l'image : vendredi 30 oct. 2026, 10:42.
 *
 *   npm run apercu -- H40
 *
 * Rendue par les VRAIS composants de l'écran (`VueNotifications`, la vue de présentation sans accès aux données) sur
 * des notifications FICTIVES de bac à sable, reprises des exemples de la maquette (Menna, F-2038, D-2026-114,
 * Boulangerie Léo…). Rien de ceci n'entre dans l'application : ces exemples ne vivent que dans `scripts/apercu/`.
 */
import React from 'react';
import { ApercuBureau } from '../coquille';
import { VueNotifications, type ActionsNotifications } from '../../../src/refonte/systeme/notifications/VueNotifications';
import { CATEGORIES_MATRICE, compteurs, type Notification } from '../../../src/refonte/systeme/notifications/modele';
import { reglagesParDefaut } from '../../../src/refonte/systeme/notifications/reglages';

const MAINTENANT = new Date(2026, 9, 30, 10, 42, 0, 0);
const A = (jour: number, h: number, m: number, s = 0): string => new Date(2026, 9, jour, h, m, s, 0).toISOString();

type Fictive = Omit<Notification, 'vers' | 'module'> & { module?: string | null };
const N = (n: Fictive): Notification => ({ vers: { route: '/apercu' }, module: null, ...n });

const NOTIFICATIONS: Notification[] = [
  N({ id: 'u1', type: 'urgent', titre: 'Ticket urgent de Menna', detail: 'Données utilisateurs absentes du tableau de bord', date: A(30, 10, 12), urgente: true, famille: 'jour', icone: 'drapeau', module: 'tasks', lue: false }),
  N({ id: 'r1', type: 'rendez-vous', titre: 'Rendez-vous Menna dans 18 min', detail: '11:00, salle clients · 3 points prêts', date: A(30, 10, 30, 30), echeance: A(30, 11, 0), urgente: false, famille: 'jour', icone: 'calendrier', module: 'agenda', lue: true }),
  N({ id: 'f1', type: 'paiement', titre: 'Facture F-2038 encaissée', detail: '2 400 € de Menna Conseil', date: A(30, 9, 48), urgente: false, famille: 'argent', icone: 'euro', module: 'invoices', lue: false }),
  N({ id: 's1', type: 'securite', titre: 'Tentatives de connexion bloquées', detail: 'La Garde a protégé un compte, rien à faire', date: A(30, 8, 19), urgente: false, famille: 'outils', icone: 'cadenas', lue: false }),
  N({ id: 'm1', type: 'mention', titre: 'Mohamed vous a mentionné', detail: '« Peux-tu valider les colonnes du kanban ? »', date: A(30, 8, 2), urgente: false, famille: 'echanger', icone: 'bulle', module: 'dm', lue: false }),
  ...[A(30, 2, 15), A(30, 3, 0), A(30, 6, 0), A(30, 10, 30)].map((date, i) =>
    N({ id: `g${i}`, type: 'activite', titre: 'Ronde de La Garde terminée', detail: 'aucun écart', date, urgente: false, famille: 'outils', icone: 'coche', lue: true }),
  ),
  N({ id: 'd1', type: 'devis', titre: 'Devis D-2026-114 relu par Menna Conseil', detail: 'En attente de signature', date: A(29, 16, 10), urgente: false, famille: 'argent', icone: 'coche', module: 'invoices', lue: true }),
  N({ id: 'p2', type: 'paiement', titre: 'Facture F-2031 envoyée', detail: '1 200 € à Atelier Dupont', date: A(29, 11, 0), urgente: false, famille: 'argent', icone: 'euro', module: 'invoices', lue: true }),
  N({ id: 'st1', type: 'stock', titre: 'Stock sous le seuil', detail: 'Câble réseau 5 m : 4 restants', date: A(29, 9, 0), urgente: false, famille: 'creer', icone: 'boite', lue: true }),
  N({ id: 'c1', type: 'client', titre: 'Nouveau client ajouté par Riyad', detail: 'Boulangerie Léo, via le formulaire du site', date: A(27, 15, 0), urgente: false, famille: 'contacts', icone: 'utilisateurs', module: 'clients', lue: true }),
  N({ id: 'm0', type: 'mention', titre: 'Riyad vous a mentionné', detail: '« Tu as vu le devis ? »', date: A(26, 9, 0), urgente: false, famille: 'echanger', icone: 'bulle', module: 'dm', lue: true }),
];

const rien = () => undefined;
const ACTIONS: ActionsNotifications = {
  ouvrir: rien,
  reporter: rien,
  basculerLue: rien,
  toutMarquerLu: rien,
  reessayer: rien,
  versReglages: rien,
  changerReglage: () => true,
  reessayerReglage: rien,
  passerEnResume: rien,
  garder: rien,
};

export default function Apercu() {
  return (
    <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Notifications']} ajmani="Demandez à Ajmani, par exemple : « reporte tout ce qui n'est pas urgent à demain »" notifications={4}>
      <VueNotifications
        statut="pret"
        notifications={NOTIFICATIONS}
        compteurs={compteurs(NOTIFICATIONS)}
        maintenant={MAINTENANT}
        enLigne
        enAttente={0}
        reglages={reglagesParDefaut()}
        lignesMatrice={CATEGORIES_MATRICE}
        echecReglage={false}
        suggestion={{ categorie: 'rendez-vous', jours: 14 }}
        actions={ACTIONS}
        limiteInitiale={NOTIFICATIONS.length - 1}
      />
    </ApercuBureau>
  );
}

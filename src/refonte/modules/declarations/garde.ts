import { declarerFamille, vue } from '../declarer';

/**
 * LA GARDE ET LA SUPERVISION — la huitième famille, réservée à l’équipe AMN.
 *
 * Décisions validées : Supervisor et Cyber (parc, produits) sont rangés ici ;
 * `/tour` et `/supervisor` restent tous les deux. Le module Ajmani de la Garde
 * n’est plus une entrée : il devient le panneau assistant ⌘J, sans personnage.
 * Sa route reste (`remplacees`). Studio et Stratégie restent cachés : ils n’ont
 * pas d’entrée au catalogue. Regroupés : Supervision et alertes ; Sites et
 * trackers ; Maturité et comparatif ; Produits cyber (Scanner, Comply, SSL).
 *
 * Pas de teinte propre : le socle n’en a que sept. Elle prend celle des Outils.
 */

export default declarerFamille({
  id: 'garde',
  ordre: 8,
  teinte: 'outils',
  nom: { fr: 'La Garde et la supervision', en: 'Guard and oversight' },
  amnSeulement: true,
  actions: {
    deleguer: { fr: 'Déléguer à la Garde', en: 'Delegate to the Guard' },
    superviser: { fr: 'Superviser les clientes', en: 'Oversee clients' },
    securiser: { fr: 'Cybersécurité', en: 'Cybersecurity' },
  },
  modules: [
    { action: 'deleguer', niveau: 'essentiel', vues: [vue('gardeSalle', '/garde', ['voir ce que fait la Garde', 'voir le mur des gardes'], ['garde', 'salle', 'mur', 'agents'])] },
    { action: 'deleguer', niveau: 'essentiel', vues: [vue('gardePile', '/garde/pile', ['donner mon avis', 'décider ce qui attend'], ['avis', 'décision', 'attente', 'pile'])] },
    { action: 'deleguer', niveau: 'courant', vues: [vue('gardeOrganigramme', '/garde/organigramme', ['voir qui est en ronde', 'voir l’organigramme de la Garde'], ['garde', 'capitaine', 'chefs', 'organigramme'])] },
    { action: 'deleguer', niveau: 'courant', vues: [vue('gardeBureaux', '/garde/bureaux', ['parler à un chef de garde'], ['bureaux', 'chef', 'garde'])] },
    { action: 'deleguer', niveau: 'courant', vues: [vue('gardeCommune', '/garde/commune', ['parler à toute la Garde', 'lire la relève du jour'], ['salle commune', 'relève', 'garde'])] },
    { action: 'deleguer', niveau: 'avance', vues: [vue('gardeCalendrier', '/garde/calendrier', ['voir ce que la Garde fera cette semaine'], ['calendrier', 'garde', 'semaine'])] },
    { action: 'superviser', niveau: 'essentiel', vues: [vue('tour', '/tour', ['voir tout le parc', 'voir le mur du SOC'], ['vue d’ensemble', 'soc', 'parc', 'tour'])] },
    { action: 'superviser', niveau: 'courant', vues: [vue('orgs', '/tour/organisations', ['ouvrir le dossier d’une cliente', 'voir toutes les clientes'], ['dossier', 'organisation', 'cliente'])] },
    { action: 'superviser', niveau: 'avance', vues: [vue('generator', '/tour/generateur', ['créer un espace client', 'préparer un poste sur mesure'], ['atelier', 'générateur', 'espace client'])] },
    {
      nom: { fr: 'Supervision et alertes', en: 'Monitoring and alerts' },
      action: 'securiser',
      niveau: 'essentiel',
      vues: [
        vue('supervision', '/supervision', ['traiter un incident', 'voir les incidents'], ['supervision', 'incident', 'alerte', 'soc']),
        vue('customAlerts', '/alertes-personnalisees', ['créer une alerte', 'régler un seuil'], ['alerte', 'seuil', 'règle']),
      ],
    },
    {
      nom: { fr: 'Sites et trackers', en: 'Sites and trackers' },
      action: 'securiser',
      niveau: 'courant',
      vues: [
        vue('sites', '/sites', ['ajouter un site client', 'retrouver un site'], ['site', 'registre', 'domaine']),
        vue('tracker', '/tracker', ['installer un tracker', 'voir les trackers'], ['tracker', 'sonde', 'temps réel']),
      ],
    },
    {
      nom: { fr: 'Maturité et comparatif', en: 'Maturity and comparison' },
      action: 'securiser',
      niveau: 'avance',
      vues: [
        vue('socMaturity', '/maturite-soc', ['mesurer la maturité SOC d’une cliente'], ['maturité', 'soc', 'niveau']),
        vue('orgCompare', '/comparatif', ['comparer les clientes'], ['comparatif', 'organisations', 'côte à côte']),
      ],
    },
    { action: 'securiser', niveau: 'courant', vues: [vue('clientReport', '/rapport-client', ['imprimer le rapport d’une cliente'], ['rapport', 'cliente', 'imprimer', 'pdf'])] },
    { action: 'securiser', niveau: 'courant', vues: [vue('access', '/tour/journal', ['voir qui est entré chez qui'], ['journal d’accès', 'audit', 'connexion'])] },
    {
      nom: { fr: 'Produits cyber', en: 'Cyber products' },
      action: 'securiser',
      niveau: 'courant',
      vues: [
        vue('scanner', '/scanner', ['scanner un site', 'chercher des vulnérabilités'], ['scanner', 'vulnérabilité', 'faille']),
        vue('comply', '/comply', ['vérifier la conformité RGPD d’un site'], ['comply', 'conformité', 'rgpd', 'cookies']),
        vue('ssl', '/ssl', ['surveiller un certificat', 'voir les certificats qui expirent'], ['ssl', 'tls', 'certificat', 'https']),
      ],
    },
  ],
  remplacees: [
    { id: 'gardeAjmani', route: '/garde/ajmani', par: { fr: 'le panneau assistant, ouvert par ⌘J', en: 'the assistant panel, opened with ⌘J' } },
  ],
});

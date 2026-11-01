import { declarerFamille, vue } from '../declarer';

/**
 * LA GARDE ET LA SUPERVISION — la huitième famille, réservée à l’équipe AMN.
 *
 * Décisions validées : Supervisor et Cyber (parc, produits) sont rangés ici ;
 * `/tour` et `/supervisor` restent tous les deux. Le module Ajmani de la Garde
 * n’est plus une entrée : il devient le panneau assistant ⌘J, sans personnage.
 * Sa route reste et ouvre le panneau (`remplacees`). Studio et Stratégie restent cachés : ils n’ont
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
    {
      action: 'deleguer',
      niveau: 'essentiel',
      vues: [
        vue('gardeSalle', '/garde', ['voir ce que fait la Garde', 'voir le mur des gardes'], ['garde', 'salle', 'mur', 'agents', 'ronde'], {
          en: { verbes: ['see what the Guard is doing', 'see the wall of guards'], motsCles: ['guard', 'room', 'wall', 'agents', 'patrol'] },
        }),
      ],
    },
    {
      action: 'deleguer',
      niveau: 'essentiel',
      vues: [
        vue('gardePile', '/garde/pile', ['donner mon avis', 'décider ce qui attend'], ['avis', 'décision', 'attente', 'pile', 'à votre avis', 'validation'], {
          en: { verbes: ['give my opinion', 'decide what is waiting'], motsCles: ['your call', 'decision', 'pending', 'queue', 'approval'] },
        }),
      ],
    },
    {
      action: 'deleguer',
      niveau: 'courant',
      vues: [
        vue('gardeOrganigramme', '/garde/organigramme', ['voir qui est en ronde', 'voir l’organigramme de la Garde'], ['garde', 'capitaine', 'chefs', 'organigramme'], {
          en: { verbes: ['see who is on patrol', 'see the Guard org chart'], motsCles: ['guard', 'captain', 'chiefs', 'org chart'] },
        }),
      ],
    },
    {
      action: 'deleguer',
      niveau: 'courant',
      vues: [
        vue('gardeBureaux', '/garde/bureaux', ['parler à un chef de garde'], ['bureaux', 'chef', 'garde'], {
          en: { verbes: ['talk to a guard chief'], motsCles: ['offices', 'chief', 'guard'] },
        }),
      ],
    },
    {
      action: 'deleguer',
      niveau: 'courant',
      vues: [
        vue('gardeCommune', '/garde/commune', ['parler à toute la Garde', 'lire la relève du jour'], ['salle commune', 'relève', 'garde'], {
          en: { verbes: ['talk to the whole Guard', 'read the daily brief'], motsCles: ['common room', 'daily brief', 'guard'] },
        }),
      ],
    },
    {
      action: 'deleguer',
      niveau: 'avance',
      vues: [
        vue('gardeCalendrier', '/garde/calendrier', ['voir ce que la Garde fera cette semaine'], ['calendrier', 'garde', 'semaine'], {
          en: { verbes: ['see what the Guard will do this week'], motsCles: ['calendar', 'guard', 'week', 'schedule'] },
        }),
      ],
    },
    {
      action: 'superviser',
      niveau: 'essentiel',
      vues: [
        vue('tour', '/tour', ['voir tout le parc', 'voir le mur du SOC'], ['vue d’ensemble', 'soc', 'parc', 'tour', 'wall', 'mur'], {
          en: { verbes: ['see the whole fleet', 'see the SOC wall'], motsCles: ['overview', 'soc', 'fleet', 'tower', 'wall'] },
        }),
      ],
    },
    {
      action: 'superviser',
      niveau: 'courant',
      vues: [
        vue('orgs', '/tour/organisations', ['ouvrir le dossier d’une cliente', 'voir toutes les clientes'], ['dossier', 'organisation', 'cliente', 'clients gérés'], {
          en: { verbes: ['open a client’s file', 'see all clients'], motsCles: ['client file', 'organization', 'client', 'account'] },
        }),
      ],
    },
    {
      action: 'superviser',
      niveau: 'avance',
      vues: [
        vue('generator', '/tour/generateur', ['créer un espace client', 'préparer un poste sur mesure'], ['atelier', 'générateur', 'espace client'], {
          en: { verbes: ['create a client space', 'prepare a tailored workspace'], motsCles: ['workshop', 'generator', 'client space'] },
        }),
      ],
    },
    {
      nom: { fr: 'Supervision et alertes', en: 'Monitoring and alerts' },
      action: 'securiser',
      niveau: 'essentiel',
      vues: [
        vue('supervision', '/supervision', ['traiter un incident', 'voir les incidents'], ['supervision', 'incident', 'alerte', 'soc'], {
          en: { verbes: ['handle an incident', 'see the incidents'], motsCles: ['monitoring', 'incident', 'alert', 'soc'] },
        }),
        vue('customAlerts', '/alertes-personnalisees', ['créer une alerte', 'régler un seuil'], ['alerte', 'seuil', 'règle'], {
          en: { verbes: ['create an alert', 'set a threshold'], motsCles: ['alert', 'threshold', 'rule'] },
        }),
      ],
    },
    {
      nom: { fr: 'Sites et trackers', en: 'Sites and trackers' },
      action: 'securiser',
      niveau: 'courant',
      vues: [
        vue('sites', '/sites', ['ajouter un site client', 'retrouver un site'], ['site', 'registre', 'domaine'], {
          en: { verbes: ['add a client site', 'find a site'], motsCles: ['site', 'register', 'domain', 'website'] },
        }),
        vue('tracker', '/tracker', ['installer un tracker', 'voir les trackers'], ['tracker', 'sonde', 'temps réel'], {
          en: { verbes: ['install a tracker', 'see the trackers'], motsCles: ['tracker', 'probe', 'real time'] },
        }),
      ],
    },
    {
      nom: { fr: 'Maturité et comparatif', en: 'Maturity and comparison' },
      action: 'securiser',
      niveau: 'avance',
      vues: [
        vue('socMaturity', '/maturite-soc', ['mesurer la maturité SOC d’une cliente'], ['maturité', 'soc', 'niveau'], {
          en: { verbes: ['measure a client’s SOC maturity'], motsCles: ['maturity', 'soc', 'level'] },
        }),
        vue('orgCompare', '/comparatif', ['comparer les clientes'], ['comparatif', 'organisations', 'côte à côte'], {
          en: { verbes: ['compare clients'], motsCles: ['comparison', 'organizations', 'side by side'] },
        }),
      ],
    },
    {
      action: 'securiser',
      niveau: 'courant',
      vues: [
        vue('clientReport', '/rapport-client', ['imprimer le rapport d’une cliente'], ['rapport', 'cliente', 'imprimer', 'pdf'], {
          en: { verbes: ['print a client’s report'], motsCles: ['report', 'client', 'print', 'pdf'] },
        }),
      ],
    },
    {
      action: 'securiser',
      niveau: 'courant',
      vues: [
        vue('access', '/tour/journal', ['voir qui est entré chez qui'], ['journal d’accès', 'audit', 'connexion'], {
          en: { verbes: ['see who entered which client'], motsCles: ['access log', 'audit', 'login'] },
        }),
      ],
    },
    {
      nom: { fr: 'Produits cyber', en: 'Cyber products' },
      action: 'securiser',
      niveau: 'courant',
      vues: [
        vue('scanner', '/scanner', ['scanner un site', 'chercher des vulnérabilités'], ['scanner', 'vulnérabilité', 'faille'], {
          en: { verbes: ['scan a site', 'look for vulnerabilities'], motsCles: ['scanner', 'vulnerability', 'flaw', 'security scan'] },
        }),
        vue('comply', '/comply', ['vérifier la conformité RGPD d’un site'], ['comply', 'conformité', 'rgpd', 'cookies'], {
          en: { verbes: ['check a site’s GDPR compliance'], motsCles: ['comply', 'compliance', 'gdpr', 'cookies'] },
        }),
        vue('ssl', '/ssl', ['surveiller un certificat', 'voir les certificats qui expirent'], ['ssl', 'tls', 'certificat', 'https'], {
          en: { verbes: ['monitor a certificate', 'see which certificates expire'], motsCles: ['ssl', 'tls', 'certificate', 'https'] },
        }),
      ],
    },
  ],
  remplacees: [
    { id: 'gardeAjmani', route: '/garde/ajmani', par: { fr: 'le panneau assistant, ouvert par ⌘J', en: 'the assistant panel, opened with ⌘J' }, redirection: { vers: '/garde', assistant: true } },
  ],
});

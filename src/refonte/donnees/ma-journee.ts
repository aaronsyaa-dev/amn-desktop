/**
 * LES JEUX « MA JOURNÉE » — tâches, calendrier, projets, tickets, notes,
 * rappels, habitudes (lot 01 : N01, H01, H02, H03, MJ01 à MJ05, L01 à L03).
 *
 * Le « maintenant » des maquettes est le vendredi 30 octobre, 10 h 15. À cette
 * heure : 5 tâches sur 8 faites aujourd'hui, 2 en retard, un stand-up passé,
 * une ronde de La Garde à venir. Ces repères sont des RÉGLAGES DE LA GÉNÉRATION,
 * pas des valeurs à recopier : un écran doit les recalculer depuis les
 * enregistrements (04-ECARTS : « les chiffres d'exemple ne sont jamais la règle »).
 */

import { ETIQUETTES_TACHES, ETIQUETTES_TICKETS, ICONES_PROJET } from './fond';
import { ajouterJours, compter, deElision, estOuvre, graineDe, hasard, instantParis, iso, jourDe, jourSemaine, lundiDe, type Jour } from './outils';
import { moi } from './equipe';
import type {
  Contexte, Evenement, Facture, FicheClient, Habitude, Membre, NoteRapide, Projet, Rappel, StatutProjet, SousTache, Tache, Ticket,
  TypeEvenement,
} from './types';

const hhmm = (h: number, m = 0): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const ouvres = (e: readonly Membre[]): Membre[] => e.filter((m) => m.role === 'Administrateur' || m.role === 'Membre');

/* ------------------------------- Projets ------------------------------- */

const TITRES_PROJET = [
  (c: string) => `Refonte du site ${deElision(c)}`,
  (c: string) => `Audit de sécurité ${c}`,
  (c: string) => `Identité visuelle ${c}`,
  (c: string) => `Boutique en ligne ${c}`,
  (c: string) => `Campagne de courriels ${c}`,
  (c: string) => `Formation d’équipe ${c}`,
];

/** Avancement d'un projet : tâches terminées / tâches totales, ou la saisie manuelle quand il n'a aucune tâche (MJ01). */
export function avancementProjet(projet: Pick<Projet, 'id' | 'avancementManuel'>, taches: readonly Tache[]): number {
  const liees = taches.filter((t) => t.projectId === projet.id);
  if (liees.length === 0) return projet.avancementManuel ?? 0;
  return Math.round((liees.filter((t) => t.status === 'done').length / liees.length) * 100);
}

/** Le statut affiché par MJ01, dans l'ordre exact de la fiche. */
export function statutProjet(avancement: number, echeance: Jour, aujourdhui: Jour, aDesTachesCommencees: boolean): StatutProjet {
  if (avancement >= 100) return 'Terminé';
  if (echeance < aujourdhui) return 'En retard';
  if (avancement >= 85) return 'Presque fini';
  if (avancement <= 20 || !aDesTachesCommencees) return 'À démarrer';
  return 'En cours';
}

/** Où en est un projet au départ : sert seulement à décider combien de ses tâches sont faites. */
export type CibleProjet = 'fini' | 'retard' | 'encours' | 'debut';

export function genererProjets(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[]): { projets: Projet[]; cibles: Map<string, CibleProjet> } {
  const h = hasard(graineDe(ctx.graine, 'projets'));
  const cibles = new Map<string, CibleProjet>();
  const n = compter(ctx.volumes.projets, [0, 4, 12, 60]);
  const resp = ouvres(equipe);
  const liste: Projet[] = [];
  for (let i = 1; i <= n; i += 1) {
    const c = clients.length ? h.choix(clients) : null;
    const nomClient = c ? c.company || c.name : 'la maison';
    const cree = ajouterJours(ctx.aujourdhui, -h.entier(10, 160));
    // Un projet sur huit est déjà fini, un sur six en retard : la grille de MJ01 montre les deux.
    const sort: CibleProjet = h.pondere([['fini', 12], ['retard', 17], ['encours', 55], ['debut', 16]] as const);
    cibles.set(`pr-${String(i).padStart(3, '0')}`, sort);
    const echeance = sort === 'retard' ? ajouterJours(ctx.aujourdhui, -h.entier(2, 20)) : sort === 'fini' ? ajouterJours(ctx.aujourdhui, -h.entier(1, 60)) : ajouterJours(ctx.aujourdhui, h.entier(2, 70));
    const membres = h.echantillon(resp, Math.min(resp.length, h.entier(1, 3)));
    liste.push({
      id: `pr-${String(i).padStart(3, '0')}`,
      title: h.choix(TITRES_PROJET)(nomClient),
      ownerEmail: membres[0]?.email,
      status: 'En cours', // posé par `finaliserProjets` d'après les tâches
      structure: '',
      clientId: c?.id ?? 0,
      priority: h.pondere([['low', 2], ['normal', 6], ['high', 2]] as const),
      nextAction: h.choix(['Valider la maquette', 'Envoyer le devis', 'Planifier la mise en ligne', 'Recueillir les contenus', 'Relire avec le client']),
      deadline: echeance,
      budgetDays: h.entier(3, 25),
      link: '',
      notes: '',
      extra: {},
      createdAt: iso(instantParis(cree, '09:30')),
      updatedAt: iso(instantParis(ajouterJours(ctx.aujourdhui, -h.entier(0, 6)), '16:00')),
      description: `Projet réalisé pour ${nomClient}.`,
      icone: h.choix(ICONES_PROJET),
      membres: membres.map((m) => m.email),
      jalons: [
        { id: `j-${i}-1`, title: 'Lancement validé', jour: ajouterJours(cree, 5), fait: true },
        { id: `j-${i}-2`, title: 'Livraison', jour: echeance, fait: sort === 'fini' },
      ],
      avancementManuel: null,
      termineLe: null,
      archive: false,
    });
  }
  return { projets: liste, cibles };
}

/** Pose le statut, la date de fin et l'archivage, une fois les tâches connues. */
export function finaliserProjets(projets: Projet[], taches: readonly Tache[], aujourdhui: Jour): void {
  const debutTrimestre = `${aujourdhui.slice(0, 4)}-${String(Math.floor((Number(aujourdhui.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  for (const p of projets) {
    const liees = taches.filter((t) => t.projectId === p.id);
    const av = avancementProjet(p, taches);
    p.status = statutProjet(av, p.deadline, aujourdhui, liees.some((t) => t.status !== 'todo'));
    if (p.status === 'Terminé') {
      const fin = liees.map((t) => t.faiteAt?.slice(0, 10) ?? '').sort().pop() || p.deadline;
      p.termineLe = fin;
      p.archive = fin < debutTrimestre;
    }
  }
}

/* -------------------------------- Tâches -------------------------------- */

const MODELES_TACHES: readonly (readonly [string, string])[] = [
  ['Relancer {c} pour la facture en attente', 'relance'],
  ['Envoyer le devis à {c}', 'commercial'],
  ['Mettre à jour le site {de c}', 'site web'],
  ['Appeler {c}', 'commercial'],
  ['Valider la maquette {de c}', 'production'],
  ['Préparer le rendez-vous avec {c}', 'commercial'],
  ['Facturer la mission {de c}', 'facturation'],
  ['Vérifier les sauvegardes du site {de c}', 'sécurité'],
  ['Rédiger le compte rendu de la réunion', 'administratif'],
  ['Commander les fournitures du mois', 'administratif'],
  ['Préparer le point d’équipe', 'équipe'],
  ['Saisir les notes de frais', 'compta'],
  ['Mettre à jour les mots de passe partagés', 'sécurité'],
  ['Trier la boîte de réception', 'administratif'],
  ['Écrire l’article du mois', 'production'],
  ['Préparer la formation de la semaine prochaine', 'formation'],
];

const JOURS_HISTORIQUE = (v: Contexte['volumes']['taches']): number => compter(v, [0, 12, 45, 180]);

export function genererTaches(
  ctx: Contexte,
  equipe: readonly Membre[],
  clients: readonly FicheClient[],
  projets: readonly Projet[],
  cibles: ReadonlyMap<string, CibleProjet>,
): Tache[] {
  const h = hasard(graineDe(ctx.graine, 'taches'));
  const volume = ctx.volumes.taches;
  if (volume === 'vide') return [];
  const m = moi(equipe);
  const ech = compter(volume, [0, 0.35, 1, 6]); // échelle des « tâches du jour » et des tâches à venir
  const liste: Tache[] = [];
  let k = 0;

  const fabrique = (opts: {
    echeance: Jour | null;
    heure?: string | null;
    done: boolean;
    faiteAt?: number;
    assigne?: Membre;
    urgent?: boolean;
    projetId?: string | null;
    suivie?: boolean;
  }): void => {
    k += 1;
    const [modele, etiquette] = h.choix(MODELES_TACHES);
    const client = /\{(de )?c\}/.test(modele) && clients.length ? h.choix(clients) : null;
    const assigne = opts.assigne ?? (h.chance(0.55) ? m : h.choix(equipe));
    const cree = ctx.maintenant - h.entier(1, 20) * 86_400_000;
    // Une tâche ne peut pas avoir été faite après « maintenant » (les rattrapages des derniers jours sont ramenés à avant).
    const faiteMs = Math.min(opts.faiteAt ?? cree, ctx.maintenant - h.entier(5, 90) * 60_000);
    const sous: SousTache[] = h.chance(0.2)
      ? Array.from({ length: h.entier(2, 4) }, (_, j) => ({ id: `${k}-s${j + 1}`, title: h.choix(['Rassembler les éléments', 'Vérifier avec le client', 'Relire', 'Envoyer', 'Archiver']), done: opts.done || h.chance(0.4) }))
      : [];
    const projet = opts.projetId ? projets.find((p) => p.id === opts.projetId) ?? null : null;
    liste.push({
      id: `t-${String(k).padStart(5, '0')}`,
      title: modele.replace('{de c}', client ? deElision(client.company || client.name) : 'du client').replace('{c}', client ? client.company || client.name : 'le client'),
      detail: h.chance(0.3) ? 'Voir la fiche du client pour le contexte.' : '',
      status: opts.done ? 'done' : h.chance(0.12) ? 'doing' : 'todo',
      assigneeEmail: assigne.email,
      siteId: null,
      clientId: client?.id ?? (projet && projet.clientId ? projet.clientId : null),
      createdAt: iso(cree),
      updatedAt: iso(opts.done ? faiteMs : cree),
      echeance: opts.echeance,
      heure: opts.heure ?? null,
      urgent: opts.urgent ?? h.chance(0.08),
      etiquettes: [etiquette, ...(h.chance(0.2) ? [h.choix(ETIQUETTES_TACHES)] : [])].filter((e, i, a) => a.indexOf(e) === i),
      sousTaches: sous,
      suiviPar: assigne.email !== m.email && opts.suivie !== false && h.chance(0.15) ? [m.email] : [],
      projectId: opts.projetId ?? null,
      faiteAt: opts.done ? iso(faiteMs) : null,
    });
  };

  // 1. Aujourd'hui : une grande part de faites, les autres à venir dans la journée (heures croissantes).
  const duJour = Math.max(1, Math.round(8 * ech));
  const faitesAujourdhui = Math.round(duJour * 0.62);
  for (let i = 0; i < duJour; i += 1) {
    const done = i < faitesAujourdhui;
    const heures = ['09:00', '09:30', '11:00', '14:00', '15:30', '17:00', 'Ce soir'];
    fabrique({
      echeance: ctx.aujourdhui,
      heure: done ? (h.chance(0.5) ? hhmm(h.entier(8, 10)) : null) : h.chance(0.8) ? heures[Math.min(i - faitesAujourdhui, heures.length - 1)] : null,
      done,
      faiteAt: done ? instantParis(ctx.aujourdhui, hhmm(7, 30)) + h.entier(0, 150) * 60_000 : undefined,
      assigne: i % 3 === 0 && equipe.length > 1 ? h.choix(equipe) : m,
      urgent: !done && i === faitesAujourdhui,
    });
  }
  // 2. En retard : jamais perdues (H02 : section « En retard » seulement s'il y en a).
  for (let i = 0; i < Math.max(1, Math.round(2 * ech)); i += 1) fabrique({ echeance: ajouterJours(ctx.aujourdhui, -h.entier(1, 6)), done: false, assigne: m });
  // 3. À venir : la semaine en cours puis la suivante.
  for (let i = 0; i < Math.round(6 * ech); i += 1) {
    let jour = ajouterJours(ctx.aujourdhui, h.entier(1, 12));
    while (!estOuvre(jour)) jour = ajouterJours(jour, 1);
    fabrique({ echeance: jour, done: false, heure: h.chance(0.4) ? hhmm(h.entier(9, 16), h.choix([0, 30])) : null });
  }
  // 4. Tâches de projet : l'avancement de chaque projet vient de ses tâches (règle de MJ01).
  for (const p of projets) {
    const sort = cibles.get(p.id) ?? 'encours';
    const total = h.entier(4, 10);
    const part = sort === 'fini' ? 1 : sort === 'debut' ? 0.1 : sort === 'retard' ? h.choix([0.3, 0.5, 0.65]) : h.choix([0.35, 0.5, 0.7, 0.9]);
    const faites = Math.min(total, Math.round(total * part));
    for (let i = 0; i < total; i += 1) {
      const done = i < faites;
      const limite = done ? ajouterJours(ctx.aujourdhui, -h.entier(1, 40)) : ajouterJours(ctx.aujourdhui, h.entier(-3, 25));
      fabrique({ echeance: limite, done, faiteAt: done ? instantParis(limite, hhmm(h.entier(9, 17))) : undefined, projetId: p.id, assigne: h.choix(equipe.filter((x) => p.membres.includes(x.email)).concat([m])) });
    }
  }
  // 5. L'historique : des journées bouclées (ou presque) pour nourrir séries et jalons (N01, L01).
  const profondeur = JOURS_HISTORIQUE(volume);
  let jour = ajouterJours(ctx.aujourdhui, -1);
  let vus = 0;
  while (vus < profondeur) {
    if (estOuvre(jour)) {
      vus += 1;
      const nb = Math.max(1, Math.round(h.entier(2, 5) * Math.min(ech, 2)));
      const bouclee = h.chance(0.86);
      for (let i = 0; i < nb; i += 1) {
        const enRetard = !bouclee && i === nb - 1;
        fabrique({ echeance: jour, done: true, faiteAt: instantParis(enRetard ? ajouterJours(jour, h.entier(1, 3)) : jour, hhmm(h.entier(9, enRetard ? 12 : 18))), assigne: m, urgent: false });
      }
    }
    jour = ajouterJours(jour, -1);
  }
  return liste.sort((a, b) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') || a.id.localeCompare(b.id));
}

export interface JourneeDeTravail {
  jour: Jour;
  prevues: number;
  faitesLeJour: number;
  bouclee: boolean;
}

/**
 * Les journées de travail d'une personne, du plus récent au plus ancien :
 * « bouclée » = toutes les tâches dont l'échéance est ce jour-là sont faites CE
 * JOUR-LÀ (règle de L01, qui compte à la clôture). Les jours sans tâche et les
 * week-ends n'y figurent pas, donc ne cassent pas la série.
 */
export function journeesDeTravail(taches: readonly Tache[], email: string, jusqua: Jour, nombre = 90): JourneeDeTravail[] {
  const mes = taches.filter((t) => t.assigneeEmail === email && t.echeance);
  const parJour = new Map<Jour, Tache[]>();
  for (const t of mes) parJour.set(t.echeance as Jour, [...(parJour.get(t.echeance as Jour) ?? []), t]);
  return [...parJour.entries()]
    .filter(([j]) => j <= jusqua)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, nombre)
    .map(([j, l]) => {
      const faites = l.filter((t) => t.status === 'done' && t.faiteAt && jourDe(Date.parse(t.faiteAt)) <= j).length;
      return { jour: j, prevues: l.length, faitesLeJour: faites, bouclee: faites === l.length };
    });
}

/** La série en cours : jours de travail consécutifs bouclés, en comptant aujourd'hui seulement s'il l'est. */
export function serieEnCours(journees: readonly JourneeDeTravail[], aujourdhui: Jour): number {
  let serie = 0;
  for (const j of journees) {
    if (j.jour === aujourdhui && !j.bouclee) continue; // la journée d'aujourd'hui n'est pas encore jouée
    if (!j.bouclee) break;
    serie += 1;
  }
  return serie;
}

/* ------------------------------ Événements ------------------------------ */

const FAMILLE: Record<TypeEvenement, Evenement['famille']> = {
  'rendez-vous client': 'contacts', 'réunion': 'jour', facturation: 'argent', bilan: 'jour', chantier: 'creer', personnel: 'gris', 'système': 'outils',
};

export function genererEvenements(
  ctx: Contexte,
  equipe: readonly Membre[],
  clients: readonly FicheClient[],
  factures: readonly Facture[],
): Evenement[] {
  const h = hasard(graineDe(ctx.graine, 'evenements'));
  const volume = ctx.volumes.evenements;
  if (volume === 'vide') return [];
  const m = moi(equipe);
  const liste: Evenement[] = [];
  let k = 0;

  const ajouter = (o: {
    jour: Jour;
    debut: string;
    duree: number;
    titre: string;
    type: TypeEvenement;
    client?: FicheClient | null;
    lieu?: string;
    participants?: Membre[];
    facture?: Facture | null;
    manque?: boolean;
    mode?: Evenement['mode'];
  }): void => {
    k += 1;
    const debutMs = instantParis(o.jour, o.debut);
    const passe = debutMs + o.duree * 60_000 <= ctx.maintenant;
    const c = o.client ?? null;
    const annule = o.manque === true;
    const par = (o.participants ?? [m]).map((p) => p.email);
    liste.push({
      id: `ev-${String(k).padStart(4, '0')}`,
      title: o.titre,
      startAt: iso(debutMs),
      durationMin: o.duree,
      clientId: c?.id ?? null,
      clientName: c ? c.company || c.name : '',
      location: o.lieu ?? '',
      notes: '',
      reminderMin: o.type === 'système' ? 0 : h.choix([0, 10, 15, 30]),
      status: annule ? 'cancelled' : passe ? 'done' : 'scheduled',
      createdAt: iso(debutMs - 5 * 86_400_000),
      updatedAt: iso(Math.min(debutMs, ctx.maintenant)),
      type: o.type,
      endAt: iso(debutMs + o.duree * 60_000),
      participants: par,
      famille: FAMILLE[o.type],
      factureId: o.facture?.id ?? null,
      confirmation: annule ? 'manqué' : debutMs > ctx.maintenant && h.chance(0.2) ? 'à confirmer' : 'confirmé',
      mode: o.mode ?? (o.lieu?.toLowerCase().includes('visio') ? 'visio' : 'salle'),
      systeme: o.type === 'système',
    });
  };

  const aujourdhui = ctx.aujourdhui;
  const lundi = lundiDe(aujourdhui);
  const clientAleatoire = (): FicheClient | null => (clients.length ? h.choix(clients) : null);
  const echelle = compter(volume, [0, 0.3, 1, 7]);

  // Rituels : le point d'équipe du lundi, le bilan du vendredi, une ronde de La Garde chaque jour ouvré.
  const semaines = Math.max(1, Math.round(5 * Math.min(echelle, 2)));
  for (let s = -semaines; s <= 2; s += 1) {
    const lun = ajouterJours(lundi, s * 7);
    ajouter({ jour: lun, debut: '09:30', duree: 30, titre: 'Point d’équipe', type: 'réunion', participants: [...equipe], lieu: 'Salle de réunion' });
    ajouter({ jour: ajouterJours(lun, 4), debut: '16:30', duree: 45, titre: 'Bilan de la semaine', type: 'bilan', participants: [...equipe], lieu: 'Visio' });
    for (let j = 0; j < 5; j += 1) {
      const jour = ajouterJours(lun, j);
      if (s >= 0 && s <= 1) ajouter({ jour, debut: '12:00', duree: 15, titre: 'Ronde de La Garde', type: 'système', lieu: '' });
    }
  }
  // Aujourd'hui, tel que le montrent les maquettes : stand-up passé, rendez-vous, facturation.
  const deMaintenant = ctx.aujourdhui;
  ajouter({ jour: deMaintenant, debut: '09:00', duree: 30, titre: 'Stand-up', type: 'réunion', participants: [...equipe], lieu: 'Visio' });
  const clientDuJour = clientAleatoire();
  ajouter({ jour: deMaintenant, debut: '11:00', duree: 60, titre: clientDuJour ? `Rendez-vous ${clientDuJour.company || clientDuJour.name}` : 'Rendez-vous client', type: 'rendez-vous client', client: clientDuJour, lieu: 'Salle clients' });
  const aFacturer = factures.find((f) => f.status === 'issued' && f.dueAt <= ajouterJours(aujourdhui, 7));
  ajouter({ jour: deMaintenant, debut: '14:00', duree: 60, titre: 'Facturation du mois', type: 'facturation', facture: aFacturer ?? null, lieu: '' });

  // Le reste : des rendez-vous clients, du chantier, du personnel, répartis de -45 à +30 jours.
  const reste = Math.round(24 * echelle);
  for (let i = 0; i < reste; i += 1) {
    let jour = ajouterJours(aujourdhui, h.entier(-45, 30));
    while (!estOuvre(jour)) jour = ajouterJours(jour, 1);
    const type = h.pondere([['rendez-vous client', 6], ['réunion', 2], ['chantier', 1.5], ['personnel', 1], ['facturation', 1]] as const);
    const c = type === 'rendez-vous client' || type === 'chantier' ? clientAleatoire() : null;
    const debutH = h.entier(8, 17);
    const manque = type === 'rendez-vous client' && jour < aujourdhui && h.chance(0.08);
    ajouter({
      jour,
      debut: hhmm(debutH, h.choix([0, 15, 30, 45])),
      duree: h.choix([30, 45, 60, 60, 90, 120]),
      titre: type === 'rendez-vous client' ? `${h.choix(['Rendez-vous', 'Point', 'Démonstration', 'Visite'])} ${c ? c.company || c.name : 'client'}` : type === 'chantier' ? `Chantier ${c ? c.company || c.name : ''}`.trim() : type === 'personnel' ? h.choix(['Déjeuner', 'Médecin', 'Banque']) : type === 'facturation' ? 'Relances de factures' : h.choix(['Revue de projet', 'Atelier contenus', 'Point sécurité']),
      type,
      client: c,
      lieu: h.choix(['Salle clients', 'Visio', 'Chez le client', 'Atelier']),
      participants: type === 'personnel' ? [m] : h.echantillon(equipe, h.entier(1, Math.min(3, equipe.length))),
      manque,
      mode: type === 'rendez-vous client' ? h.choix(['salle', 'visio', 'chez le client', 'téléphone'] as const) : undefined,
    });
  }
  return liste.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/* -------------------------------- Tickets -------------------------------- */

const TITRES_TICKETS = [
  'Le site ne charge plus depuis ce matin', 'Mise à jour de sécurité à planifier', 'Demande de modification du logo', 'Question sur la facture du mois',
  'Le formulaire de contact renvoie une erreur', 'Ajouter une page « Tarifs »', 'Les photos du catalogue sont floues', 'Changer l’adresse de livraison affichée',
  'Sauvegarde à restaurer', 'Mot de passe oublié sur l’espace client', 'Corriger une faute dans les mentions légales', 'Créer une boîte courriel pour une nouvelle recrue',
  'Le panier se vide à la dernière étape', 'Préparer l’inventaire de fin d’année',
];

export function genererTickets(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[]): Ticket[] {
  const h = hasard(graineDe(ctx.graine, 'tickets'));
  const n = compter(ctx.volumes.tickets, [0, 5, 14, 90]);
  const resp = ouvres(equipe);
  const liste: Ticket[] = [];
  for (let i = 1; i <= n; i += 1) {
    const colonne = (i <= 3 && n >= 8 ? 'en-cours' : h.pondere([['a-faire', 30], ['en-cours', 22], ['en-revue', 18], ['termine', 30]] as const)) as Ticket['colonne'];
    const c = clients.length && h.chance(0.55) ? h.choix(clients) : null;
    const termine = colonne === 'termine';
    const cree = ajouterJours(ctx.aujourdhui, -h.entier(0, termine ? 40 : 14));
    // « Terminé » n'affiche que la semaine écoulée (H03) ; les plus anciens vont aux archives.
    const fin = termine ? ajouterJours(ctx.aujourdhui, -h.entier(0, 40)) : null;
    const urgent = !termine && (i === 4 || h.chance(0.08));
    const total = h.chance(0.55) ? h.entier(2, 5) : 0;
    liste.push({
      id: `tk-${String(i).padStart(4, '0')}`,
      title: h.choix(TITRES_TICKETS),
      detail: '',
      colonne,
      urgent,
      clientId: c?.id ?? null,
      clientNom: c ? c.company || c.name : null,
      etiquette: h.choix(ETIQUETTES_TICKETS),
      sousTaches: { faites: termine ? total : h.entier(0, Math.max(0, total - 1)), total },
      assigneeEmail: h.choix(resp).email,
      echeance: termine ? null : h.chance(0.6) ? ajouterJours(ctx.aujourdhui, h.entier(-1, 10)) : null,
      termineLe: fin,
      commentaires: termine ? 0 : h.entier(0, 6),
      partageClient: c !== null && h.chance(0.45),
      ordre: 0,
      creeLe: iso(instantParis(cree, hhmm(h.entier(8, 18), h.entier(0, 59)))),
      luAt: urgent && h.chance(0.7) ? iso(ctx.maintenant - h.entier(2, 60) * 60_000) : null,
    });
  }

  // Garanties : le tableau doit montrer ses quatre colonnes, des urgents ouverts et des tickets partagés (H03, N01).
  const colonnes: Ticket['colonne'][] = ['a-faire', 'en-cours', 'en-revue', 'termine'];
  if (n >= 8) {
    for (const col of colonnes) {
      if (liste.some((t) => t.colonne === col)) continue;
      const donneur = colonnes.map((c) => liste.filter((t) => t.colonne === c)).sort((a, b) => b.length - a.length)[0];
      const t = donneur[donneur.length - 1];
      t.colonne = col;
      t.urgent = col === 'termine' ? false : t.urgent;
      t.termineLe = col === 'termine' ? ajouterJours(ctx.aujourdhui, -h.entier(0, 5)) : null;
      t.commentaires = col === 'termine' ? 0 : t.commentaires;
    }
  }
  const ouverts = liste.filter((t) => t.colonne !== 'termine');
  const urgentsVoulus = n >= 14 ? 2 : n >= 3 ? 1 : 0;
  for (const t of ouverts) {
    if (liste.filter((x) => x.urgent && x.colonne !== 'termine').length >= urgentsVoulus) break;
    t.urgent = true;
  }
  if (n >= 5 && clients.length && !liste.some((t) => t.partageClient && t.clientId !== null)) {
    const t = ouverts.find((x) => x.clientId !== null) ?? ouverts[0];
    if (t) {
      const c = t.clientId !== null ? null : h.choix(clients);
      if (c) { t.clientId = c.id; t.clientNom = c.company || c.name; }
      t.partageClient = true;
    }
  }
  for (const col of colonnes) liste.filter((t) => t.colonne === col).forEach((t, rang) => { t.ordre = rang; });
  return liste;
}

/* ----------------------------- Notes rapides ----------------------------- */

const MODELES_NOTES: readonly (readonly [string, string])[] = [
  ['Idées pour le site {de c}', 'Mettre la prise de rendez-vous en haut de page.\nAjouter trois avis de clients.\nRaccourcir le texte d’accueil.'],
  ['Compte rendu — point d’équipe', 'Priorité de la semaine : les factures en retard.\nYanis prépare la mise à jour de sécurité.\nProchain point lundi.'],
  ['À demander à {c}', 'Le logo en haute définition.\nLes horaires d’ouverture à jour.\nUn contact pour la comptabilité.'],
  ['Liste pour l’atelier', 'Câbles réseau, deux rallonges, des étiquettes.'],
  ['Appel avec {c}', 'Souhaite une offre pour la maintenance. Rappeler jeudi matin.'],
  ['Phrase d’accroche', '« Votre site, simple et sûr. » À tester sur la page d’accueil.'],
  ['Procédure de sauvegarde', '1. Lancer la sauvegarde.\n2. Vérifier le journal.\n3. Noter la date.'],
];

export function genererNotes(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[], projets: readonly Projet[], taches: readonly Tache[]): NoteRapide[] {
  const h = hasard(graineDe(ctx.graine, 'notes'));
  const n = compter(ctx.volumes.notes, [0, 5, 16, 120]);
  const m = moi(equipe);
  const liste: NoteRapide[] = [];
  for (let i = 1; i <= n; i += 1) {
    const [titre, corps] = h.choix(MODELES_NOTES);
    const c = /\{(de )?c\}/.test(titre) && clients.length ? h.choix(clients) : null;
    const nom = c ? c.company || c.name : 'le client';
    const equipeNote = h.chance(0.4);
    const auteur = equipeNote ? h.choix(equipe) : m;
    const age = Math.floor(h.reel() ** 1.8 * 60);
    const maj = ctx.maintenant - age * 86_400_000 - h.entier(0, 20) * 3_600_000;
    const projet = projets.length && h.chance(0.2) ? h.choix(projets) : null;
    const tache = taches.length && h.chance(0.15) ? h.choix(taches) : null;
    liste.push({
      id: `n-${String(i).padStart(4, '0')}`,
      scope: equipeNote ? 'team' : 'personal',
      title: titre.replace('{de c}', deElision(nom)).replace('{c}', nom),
      body: corps.replace('{de c}', deElision(nom)).replace('{c}', nom),
      authorEmail: auteur.email,
      pinned: h.chance(0.15),
      projectId: projet?.id,
      createdAt: iso(maj - h.entier(0, 6) * 3_600_000),
      updatedAt: iso(maj),
      etiquette: h.chance(0.55) ? h.choix(ETIQUETTES_TACHES) : null,
      visibilite: equipeNote ? 'équipe' : h.chance(0.1) ? 'personnes choisies' : 'privée',
      clientId: c?.id ?? null,
      tacheId: tache?.id ?? null,
      nonLue: auteur.email !== m.email && age <= 2 && h.chance(0.5),
    });
  }
  return liste.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/* -------------------------------- Rappels -------------------------------- */

export function genererRappels(
  ctx: Contexte,
  equipe: readonly Membre[],
  clients: readonly FicheClient[],
  factures: readonly Facture[],
): Rappel[] {
  const h = hasard(graineDe(ctx.graine, 'rappels'));
  const n = compter(ctx.volumes.rappels, [0, 6, 18, 150]);
  const m = moi(equipe);
  const liste: Rappel[] = [];
  const impayees = factures.filter((f) => f.status === 'issued' && f.dueAt < ctx.aujourdhui);
  for (let i = 1; i <= n; i += 1) {
    // Les trois premiers reproduisent la journée : un en retard, deux à venir.
    const decalage = i === 1 ? -1.2 : i === 2 ? 3.5 : i === 3 ? 6.2 : Math.round((h.reel() ** 1.3 * 2 - 0.8) * 60 * 24); // heures, puis jours en minutes
    const quand = i <= 3 ? ctx.maintenant + decalage * 3_600_000 : ctx.maintenant + decalage * 60_000 * (h.chance(0.3) ? 1 : 0.2);
    const futur = quand > ctx.maintenant;
    const f = impayees.length && h.chance(0.3) ? h.choix(impayees) : null;
    const c = !f && clients.length && h.chance(0.35) ? h.choix(clients) : null;
    const fait = !futur && h.chance(i <= 3 ? 0 : 0.72);
    const aLHeure = h.chance(0.82);
    const systeme = i === 4;
    liste.push({
      id: `r-${String(i).padStart(4, '0')}`,
      title: systeme ? 'Sauvegarde hebdomadaire' : f ? `Relancer la facture ${f.number}` : c ? `Rappeler ${c.company || c.name}` : h.choix(['Envoyer le bilan', 'Réserver la salle', 'Préparer la paie', 'Renouveler le nom de domaine', 'Faire le point sur les stocks']),
      sousTitre: systeme ? 'Rappel automatique' : f ? f.clientNom : c ? 'Appel client' : '',
      pourEmail: h.chance(0.7) ? m.email : h.choix(equipe).email,
      quandAt: iso(quand),
      fait,
      faitAt: fait ? iso(Math.min(aLHeure ? quand - h.entier(1, 40) * 60_000 : quand + h.entier(60, 2000) * 60_000, ctx.maintenant - 60_000)) : null,
      avanceeMin: h.choix([0, 5, 15, 30, 60]),
      lien: f ? { type: 'facture', id: f.id } : c ? { type: 'client', id: String(c.id) } : { type: null, id: null },
      recurrence: systeme ? { regle: 'Chaque vendredi à 17 h', actif: true, prochaineAt: iso(instantParis(ctx.aujourdhui, '17:00')) } : h.chance(0.1) ? { regle: h.choix(['Chaque lundi', 'Le 1er de chaque mois', 'Chaque trimestre']), actif: h.chance(0.8), prochaineAt: iso(ctx.maintenant + h.entier(1, 30) * 86_400_000) } : null,
      visibilite: h.chance(0.6) ? 'équipe' : 'privé',
      canal: h.pondere([['application', 5], ['application et mobile', 4], ['courriel', 1]] as const),
      urgent: h.chance(0.08),
      creeParEmail: m.email,
      systeme,
    });
  }
  return liste.sort((a, b) => a.quandAt.localeCompare(b.quandAt));
}

/* ------------------------------- Habitudes ------------------------------- */

const MODELES_HABITUDES: readonly {
  nom: string; description: string; icone: string; frequence: Habitude['frequence']; mesure: Habitude['mesure']; source: Habitude['source']; reussite: number;
}[] = [
  { nom: 'Boire 2 litres d’eau', description: 'Une gourde le matin, une l’après-midi.', icone: 'droplet', frequence: { type: 'tous les jours' }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.86 },
  { nom: 'Marcher 8 000 pas', description: 'Compté par le téléphone.', icone: 'footprints', frequence: { type: 'tous les jours' }, mesure: { type: 'objectif', cible: 8000, unite: 'pas' }, source: 'téléphone', reussite: 0.66 },
  { nom: 'Lire 20 minutes', description: 'Un livre, pas un écran.', icone: 'book', frequence: { type: 'jours choisis', jours: [1, 2, 3, 4, 5] }, mesure: { type: 'objectif', cible: 20, unite: 'minutes' }, source: 'manuelle', reussite: 0.57 },
  { nom: 'Séance de sport', description: 'Trois fois par semaine.', icone: 'dumbbell', frequence: { type: 'fois par semaine', fois: 3 }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.71 },
  { nom: 'Boîte de réception à zéro', description: 'Vider la boîte avant 17 h.', icone: 'inbox', frequence: { type: 'jours choisis', jours: [1, 2, 3, 4, 5] }, mesure: { type: 'case' }, source: 'module', reussite: 0.43 },
  { nom: 'Planifier la semaine', description: 'Le lundi matin, vingt minutes.', icone: 'calendar', frequence: { type: 'jours choisis', jours: [1] }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.92 },
  { nom: 'Relire les dépenses', description: 'Chaque vendredi.', icone: 'receipt', frequence: { type: 'jours choisis', jours: [5] }, mesure: { type: 'case' }, source: 'module', reussite: 0.78 },
  { nom: 'Méditer', description: 'Cinq minutes, le soir.', icone: 'moon', frequence: { type: 'tous les jours' }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.35 },
  { nom: 'Appeler un client sans raison', description: 'Prendre des nouvelles.', icone: 'phone', frequence: { type: 'fois par semaine', fois: 2 }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.6 },
  { nom: 'Ranger le bureau', description: 'Avant de partir.', icone: 'box', frequence: { type: 'jours choisis', jours: [1, 2, 3, 4, 5] }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.5 },
  { nom: 'Écrire trois lignes', description: 'Dans le journal.', icone: 'pen', frequence: { type: 'tous les jours' }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.55 },
  { nom: 'Étirements', description: 'Dix minutes au réveil.', icone: 'activity', frequence: { type: 'tous les jours' }, mesure: { type: 'case' }, source: 'manuelle', reussite: 0.4 },
];

function prevueCeJour(hab: Habitude['frequence'], jour: Jour): boolean {
  if (hab.type === 'tous les jours') return true;
  if (hab.type === 'jours choisis') return (hab.jours ?? []).includes(jourSemaine(jour));
  return true; // « n fois par semaine » : prévue tant que l'objectif de la semaine n'est pas atteint (calcul de l'écran)
}

export function genererHabitudes(ctx: Contexte, equipe: readonly Membre[]): Habitude[] {
  const h = hasard(graineDe(ctx.graine, 'habitudes'));
  const n = compter(ctx.volumes.habitudes, [0, 3, 6, 12]);
  const m = moi(equipe);
  return MODELES_HABITUDES.slice(0, n).map((mod, i) => {
    const historique: Record<Jour, number> = {};
    const debut = ajouterJours(ctx.aujourdhui, -h.entier(60, 200));
    const semaine = new Map<Jour, number>();
    for (let d = 120; d >= 0; d -= 1) {
      const jour = ajouterJours(ctx.aujourdhui, -d);
      if (jour < debut || !prevueCeJour(mod.frequence, jour)) continue;
      // Aujourd'hui (10 h 15) : seules les habitudes du matin peuvent déjà être faites.
      const probabilite = d === 0 ? mod.reussite * 0.35 : mod.reussite;
      const lun = lundiDe(jour);
      if (mod.frequence.type === 'fois par semaine' && (semaine.get(lun) ?? 0) >= (mod.frequence.fois ?? 1)) continue;
      if (h.chance(mod.frequence.type === 'fois par semaine' ? Math.min(0.9, probabilite * 0.55) : probabilite)) {
        historique[jour] = mod.mesure.type === 'objectif' ? Math.round(mod.mesure.cible * h.choix([0.5, 0.8, 1, 1.15, 1.4])) : 1;
        semaine.set(lun, (semaine.get(lun) ?? 0) + 1);
      }
    }
    return {
      id: `h-${String(i + 1).padStart(3, '0')}`,
      nom: mod.nom,
      description: mod.description,
      icone: mod.icone,
      frequence: mod.frequence,
      mesure: mod.mesure,
      source: mod.source,
      proprietaireEmail: m.email,
      debut,
      archivee: false,
      historique,
    };
  });
}

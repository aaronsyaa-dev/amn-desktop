/**
 * LES JEUX « CONTACTS » — clients, interlocuteurs, prospects, fournisseurs,
 * achats, avis (lot 02 : H05, G04, H06, H44, H45, MC01, MC03, T02).
 *
 * Les clients sont créés d'abord, SANS santé ni statut : ces deux valeurs
 * dépendent des factures, qui n'existent pas encore. `finaliserClients` les pose
 * une fois le reste du monde construit, avec la formule que propose la fiche H05
 * (« à confirmer dans le code »). Un écran doit refaire ce calcul lui-même ;
 * les valeurs d'ici servent à comparer.
 */

import {
  ARTICLES_ACHAT, ECHANGES, FONCTIONS, FOURNISSEURS, MOTS_ENTREPRISE, NOMS, PRENOMS, PRESTATIONS, RUES, TEXTES_AVIS_MOYENS,
  TEXTES_AVIS_NEGATIFS, TEXTES_AVIS_POSITIFS, THEMES_AVIS, TYPES_ENTREPRISE, VILLES,
} from './fond';
import {
  ajouterJours, arrondir, centimes, compter, courriel, DOMAINE_COURRIEL, ecartJours, graineDe, hasard, instantParis, iso, jourDe, slug,
  telephone, type Hasard, type Jour,
} from './outils';
import type {
  Achat, Avis, Contexte, Devis, Evenement, Facture, FicheClient, Fournisseur, Interlocuteur, Membre, Prospect, StatutClientAffiche,
} from './types';

/* ------------------------------ Aides ------------------------------ */

export function personne(h: Hasard): { prenom: string; nom: string } {
  return { prenom: h.choix(PRENOMS), nom: h.choix(NOMS) };
}

/** Un nom d'entreprise inventé et unique : `Boulangerie des Tilleuls`. */
function nomEntreprise(h: Hasard, deja: Set<string>): { nom: string; secteur: string } {
  for (let essai = 0; essai < 60; essai += 1) {
    const [type, secteur] = h.choix(TYPES_ENTREPRISE);
    const nom = `${type} ${h.choix(MOTS_ENTREPRISE)}`;
    if (!deja.has(nom)) {
      deja.add(nom);
      return { nom, secteur };
    }
  }
  // Repli (très gros volumes) : un numéro lève l'ambiguïté.
  const [type, secteur] = h.choix(TYPES_ENTREPRISE);
  const nom = `${type} ${h.choix(MOTS_ENTREPRISE)} ${deja.size + 1}`;
  deja.add(nom);
  return { nom, secteur };
}

const adresse = (h: Hasard, ville: readonly [string, string]): string => `${h.entier(1, 98)} ${h.choix(RUES)}, ${ville[1]} ${ville[0]}`;

/** Un écart « dernier échange » plausible, en jours : surtout récent, avec une longue traîne. */
const ecartEchange = (h: Hasard): number =>
  h.pondere([
    [h.entier(0, 2), 30], [h.entier(3, 5), 25], [h.entier(6, 14), 20], [h.entier(15, 30), 15], [h.entier(31, 90), 10],
  ] as const);

const suiveurs = (equipe: readonly Membre[]): Membre[] => {
  const l = equipe.filter((m) => m.role === 'Administrateur' || m.role === 'Membre');
  return l.length ? l : [...equipe];
};

/* ------------------------------ Clients ------------------------------ */

export function genererClients(ctx: Contexte, equipe: readonly Membre[]): FicheClient[] {
  const h = hasard(graineDe(ctx.graine, 'clients'));
  const n = compter(ctx.volumes.clients, [0, 6, 48, 300]);
  const resp = suiveurs(equipe);
  const deja = new Set<string>();
  const clients: FicheClient[] = [];
  for (let i = 1; i <= n; i += 1) {
    const nature: 'organisation' | 'personne' = h.chance(0.08) ? 'personne' : 'organisation';
    const contact = personne(h);
    const ville = h.choix(VILLES);
    const org = nature === 'organisation' ? nomEntreprise(h, deja) : { nom: '', secteur: h.choix(['Particulier', 'Profession libérale', 'Association']) };
    const debutLe = ajouterJours(ctx.aujourdhui, -h.entier(25, 1100));
    const dernier = ctx.maintenant - ecartEchange(h) * 86_400_000 - h.entier(0, 8) * 3_600_000;
    const domaine = nature === 'organisation' ? `${slug(org.nom)}.${DOMAINE_COURRIEL}` : DOMAINE_COURRIEL;
    const echanges = h.echantillon(ECHANGES, h.entier(2, 5));
    const debutMs = instantParis(debutLe, '09:00');
    const events = echanges
      .map((e, k) => ({ e, quand: debutMs + Math.round(((dernier - debutMs) * (k + 1)) / echanges.length) }))
      .map(({ e, quand }, k) => ({ id: i * 100 + k, clientId: i, title: e[0], detail: e[1], date: iso(quand) }));
    clients.push({
      id: i,
      name: `${contact.prenom} ${contact.nom}`,
      company: org.nom,
      status: h.chance(0.07) ? 'paused' : 'active',
      email: nature === 'organisation' ? `${slug(contact.prenom)}.${slug(contact.nom)}@${domaine}` : courriel(`${contact.prenom} ${contact.nom}`),
      phone: telephone(h, nature === 'personne' || h.chance(0.3)),
      notes: h.chance(0.35) ? h.choix(['Préfère être appelé le matin.', 'Facture à envoyer à la comptabilité.', 'Client depuis le premier lancement.', 'Souhaite un devis détaillé.']) : '',
      imageDataUrl: '',
      linkedSiteIds: [],
      createdAt: iso(debutMs),
      updatedAt: iso(dernier),
      events,
      secteur: org.secteur,
      ville: ville[0],
      adresse: adresse(h, ville),
      siteWeb: nature === 'organisation' ? `https://www.${domaine}` : '',
      responsableEmail: h.choix(resp).email,
      debutLe,
      dernierEchangeAt: iso(dernier),
      sante: 70,
      statutAffiche: 'Actif',
      nature,
      tags: h.echantillon(['fidèle', 'à suivre', 'grand compte', 'recommandé', 'saisonnier', 'nouveau'], h.entier(0, 2)),
    });
  }
  return clients;
}

/** Interlocuteurs : un à trois par client, un à deux par fournisseur. */
export function genererInterlocuteurs(
  ctx: Contexte,
  clients: readonly FicheClient[],
  fournisseurs: readonly Fournisseur[],
  prospects: readonly Prospect[],
): Interlocuteur[] {
  const h = hasard(graineDe(ctx.graine, 'interlocuteurs'));
  const volume = compter(ctx.volumes.interlocuteurs, [0, 1, 2, 3]); // plafond par organisation
  const liste: Interlocuteur[] = [];
  let k = 0;
  const ajouter = (type: Interlocuteur['organisationType'], id: string, nom: string, domaine: string, principal?: { prenom: string; nom: string }): void => {
    const n = volume === 0 ? 0 : h.entier(1, volume);
    for (let j = 0; j < n; j += 1) {
      const p = j === 0 && principal ? principal : personne(h);
      k += 1;
      const echange = ctx.maintenant - ecartEchange(h) * 86_400_000 - h.entier(0, 9) * 3_600_000;
      liste.push({
        id: `i-${String(k).padStart(4, '0')}`,
        prenom: p.prenom,
        nom: p.nom,
        nomComplet: `${p.prenom} ${p.nom}`,
        fonction: h.choix(FONCTIONS),
        organisationType: type,
        organisationId: id,
        organisationNom: nom,
        email: `${slug(p.prenom)}.${slug(p.nom)}@${domaine}`,
        telephone: telephone(h, h.chance(0.5)),
        notes: h.chance(0.25) ? 'À joindre de préférence en début de semaine.' : '',
        favori: h.chance(0.12),
        dernierEchangeAt: iso(echange),
        nonLu: h.chance(0.1),
        preference: h.choix(['courriel', 'téléphone', 'messagerie'] as const),
      });
    }
  };
  for (const c of clients) {
    const [prenom, ...reste] = c.name.split(' ');
    ajouter('client', String(c.id), c.company || c.name, c.company ? `${slug(c.company)}.${DOMAINE_COURRIEL}` : DOMAINE_COURRIEL, { prenom, nom: reste.join(' ') });
  }
  for (const f of fournisseurs) ajouter('fournisseur', f.id, f.nom, `${slug(f.nom)}.${DOMAINE_COURRIEL}`);
  for (const p of prospects) {
    const [prenom, ...reste] = p.contactNom.split(' ');
    ajouter('prospect', p.id, p.nom, `${slug(p.nom)}.${DOMAINE_COURRIEL}`, { prenom, nom: reste.join(' ') });
  }
  return liste.sort((a, b) => b.dernierEchangeAt.localeCompare(a.dernierEchangeAt));
}

/* ------------------------------ Prospects ------------------------------ */

const ACTIONS_PROSPECT: Record<string, readonly string[]> = {
  nouveau: ['Appeler pour qualifier le besoin', 'Envoyer la présentation'],
  contacté: ['Proposer un rendez-vous', 'Relancer par courriel'],
  'rendez-vous': ['Préparer la proposition', 'Valider le périmètre'],
  'devis envoyé': ['Relancer après l’envoi du devis', 'Répondre à la question sur le prix'],
  gagné: ['Planifier le lancement'],
  perdu: ['Garder le contact pour plus tard'],
};

export function genererProspects(ctx: Contexte, equipe: readonly Membre[]): Prospect[] {
  const h = hasard(graineDe(ctx.graine, 'prospects'));
  const n = compter(ctx.volumes.prospects, [0, 6, 18, 90]);
  const resp = suiveurs(equipe);
  const deja = new Set<string>();
  const liste: Prospect[] = [];
  for (let i = 1; i <= n; i += 1) {
    const etape = h.pondere([['nouveau', 3], ['contacté', 3], ['rendez-vous', 2.5], ['devis envoyé', 2.5], ['gagné', 2], ['perdu', 1.5]] as const);
    const org = nomEntreprise(h, deja);
    const contact = personne(h);
    const [offre, prix, rec] = h.choix(PRESTATIONS);
    const cree = ajouterJours(ctx.aujourdhui, -h.entier(3, etape === 'gagné' || etape === 'perdu' ? 85 : 45));
    // « Gagné ce mois » : H06 ne garde que les signatures du mois civil en cours.
    const duMois = h.chance(0.7);
    const signe = etape === 'gagné' ? (duMois ? ajouterJours(ctx.aujourdhui, -h.entier(0, Math.max(0, Number(ctx.aujourdhui.slice(8)) - 1))) : ajouterJours(ctx.aujourdhui, -h.entier(32, 80))) : null;
    const perdu = etape === 'perdu' ? ajouterJours(ctx.aujourdhui, -h.entier(2, 80)) : null;
    const avecMontant = etape !== 'nouveau' || h.chance(0.4);
    const montant = avecMontant ? arrondir(centimes(prix * h.pondere([[1, 5], [2, 2], [3, 1]] as const)), 5000) : null;
    const proba = { nouveau: 10, contacté: 25, 'rendez-vous': 45, 'devis envoyé': 70, gagné: 100, perdu: 0 }[etape];
    liste.push({
      id: `p-${String(i).padStart(4, '0')}`,
      nom: org.nom,
      contactNom: `${contact.prenom} ${contact.nom}`,
      offre,
      montantCents: montant,
      recurrence: rec,
      etape,
      probabilite: proba,
      responsableEmail: h.choix(resp).email,
      prochaineAction: h.choix(ACTIONS_PROSPECT[etape]),
      prochaineActionLe: etape === 'gagné' || etape === 'perdu' ? null : ajouterJours(ctx.aujourdhui, h.entier(-3, 10)),
      urgent: etape !== 'gagné' && etape !== 'perdu' && h.chance(0.12),
      checklist: { faites: h.entier(0, 4), total: h.entier(4, 5) },
      creeLe: cree,
      signeLe: signe,
      perduLe: perdu,
      clientId: null,
    });
  }
  return liste;
}

/** MC01 regroupe H06 en quatre colonnes : « contacté » rejoint « nouveau », « gagné » devient « signé ». */
export function groupePipeline(etape: Prospect['etape']): 'Nouveau' | 'Rendez-vous' | 'Devis envoyé' | 'Signé' | null {
  if (etape === 'nouveau' || etape === 'contacté') return 'Nouveau';
  if (etape === 'rendez-vous') return 'Rendez-vous';
  if (etape === 'devis envoyé') return 'Devis envoyé';
  if (etape === 'gagné') return 'Signé';
  return null;
}

/* ----------------------- Fournisseurs et achats ----------------------- */

export function genererFournisseurs(ctx: Contexte): Fournisseur[] {
  const h = hasard(graineDe(ctx.graine, 'fournisseurs'));
  const n = compter(ctx.volumes.fournisseurs, [0, 4, 10, 18]);
  const ordre = h.melanger(FOURNISSEURS);
  return ordre.slice(0, n).map(([nom, categorie], i) => {
    const contact = personne(h);
    const ville = h.choix(VILLES);
    return {
      id: `f-${String(i + 1).padStart(3, '0')}`,
      nom,
      categorie,
      contactNom: `${contact.prenom} ${contact.nom}`,
      email: `commandes@${slug(nom)}.${DOMAINE_COURRIEL}`,
      telephone: telephone(h, false),
      adresse: adresse(h, ville),
      delaiAnnonceJours: h.pondere([[1, 3], [2, 3], [3, 2], [5, 2], [7, 1]] as const),
      note: h.chance(0.3) ? 'Livraison gratuite au-delà de 150 €.' : '',
      negociationLe: h.chance(0.3) ? ajouterJours(ctx.aujourdhui, -h.entier(40, 300)) : null,
    };
  });
}

export function genererAchats(ctx: Contexte, fournisseurs: readonly Fournisseur[]): Achat[] {
  const h = hasard(graineDe(ctx.graine, 'achats'));
  const n = fournisseurs.length === 0 ? 0 : compter(ctx.volumes.achats, [0, 12, 60, 400]);
  const liste: Achat[] = [];
  for (let i = 1; i <= n; i += 1) {
    const f = h.choix(fournisseurs);
    const [article, prix] = h.choix(ARTICLES_ACHAT);
    const commandeLe = ajouterJours(ctx.aujourdhui, -h.entier(1, 360));
    const retard = h.pondere([[0, 6], [1, 2], [2, 1.5], [4, 1]] as const);
    const recu = ajouterJours(commandeLe, f.delaiAnnonceJours + retard);
    const quantite = h.pondere([[5, 3], [10, 3], [20, 2], [50, 1]] as const);
    const unite = centimes(prix * h.choix([0.92, 1, 1, 1.05]));
    liste.push({
      id: `a-${String(i).padStart(4, '0')}`,
      fournisseurId: f.id,
      commandeLe,
      recuLe: recu <= ctx.aujourdhui ? recu : null,
      article,
      quantite,
      prixUnitaireCents: unite,
      totalCents: unite * quantite,
      conforme: h.chance(0.93),
    });
  }
  return liste.sort((a, b) => b.commandeLe.localeCompare(a.commandeLe));
}

/* -------------------------------- Avis -------------------------------- */

export function genererAvis(ctx: Contexte, clients: readonly FicheClient[]): Avis[] {
  const h = hasard(graineDe(ctx.graine, 'avis'));
  const n = clients.length === 0 ? 0 : compter(ctx.volumes.avis, [0, 5, 30, 220]);
  const liste: Avis[] = [];
  for (let i = 1; i <= n; i += 1) {
    const c = h.choix(clients);
    const note = h.pondere([[5, 62], [4, 25], [3, 9], [2, 3], [1, 1]] as const);
    const texte = note >= 5 ? h.choix(TEXTES_AVIS_POSITIFS) : note === 4 ? h.choix([...TEXTES_AVIS_POSITIFS, ...TEXTES_AVIS_MOYENS]) : note === 3 ? h.choix(TEXTES_AVIS_MOYENS) : h.choix(TEXTES_AVIS_NEGATIFS);
    liste.push({
      id: `v-${String(i).padStart(4, '0')}`,
      clientId: c.id,
      clientNom: c.company || c.name,
      noteSur5: note,
      recommandation: h.chance(0.7) ? Math.max(0, Math.min(10, note * 2 + h.entier(-1, 0))) : null,
      texte,
      date: ajouterJours(ctx.aujourdhui, -Math.floor(h.reel() ** 1.4 * 360)),
      themes: h.echantillon(THEMES_AVIS, h.entier(1, 2)),
      canal: h.pondere([['courriel', 5], ['lien public', 3], ['message', 2]] as const),
    });
  }
  return liste.sort((a, b) => b.date.localeCompare(a.date));
}

/* -------------------- Santé et statut des clients -------------------- */

const moyenne = (l: readonly number[]): number => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);

/**
 * La santé 0 à 100 d'un client — la FORMULE PROPOSÉE par H05 (« à confirmer dans
 * le code ») : 40 % délai de paiement, 25 % réactivité, 20 % activité, 15 %
 * satisfaction.
 */
export function calculerSante(
  client: Pick<FicheClient, 'id' | 'dernierEchangeAt'>,
  donnees: { factures: readonly Facture[]; devis: readonly Devis[]; avis: readonly Avis[] },
  aujourdhui: Jour,
): number {
  const emises = donnees.factures.filter((f) => f.clientId === client.id && (f.status === 'issued' || f.status === 'paid'));
  const retards = emises.map((f) => {
    const fin = f.status === 'paid' ? f.paidAt : aujourdhui > f.dueAt ? aujourdhui : f.dueAt;
    return Math.max(0, ecartJours(f.dueAt, fin));
  });
  const delai = Math.max(0, 100 - (moyenne(retards) * 100) / 30);
  const reactivite = Math.max(0, 100 - (ecartJours(jourDe(Date.parse(client.dernierEchangeAt)), aujourdhui) * 100) / 30);
  const depuis = ajouterJours(aujourdhui, -90);
  const activite = Math.min(
    100,
    35 * (emises.filter((f) => f.issuedAt >= depuis).length + donnees.devis.filter((d) => d.clientId === client.id && d.createdAt.slice(0, 10) >= depuis).length),
  );
  const avis = donnees.avis.filter((a) => a.clientId === client.id);
  const satisfaction = avis.length ? (moyenne(avis.map((a) => a.noteSur5)) / 5) * 100 : 60;
  return Math.round(0.4 * delai + 0.25 * reactivite + 0.2 * activite + 0.15 * satisfaction);
}

/** Pose santé, statut affiché et dernier échange, une fois le reste du monde construit. */
export function finaliserClients(
  clients: FicheClient[],
  donnees: { factures: readonly Facture[]; devis: readonly Devis[]; avis: readonly Avis[]; evenements: readonly Evenement[] },
  aujourdhui: Jour,
  maintenant: number,
): void {
  for (const c of clients) {
    // Le dernier échange tient compte d'un rendez-vous passé avec ce client.
    const dernierRdv = donnees.evenements
      .filter((e) => e.clientId === c.id && Date.parse(e.startAt) <= maintenant && e.status !== 'cancelled' && !e.systeme)
      .map((e) => Date.parse(e.startAt))
      .sort((a, b) => b - a)[0];
    if (dernierRdv && dernierRdv > Date.parse(c.dernierEchangeAt)) c.dernierEchangeAt = iso(dernierRdv);
    c.sante = calculerSante(c, donnees, aujourdhui);
    const impaye = donnees.factures.some((f) => f.clientId === c.id && f.status === 'issued' && f.dueAt < aujourdhui);
    const depuisEchange = ecartJours(jourDe(Date.parse(c.dernierEchangeAt)), aujourdhui);
    const statut: StatutClientAffiche = impaye ? 'Impayé' : depuisEchange > 5 || c.sante < 45 ? 'À relancer' : 'Actif';
    c.statutAffiche = statut;
  }
}

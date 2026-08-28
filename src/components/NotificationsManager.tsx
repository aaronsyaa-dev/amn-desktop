import { useEffect, useRef, useState } from 'react';
import { IS_BUSINESS } from '../edition/edition';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useSync, useCollection } from '../state/SyncContext';
import { useMessages } from '../state/useMessages';
import { useProfiles } from '../state/ProfilesContext';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../shared/api';
import { useParcInsights } from '../state/parcInsights';

interface TaskLike {
  id: string;
  title: string;
  assigneeEmail: string;
}

/**
 * Watches the live data streams and raises native OS notifications for the
 * few genuinely important events — respecting the user's per-event
 * preferences (Settings) and de-duping so pre-existing data on load never
 * fires. Renders nothing. The main process shows the notification so it
 * surfaces even when the app is in the background.
 */
export function NotificationsManager() {
  const { user } = useAuth();
  const { profileFor } = useProfiles();
  const { sites, eventsBySite } = useRemoteSites();
  const { ready, isLocalWrite } = useSync();
  const { messages } = useMessages();
  const tasks = useCollection<TaskLike>('tasks');

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  /*
    LE RELEVÉ DU PARC, EN ARRIÈRE-PLAN (BLOC G)

    `background: true` parce qu'un surveillant qui ne tourne que fenêtre
    visible n'annonce jamais rien qu'Aaron n'aurait pas vu de toute façon —
    voir state/parcInsights.ts. C'est le seul abonné qui le demande.
  */
  const parc = useParcInsights({ background: true });

  const seenAlerts = useRef<Set<number>>(new Set());
  /**
   * Les incidents déjà annoncés. Une campagne de vingt alertes ne doit sonner
   * qu'une fois — voir l'effet des alertes critiques plus bas.
   */
  const seenIncidents = useRef<Set<string>>(new Set());
  /** État du parc au tour précédent : connexions, et date de dernière écriture. */
  const parcPrecedent = useRef<Map<string, { connecte: boolean; derniere: string | null }>>(new Map());
  const parcBaseline = useRef(false);
  const seenMessages = useRef<Set<string>>(new Set());
  const seenTasks = useRef<Set<string>>(new Set());
  const prevOffline = useRef<Set<string>>(new Set());
  const baselined = useRef(false);

  useEffect(() => {
    if (!user) return;
    bridge()
      .prefs.get(user.email)
      .then(setPrefs)
      .catch(() => setPrefs(DEFAULT_NOTIFICATION_PREFS));
  }, [user?.email]);

  const notify = (title: string, body: string) => bridge().system.notify({ title, body });

  // Establish the "already seen" baseline once everything has loaded, so we
  // never notify for the history that existed at startup.
  useEffect(() => {
    if (baselined.current || !ready) return;
    for (const events of Object.values(eventsBySite)) {
      for (const e of events) {
        if (e.type !== 'security_alert') continue;
        seenAlerts.current.add(e.id);
        // Et son incident : sans cela, la première alerte NOUVELLE d'un
        // incident déjà en cours au démarrage sonnerait comme s'il était neuf.
        if (e.incidentId) seenIncidents.current.add(e.incidentId);
      }
    }
    for (const m of messages) seenMessages.current.add(m.id);
    for (const t of tasks) seenTasks.current.add(t.id);
    for (const s of sites) if (s.status === 'offline') prevOffline.current.add(s.id);
    baselined.current = true;
  }, [ready, eventsBySite, messages, tasks, sites]);

  /*
    ALERTES CRITIQUES — UNE PAR INCIDENT, PLUS UNE PAR ALERTE.

    Le défaut, mesuré une fois les incidents introduits : une IP qui mitraille
    produit vingt alertes critiques en deux minutes, donc vingt notifications
    système. C'est exactement le bruit qui fait couper les notifications — et
    une fois coupées, la nuit où ça compte, personne n'est prévenu.

    Or ces vingt alertes forment UN incident. On notifie donc la première
    alerte de chaque incident, et on se tait pour les suivantes : le
    regroupement a été fait côté serveur, l'écran n'a qu'à s'en servir.

    Le repli sur `e.id` couvre les alertes sans incident — celles enregistrées
    avant que le rattachement existe, ou dont le rattachement a échoué. Elles
    gardent alors l'ancien comportement, une notification chacune, plutôt que
    de disparaître silencieusement.
  */
  useEffect(() => {
    if (!baselined.current) return;
    for (const [siteId, events] of Object.entries(eventsBySite)) {
      const site = sites.find((s) => s.id === siteId);
      for (const e of events) {
        if (e.type !== 'security_alert' || seenAlerts.current.has(e.id)) continue;
        seenAlerts.current.add(e.id);
        if (!prefs.criticalAlert || e.severity !== 'critical') continue;

        const groupe = e.incidentId ?? `alerte:${e.id}`;
        if (seenIncidents.current.has(groupe)) continue;
        seenIncidents.current.add(groupe);

        notify(`Alerte critique — ${site?.name ?? 'site'}`, e.message || 'Incident de sécurité détecté.');
      }
    }
  }, [eventsBySite, sites, prefs.criticalAlert]);

  /*
    L'ESCALADE — « personne n'a regardé », et le poste est ouvert.

    Cas réel : l'application tourne, l'incident est dans la file, et il y
    reste. La notification d'alerte a déjà eu lieu il y a dix minutes ; celle-ci
    dit autre chose — que le délai est passé et que PERSONNE ne l'a pris. C'est
    le serveur qui compte les minutes, un poste ouvert ne peut pas le déduire
    seul.

    Elle suit la préférence « alerte critique » : une escalade n'est jamais
    autre chose que la suite d'une alerte critique, et quelqu'un qui a coupé
    celles-ci ne veut pas de celles-là.
  */
  useEffect(() => {
    if (IS_BUSINESS) return;
    const off = bridge().remote.onIncidentEscalation((escalade) => {
      if (!prefs.criticalAlert) return;
      notify(escalade.title, escalade.body);
    });
    return off;
  }, [prefs.criticalAlert]);

  // Site went offline.
  useEffect(() => {
    if (!baselined.current) return;
    for (const site of sites) {
      const wasOffline = prevOffline.current.has(site.id);
      if (site.status === 'offline' && !wasOffline) {
        prevOffline.current.add(site.id);
        if (prefs.siteOffline) notify('Site hors ligne', `${site.name} ne répond plus.`);
      } else if (site.status !== 'offline' && wasOffline) {
        prevOffline.current.delete(site.id);
      }
    }
  }, [sites, prefs.siteOffline]);

  // Incoming team message from the other operator.
  useEffect(() => {
    if (!baselined.current || !user) return;
    for (const m of messages) {
      if (seenMessages.current.has(m.id)) continue;
      seenMessages.current.add(m.id);
      if (prefs.mention && m.authorEmail !== user.email) {
        notify(
          `Message de ${profileFor(m.authorEmail).name}`,
          m.body || 'Pièce jointe',
        );
      }
    }
  }, [messages, prefs.mention, user?.email]);

  // A task newly assigned to me by someone else.
  useEffect(() => {
    if (!baselined.current || !user) return;
    for (const t of tasks) {
      if (seenTasks.current.has(t.id)) continue;
      seenTasks.current.add(t.id);
      if (prefs.taskAssigned && t.assigneeEmail === user.email && !isLocalWrite('tasks', t.id)) {
        notify('Nouvelle tâche assignée', t.title);
      }
    }
  }, [tasks, prefs.taskAssigned, user?.email]);

  /*
    L'ACTIVITÉ DES ORGANISATIONS CLIENTES (BLOC G)
    ═════════════════════════════════════════════

    Deux événements seulement, et c'est délibéré. Aaron a demandé d'être
    prévenu de ce qui mérite vraiment son attention — pas de chaque
    micro-mouvement. Une notification par écriture de cliente serait un flux
    continu qu'on apprend à ignorer en trois jours, et le jour où quelque chose
    compte vraiment, elle passerait dans le tas.

      1. UN ESPACE S'OUVRE — la cliente vient de se connecter. C'est le moment
         utile : elle travaille maintenant, donc c'est maintenant qu'une
         question peut arriver.

      2. UNE CLIENTE REPART APRÈS UN SILENCE — plus d'une semaine sans écrire,
         puis une écriture. Un vrai signal de gestion : soit elle revient, soit
         quelque chose s'est débloqué chez elle.

    Ce qui n'est PAS notifié, et pourquoi : chaque écriture (bruit continu),
    chaque déconnexion (elle ferme son ordinateur le soir, ce n'est pas un
    événement), et l'ouverture d'un espace déjà annoncé le jour même.

    ## Le garde-fou : une fois par organisation et par jour

    Il est gardé en `localStorage`, pas en mémoire. Une limite en mémoire
    repartirait à zéro à chaque redémarrage de l'application — donc relancer
    l'app trois fois dans la matinée renotifierait trois fois pour la même
    cliente, ce qui est exactement le bruit qu'on veut éviter.
  */
  const dejaNotifie = (orgId: string): boolean => {
    const jour = new Date().toISOString().slice(0, 10);
    try {
      const cle = `amn.notif.parc.${orgId}`;
      if (window.localStorage.getItem(cle) === jour) return true;
      window.localStorage.setItem(cle, jour);
      return false;
    } catch {
      // Stockage indisponible : on préfère notifier que se taire. Une
      // notification en trop se remarque ; une notification manquée, non.
      return false;
    }
  };

  useEffect(() => {
    if (!parc.data) return;

    // Le premier relevé sert de repère, jamais de déclencheur : au lancement,
    // toutes les clientes connectées paraîtraient « venir de se connecter ».
    if (!parcBaseline.current) {
      for (const org of parc.data.orgs) {
        parcPrecedent.current.set(org.id, {
          connecte: org.connections > 0,
          derniere: org.lastActivityAt,
        });
      }
      parcBaseline.current = true;
      return;
    }

    const SEMAINE_MS = 7 * 24 * 60 * 60 * 1000;
    for (const org of parc.data.orgs) {
      const avant = parcPrecedent.current.get(org.id);
      const connecte = org.connections > 0;
      parcPrecedent.current.set(org.id, { connecte, derniere: org.lastActivityAt });
      if (!avant) continue; // organisation apparue en cours de route

      if (prefs.clientActivity && connecte && !avant.connecte && !dejaNotifie(org.id)) {
        notify('Espace client ouvert', `${org.name} vient de se connecter.`);
        continue; // une seule notification par organisation et par tour
      }

      const aEcrit = org.lastActivityAt && org.lastActivityAt !== avant.derniere;
      const silenceAvant = avant.derniere
        ? Date.now() - new Date(avant.derniere).getTime() > SEMAINE_MS
        : true;
      if (prefs.clientActivity && aEcrit && silenceAvant && !dejaNotifie(org.id)) {
        notify(
          'Reprise d’activité',
          `${org.name} a repris après plus d’une semaine sans activité.`,
        );
      }
    }
  }, [parc.data, prefs.clientActivity]);

  return null;
}

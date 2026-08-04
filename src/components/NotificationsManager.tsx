import { useEffect, useRef, useState } from 'react';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useSync, useCollection } from '../state/SyncContext';
import { useMessages } from '../state/useMessages';
import { useProfiles } from '../state/ProfilesContext';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../shared/api';

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

  const seenAlerts = useRef<Set<number>>(new Set());
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
      for (const e of events) if (e.type === 'security_alert') seenAlerts.current.add(e.id);
    }
    for (const m of messages) seenMessages.current.add(m.id);
    for (const t of tasks) seenTasks.current.add(t.id);
    for (const s of sites) if (s.status === 'offline') prevOffline.current.add(s.id);
    baselined.current = true;
  }, [ready, eventsBySite, messages, tasks, sites]);

  // Critical security alerts.
  useEffect(() => {
    if (!baselined.current) return;
    for (const [siteId, events] of Object.entries(eventsBySite)) {
      const site = sites.find((s) => s.id === siteId);
      for (const e of events) {
        if (e.type !== 'security_alert' || seenAlerts.current.has(e.id)) continue;
        seenAlerts.current.add(e.id);
        if (prefs.criticalAlert && e.severity === 'critical') {
          notify(`Alerte critique — ${site?.name ?? 'site'}`, e.message || 'Incident de sécurité détecté.');
        }
      }
    }
  }, [eventsBySite, sites, prefs.criticalAlert]);

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

  return null;
}

import { useEffect, useRef, useState } from 'react';
import { bridge } from '../lib/bridge';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../shared/api';
import { useAppointments } from '../state/useAppointments';
import { useAuth } from '../auth/AuthContext';
import { relativeToNow, timeLabel } from '../lib/calendar';

/** Fréquence de balayage. Une minute suffit : les préavis sont en minutes. */
const SWEEP_MS = 60_000;

/** Au-delà, le rappel est considéré comme manqué et n'est plus émis. */
const LATE_TOLERANCE_MS = 5 * 60_000;

const FIRED_KEY = 'amn.agenda.reminders.fired';

/**
 * Rappels avant rendez-vous.
 *
 * Monté par la coquille Business, sans interface : il balaie les rendez-vous
 * une fois par minute et déclenche une notification système quand le préavis
 * choisi est atteint.
 *
 * ## Deux garde-fous, appris des notifications de l'édition interne
 *
 * 1. **Un rappel déjà émis n'est pas réémis** — la liste des identifiants
 *    notifiés est conservée en `localStorage`, donc un redémarrage de l'app ne
 *    refait pas sonner tous les rendez-vous du jour.
 * 2. **Un rappel en retard de plus de cinq minutes est abandonné** — ouvrir
 *    l'app le soir ne doit pas déclencher d'un coup les rappels de la journée
 *    écoulée. Sans cette borne, la première notification serait toujours du
 *    bruit, et on apprendrait vite à les ignorer.
 */
export function AppointmentReminders() {
  const { appointments } = useAppointments();
  const appointmentsRef = useRef(appointments);
  appointmentsRef.current = appointments;

  /*
    LE RÉGLAGE EST LU, ET C'EST NEUF.

    Ce composant notifiait sans jamais consulter les préférences. Conséquence
    côté cliente : l'écran des notifications proposait quatre interrupteurs qui
    ne changeaient rien, et le seul rappel qu'elle recevait vraiment — celui-ci
    — n'en avait aucun. Elle ne pouvait donc ni l'éteindre, ni comprendre à
    quoi servaient ceux qu'on lui montrait.

    Lu par email plutôt que passé en propriété : c'est la même clé que l'écran
    des Paramètres écrit, donc le réglage vaut sans qu'on ait à relier les deux.
  */
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const { user } = useAuth();
  const email = user?.email ?? '';
  useEffect(() => {
    if (!email) return;
    let vivant = true;
    void bridge()
      .prefs.get(email)
      .then((p) => vivant && setPrefs(p))
      .catch(() => {
        /* réglages illisibles : on garde les valeurs par défaut, donc le rappel */
      });
    return () => {
      vivant = false;
    };
  }, [email]);

  useEffect(() => {
    const readFired = (): Set<string> => {
      try {
        const raw = window.localStorage.getItem(FIRED_KEY);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        return new Set();
      }
    };

    const sweep = () => {
      const fired = readFired();
      const now = Date.now();
      let changed = false;

      if (!prefsRef.current.appointmentReminder) return;

      for (const appointment of appointmentsRef.current) {
        if (appointment.status !== 'scheduled') continue;
        if (appointment.reminderMin <= 0) continue;
        if (fired.has(appointment.id)) continue;

        const start = new Date(appointment.startAt).getTime();
        const dueAt = start - appointment.reminderMin * 60_000;
        if (now < dueAt) continue;
        if (now > dueAt + LATE_TOLERANCE_MS) {
          // Trop tard pour être utile : on marque quand même comme émis, sinon
          // ce rendez-vous serait réexaminé à chaque balayage jusqu'à son heure.
          fired.add(appointment.id);
          changed = true;
          continue;
        }

        bridge().system.notify({
          title: `Rendez-vous ${relativeToNow(appointment.startAt)}`,
          body: [
            `${timeLabel(appointment.startAt)} — ${appointment.title || 'Rendez-vous'}`,
            appointment.clientName,
            appointment.location,
          ]
            .filter(Boolean)
            .join(' · '),
        });
        fired.add(appointment.id);
        changed = true;
      }

      // La liste ne garde que les rendez-vous encore connus : sans ce ménage,
      // elle grossirait indéfiniment au fil des mois.
      if (changed) {
        const known = new Set(appointmentsRef.current.map((a) => a.id));
        const kept = [...fired].filter((id) => known.has(id));
        try {
          window.localStorage.setItem(FIRED_KEY, JSON.stringify(kept));
        } catch {
          /* quota — les rappels de cette session restent corrects en mémoire */
        }
      }
    };

    sweep();
    const timer = window.setInterval(sweep, SWEEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}

import { useEffect, useRef } from 'react';
import { useSync, type RemoteChange } from '../state/SyncContext';
import { useToast } from '../state/ToastContext';
import { useProfiles } from '../state/ProfilesContext';
import { useAuth } from '../auth/AuthContext';
import type { SyncedCollection } from '../shared/api';

/**
 * Partie 3 — a discreet, coalesced "sync is alive" signal.
 *
 * When the OTHER operator changes shared data, amn-api pushes it over the
 * WebSocket. Rather than one notification per record (noisy), we buffer live
 * remote changes for a short window and raise a SINGLE summary toast, e.g.
 * « Mohamed · 3 mises à jour (2 tâches, 1 décision) ». This confirms, without
 * getting in the way, that collaboration is syncing in real time.
 *
 * Messages and profiles are intentionally excluded: incoming team messages
 * already raise their own (OS) notification, and profile churn is low-value.
 */
const LABELS: Partial<Record<SyncedCollection, [string, string]>> = {
  tasks: ['tâche', 'tâches'],
  decisions: ['décision', 'décisions'],
  knowledge: ['note', 'notes'],
  objectives: ['objectif', 'objectifs'],
};

const COALESCE_MS = 2500;
/*
  Quand l'équipe est très active, la fenêtre s'allonge : au-delà de trois
  résumés dans la minute, on n'en montre plus qu'un toutes les trente
  secondes. Mesuré (simulation S1, 25 personnes) : un toast toutes les 2,5 s,
  chacun visible 6 s — le coin de l'écran ne se vidait jamais.
*/
const COALESCE_CHARGE_MS = 30_000;
const SEUIL_CHARGE = 3;

export function SyncActivityNotifier() {
  const { onRemoteChange, onlineEmails } = useSync();
  const { notify } = useToast();
  const { profileFor } = useProfiles();
  const { user } = useAuth();

  const buffer = useRef<RemoteChange[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumes = useRef<number[]>([]);

  // Latest values in refs so the stable subscription always sees current data.
  const onlineRef = useRef(onlineEmails);
  onlineRef.current = onlineEmails;
  const emailRef = useRef(user?.email);
  emailRef.current = user?.email;
  const profileForRef = useRef(profileFor);
  profileForRef.current = profileFor;

  useEffect(() => {
    const flush = () => {
      timer.current = null;
      const changes = buffer.current;
      buffer.current = [];
      if (changes.length === 0) return;

      // Count per relevant collection.
      const counts = new Map<SyncedCollection, number>();
      for (const c of changes) {
        if (!LABELS[c.collection]) continue;
        counts.set(c.collection, (counts.get(c.collection) ?? 0) + 1);
      }
      if (counts.size === 0) return;

      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      const parts = [...counts.entries()].map(([col, n]) => {
        const [one, many] = LABELS[col] ?? ['élément', 'éléments'];
        return `${n} ${n > 1 ? many : one}`;
      });

      // Attribute to the other operator when exactly one other is online.
      const others = [...onlineRef.current].filter((e) => e !== emailRef.current);
      const who = others.length === 1 ? profileForRef.current(others[0]).name : 'L’équipe';

      resumes.current.push(Date.now());
      notify({
        tone: 'sync',
        title: `${who} · ${total > 1 ? `${total} mises à jour` : '1 mise à jour'}`,
        body: parts.join(' · '),
      });
    };

    const off = onRemoteChange((change) => {
      if (change.deleted && !LABELS[change.collection]) return;
      buffer.current.push(change);
      if (!timer.current) {
        const recents = resumes.current.filter((t) => Date.now() - t < 60_000);
        resumes.current = recents;
        timer.current = setTimeout(flush, recents.length >= SEUIL_CHARGE ? COALESCE_CHARGE_MS : COALESCE_MS);
      }
    });

    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [onRemoteChange, notify]);

  return null;
}

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bridge } from '../lib/bridge';
import { useToast } from '../state/ToastContext';

/**
 * Surfaces a regression from a scheduled Scanner / Comply run (BLOC 5).
 *
 * The comparison itself happens on amn-api, so a weekly scan still runs and
 * still detects a drop while every desktop is closed. This component is only
 * the arrival end: when the app is open it raises an in-app toast, and it also
 * fires an OS notification so the news reaches the operator with the window in
 * the tray — which is the situation a weekly automatic scan is designed for.
 *
 * Regression notices are the one product alert we deliberately do NOT
 * de-duplicate away: a score that keeps dropping week after week should keep
 * saying so.
 */
export function RegressionNotifier() {
  const { notify } = useToast();
  const navigate = useNavigate();
  // Same notice re-delivered on a reconnect must not toast twice.
  const seen = useRef(new Set<string>());

  useEffect(() => {
    return bridge().remote.onProductRegression((regression) => {
      const key = `${regression.kind}:${regression.runId}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);

      const title =
        regression.kind === 'scan' ? 'Score de sécurité en baisse' : 'Conformité en recul';

      notify({
        title,
        body: regression.message,
        durationMs: 12_000,
        onClick: () => navigate(regression.kind === 'scan' ? '/scanner' : '/comply'),
      });

      try {
        bridge().system.notify({ title, body: regression.message });
      } catch {
        /* no native notifications on this platform — the toast already fired */
      }
    });
  }, [notify, navigate]);

  return null;
}

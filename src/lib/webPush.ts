/**
 * Web Push subscription for the PWA (A.3).
 *
 * A closed PWA has no page and no WebSocket, so nothing in the app can learn
 * that a call is coming in. A push woken service worker is the only mechanism
 * that can, which is why an incoming call on a phone previously produced
 * nothing at all — no sound, no notification.
 *
 * Electron does not need any of this: it has a real process and native
 * notifications, so the whole module no-ops there.
 */

import { isElectron } from './platform';

const SUBSCRIBED_KEY = 'amn.push.subscribedFor';

function base64UrlToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = window.atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushSetupResult {
  ok: boolean;
  /** Why it did not happen, for an honest message in Paramètres. */
  reason?:
    | 'electron'
    | 'unsupported'
    | 'denied'
    | 'no-key'
    | 'not-configured'
    | 'error';
  detail?: string;
}

/**
 * Talks to amn-api with the same base URL and web token the browser bridge
 * uses. Read here rather than injected because push is web-only by nature:
 * there is no second implementation to stay agnostic of.
 */
async function pushApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');
  const token =
    import.meta.env.VITE_AMN_API_WEB_TOKEN || import.meta.env.VITE_AMN_API_OPERATOR_TOKEN || '';
  if (!apiUrl) throw new Error('amn-api non configurée');
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`amn-api ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/**
 * Subscribes this browser install to push for `email`, asking for permission if
 * needed. Idempotent: re-running with the same operator does nothing.
 */
export async function ensurePushSubscription(
  email: string,
  options: { force?: boolean } = {},
): Promise<PushSetupResult> {
  if (isElectron()) return { ok: false, reason: 'electron' };
  if (!email) return { ok: false, reason: 'not-configured' };

  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    typeof Notification === 'undefined'
  ) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    if (!options.force && window.localStorage.getItem(SUBSCRIBED_KEY) === email) {
      return { ok: true };
    }
  } catch {
    /* private mode — just re-subscribe, it is idempotent server-side */
  }

  try {
    // Permission must be requested from a user gesture on iOS; callers wire
    // this to an explicit button in Paramètres for exactly that reason.
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const { key, enabled } = await pushApiFetch<{ key: string | null; enabled: boolean }>(
      '/v1/push/key',
    );
    if (!enabled || !key) return { ok: false, reason: 'no-key' };

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push that cannot be shown is refused.
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(key),
      }));

    await pushApiFetch('/v1/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email, subscription: subscription.toJSON() }),
    });

    try {
      window.localStorage.setItem(SUBSCRIBED_KEY, email);
    } catch {
      /* ignore */
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Asks amn-api to push a test notification to this operator's devices.
 * The returned count is what makes the Paramètres feedback honest: "envoyée à
 * 2 appareils" versus "aucun appareil enregistré".
 */
export async function sendPushTest(email: string): Promise<{ sent: number; disabled: boolean }> {
  return pushApiFetch<{ sent: number; disabled: boolean }>('/v1/push/test', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Shows a notification the way the platform actually allows.
 *
 * On Android, `new Notification()` from a page throws (`Illegal constructor`) —
 * a PWA must go through `ServiceWorkerRegistration.showNotification`. The old
 * code used the constructor only, which is why notifications silently did
 * nothing on the phone while working on desktop browsers.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  options: { kind?: string; vibrate?: number[] } = {},
): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  try {
    if (Notification.permission !== 'granted') {
      if (Notification.permission === 'denied') return false;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: './icon.png',
          badge: './icon.png',
          tag: options.kind ?? 'amn',
          ...(options.vibrate ? { vibrate: options.vibrate } : {}),
        } as NotificationOptions);
        return true;
      }
    }

    // Desktop browsers with no service worker registered yet.
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

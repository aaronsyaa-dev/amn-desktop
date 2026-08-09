import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Bot, Camera, Check, Download, ExternalLink, Info, KeyRound, Loader2, Power, RefreshCw, UserCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useAssistant } from '../assistant/AssistantContext';
import { bridge } from '../lib/bridge';
import { downloadBackup } from '../lib/backup';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { ensurePushSubscription, sendPushTest } from '../lib/webPush';
import { UserAvatar } from '../components/UserAvatar';
import { Logo } from '../components/Logo';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { CHANGELOG, CURRENT_VERSION } from '../data/changelog';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../shared/api';

export function SettingsScreen() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Paramètres</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            Profil · sécurité · notifications
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        <ProfileSection email={user.email} />
      </StaggerItem>
      <StaggerItem>
        <PasswordSection email={user.email} />
      </StaggerItem>
      <StaggerItem>
        <NotificationsSection email={user.email} />
      </StaggerItem>
      {!bridge().env.isElectron && (
        <StaggerItem>
          <PushSection email={user.email} />
        </StaggerItem>
      )}
      {bridge().env.isElectron && (
        <StaggerItem>
          <OllamaSection />
        </StaggerItem>
      )}
      {bridge().env.isElectron && (
        <StaggerItem>
          <StartupSection />
        </StaggerItem>
      )}
      <StaggerItem>
        <BackupSection />
      </StaggerItem>
      <StaggerItem>
        <AboutSection />
      </StaggerItem>
    </StaggerGroup>
  );
}

function BackupSection() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    setDone(false);
    try {
      await downloadBackup();
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      icon={Download}
      title="Sauvegarde"
      subtitle="Exportez une copie complète de vos données (clients, devis, tâches, messages…) dans un fichier."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          Le fichier JSON contient un instantané de l’espace de travail, à conserver en lieu sûr.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="flex items-center gap-2 border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : done ? <Check size={14} /> : <Download size={14} />}
          {busy ? 'Export…' : done ? 'Exporté' : 'Exporter une sauvegarde'}
        </button>
      </div>
    </Panel>
  );
}

function AboutSection() {
  const [version, setVersion] = useState(CURRENT_VERSION);

  useEffect(() => {
    let active = true;
    bridge()
      .system.getAppInfo()
      .then((info) => {
        if (active && info?.version && info.version !== '0.0.0-dev') setVersion(info.version);
      })
      .catch(() => {
        /* keep the changelog version */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Panel icon={Info} title="À propos" subtitle="Version, historique des mises à jour et identité de l’application.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-2">
            <Logo height={30} showAppName />
            <p className="text-xs text-text-muted">
              Poste de commandement AMN DEVSEC — supervision, équipe et clients.
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Version</p>
            <p className="font-mono text-lg font-semibold text-text-primary">{version}</p>
          </div>
        </div>

        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Historique des versions
          </p>
          <div className="space-y-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="border-l border-border pl-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary">{entry.version}</span>
                  <span className="font-mono text-[11px] text-text-muted">{entry.date}</span>
                  {entry.title && <span className="text-xs text-text-secondary">— {entry.title}</span>}
                </div>
                <ul className="mt-1.5 space-y-1">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex gap-2 text-xs text-text-secondary">
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function StartupSection() {
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bridge()
      .system.getAutoLaunch()
      .then((v) => active && setAutoLaunch(v))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const toggle = async () => {
    const next = !autoLaunch;
    setAutoLaunch(next); // optimistic
    const confirmed = await bridge().system.setAutoLaunch(next);
    setAutoLaunch(confirmed);
  };

  return (
    <Panel
      icon={Power}
      title="Démarrage"
      subtitle="Lancer AMN Desktop automatiquement, discrètement en arrière-plan."
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Démarrer avec Windows</p>
            <p className="text-xs text-text-muted">
              L’app démarre en arrière-plan à l’ouverture de session et reste dans la barre système.
            </p>
          </div>
          <Toggle on={autoLaunch} onClick={toggle} />
        </div>
      )}
    </Panel>
  );
}

function OllamaSection() {
  const { ollamaAvailable, ollamaModels, ollamaModel, setOllamaModel, refreshOllama } = useAssistant();
  const [checking, setChecking] = useState(false);

  const recheck = () => {
    setChecking(true);
    refreshOllama();
    window.setTimeout(() => setChecking(false), 900);
  };

  return (
    <Panel
      icon={Bot}
      title="Ajmani — modèle local (Ollama)"
      subtitle="Ajmani utilise un modèle qui tourne sur votre machine, gratuitement et en privé. Sinon, le moteur intégré prend le relais."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${ollamaAvailable ? 'bg-success' : 'border border-text-muted bg-transparent'}`}
            />
            <span className="text-sm text-text-primary">
              {ollamaAvailable ? 'Ollama détecté' : 'Ollama non détecté'}
            </span>
            {ollamaAvailable && (
              <span className="font-mono text-[11px] text-text-muted">
                · {ollamaModels.length} modèle{ollamaModels.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={recheck}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            Vérifier
          </button>
        </div>

        {ollamaAvailable && ollamaModels.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Modèle utilisé</span>
            <select
              value={ollamaModel ?? ''}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="input-focus cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              {ollamaModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-xs text-text-muted">
              L’assistant répond désormais via ce modèle, ancré sur vos données de parc réelles.
            </span>
          </label>
        ) : ollamaAvailable ? (
          <p className="text-sm text-text-secondary">
            Ollama tourne mais aucun modèle n’est installé. Dans un terminal :{' '}
            <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-text-primary">ollama pull llama3.2</code>
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
            <p>
              Installez Ollama, puis téléchargez un modèle léger, par ex.{' '}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-text-primary">
                ollama pull llama3.2
              </code>
              . L’app le détectera automatiquement.
            </p>
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-text-primary underline decoration-border underline-offset-2 hover:decoration-text-primary"
            >
              <ExternalLink size={12} /> ollama.com
            </a>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Panel({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <Icon size={16} strokeWidth={1.75} className="text-text-secondary" />
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ProfileSection({ email }: { email: string }) {
  const { profileFor, updateSelf } = useProfiles();
  const profile = profileFor(email);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [presenceText, setPresenceText] = useState(profile.presenceText);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setPresenceText(profile.presenceText);
  }, [profile.email, profile.name, profile.presenceText]);

  const flashSaved = () => {
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 1200);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file, 512, 0.85);
    await updateSelf(email, { photoDataUrl: dataUrl });
    flashSaved();
  };

  const saveName = async () => {
    if (name.trim() && name !== profile.name) {
      await updateSelf(email, { name: name.trim() });
      flashSaved();
    }
  };
  const savePresence = async () => {
    if (presenceText !== profile.presenceText) {
      await updateSelf(email, { presenceText: presenceText.trim() });
      flashSaved();
    }
  };

  return (
    <Panel icon={UserCircle} title="Profil" subtitle="Votre photo et votre nom, visibles par l’équipe partout dans l’app.">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative overflow-hidden rounded-full"
            title="Changer la photo"
          >
            <UserAvatar email={email} size={88} ring />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={20} strokeWidth={1.75} className="text-white" />
            </span>
          </button>
          {profile.photoDataUrl && (
            <button
              type="button"
              onClick={async () => {
                await updateSelf(email, { photoDataUrl: '' });
                flashSaved();
              }}
              className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-danger"
            >
              Retirer
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex-1 space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Nom affiché</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Statut personnalisé (optionnel)
            </span>
            <input
              value={presenceText}
              onChange={(e) => setPresenceText(e.target.value)}
              onBlur={savePresence}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              maxLength={60}
              placeholder="ex. en mission chez client"
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>
          <p className="font-mono text-[11px] text-text-muted">{email}</p>
          {savedTick && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 text-xs text-success"
            >
              <Check size={13} strokeWidth={2.25} /> Enregistré
            </motion.p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function PasswordSection({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: 'La confirmation ne correspond pas.' });
      return;
    }
    setBusy(true);
    try {
      const res = await bridge().auth.changePassword({ email, currentPassword: current, newPassword: next });
      if (res.ok) {
        setMsg({ ok: true, text: 'Mot de passe mis à jour.' });
        setCurrent('');
        setNext('');
        setConfirm('');
      } else {
        setMsg({ ok: false, text: res.error ?? 'Échec de la mise à jour.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
      />
    </label>
  );

  return (
    <Panel icon={KeyRound} title="Mot de passe" subtitle="Changez votre mot de passe (minimum 8 caractères).">
      <div className="grid gap-3 sm:grid-cols-3">
        {field('Actuel', current, setCurrent)}
        {field('Nouveau', next, setNext)}
        {field('Confirmer', confirm, setConfirm)}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !current || !next || !confirm}
          className="flex items-center gap-2 bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Mettre à jour
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</span>}
      </div>
    </Panel>
  );
}

const PREF_LABELS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'siteOffline', label: 'Site hors ligne', detail: 'Un site supervisé ne répond plus.' },
  { key: 'criticalAlert', label: 'Alerte critique', detail: 'Attaque ou incident critique détecté.' },
  { key: 'mention', label: 'Mention', detail: 'Quelqu’un vous mentionne dans un message.' },
  { key: 'taskAssigned', label: 'Tâche assignée', detail: 'Une tâche vous est attribuée.' },
];

function NotificationsSection({ email }: { email: string }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bridge()
      .prefs.get(email)
      .then((p) => active && setPrefs(p))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [email]);

  const toggle = async (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await bridge().prefs.update(email, { [key]: next[key] });
  };

  return (
    <Panel
      icon={Bell}
      title="Notifications système"
      subtitle="Choisissez les événements qui déclenchent une notification de bureau."
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="divide-y divide-border/60">
          {PREF_LABELS.map(({ key, label, detail }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-muted">{detail}</p>
              </div>
              <Toggle on={prefs[key]} onClick={() => toggle(key)} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Push notifications on mobile / PWA (A.3).
 *
 * Only shown on the web build: Electron has real OS notifications and needs
 * none of this. The button is deliberate rather than automatic because both
 * iOS and Android require the permission prompt to come from a user gesture —
 * asking on page load is silently refused, which is one of the reasons an
 * incoming call produced nothing at all on a phone.
 */
function PushSection({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'on' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Already granted on a previous visit: re-register silently. A push
  // subscription can be rotated by the browser, so this must not be one-shot.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    void ensurePushSubscription(email).then((r) => {
      if (r.ok) setState('on');
    });
  }, [email]);

  const enable = async () => {
    setState('working');
    setMessage('');
    const result = await ensurePushSubscription(email, { force: true });
    if (result.ok) {
      setState('on');
      setMessage('Cet appareil recevra les appels et alertes, même application fermée.');
      return;
    }
    setState('error');
    setMessage(
      {
        denied: 'Notifications refusées pour ce site — réautorisez-les dans les réglages du navigateur.',
        unsupported: 'Ce navigateur ne gère pas les notifications push.',
        'no-key': 'Le serveur AMN n’a pas de clé VAPID configurée : les push sont désactivées côté serveur.',
        'not-configured': 'Session incomplète — reconnectez-vous.',
        electron: '',
        error: result.detail || 'Échec de l’enregistrement.',
      }[result.reason ?? 'error'] || 'Échec de l’enregistrement.',
    );
  };

  const test = async () => {
    try {
      const { sent, disabled } = await sendPushTest(email);
      setMessage(
        disabled
          ? 'Push désactivées côté serveur (clé VAPID absente).'
          : sent > 0
            ? `Notification de test envoyée à ${sent} appareil${sent > 1 ? 's' : ''}.`
            : 'Aucun appareil enregistré pour ce compte.',
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Échec du test.');
    }
  };

  return (
    <Panel
      icon={Bell}
      title="Notifications sur cet appareil"
      subtitle="Nécessaire pour être prévenu d’un appel entrant quand l’application est fermée."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void enable()}
          disabled={state === 'working'}
          className="rounded-lg border border-border-strong px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-primary transition-colors hover:bg-accent-muted disabled:opacity-50"
        >
          {state === 'on' ? 'Réenregistrer cet appareil' : 'Activer les notifications'}
        </button>
        {state === 'on' && (
          <button
            type="button"
            onClick={() => void test()}
            className="rounded-lg border border-border px-3 py-2 text-xs uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary"
          >
            Envoyer un test
          </button>
        )}
      </div>
      {message && (
        <p className={`mt-3 text-xs ${state === 'error' ? 'text-danger' : 'text-text-muted'}`}>
          {message}
        </p>
      )}
    </Panel>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors ${
        on ? 'border-accent bg-accent' : 'border-border-strong bg-transparent'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full ${on ? 'right-0.5 bg-bg' : 'left-0.5 bg-text-muted'}`}
      />
    </button>
  );
}

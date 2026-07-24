import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Camera, Check, KeyRound, Loader2, UserCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { bridge } from '../lib/bridge';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { UserAvatar } from '../components/UserAvatar';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
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
    </StaggerGroup>
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
